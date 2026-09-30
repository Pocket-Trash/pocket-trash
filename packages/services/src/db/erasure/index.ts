import type {
  Database,
  ErasureInitiator,
  ErasureRequest,
  ErasureRetentionException,
  ErasureStepResults,
  ErasureVerificationMethod,
} from "@package/database";
import { schema } from "@package/database";
import type { Logger } from "@package/logger";
import { loggerMessages } from "@package/logger";
import { and, asc, eq, inArray, lte, or, sql } from "drizzle-orm";
import {
  DatabaseErasureVerificationError,
  eraseAccountDatabaseData,
} from "./database.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const LEASE_MS = 30 * 60 * 1000;
const RECEIPT_MS = 30 * DAY_MS;
const ADMIN_ERASURE_URL = "https://pocket-trash.app/admin/account-erasure";
const errorCodePattern = /^[a-z0-9_]{1,64}$/u;
const subjectHmacPattern = /^[0-9a-f]{64}$/u;
const verificationReferencePattern = /^[A-Za-z0-9:_-]{1,120}$/u;

const exceptionMaximumMs = {
  axiom_30_days: 30 * DAY_MS,
  bunny_cache_30_days: 30 * DAY_MS,
  bunny_logs_3_days: 3 * DAY_MS,
  clerk_logs_30_days: 30 * DAY_MS,
  cloudflare_logs_7_days: 7 * DAY_MS,
  neon_history_6_hours: 6 * 60 * 60 * 1000,
  vercel_logs_1_hour: 60 * 60 * 1000,
} as const;

const operationSteps = [
  "snapshot",
  "inaccessible",
  "storage",
  "database",
  "providers",
  "verify",
] as const;

export type ApprovedErasureExceptionCode = keyof typeof exceptionMaximumMs;

export type ErasureReceipt = Omit<
  ErasureRequest,
  "storageTargets" | "targetClerkId" | "verifiedByClerkId"
>;

export type ErasureOperationRequest = Pick<
  ErasureRequest,
  "id" | "initiator" | "subjectHmac" | "targetClerkId"
>;

export type ErasureOperationResult = {
  exceptions?: ErasureRetentionException[];
};

export type ErasureOperations = Record<
  (typeof operationSteps)[number],
  (
    request: ErasureOperationRequest,
  ) => Promise<ErasureOperationResult | undefined>
>;

export type ErasureService = ReturnType<typeof createErasureService>;

export class AccountErasureInProgressError extends Error {
  constructor() {
    super("Account erasure is in progress.");
    this.name = "AccountErasureInProgressError";
  }
}

export class ErasureOperationError extends Error {
  constructor(
    readonly code: string,
    readonly retryable = true,
  ) {
    super("Erasure operation failed.");
    this.name = "ErasureOperationError";
    if (!errorCodePattern.test(code)) {
      throw new Error("Invalid erasure error code.");
    }
  }
}

export async function createErasureSubjectHmac(
  clerkId: string,
  secret: string,
): Promise<string> {
  const normalizedClerkId = clerkId.trim();
  if (!normalizedClerkId) throw new Error("Subject is required.");
  if (secret.length < 32) throw new Error("Erasure HMAC secret is invalid.");

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`pocket-trash:erasure:${normalizedClerkId}`),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function createErasureService(
  db: Database,
  logger: Logger,
  now: () => Date = () => new Date(),
) {
  return {
    async assertAccountActive(clerkId: string): Promise<void> {
      const normalizedClerkId = requiredValue(clerkId, "Subject");
      const [request] = await db
        .select({ id: schema.erasureRequest.id })
        .from(schema.erasureRequest)
        .where(
          and(
            eq(schema.erasureRequest.targetClerkId, normalizedClerkId),
            inArray(schema.erasureRequest.status, [
              "pending",
              "running",
              "needs_attention",
            ]),
          ),
        )
        .limit(1);
      if (request) throw new AccountErasureInProgressError();
    },

    async getReceiptBySubject(
      subjectHmac: string,
    ): Promise<ErasureReceipt | null> {
      const [request] = await db
        .select()
        .from(schema.erasureRequest)
        .where(
          eq(
            schema.erasureRequest.subjectHmac,
            normalizeSubjectHmac(subjectHmac),
          ),
        )
        .limit(1);
      return request ? receipt(request) : null;
    },

    async getForAdmin(id: string): Promise<ErasureRequest | null> {
      const [request] = await db
        .select()
        .from(schema.erasureRequest)
        .where(eq(schema.erasureRequest.id, requiredValue(id, "Request")))
        .limit(1);
      return request ?? null;
    },

    async makeAccountInaccessible(targetClerkId: string): Promise<void> {
      await db.transaction(async (tx) => {
        await hideAccountContent(tx, requiredValue(targetClerkId, "Subject"));
      });
    },

    async create(input: {
      initiator: ErasureInitiator;
      subjectHmac: string;
      targetClerkId: string;
      verificationMethod: ErasureVerificationMethod;
      verificationReference?: string;
      verifiedAt: Date;
      verifiedByClerkId: string;
    }): Promise<ErasureReceipt> {
      const values = normalizeCreateInput(input);
      const createdAt = now();
      const request = await logger.operation(
        loggerMessages.database.erasure.create,
        async () =>
          await db.transaction(async (tx) => {
            const [inserted] = await tx
              .insert(schema.erasureRequest)
              .values({
                ...values,
                createdAt,
                nextAttemptAt: createdAt,
                stepResults: initialStepResults(createdAt),
                updatedAt: createdAt,
              })
              .onConflictDoNothing({
                target: schema.erasureRequest.subjectHmac,
              })
              .returning();
            if (inserted) return inserted;

            const [existing] = await tx
              .select()
              .from(schema.erasureRequest)
              .where(eq(schema.erasureRequest.subjectHmac, values.subjectHmac))
              .limit(1);
            if (!existing) throw new Error("Failed to create erasure request.");
            if (
              existing.targetClerkId &&
              existing.targetClerkId !== values.targetClerkId
            ) {
              throw new Error("Erasure request subject mismatch.");
            }
            return existing;
          }),
        { attributes: { initiator: values.initiator } },
      );
      return receipt(request);
    },

    async eraseDatabase(targetClerkId: string): Promise<void> {
      try {
        await eraseAccountDatabaseData(
          db,
          requiredValue(targetClerkId, "Subject"),
        );
      } catch (error) {
        if (error instanceof DatabaseErasureVerificationError) {
          throw new ErasureOperationError(error.code);
        }
        throw error;
      }
    },

    async getReceipt(input: {
      id: string;
      subjectHmac: string;
    }): Promise<ErasureReceipt | null> {
      const [request] = await db
        .select()
        .from(schema.erasureRequest)
        .where(
          and(
            eq(schema.erasureRequest.id, input.id),
            eq(
              schema.erasureRequest.subjectHmac,
              normalizeSubjectHmac(input.subjectHmac),
            ),
          ),
        )
        .limit(1);
      return request ? receipt(request) : null;
    },

    async handleClerkDeletion(input: {
      subjectHmac: string;
      targetClerkId: string;
    }): Promise<{ requestId: string; unexpected: boolean }> {
      const subjectHmac = normalizeSubjectHmac(input.subjectHmac);
      const targetClerkId = requiredValue(input.targetClerkId, "Subject");
      const handledAt = now();
      const result = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(schema.erasureRequest)
          .where(
            or(
              eq(schema.erasureRequest.subjectHmac, subjectHmac),
              eq(schema.erasureRequest.targetClerkId, targetClerkId),
            ),
          )
          .limit(1);

        if (existing) {
          if (
            existing.status !== "completed" &&
            existing.errorCode !== "unexpected_clerk_deletion"
          ) {
            await tx
              .update(schema.erasureRequest)
              .set({
                errorCode: null,
                nextAttemptAt: handledAt,
                status: "pending",
                updatedAt: handledAt,
              })
              .where(eq(schema.erasureRequest.id, existing.id));
          }
          return {
            requestId: existing.id,
            unexpected: existing.errorCode === "unexpected_clerk_deletion",
          };
        }

        await hideAccountContent(tx, targetClerkId);

        const stepResults = initialStepResults(handledAt);
        stepResults.inaccessible = completedStep(handledAt);
        const [created] = await tx
          .insert(schema.erasureRequest)
          .values({
            createdAt: handledAt,
            errorCode: "unexpected_clerk_deletion",
            initiator: "admin",
            nextAttemptAt: null,
            startedAt: handledAt,
            status: "needs_attention",
            stepResults,
            subjectHmac,
            targetClerkId,
            updatedAt: handledAt,
            verificationReference: "clerk_webhook",
            verificationMethod: "clerk_webhook",
            verifiedAt: handledAt,
            verifiedByClerkId: "clerk_webhook",
          })
          .onConflictDoNothing({ target: schema.erasureRequest.subjectHmac })
          .returning({ id: schema.erasureRequest.id });
        if (created) return { requestId: created.id, unexpected: true };

        const [concurrent] = await tx
          .select({ id: schema.erasureRequest.id })
          .from(schema.erasureRequest)
          .where(eq(schema.erasureRequest.subjectHmac, subjectHmac))
          .limit(1);
        if (!concurrent) throw new Error("Failed to record Clerk deletion.");
        return { requestId: concurrent.id, unexpected: true };
      });

      if (result.unexpected) {
        logger.error(loggerMessages.database.erasure.unexpectedClerkDeletion, {
          attributes: {
            adminLink: ADMIN_ERASURE_URL,
            failureCategory: "unexpected_clerk_deletion",
            requestId: result.requestId,
            state: "needs_attention",
          },
        });
      }
      return result;
    },

    async processDue(operations: ErasureOperations): Promise<boolean> {
      const claimedAt = now();
      const request = await claimDueRequest(db, claimedAt);
      if (!request) return false;

      const operationRequest: ErasureOperationRequest = {
        id: request.id,
        initiator: request.initiator,
        subjectHmac: request.subjectHmac,
        targetClerkId: request.targetClerkId,
      };

      for (const step of operationSteps) {
        if (request.stepResults[step].status === "completed") continue;
        try {
          const result = await operations[step](operationRequest);
          const completedAt = now();
          const exceptions = uniqueExceptions([
            ...(request.stepResults[step].exceptions ?? []),
            ...validateExceptions(result?.exceptions ?? [], completedAt),
          ]);
          request.stepResults[step] = {
            ...completedStep(completedAt),
            ...(exceptions.length > 0 ? { exceptions } : {}),
          };
          if (step === "verify") {
            await completeRequest(db, request, completedAt);
            logger.info(loggerMessages.database.erasure.completed, {
              attributes: { requestId: request.id },
            });
            return true;
          }

          await db
            .update(schema.erasureRequest)
            .set({
              errorCode: null,
              nextAttemptAt: new Date(completedAt.getTime() + LEASE_MS),
              stepResults: request.stepResults,
              targetClerkId: request.targetClerkId,
              updatedAt: completedAt,
            })
            .where(eq(schema.erasureRequest.id, request.id));
        } catch (error) {
          const state = await recordFailure(db, request, error, now());
          logger[state === "needs_attention" ? "error" : "warn"](
            loggerMessages.database.erasure.stepFailed,
            {
              attributes: {
                adminLink: ADMIN_ERASURE_URL,
                failureCategory: operationErrorCode(error),
                requestId: request.id,
                state,
              },
            },
          );
          return true;
        }
      }

      return true;
    },

    async purgeExpiredReceipts(): Promise<number> {
      const deleted = await db
        .delete(schema.erasureRequest)
        .where(
          and(
            eq(schema.erasureRequest.status, "completed"),
            lte(schema.erasureRequest.expiresAt, now()),
          ),
        )
        .returning({ id: schema.erasureRequest.id });
      return deleted.length;
    },

    async retry(input: {
      exception?: {
        code: ApprovedErasureExceptionCode;
        expiresAt: Date;
      };
      requestId: string;
    }): Promise<ErasureReceipt> {
      const retriedAt = now();
      const request = await db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(schema.erasureRequest)
          .where(eq(schema.erasureRequest.id, input.requestId))
          .limit(1)
          .for("update");
        if (current?.status !== "needs_attention") {
          throw new Error("Erasure request is not awaiting attention.");
        }

        const pendingStep = operationSteps.find(
          (step) => current.stepResults[step].status === "pending",
        );
        if (!pendingStep)
          throw new Error("Erasure request has no pending step.");
        if (input.exception) {
          const [exception] = validateExceptions(
            [
              {
                code: input.exception.code,
                expiresAt: input.exception.expiresAt.toISOString(),
              },
            ],
            retriedAt,
          );
          if (!exception) throw new Error("Invalid retention exception.");
          current.stepResults[pendingStep] = {
            ...current.stepResults[pendingStep],
            exceptions: [
              ...(current.stepResults[pendingStep].exceptions ?? []).filter(
                ({ code }) => code !== exception.code,
              ),
              exception,
            ],
          };
        }

        const [updated] = await tx
          .update(schema.erasureRequest)
          .set({
            errorCode: null,
            nextAttemptAt: retriedAt,
            status: "pending",
            stepResults: current.stepResults,
            updatedAt: retriedAt,
          })
          .where(eq(schema.erasureRequest.id, current.id))
          .returning();
        if (!updated) throw new Error("Failed to retry erasure request.");
        return updated;
      });
      return receipt(request);
    },
  };
}

async function claimDueRequest(
  db: Database,
  claimedAt: Date,
): Promise<ErasureRequest | null> {
  return await db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(schema.erasureRequest)
      .where(
        and(
          inArray(schema.erasureRequest.status, ["pending", "running"]),
          lte(schema.erasureRequest.nextAttemptAt, claimedAt),
        ),
      )
      .orderBy(asc(schema.erasureRequest.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!request) return null;

    const [claimed] = await tx
      .update(schema.erasureRequest)
      .set({
        attempts: sql`${schema.erasureRequest.attempts} + 1`,
        nextAttemptAt: new Date(claimedAt.getTime() + LEASE_MS),
        startedAt: request.startedAt ?? claimedAt,
        status: "running",
        updatedAt: claimedAt,
      })
      .where(eq(schema.erasureRequest.id, request.id))
      .returning();
    return claimed ?? null;
  });
}

async function completeRequest(
  db: Database,
  request: ErasureRequest,
  completedAt: Date,
) {
  const exceptionExpiries = operationSteps.flatMap((step) =>
    (request.stepResults[step].exceptions ?? []).map(({ expiresAt }) =>
      new Date(expiresAt).getTime(),
    ),
  );
  const expiresAt = new Date(
    Math.max(completedAt.getTime() + RECEIPT_MS, ...exceptionExpiries),
  );
  await db
    .update(schema.erasureRequest)
    .set({
      completedAt,
      errorCode: null,
      expiresAt,
      nextAttemptAt: null,
      status: "completed",
      stepResults: request.stepResults,
      targetClerkId: null,
      updatedAt: completedAt,
      verifiedByClerkId:
        request.initiator === "self" ? null : request.verifiedByClerkId,
    })
    .where(eq(schema.erasureRequest.id, request.id));
}

async function recordFailure(
  db: Database,
  request: ErasureRequest,
  error: unknown,
  failedAt: Date,
): Promise<"needs_attention" | "running"> {
  const startedAt = request.startedAt ?? failedAt;
  const needsAttention =
    (error instanceof ErasureOperationError && !error.retryable) ||
    failedAt.getTime() - startedAt.getTime() >= DAY_MS;
  const backoffMs = Math.min(
    60 * 60 * 1000,
    5 * 60 * 1000 * 2 ** Math.max(0, request.attempts - 1),
  );
  await db
    .update(schema.erasureRequest)
    .set({
      errorCode: operationErrorCode(error),
      nextAttemptAt: needsAttention
        ? null
        : new Date(failedAt.getTime() + backoffMs),
      status: needsAttention ? "needs_attention" : "running",
      stepResults: request.stepResults,
      updatedAt: failedAt,
    })
    .where(eq(schema.erasureRequest.id, request.id));
  return needsAttention ? "needs_attention" : "running";
}

function normalizeCreateInput(input: {
  initiator: ErasureInitiator;
  subjectHmac: string;
  targetClerkId: string;
  verificationMethod: ErasureVerificationMethod;
  verificationReference?: string;
  verifiedAt: Date;
  verifiedByClerkId: string;
}) {
  const verificationReference = input.verificationReference?.trim();
  if (!(["self", "admin"] as const).includes(input.initiator)) {
    throw new Error("Invalid erasure initiator.");
  }
  const verifiedByClerkId = requiredValue(input.verifiedByClerkId, "Verifier");
  if (Number.isNaN(input.verifiedAt.getTime())) {
    throw new Error("Verification timestamp is invalid.");
  }
  if (input.initiator === "admin") {
    if (
      !verificationReference ||
      !verificationReferencePattern.test(verificationReference) ||
      !(["authenticated_request", "verified_email"] as const).includes(
        input.verificationMethod as "authenticated_request" | "verified_email",
      )
    ) {
      throw new Error("Admin verification evidence is required.");
    }
  } else if (
    verificationReference ||
    input.verificationMethod !== "clerk_reverification" ||
    verifiedByClerkId !== input.targetClerkId.trim()
  ) {
    throw new Error("Self-service verification evidence is invalid.");
  }
  return {
    initiator: input.initiator,
    subjectHmac: normalizeSubjectHmac(input.subjectHmac),
    targetClerkId: requiredValue(input.targetClerkId, "Subject"),
    verificationMethod: input.verificationMethod,
    verificationReference,
    verifiedAt: input.verifiedAt,
    verifiedByClerkId,
  };
}

function initialStepResults(createdAt: Date): ErasureStepResults {
  return {
    database: { status: "pending" },
    inaccessible: { status: "pending" },
    providers: { status: "pending" },
    quiesce: completedStep(createdAt),
    snapshot: { status: "pending" },
    storage: { status: "pending" },
    verify: { status: "pending" },
  };
}

function completedStep(completedAt: Date) {
  return {
    completedAt: completedAt.toISOString(),
    status: "completed",
  } as const;
}

function validateExceptions(
  exceptions: ErasureRetentionException[],
  referenceTime: Date,
): ErasureRetentionException[] {
  return exceptions.map((exception) => {
    const maximumMs =
      exceptionMaximumMs[exception.code as ApprovedErasureExceptionCode];
    const expiresAt = new Date(exception.expiresAt);
    if (
      !maximumMs ||
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt <= referenceTime ||
      expiresAt.getTime() - referenceTime.getTime() > maximumMs
    ) {
      throw new ErasureOperationError("invalid_retention_exception", false);
    }
    return { code: exception.code, expiresAt: expiresAt.toISOString() };
  });
}

function operationErrorCode(error: unknown): string {
  return error instanceof ErasureOperationError
    ? error.code
    : "operation_failed";
}

function uniqueExceptions(
  exceptions: ErasureRetentionException[],
): ErasureRetentionException[] {
  return [
    ...new Map(
      exceptions.map((exception) => [exception.code, exception]),
    ).values(),
  ];
}

function normalizeSubjectHmac(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!subjectHmacPattern.test(normalized)) {
    throw new Error("Invalid erasure subject HMAC.");
  }
  return normalized;
}

function requiredValue(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${name} is required.`);
  return normalized;
}

function receipt(request: ErasureRequest): ErasureReceipt {
  const { storageTargets, targetClerkId, verifiedByClerkId, ...safe } = request;
  void storageTargets;
  void targetClerkId;
  void verifiedByClerkId;
  return safe;
}

type ErasureTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function hideAccountContent(
  tx: ErasureTransaction,
  targetClerkId: string,
) {
  const [account] = await tx
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.clerkId, targetClerkId))
    .limit(1);
  if (account) {
    await tx
      .update(schema.userCollection)
      .set({ isPrivate: true })
      .where(eq(schema.userCollection.ownerId, account.id));
    await tx
      .update(schema.collectionItem)
      .set({ isPrivate: true })
      .where(eq(schema.collectionItem.ownerId, account.id));
  }
  await tx
    .update(schema.resources)
    .set({ isPrivate: true })
    .where(eq(schema.resources.uploaderClerkId, targetClerkId));
}
