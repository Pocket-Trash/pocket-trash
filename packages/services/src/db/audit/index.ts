import { createHash } from "node:crypto";
import type {
  AuditEvent,
  AuditExport,
  AuditJsonObject,
  Database,
} from "@package/database";
import { schema } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  isNull,
  lt,
  lte,
  min,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import {
  type Actor,
  hasPermission,
  type Permission,
  permissions,
  type Role,
} from "../../authorization.js";

const MAX_PAYLOAD_BYTES = 256 * 1024;
/** Maximum number of events captured by one export range. */
const MAX_EXPORT_EVENTS = 10_000;
/** Number of audit events fetched for each streamed export chunk. */
const EXPORT_BATCH_SIZE = 100;
/** Minimum event age eligible for export. */
const EXPORT_MINIMUM_AGE_MS = 60 * 24 * 60 * 60 * 1000;
const DELETED_REASON = "[erased]";
const DELETED_USERNAME = "Deleted user";
const namePattern = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u;
const targetIdPattern = /^\S(?:.*\S)?$/u;
const roles = ["user", "editor", "admin", "system_admin", "system"] as const;

type AuditTransaction = Pick<
  Database,
  "execute" | "insert" | "select" | "update"
>;

export type AuditPayload =
  | {
      after?: AuditJsonObject;
      before?: AuditJsonObject;
      metadata?: never;
    }
  | {
      after?: never;
      before?: never;
      metadata: AuditJsonObject;
    };

type StoredAuditPayload = Pick<
  AuditEvent,
  "afterState" | "beforeState" | "metadata"
>;

export type AuditRedactionContext = {
  erasedParty: "actor" | "actor_and_owner" | "owner";
};

export type AuditEventDefinition<T> = {
  action: string;
  targetType: string;
  redact(
    payload: StoredAuditPayload,
    context: AuditRedactionContext,
  ): AuditPayload;
  serialize(input: T): AuditPayload;
};

type AuditActor = {
  role: Role | "system";
  userId: number | null;
  username: string | null;
};

type AuditAuthorization =
  | { permission: Permission; type: "permission" }
  | { permission?: never; type: "owner" | "system" };

/**
 * Input for writing a registered audit event.
 *
 * @template T - Definition input type.
 */
export type AuditWriteInput<T> = {
  actor: AuditActor;
  authorization: AuditAuthorization;
  correlationId?: string | null;
  data: T;
  definition: AuditEventDefinition<T>;
  /** Timestamp when the audited action occurred. */
  occurredAt: Date;
  /** Internal owner identifier associated with the target. */
  ownerUserId?: number | null;
  /** Operational reason for a staff action. */
  reason?: string | null;
  requestId?: string | null;
  /** Stable identifier of the affected target. */
  targetId: string;
};

/** Audit persistence, query, export, and erasure operations. */
export type AuditService = {
  /**
   * Reserves the oldest eligible audit-event range.
   *
   * @param input - Authorized export request.
   * @returns The reserved export range.
   */
  createExport(input: CreateAuditExportInput): Promise<AuditExportView>;
  /**
   * Streams an existing audit export.
   *
   * @param input - Authorized download request.
   * @returns The export stream and download filename.
   */
  downloadExport(input: DownloadAuditExportInput): Promise<AuditExportDownload>;
  /**
   * Finds the current unconsumed export range.
   *
   * @param actor - Authorized audit actor.
   * @returns The active export, when one exists.
   */
  getActiveExport(actor: Actor): Promise<AuditExportView | null>;
  /**
   * Lists filtered audit events.
   *
   * @param input - Authorized query and filters.
   * @returns One page of audit events.
   */
  list(input: ListAuditEventsInput): Promise<AuditEventPage>;
  /**
   * Redacts retained audit data for an erased account.
   *
   * @param transaction - Caller-owned database transaction.
   * @param userId - Internal user identifier to erase.
   * @returns Completion after redaction.
   */
  redactAccount(transaction: AuditTransaction, userId: number): Promise<void>;
  /**
   * Writes one registered audit event.
   *
   * @template T - Definition input type.
   * @param transaction - Caller-owned database transaction.
   * @param input - Audit-event input.
   * @returns The stored audit event.
   */
  write<T>(
    transaction: AuditTransaction,
    input: AuditWriteInput<T>,
  ): Promise<AuditEvent>;
};

/** Input for reserving an audit-export range. */
export type CreateAuditExportInput = {
  /** Actor requesting the export. */
  actor: Actor;
  /** Operational reason retained with the export ledger. */
  reason: string;
};

/** Input for downloading a reserved audit export. */
export type DownloadAuditExportInput = {
  /** Actor downloading the export. */
  actor: Actor;
  /** Reserved export identifier. */
  exportId: string;
};

/** Public audit-export state. */
export type AuditExportView = Pick<
  AuditExport,
  | "completedAt"
  | "createdAt"
  | "cutoffAt"
  | "eventCount"
  | "highWaterEventId"
  | "highWaterRecordedAt"
  | "id"
  | "reason"
  | "sha256"
>;

/** Stream and filename returned for an audit export. */
export type AuditExportDownload = {
  /** Streamed JSON export body. */
  body: ReadableStream<Uint8Array>;
  /** Safe attachment filename. */
  filename: string;
};

/** Stable keyset cursor for audit-event pagination. */
export type AuditEventCursor = {
  /** Event identifier at the cursor boundary. */
  id: number;
  /** Recorded timestamp at the cursor boundary. */
  recordedAt: Date;
};

/** Authorized audit-event query filters. */
export type ListAuditEventsInput = {
  /** Exact audit action to match. */
  action?: string;
  /** Actor requesting the audit events. */
  actor: Actor;
  /** Exact internal actor identifier to match. */
  actorUserId?: number;
  /** Keyset cursor for the next page. */
  cursor?: AuditEventCursor;
  /** Inclusive recorded-time lower bound. */
  recordedFrom?: Date;
  /** Inclusive recorded-time upper bound. */
  recordedTo?: Date;
  /** Exact target identifier to match. */
  targetId?: string;
  /** Exact target type to match. */
  targetType?: string;
};

/** One page of audit events and coverage metadata. */
export type AuditEventPage = {
  /** Earliest retained event timestamp. */
  coverageStartAt: Date | null;
  /** Registered top-level audit action domains. */
  coveredDomains: string[];
  /** Events in descending keyset order. */
  items: AuditEvent[];
  /** Cursor for the next page, when one exists. */
  nextCursor: AuditEventCursor | null;
};

/** Raised when audit input fails validation. */
export class AuditEventValidationError extends Error {}
/** Raised when no events are old enough to export. */
export class AuditExportEmptyError extends Error {}
/** Raised when an unconsumed export already exists. */
export class AuditExportInProgressError extends Error {}
/** Raised when an audit payload exceeds its storage limit. */
export class AuditPayloadTooLargeError extends Error {}

/** Payload recorded when an audit export finishes streaming. */
type AuditExportCompletedData = {
  /** SHA-256 checksum of the streamed JSON. */
  checksum: string;
  /** Number of exported events. */
  count: number;
  /** Eligibility cutoff captured for the export. */
  cutoff: string;
  /** Last event identifier included in the export. */
  highWaterEventId: number;
};

/** Audit-event definition for completed exports. */
const auditExportCompleted = {
  action: "audit.export.completed",
  targetType: "audit.export",
  /**
   * Serializes export completion metadata.
   *
   * @param data - Completed export metadata.
   * @returns Audit metadata payload.
   */
  serialize: (data: AuditExportCompletedData) => ({ metadata: data }),
  /**
   * Redacts export metadata when an associated account is erased.
   *
   * @param payload - Stored audit payload.
   * @returns Redacted metadata payload.
   */
  redact: (payload: StoredAuditPayload) => ({
    metadata: payload.metadata ?? { redacted: true },
  }),
} satisfies AuditEventDefinition<AuditExportCompletedData>;

/**
 * Creates the shared audit service.
 *
 * @param logger - Structured operation logger.
 * @param definitions - Registered audit-event definitions.
 * @param database - Database used for reads, exports, and redaction.
 * @returns Configured audit service.
 * @throws When event definitions are duplicated.
 */
export function createAuditService(
  logger: Logger,
  definitions: readonly AuditEventDefinition<never>[] = [],
  database?: Database,
): AuditService {
  const registered = new Map<string, AuditEventDefinition<never>>();
  for (const definition of [
    ...definitions,
    auditExportCompleted as AuditEventDefinition<never>,
  ]) {
    const key = definitionKey(definition);
    if (registered.has(key)) {
      throw new AuditEventValidationError(`Duplicate audit event ${key}.`);
    }
    registered.set(key, definition);
  }

  /**
   * Writes one registered audit event.
   *
   * @template T - Definition input type.
   * @param transaction - Caller-owned database transaction.
   * @param input - Audit-event input.
   * @returns The stored audit event.
   * @throws When validation or persistence fails.
   */
  async function write<T>(
    transaction: AuditTransaction,
    input: AuditWriteInput<T>,
  ) {
    return await logger.operation(
      loggerMessages.database.audit.write,
      async () => {
        const definition = input.definition as AuditEventDefinition<never>;
        const key = definitionKey(definition);
        if (registered.get(key) !== definition) {
          throw new AuditEventValidationError(
            `Audit event ${key} is not registered.`,
          );
        }
        const values = normalizedInput(input);
        const payload = normalizedPayload(
          input.definition.serialize(input.data),
        );
        const [event] = await transaction
          .insert(schema.auditEvent)
          .values({
            ...values,
            afterState: payload.after,
            beforeState: payload.before,
            metadata: payload.metadata,
          })
          .returning();
        if (!event) throw new Error("Failed to write audit event.");
        return event;
      },
      {
        attributes: {
          action: input.definition.action,
          targetType: input.definition.targetType,
        },
      },
    );
  }

  return {
    /**
     * Reserves the oldest eligible audit-event range.
     *
     * @param input - Authorized export request.
     * @returns The reserved export range.
     * @rejects When authorization, validation, or reservation fails.
     */
    async createExport(input) {
      assertPermission(input.actor, "audit.export");
      if (!database) throw new Error("Audit exports are not configured.");
      const reason = requiredText(input.reason, "reason", 500);
      const cutoffAt = new Date(Date.now() - EXPORT_MINIMUM_AGE_MS);

      return await database.transaction(async (transaction) => {
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended('audit-export', 0))`,
        );
        const [active] = await transaction
          .select()
          .from(schema.auditExport)
          .where(isNull(schema.auditExport.consumedAt))
          .limit(1)
          .for("update");
        if (active) throw new AuditExportInProgressError();

        const [requester] = await transaction
          .select({
            id: schema.user.id,
            username: schema.user.username,
          })
          .from(schema.user)
          .where(eq(schema.user.clerkId, input.actor.clerkId))
          .limit(1);
        if (!requester) throw new Error("Audit export requester is missing.");

        const candidates = await transaction
          .select({
            id: schema.auditEvent.id,
            recordedAt: schema.auditEvent.recordedAt,
          })
          .from(schema.auditEvent)
          .where(lt(schema.auditEvent.recordedAt, cutoffAt))
          .orderBy(asc(schema.auditEvent.recordedAt), asc(schema.auditEvent.id))
          .limit(MAX_EXPORT_EVENTS);
        const highWater = candidates.at(-1);
        if (!highWater) throw new AuditExportEmptyError();

        const [created] = await transaction
          .insert(schema.auditExport)
          .values({
            cutoffAt,
            eventCount: candidates.length,
            highWaterEventId: highWater.id,
            highWaterRecordedAt: highWater.recordedAt,
            reason,
            requestedByRole: input.actor.role,
            requestedByUserId: requester.id,
            requestedByUsername: requester.username,
          })
          .returning();
        if (!created) throw new Error("Failed to create audit export.");
        return exportView(created);
      });
    },

    /**
     * Streams a reserved audit-event range.
     *
     * @param input - Authorized download request.
     * @returns Export stream and attachment filename.
     * @rejects When authorization or export lookup fails.
     */
    async downloadExport(input) {
      assertPermission(input.actor, "audit.export");
      if (!database) throw new Error("Audit exports are not configured.");
      const [record] = await database
        .select()
        .from(schema.auditExport)
        .where(
          and(
            eq(schema.auditExport.id, requiredUuid(input.exportId)),
            isNull(schema.auditExport.consumedAt),
          ),
        )
        .limit(1);
      if (!record) throw new Error("Audit export does not exist.");

      const hash = createHash("sha256");
      const encoder = new TextEncoder();
      const chunks = exportChunks(database, record)[Symbol.asyncIterator]();
      let completed = false;
      const body = new ReadableStream<Uint8Array>({
        /** Closes the backing event iterator when the client cancels. */
        async cancel() {
          await chunks.return?.();
        },
        /**
         * Enqueues the next serialized export chunk.
         *
         * @param controller - Export stream controller.
         * @returns Completion after the next chunk is handled.
         */
        async pull(controller) {
          try {
            const next = await chunks.next();
            if (!next.done) {
              const bytes = encoder.encode(next.value);
              hash.update(bytes);
              controller.enqueue(bytes);
              return;
            }
            if (!completed) {
              completed = true;
              await completeExport(
                database,
                write,
                record,
                input.actor,
                hash.digest("hex"),
              );
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });
      return {
        body,
        filename: `audit-export-${record.createdAt.toISOString().slice(0, 10)}-${record.id}.json`,
      };
    },

    /**
     * Finds the current unconsumed export.
     *
     * @param actor - Authorized audit actor.
     * @returns The active export, when one exists.
     * @rejects When authorization or configuration is missing.
     */
    async getActiveExport(actor) {
      assertPermission(actor, "audit.export");
      if (!database) throw new Error("Audit exports are not configured.");
      const [record] = await database
        .select()
        .from(schema.auditExport)
        .where(isNull(schema.auditExport.consumedAt))
        .limit(1);
      return record ? exportView(record) : null;
    },

    /**
     * Lists filtered audit events.
     *
     * @param input - Authorized query and filters.
     * @returns One page of audit events.
     * @rejects When authorization or configuration is missing.
     */
    async list(input) {
      if (!hasPermission(input.actor, "audit.read")) {
        throw new Error("Audit events do not exist.");
      }
      if (!database) throw new Error("Audit queries are not configured.");
      const normalized = normalizedListInput(input);
      const conditions: SQL[] = [];
      if (normalized.action) {
        conditions.push(eq(schema.auditEvent.action, normalized.action));
      }
      if (normalized.actorUserId) {
        conditions.push(
          eq(schema.auditEvent.actorUserId, normalized.actorUserId),
        );
      }
      if (normalized.recordedFrom) {
        conditions.push(
          gte(schema.auditEvent.recordedAt, normalized.recordedFrom),
        );
      }
      if (normalized.recordedTo) {
        conditions.push(
          lte(schema.auditEvent.recordedAt, normalized.recordedTo),
        );
      }
      if (normalized.targetId) {
        conditions.push(eq(schema.auditEvent.targetId, normalized.targetId));
      }
      if (normalized.targetType) {
        conditions.push(
          eq(schema.auditEvent.targetType, normalized.targetType),
        );
      }
      if (normalized.cursor) {
        conditions.push(
          or(
            lt(schema.auditEvent.recordedAt, normalized.cursor.recordedAt),
            and(
              eq(schema.auditEvent.recordedAt, normalized.cursor.recordedAt),
              lt(schema.auditEvent.id, normalized.cursor.id),
            ),
          ) as SQL,
        );
      }
      const [rows, coverage] = await Promise.all([
        database
          .select()
          .from(schema.auditEvent)
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(
            desc(schema.auditEvent.recordedAt),
            desc(schema.auditEvent.id),
          )
          .limit(51),
        database
          .select({ coverageStartAt: min(schema.auditEvent.recordedAt) })
          .from(schema.auditEvent),
      ]);
      const items = rows.slice(0, 50);
      const last = items.at(-1);
      return {
        coverageStartAt: coverage[0]?.coverageStartAt ?? null,
        coveredDomains: [
          ...new Set(
            [...registered.values()].map(({ action }) => action.split(".")[0]),
          ),
        ]
          .filter((domain): domain is string => Boolean(domain))
          .sort(),
        items,
        nextCursor:
          rows.length > items.length && last
            ? { id: last.id, recordedAt: last.recordedAt }
            : null,
      };
    },

    write,

    /**
     * Redacts audit data associated with an erased account.
     *
     * @param transaction - Caller-owned database transaction.
     * @param userId - Internal user identifier to erase.
     * @returns Completion after verified redaction.
     */
    async redactAccount(transaction, userId) {
      await logger.operation(
        loggerMessages.database.audit.redactAccount,
        async () => {
          positiveInteger(userId, "userId");
          const events = await transaction
            .select()
            .from(schema.auditEvent)
            .where(
              or(
                eq(schema.auditEvent.actorUserId, userId),
                eq(schema.auditEvent.ownerUserId, userId),
              ),
            );
          const exports = await transaction
            .select()
            .from(schema.auditExport)
            .where(eq(schema.auditExport.requestedByUserId, userId));
          if (events.length === 0 && exports.length === 0) return;

          await transaction.execute(
            sql`select set_config('pocket_trash.audit_erasure_redaction', 'on', true)`,
          );
          for (const event of events) {
            const actorErased = event.actorUserId === userId;
            const ownerErased = event.ownerUserId === userId;
            const key = `${event.action}:${event.targetType}`;
            const definition = registered.get(key);
            if (!definition) {
              throw new AuditEventValidationError(
                `Audit event ${key} is not registered.`,
              );
            }
            const payload = normalizedPayload(
              definition.redact(
                {
                  afterState: event.afterState,
                  beforeState: event.beforeState,
                  metadata: event.metadata,
                },
                {
                  erasedParty:
                    actorErased && ownerErased
                      ? "actor_and_owner"
                      : actorErased
                        ? "actor"
                        : "owner",
                },
              ),
            );
            const expected = {
              actorUserId: actorErased ? null : event.actorUserId,
              actorUsername: actorErased
                ? DELETED_USERNAME
                : event.actorUsername,
              afterState: payload.after,
              beforeState: payload.before,
              metadata: payload.metadata,
              ownerUserId: ownerErased ? null : event.ownerUserId,
              reason: event.reason === null ? null : DELETED_REASON,
            };
            const [redacted] = await transaction
              .update(schema.auditEvent)
              .set(expected)
              .where(and(eq(schema.auditEvent.id, event.id)))
              .returning();
            if (!redacted || !redactionMatches(redacted, expected)) {
              throw new Error("Audit erasure redaction verification failed.");
            }
          }
          if (exports.length) {
            const redacted = await transaction
              .update(schema.auditExport)
              .set({
                reason: DELETED_REASON,
                requestedByUserId: null,
                requestedByUsername: DELETED_USERNAME,
              })
              .where(eq(schema.auditExport.requestedByUserId, userId))
              .returning({ id: schema.auditExport.id });
            if (redacted.length !== exports.length) {
              throw new Error("Audit export erasure verification failed.");
            }
          }
        },
      );
    },
  };
}

/**
 * Streams deterministic JSON chunks for a reserved export range.
 *
 * @param database - Database used to read the range.
 * @param record - Reserved export ledger row.
 * @yields Serialized JSON chunks in export order.
 * @rejects When the reserved range changes before completion.
 */
async function* exportChunks(database: Database, record: AuditExport) {
  yield `${JSON.stringify({
    export: {
      count: record.eventCount,
      createdAt: record.createdAt.toISOString(),
      cutoffAt: record.cutoffAt.toISOString(),
      highWaterEventId: record.highWaterEventId,
      id: record.id,
    },
  }).slice(0, -1)},"events":[`;

  let cursor: AuditEventCursor | undefined;
  let count = 0;
  while (count < record.eventCount) {
    const rows = await database
      .select()
      .from(schema.auditEvent)
      .where(
        and(
          lt(schema.auditEvent.recordedAt, record.cutoffAt),
          or(
            lt(schema.auditEvent.recordedAt, record.highWaterRecordedAt),
            and(
              eq(schema.auditEvent.recordedAt, record.highWaterRecordedAt),
              lte(schema.auditEvent.id, record.highWaterEventId),
            ),
          ),
          cursor
            ? or(
                gt(schema.auditEvent.recordedAt, cursor.recordedAt),
                and(
                  eq(schema.auditEvent.recordedAt, cursor.recordedAt),
                  gt(schema.auditEvent.id, cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(asc(schema.auditEvent.recordedAt), asc(schema.auditEvent.id))
      .limit(Math.min(EXPORT_BATCH_SIZE, record.eventCount - count));
    if (!rows.length) break;
    for (const event of rows) {
      yield `${count ? "," : ""}${JSON.stringify(exportEvent(event))}`;
      count += 1;
    }
    const last = rows.at(-1);
    if (!last) break;
    cursor = { id: last.id, recordedAt: last.recordedAt };
  }
  if (count !== record.eventCount) {
    throw new Error("Audit export range changed before completion.");
  }
  yield "]}";
}

/**
 * Records an export checksum and completion audit event atomically.
 *
 * @param database - Database containing the export ledger.
 * @param write - Audit writer used for the completion event.
 * @param record - Export ledger row being completed.
 * @param actor - Actor completing the download.
 * @param checksum - SHA-256 checksum of the streamed JSON.
 * @returns Completion after the transaction commits.
 */
async function completeExport(
  database: Database,
  write: AuditService["write"],
  record: AuditExport,
  actor: Actor,
  checksum: string,
) {
  await database.transaction(async (transaction) => {
    const [current] = await transaction
      .select()
      .from(schema.auditExport)
      .where(eq(schema.auditExport.id, record.id))
      .limit(1)
      .for("update");
    if (!current || current.consumedAt) {
      throw new Error("Audit export does not exist.");
    }
    const [actorUser] = await transaction
      .select({ id: schema.user.id, username: schema.user.username })
      .from(schema.user)
      .where(eq(schema.user.clerkId, actor.clerkId))
      .limit(1);
    if (!actorUser) throw new Error("Audit export requester is missing.");

    await transaction
      .update(schema.auditExport)
      .set({ completedAt: new Date(), sha256: checksum })
      .where(eq(schema.auditExport.id, current.id));
    await write(transaction, {
      actor: {
        role: actor.role,
        userId: actorUser.id,
        username: actorUser.username,
      },
      authorization: { permission: "audit.export", type: "permission" },
      data: {
        checksum,
        count: current.eventCount,
        cutoff: current.cutoffAt.toISOString(),
        highWaterEventId: current.highWaterEventId,
      },
      definition: auditExportCompleted,
      occurredAt: new Date(),
      reason: current.reason,
      targetId: current.id,
    });
  });
}

/**
 * Converts an audit event to its stable JSON representation.
 *
 * @param event - Stored audit event.
 * @returns Serializable export event.
 */
function exportEvent(event: AuditEvent) {
  return {
    action: event.action,
    actorRole: event.actorRole,
    actorUserId: event.actorUserId,
    actorUsername: event.actorUsername,
    afterState: event.afterState,
    authorizationType: event.authorizationType,
    beforeState: event.beforeState,
    correlationId: event.correlationId,
    id: event.id,
    metadata: event.metadata,
    occurredAt: event.occurredAt.toISOString(),
    ownerUserId: event.ownerUserId,
    permission: event.permission,
    reason: event.reason,
    recordedAt: event.recordedAt.toISOString(),
    requestId: event.requestId,
    targetId: event.targetId,
    targetType: event.targetType,
  };
}

/**
 * Selects public export-ledger fields.
 *
 * @param record - Stored export row.
 * @returns Public export state.
 */
function exportView(record: AuditExport): AuditExportView {
  return {
    completedAt: record.completedAt,
    createdAt: record.createdAt,
    cutoffAt: record.cutoffAt,
    eventCount: record.eventCount,
    highWaterEventId: record.highWaterEventId,
    highWaterRecordedAt: record.highWaterRecordedAt,
    id: record.id,
    reason: record.reason,
    sha256: record.sha256,
  };
}

/**
 * Requires an audit permission without revealing export existence.
 *
 * @param actor - Actor to authorize.
 * @param permission - Required permission.
 * @throws When the actor lacks the permission.
 */
function assertPermission(actor: Actor, permission: Permission) {
  if (!hasPermission(actor, permission)) {
    throw new Error("Audit export does not exist.");
  }
}

/**
 * Validates and normalizes an export UUID.
 *
 * @param value - Candidate UUID.
 * @returns Normalized UUID.
 * @throws When the value is not a UUID.
 */
function requiredUuid(value: string) {
  const normalized = value.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      normalized,
    )
  ) {
    throw new AuditEventValidationError("exportId is invalid.");
  }
  return normalized;
}

function normalizedListInput(input: ListAuditEventsInput) {
  const actorUserId = input.actorUserId
    ? positiveInteger(input.actorUserId, "actorUserId")
    : undefined;
  const action = input.action
    ? namespacedName(input.action.trim(), "action")
    : undefined;
  const targetType = input.targetType
    ? namespacedName(input.targetType.trim(), "targetType")
    : undefined;
  const targetId = input.targetId
    ? requiredText(input.targetId, "targetId", 200, targetIdPattern)
    : undefined;
  const recordedFrom = validDate(input.recordedFrom, "recordedFrom");
  const recordedTo = validDate(input.recordedTo, "recordedTo");
  if (recordedFrom && recordedTo && recordedFrom > recordedTo) {
    throw new AuditEventValidationError("recordedAt range is invalid.");
  }
  const cursor = input.cursor
    ? {
        id: positiveInteger(input.cursor.id, "cursor.id"),
        recordedAt:
          validDate(input.cursor.recordedAt, "cursor.recordedAt") ??
          failInvalidCursor(),
      }
    : undefined;
  return {
    action,
    actorUserId,
    cursor,
    recordedFrom,
    recordedTo,
    targetId,
    targetType,
  };
}

function validDate(value: Date | undefined, name: string) {
  if (value === undefined) return undefined;
  if (Number.isNaN(value.getTime())) {
    throw new AuditEventValidationError(`${name} is invalid.`);
  }
  return value;
}

function failInvalidCursor(): never {
  throw new AuditEventValidationError("cursor.recordedAt is invalid.");
}

function normalizedInput<T>(input: AuditWriteInput<T>) {
  const actorUserId = nullablePositiveInteger(
    input.actor.userId,
    "actor.userId",
  );
  const ownerUserId = nullablePositiveInteger(
    input.ownerUserId ?? null,
    "ownerUserId",
  );
  if (!roles.includes(input.actor.role)) {
    throw new AuditEventValidationError("actor.role is invalid.");
  }
  if (input.authorization.type === "system") {
    if (
      input.actor.role !== "system" ||
      actorUserId !== null ||
      input.actor.username !== null
    ) {
      throw new AuditEventValidationError(
        "System authorization requires the system actor.",
      );
    }
  } else if (input.actor.role === "system") {
    throw new AuditEventValidationError(
      "The system actor requires system authorization.",
    );
  }
  if (
    input.authorization.type === "permission" &&
    !permissions.includes(input.authorization.permission)
  ) {
    throw new AuditEventValidationError("authorization.permission is invalid.");
  }
  if (Number.isNaN(input.occurredAt.getTime())) {
    throw new AuditEventValidationError("occurredAt is invalid.");
  }

  return {
    action: namespacedName(input.definition.action, "definition.action"),
    actorRole: input.actor.role,
    actorUserId,
    actorUsername: nullableText(input.actor.username, "actor.username", 200),
    authorizationType: input.authorization.type,
    correlationId: nullableText(input.correlationId, "correlationId", 200),
    occurredAt: input.occurredAt,
    ownerUserId,
    permission:
      input.authorization.type === "permission"
        ? input.authorization.permission
        : null,
    reason: nullableText(input.reason, "reason", 5000),
    requestId: nullableText(input.requestId, "requestId", 200),
    targetId: requiredText(input.targetId, "targetId", 200, targetIdPattern),
    targetType: namespacedName(
      input.definition.targetType,
      "definition.targetType",
    ),
  };
}

function normalizedPayload(payload: AuditPayload) {
  if (!payload || typeof payload !== "object") {
    throw new AuditEventValidationError("Audit payload is invalid.");
  }
  const before = jsonObject(payload.before, "before");
  const after = jsonObject(payload.after, "after");
  const metadata = jsonObject(payload.metadata, "metadata");
  if (metadata && (before || after)) {
    throw new AuditEventValidationError(
      "Audit payload cannot mix state and metadata.",
    );
  }
  if (!(before || after || metadata)) {
    throw new AuditEventValidationError("Audit payload is required.");
  }
  const size = [before, after, metadata].reduce(
    (total, value) =>
      total +
      (value ? new TextEncoder().encode(JSON.stringify(value)).byteLength : 0),
    0,
  );
  if (size > MAX_PAYLOAD_BYTES) throw new AuditPayloadTooLargeError();
  return { after, before, metadata };
}

function jsonObject(
  value: AuditJsonObject | undefined,
  name: string,
): AuditJsonObject | null {
  if (value === undefined) return null;
  try {
    const normalized = JSON.parse(JSON.stringify(value)) as unknown;
    if (
      typeof normalized !== "object" ||
      normalized === null ||
      Array.isArray(normalized)
    ) {
      throw new Error();
    }
    return normalized as AuditJsonObject;
  } catch {
    throw new AuditEventValidationError(`Audit ${name} is invalid.`);
  }
}

function definitionKey(
  definition: Pick<AuditEventDefinition<never>, "action" | "targetType">,
) {
  return `${namespacedName(definition.action, "definition.action")}:${namespacedName(definition.targetType, "definition.targetType")}`;
}

function namespacedName(value: string, name: string) {
  return requiredText(value, name, 120, namePattern);
}

function nullableText(
  value: string | null | undefined,
  name: string,
  maximum: number,
) {
  return value == null ? null : requiredText(value, name, maximum);
}

function requiredText(
  value: string,
  name: string,
  maximum: number,
  pattern?: RegExp,
) {
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > maximum ||
    (pattern && !pattern.test(normalized))
  ) {
    throw new AuditEventValidationError(`${name} is invalid.`);
  }
  return normalized;
}

function nullablePositiveInteger(value: number | null, name: string) {
  if (value === null) return null;
  positiveInteger(value, name);
  return value;
}

function positiveInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AuditEventValidationError(`${name} is invalid.`);
  }
  return value;
}

function redactionMatches(
  event: AuditEvent,
  expected: Pick<
    AuditEvent,
    | "actorUserId"
    | "actorUsername"
    | "afterState"
    | "beforeState"
    | "metadata"
    | "ownerUserId"
    | "reason"
  >,
) {
  return (
    event.actorUserId === expected.actorUserId &&
    event.actorUsername === expected.actorUsername &&
    event.ownerUserId === expected.ownerUserId &&
    event.reason === expected.reason &&
    canonicalJson(event.beforeState) === canonicalJson(expected.beforeState) &&
    canonicalJson(event.afterState) === canonicalJson(expected.afterState) &&
    canonicalJson(event.metadata) === canonicalJson(expected.metadata)
  );
}

function canonicalJson(value: AuditJsonObject | null): string {
  if (value === null) return "null";
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJsonValue(value[key] ?? null)}`,
    )
    .join(",")}}`;
}

function canonicalJsonValue(value: AuditJsonObject[string]): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJsonValue).join(",")}]`;
  }
  return typeof value === "object" && value !== null
    ? canonicalJson(value)
    : JSON.stringify(value);
}
