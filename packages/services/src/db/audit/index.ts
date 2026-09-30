import type { AuditEvent, AuditJsonObject, Database } from "@package/database";
import { schema } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import {
  and,
  desc,
  eq,
  gte,
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

export type AuditWriteInput<T> = {
  actor: AuditActor;
  authorization: AuditAuthorization;
  correlationId?: string | null;
  data: T;
  definition: AuditEventDefinition<T>;
  occurredAt: Date;
  ownerUserId?: number | null;
  reason?: string | null;
  requestId?: string | null;
  targetId: string;
};

export type AuditService = {
  list(input: ListAuditEventsInput): Promise<AuditEventPage>;
  redactAccount(transaction: AuditTransaction, userId: number): Promise<void>;
  write<T>(
    transaction: AuditTransaction,
    input: AuditWriteInput<T>,
  ): Promise<AuditEvent>;
};

export type AuditEventCursor = {
  id: number;
  recordedAt: Date;
};

export type ListAuditEventsInput = {
  action?: string;
  actor: Actor;
  actorUserId?: number;
  cursor?: AuditEventCursor;
  recordedFrom?: Date;
  recordedTo?: Date;
  targetId?: string;
  targetType?: string;
};

export type AuditEventPage = {
  coverageStartAt: Date | null;
  coveredDomains: string[];
  items: AuditEvent[];
  nextCursor: AuditEventCursor | null;
};

export class AuditEventValidationError extends Error {}
export class AuditPayloadTooLargeError extends Error {}

export function createAuditService(
  logger: Logger,
  definitions: readonly AuditEventDefinition<never>[] = [],
  database?: Pick<Database, "select">,
): AuditService {
  const registered = new Map<string, AuditEventDefinition<never>>();
  for (const definition of definitions) {
    const key = definitionKey(definition);
    if (registered.has(key)) {
      throw new AuditEventValidationError(`Duplicate audit event ${key}.`);
    }
    registered.set(key, definition);
  }

  return {
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
          ...new Set(definitions.map(({ action }) => action.split(".")[0])),
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

    async write(transaction, input) {
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
    },

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
          if (events.length === 0) return;

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
        },
      );
    },
  };
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
