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
import { type Actor, hasPermission } from "../../authorization.js";
import {
  type AccountErasureAuditData,
  accountErasureAudit,
  accountErasureAuditEvents,
} from "../audit/erasure.js";
import {
  type AuditEventDefinition,
  type AuditService,
  createAuditService,
} from "../audit/index.js";
import {
  DatabaseErasureVerificationError,
  eraseAccountDatabaseData,
} from "./database.js";

/**
 * Milliseconds in one day for retention calculations.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Thirty-minute lease preventing concurrent request processing.
 */
const LEASE_MS = 30 * 60 * 1000;
/**
 * Thirty-day lifetime for completed erasure receipts.
 */
const RECEIPT_MS = 30 * DAY_MS;
/**
 * Administrative route linked from erasure alerts.
 */
const ADMIN_ERASURE_URL = "https://pocket-trash.app/admin/account-erasure";
/**
 * Format accepted for stable machine-readable operation errors.
 */
const errorCodePattern = /^[a-z0-9_]{1,64}$/u;
/**
 * Lowercase hexadecimal SHA-256 HMAC format.
 */
const subjectHmacPattern = /^[0-9a-f]{64}$/u;
/**
 * Allowed format for administrator verification evidence.
 */
const verificationReferencePattern = /^[A-Za-z0-9:_-]{1,120}$/u;

/**
 * Maximum approved retention duration for each provider exception.
 */
const exceptionMaximumMs = {
  axiom_30_days: 30 * DAY_MS,
  bunny_cache_30_days: 30 * DAY_MS,
  bunny_logs_3_days: 3 * DAY_MS,
  clerk_deletion_3_days: 3 * DAY_MS,
  clerk_logs_30_days: 30 * DAY_MS,
  cloudflare_logs_7_days: 7 * DAY_MS,
  neon_history_6_hours: 6 * 60 * 60 * 1000,
  vercel_logs_1_hour: 60 * 60 * 1000,
} as const;

/**
 * Durable erasure steps in execution order.
 */
const operationSteps = [
  "snapshot",
  "inaccessible",
  "storage",
  "database",
  "providers",
  "verify",
] as const;

/**
 * Retention exception whose maximum duration is explicitly approved.
 */
export type ApprovedErasureExceptionCode = keyof typeof exceptionMaximumMs;

/**
 * Public erasure request receipt with sensitive execution fields removed.
 */
export type ErasureReceipt = Omit<
  ErasureRequest,
  "storageTargets" | "targetClerkId" | "verifiedByClerkId"
>;

/**
 * Minimum account-erasure request context passed to each operation step.
 */
export type ErasureOperationRequest = Pick<
  ErasureRequest,
  "id" | "initiator" | "subjectHmac" | "targetClerkId"
>;

/**
 * Candidate retention exceptions reported by an erasure operation.
 */
export type ErasureOperationResult = {
  /**
   * Retained-data exceptions awaiting workflow validation.
   */
  exceptions?: ErasureRetentionException[];
};

/**
 * Ordered account-erasure step implementations keyed by step name.
 *
 * @param request - Minimum erasure request context for the step.
 * @returns Optional candidate retention exceptions discovered by the step.
 * @rejects When the external erasure step cannot complete.
 */
export type ErasureOperations = Record<
  (typeof operationSteps)[number],
  (
    request: ErasureOperationRequest,
  ) => Promise<ErasureOperationResult | undefined>
>;

/**
 * Durable account-erasure workflow and administration operations.
 */
export type ErasureService = ReturnType<typeof createErasureService>;

/** Human-initiated account-erasure request input. */
export type CreateErasureRequestInput = {
  /** Normalized human actor creating the request. */
  actor: Actor;
  /** Whether the account owner or an administrator initiated the request. */
  initiator: ErasureInitiator;
  /** Non-reversible subject lookup digest. */
  subjectHmac: string;
  /** Clerk identifier of the account being erased. */
  targetClerkId: string;
  /** Verification channel used before request creation. */
  verificationMethod: ErasureVerificationMethod;
  /** Opaque administrator verification evidence. */
  verificationReference?: string;
  /** Time at which the human actor was verified. */
  verifiedAt: Date;
};

/** Administrator retry input for an account-erasure request. */
export type RetryErasureRequestInput = {
  /** Normalized administrator retrying the request. */
  actor: Actor;
  /** Approved retention exception attached to the pending step. */
  exception?: {
    /** Approved exception code. */
    code: ApprovedErasureExceptionCode;
    /** Time at which the retained data must expire. */
    expiresAt: Date;
  };
  /** Erasure request identifier. */
  requestId: string;
};

/**
 * Error raised for account erasure in progress.
 */
export class AccountErasureInProgressError extends Error {
  /**
   * Creates the error returned while account erasure is active.
   */
  constructor() {
    super("Account erasure is in progress.");
    this.name = "AccountErasureInProgressError";
  }
}

/**
 * Error raised for erasure operation.
 */
export class ErasureOperationError extends Error {
  /**
   * Creates a stable erasure-operation failure.
   *
   * @param code - Machine-readable lowercase failure code.
   * @param retryable - Whether the workflow may retry the failed operation.
   * @throws When the failure code does not match the supported format.
   */
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

/**
 * Creates the stable HMAC used to identify an erased account.
 *
 * @param clerkId - Clerk user identifier to pseudonymize.
 * @param secret - HMAC secret containing at least 32 characters.
 * @returns Lowercase hexadecimal SHA-256 HMAC.
 * @rejects When either input is invalid or Web Crypto cannot sign it.
 */
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

/**
 * Creates the durable account-erasure service.
 *
 * @param db - Database containing erasure requests and audit events.
 * @param logger - Structured operation logger.
 * @param now - Clock used for retry and retention state.
 * @param audit - Shared audit writer and account redactor.
 * @returns Account-erasure service.
 */
export function createErasureService(
  db: Database,
  logger: Logger,
  now: () => Date = () => new Date(),
  audit: Pick<AuditService, "redactAccount" | "write"> = createAuditService(
    logger,
    accountErasureAuditEvents,
  ),
) {
  return {
    /**
     * Verifies that an account has no active erasure request.
     *
     * @param clerkId - Clerk user identifier to check.
     * @rejects When the identifier is invalid, the query fails, or erasure is active.
     */
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

    /**
     * Finds an erasure receipt by subject digest.
     *
     * @param subjectHmac - Subject digest used to find a prior request receipt.
     * @returns Matching receipt by subject, when available.
     * @rejects When the digest is invalid or persistence fails.
     */
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

    /**
     * Loads an erasure request for administration.
     *
     * @param id - Erasure request identifier.
     * @returns Matching erasure request, when available.
     * @rejects When the identifier is invalid or persistence fails.
     */
    async getForAdmin(id: string): Promise<ErasureRequest | null> {
      const [request] = await db
        .select()
        .from(schema.erasureRequest)
        .where(eq(schema.erasureRequest.id, requiredValue(id, "Request")))
        .limit(1);
      return request ?? null;
    },

    /**
     * Makes an account inaccessible before erasure proceeds.
     *
     * @param targetClerkId - Clerk user identifier made inaccessible.
     * @rejects When the identifier is invalid or persistence fails.
     */
    async makeAccountInaccessible(targetClerkId: string): Promise<void> {
      await db.transaction(async (tx) => {
        await hideAccountContent(tx, requiredValue(targetClerkId, "Subject"));
      });
    },

    /**
     * Creates one deduplicated and audited erasure request.
     *
     * @param input - Verified human request and subject digest.
     * @returns Safe erasure receipt.
     * @rejects When authorization, verification, persistence, audit, or operation logging fails.
     */
    async create(input: CreateErasureRequestInput): Promise<ErasureReceipt> {
      const values = normalizeCreateInput(input);
      const createdAt = now();
      const request = await logger.operation(
        loggerMessages.database.erasure.create,
        async () =>
          await db.transaction(async (tx) => {
            await tx.execute(
              sql`select pg_advisory_xact_lock(hashtextextended(${`account-erasure:${values.targetClerkId}`}, 0))`,
            );
            const [existing] = await tx
              .select()
              .from(schema.erasureRequest)
              .where(eq(schema.erasureRequest.subjectHmac, values.subjectHmac))
              .limit(1);
            if (existing) {
              if (
                existing.targetClerkId &&
                existing.targetClerkId !== values.targetClerkId
              ) {
                throw new Error("Erasure request subject mismatch.");
              }
              return existing;
            }

            const requestId = crypto.randomUUID();
            const [actorUser, ownerUser] = await Promise.all([
              loadAuditUser(tx, input.actor.clerkId, true),
              loadAuditUser(tx, values.targetClerkId, false),
            ]);
            await audit.write(tx, {
              actor: {
                role: input.actor.role,
                userId: actorUser?.id ?? null,
                username: actorUser?.username ?? null,
              },
              authorization:
                values.initiator === "admin"
                  ? { permission: "accounts.erase", type: "permission" }
                  : { type: "owner" },
              data: {
                attempts: 0,
                exceptionCount: 0,
                initiator: values.initiator,
                status: "pending",
                verificationMethod: values.verificationMethod,
              },
              definition: accountErasureAudit.requested,
              occurredAt: createdAt,
              ownerUserId: ownerUser?.id ?? null,
              requestId,
              targetId: requestId,
            });
            const [inserted] = await tx
              .insert(schema.erasureRequest)
              .values({
                ...values,
                createdAt,
                id: requestId,
                nextAttemptAt: createdAt,
                stepResults: initialStepResults(createdAt),
                updatedAt: createdAt,
              })
              .returning();
            if (!inserted) throw new Error("Failed to create erasure request.");
            return inserted;
          }),
        { attributes: { initiator: values.initiator } },
      );
      return receipt(request);
    },

    /**
     * Erases owned rows and redacts retained references in one transaction.
     * Before commit, captured target, raw identifier, and orphan checks must all
     * return zero; any deletion or verification failure rolls back the erasure.
     *
     * @param targetClerkId - Clerk user identifier whose data is erased.
     * @rejects When validation or database erasure fails.
     */
    async eraseDatabase(targetClerkId: string): Promise<void> {
      try {
        await eraseAccountDatabaseData(
          db,
          requiredValue(targetClerkId, "Subject"),
          audit,
        );
      } catch (error) {
        if (error instanceof DatabaseErasureVerificationError) {
          throw new ErasureOperationError(error.code);
        }
        throw error;
      }
    },

    /**
     * Finds one safe erasure receipt for its subject.
     *
     * @param input - Request identifier and subject digest.
     * @returns Matching safe receipt, or null when absent.
     * @rejects When the digest is invalid or persistence fails.
     */
    async getReceipt(input: {
      /** Erasure request identifier. */
      id: string;
      /** Non-reversible subject lookup digest. */
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

    /**
     * Reconciles a verified Clerk deletion webhook.
     *
     * @param input - Subject digest and deleted Clerk identity.
     * @returns Request identifier and whether deletion was unexpected.
     * @rejects When reconciliation, audit persistence, or logging fails.
     */
    async handleClerkDeletion(input: {
      /** Non-reversible subject lookup digest. */
      subjectHmac: string;
      /** Deleted Clerk user identifier. */
      targetClerkId: string;
    }): Promise<{
      /** Erasure request identifier. */
      requestId: string;
      /** Whether no verified erasure request preceded the deletion. */
      unexpected: boolean;
    }> {
      const subjectHmac = normalizeSubjectHmac(input.subjectHmac);
      const targetClerkId = requiredValue(input.targetClerkId, "Subject");
      const handledAt = now();
      const result = await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`account-erasure:${targetClerkId}`}, 0))`,
        );
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
        if (created) {
          await writeSystemAudit(audit, tx, {
            data: {
              attempts: 0,
              errorCode: "unexpected_clerk_deletion",
              exceptionCount: 0,
              initiationEventId: null,
              status: "needs_attention",
            },
            definition: accountErasureAudit.needsAttention,
            occurredAt: handledAt,
            requestId: created.id,
          });
          return { requestId: created.id, unexpected: true };
        }

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

    /**
     * Processes the oldest due erasure request through its next steps.
     *
     * @param operations - Idempotent external erasure operations.
     * @returns Whether a due request was claimed.
     * @rejects When durable state, audit persistence, or logging fails.
     */
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
            await completeRequest(db, audit, request, completedAt);
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
          const state = await recordFailure(db, audit, request, error, now());
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

    /**
     * Deletes expired completed-erasure receipts.
     *
     * @returns Number of expired receipts deleted.
     * @rejects When persistence fails.
     */
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

    /**
     * Retries an erasure request that needs administrator attention.
     *
     * @param input - Authorized retry and optional retention exception.
     * @returns Updated safe erasure receipt.
     * @rejects When authorization, state, or persistence is invalid.
     */
    async retry(input: RetryErasureRequestInput): Promise<ErasureReceipt> {
      if (!hasPermission(input.actor, "accounts.erase")) {
        throw new Error("Erasure request is not awaiting attention.");
      }
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
        const [actorUser, initiationEventId] = await Promise.all([
          loadAuditUser(tx, input.actor.clerkId, true),
          findInitiationEventId(tx, current.id),
        ]);
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
        await audit.write(tx, {
          actor: {
            role: input.actor.role,
            userId: actorUser?.id ?? null,
            username: actorUser?.username ?? null,
          },
          authorization: {
            permission: "accounts.erase",
            type: "permission",
          },
          data: {
            attempts: current.attempts,
            exceptionCount: countExceptions(current.stepResults),
            initiationEventId,
            status: "pending",
          },
          definition: accountErasureAudit.retried,
          occurredAt: retriedAt,
          requestId: current.id,
          targetId: current.id,
        });
        return updated;
      });
      return receipt(request);
    },
  };
}

/**
 * Atomically claims the next due erasure request.
 *
 * @param db - Application database.
 * @param claimedAt - Timestamp used to acquire the processing lease.
 * @returns Claimed request, or `null` when none is due.
 * @rejects When the transaction fails.
 */
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

/**
 * Completes an erasure request and records its system audit event atomically.
 *
 * @param db - Erasure database.
 * @param audit - Shared audit writer.
 * @param request - Claimed request with completed steps.
 * @param completedAt - Terminal completion time.
 * @returns Completion after the source transaction commits.
 * @rejects When request or audit persistence fails.
 */
async function completeRequest(
  db: Database,
  audit: Pick<AuditService, "write">,
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
  await db.transaction(async (tx) => {
    await tx
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
    await writeSystemAudit(audit, tx, {
      data: {
        attempts: request.attempts,
        exceptionCount: countExceptions(request.stepResults),
        initiationEventId: await findInitiationEventId(tx, request.id),
        status: "completed",
      },
      definition: accountErasureAudit.completed,
      occurredAt: completedAt,
      requestId: request.id,
    });
  });
}

/**
 * Records a retryable or terminal erasure failure atomically.
 *
 * @param db - Erasure database.
 * @param audit - Shared audit writer.
 * @param request - Claimed request and current step results.
 * @param error - Operation failure.
 * @param failedAt - Failure time.
 * @returns Durable request state after failure classification.
 * @rejects When request or audit persistence fails.
 */
async function recordFailure(
  db: Database,
  audit: Pick<AuditService, "write">,
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
  const errorCode = operationErrorCode(error);
  await db.transaction(async (tx) => {
    await tx
      .update(schema.erasureRequest)
      .set({
        errorCode,
        nextAttemptAt: needsAttention
          ? null
          : new Date(failedAt.getTime() + backoffMs),
        status: needsAttention ? "needs_attention" : "running",
        stepResults: request.stepResults,
        updatedAt: failedAt,
      })
      .where(eq(schema.erasureRequest.id, request.id));
    if (needsAttention) {
      await writeSystemAudit(audit, tx, {
        data: {
          attempts: request.attempts,
          errorCode,
          exceptionCount: countExceptions(request.stepResults),
          initiationEventId: await findInitiationEventId(tx, request.id),
          status: "needs_attention",
        },
        definition: accountErasureAudit.needsAttention,
        occurredAt: failedAt,
        requestId: request.id,
      });
    }
  });
  return needsAttention ? "needs_attention" : "running";
}

/**
 * Validates human authorization and verification evidence.
 *
 * @param input - Candidate erasure request input.
 * @returns Normalized values safe for request persistence.
 * @throws When authorization or verification evidence is invalid.
 */
function normalizeCreateInput(input: CreateErasureRequestInput) {
  const verificationReference = input.verificationReference?.trim();
  if (!(["self", "admin"] as const).includes(input.initiator)) {
    throw new Error("Invalid erasure initiator.");
  }
  const verifiedByClerkId = requiredValue(input.actor.clerkId, "Verifier");
  if (Number.isNaN(input.verifiedAt.getTime())) {
    throw new Error("Verification timestamp is invalid.");
  }
  if (input.initiator === "admin") {
    if (
      !hasPermission(input.actor, "accounts.erase") ||
      !verificationReference ||
      !verificationReferencePattern.test(verificationReference) ||
      !(["authenticated_request", "verified_email"] as const).includes(
        input.verificationMethod as "authenticated_request" | "verified_email",
      )
    ) {
      throw new Error("Admin verification evidence is required.");
    }
  } else if (
    input.actor.clerkId !== input.targetClerkId.trim() ||
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

/**
 * Creates pending results for every erasure step.
 *
 * @param createdAt - Request creation time assigned to every pending step.
 * @returns Pending result map keyed by erasure step.
 */
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

/**
 * Builds a completed erasure-step result.
 *
 * @param completedAt - Time the erasure step completed.
 * @returns Completed erasure-step result.
 */
function completedStep(completedAt: Date) {
  return {
    completedAt: completedAt.toISOString(),
    status: "completed",
  } as const;
}

/**
 * Validates approved exceptions for one erasure step.
 *
 * @param exceptions - Retention exceptions reported by an operation.
 * @param referenceTime - Time used to evaluate exception expiry limits.
 * @returns Validated exceptions with normalized expiry timestamps.
 * @throws When a code or expiry is invalid or exceeds its retention limit.
 */
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

/**
 * Returns the stable code for an erasure operation error.
 *
 * @param error - Candidate error.
 * @returns Stable operation error code.
 */
function operationErrorCode(error: unknown): string {
  return error instanceof ErasureOperationError
    ? error.code
    : "operation_failed";
}

/**
 * Deduplicates approved erasure exceptions by identity.
 *
 * @param exceptions - Retention exceptions to deduplicate by code.
 * @returns Deduplicated approved exceptions.
 */
function uniqueExceptions(
  exceptions: ErasureRetentionException[],
): ErasureRetentionException[] {
  return [
    ...new Map(
      exceptions.map((exception) => [exception.code, exception]),
    ).values(),
  ];
}

/**
 * Validates and normalizes an erasure subject HMAC.
 *
 * @param value - Candidate hexadecimal SHA-256 HMAC.
 * @returns Normalized lowercase hexadecimal HMAC.
 * @throws When the value is not a 64-character hexadecimal digest.
 */
function normalizeSubjectHmac(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!subjectHmacPattern.test(normalized)) {
    throw new Error("Invalid erasure subject HMAC.");
  }
  return normalized;
}

/**
 * Trims a required string value.
 *
 * @param value - Candidate required string.
 * @param name - Field name included in the validation error.
 * @returns Trimmed nonempty value.
 * @throws When the trimmed value is empty.
 */
function requiredValue(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${name} is required.`);
  return normalized;
}

/**
 * Maps an erasure request to its public receipt.
 *
 * @param request - Request whose sensitive fields are removed.
 * @returns Public erasure receipt.
 */
function receipt(request: ErasureRequest): ErasureReceipt {
  const { storageTargets, targetClerkId, verifiedByClerkId, ...safe } = request;
  void storageTargets;
  void targetClerkId;
  void verifiedByClerkId;
  return safe;
}

/**
 * Caller-owned database transaction used for atomic erasure work.
 */
type ErasureTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Loads an internal audit identity by Clerk identifier.
 *
 * @param transaction - Caller-owned erasure transaction.
 * @param clerkId - Clerk identifier to resolve.
 * @param required - Whether a missing identity must reject the operation.
 * @returns Internal audit identity, or null when optional and absent.
 * @rejects When persistence fails or a required identity does not exist.
 */
async function loadAuditUser(
  transaction: ErasureTransaction,
  clerkId: string,
  required: boolean,
) {
  const [user] = await transaction
    .select({ id: schema.user.id, username: schema.user.username })
    .from(schema.user)
    .where(eq(schema.user.clerkId, clerkId))
    .limit(1);
  if (!user && required) throw new Error("Audit actor is missing.");
  return user ?? null;
}

/**
 * Finds the request's human initiation audit event.
 *
 * @param transaction - Caller-owned erasure transaction.
 * @param requestId - Erasure request identifier.
 * @returns Initiation event identifier, or null for a legacy request.
 * @rejects When persistence fails.
 */
async function findInitiationEventId(
  transaction: ErasureTransaction,
  requestId: string,
): Promise<number | null> {
  const [event] = await transaction
    .select({ id: schema.auditEvent.id })
    .from(schema.auditEvent)
    .where(
      and(
        eq(schema.auditEvent.action, accountErasureAudit.requested.action),
        eq(schema.auditEvent.targetType, "account.erasure"),
        eq(schema.auditEvent.targetId, requestId),
      ),
    )
    .limit(1);
  return event?.id ?? null;
}

/**
 * Counts approved retention exceptions across all erasure steps.
 *
 * @param stepResults - Durable erasure step results.
 * @returns Total approved exception count.
 */
function countExceptions(stepResults: ErasureStepResults): number {
  return Object.values(stepResults).reduce(
    (total, step) => total + (step.exceptions?.length ?? 0),
    0,
  );
}

/**
 * Writes a system-authored erasure transition in the source transaction.
 *
 * @param audit - Shared audit writer.
 * @param transaction - Caller-owned erasure transaction.
 * @param input - Safe transition data and event definition.
 * @returns Completion after the event is stored.
 * @rejects When audit persistence fails.
 */
async function writeSystemAudit(
  audit: Pick<AuditService, "write">,
  transaction: ErasureTransaction,
  input: {
    /** Safe erasure state and counts. */
    data: AccountErasureAuditData;
    /** Registered erasure event definition. */
    definition: AuditEventDefinition<AccountErasureAuditData>;
    /** Time at which the transition occurred. */
    occurredAt: Date;
    /** Erasure request identifier. */
    requestId: string;
  },
): Promise<void> {
  await audit.write(transaction, {
    actor: { role: "system", userId: null, username: null },
    authorization: { type: "system" },
    data: input.data,
    definition: input.definition,
    occurredAt: input.occurredAt,
    requestId: input.requestId,
    targetId: input.requestId,
  });
}

/**
 * Redacts user-owned content during account erasure.
 *
 * @param tx - Caller-owned database transaction.
 * @param targetClerkId - Clerk user identifier whose content is redacted.
 * @rejects When persistence fails.
 */
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
