import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** JSON value accepted in an audit payload. */
export type AuditJson =
  | boolean
  | null
  | number
  | string
  | AuditJson[]
  | {
      /** JSON values keyed by audit field name. */
      [key: string]: AuditJson;
    };
/** String-keyed JSON object accepted in an audit payload. */
export type AuditJsonObject = {
  /** JSON values keyed by audit field name. */
  [key: string]: AuditJson;
};

/** Append-only audit events, except for account-erasure redaction and retention deletion. */
export const auditEvent = pgTable(
  "audit_event",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    actorUserId: bigint("actor_user_id", { mode: "number" }),
    ownerUserId: bigint("owner_user_id", { mode: "number" }),
    actorUsername: text("actor_username"),
    actorRole: text("actor_role").notNull(),
    authorizationType: text("authorization_type").notNull(),
    permission: text("permission"),
    reason: text("reason"),
    beforeState: jsonb("before_state").$type<AuditJsonObject>(),
    afterState: jsonb("after_state").$type<AuditJsonObject>(),
    metadata: jsonb("metadata").$type<AuditJsonObject>(),
    requestId: text("request_id"),
    correlationId: text("correlation_id"),
    occurredAt: timestamp("occurred_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    recordedAt: timestamp("recorded_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_event_recorded_at_id_idx").on(table.recordedAt, table.id),
    index("audit_event_actor_recorded_at_id_idx")
      .on(table.actorUserId, table.recordedAt, table.id)
      .where(sql`${table.actorUserId} is not null`),
    index("audit_event_owner_user_id_idx")
      .on(table.ownerUserId)
      .where(sql`${table.ownerUserId} is not null`),
    index("audit_event_action_recorded_at_id_idx").on(
      table.action,
      table.recordedAt,
      table.id,
    ),
    index("audit_event_target_recorded_at_id_idx").on(
      table.targetType,
      table.targetId,
      table.recordedAt,
      table.id,
    ),
    check(
      "audit_event_actor_role_valid",
      sql`${table.actorRole} in ('user', 'editor', 'admin', 'system_admin', 'system')`,
    ),
    check(
      "audit_event_authorization_valid",
      sql`${table.authorizationType} in ('owner', 'permission', 'system')`,
    ),
    check(
      "audit_event_authorization_metadata_consistent",
      sql`(
        ${table.authorizationType} = 'permission'
        and ${table.permission} is not null
        and ${table.actorRole} <> 'system'
      ) or (
        ${table.authorizationType} = 'owner'
        and ${table.permission} is null
        and ${table.actorRole} <> 'system'
      ) or (
        ${table.authorizationType} = 'system'
        and ${table.permission} is null
        and ${table.actorRole} = 'system'
        and ${table.actorUserId} is null
        and ${table.actorUsername} is null
      )`,
    ),
    check(
      "audit_event_payload_shape_valid",
      sql`num_nonnulls(${table.beforeState}, ${table.afterState}, ${table.metadata}) > 0
        and (${table.metadata} is null or (${table.beforeState} is null and ${table.afterState} is null))`,
    ),
    check(
      "audit_event_payload_size_valid",
      sql`octet_length(coalesce(${table.beforeState}::text, ''))
        + octet_length(coalesce(${table.afterState}::text, ''))
        + octet_length(coalesce(${table.metadata}::text, '')) <= 262144`,
    ),
    check(
      "audit_event_reason_nonblank",
      sql`${table.reason} is null or char_length(trim(${table.reason})) > 0`,
    ),
  ],
);

/** Stored audit event row. */
export type AuditEvent = typeof auditEvent.$inferSelect;
/** Values accepted when creating an audit-event row. */
export type NewAuditEvent = typeof auditEvent.$inferInsert;

/** Durable ranges and completion state for bounded audit exports. */
const auditExport = pgTable(
  "audit_export",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestedByUserId: bigint("requested_by_user_id", { mode: "number" }),
    requestedByUsername: text("requested_by_username"),
    requestedByRole: text("requested_by_role").notNull(),
    reason: text("reason").notNull(),
    cutoffAt: timestamp("cutoff_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    highWaterEventId: bigint("high_water_event_id", {
      mode: "number",
    }).notNull(),
    highWaterRecordedAt: timestamp("high_water_recorded_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    eventCount: integer("event_count").notNull(),
    sha256: text("sha256"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", {
      mode: "date",
      withTimezone: true,
    }),
    consumedAt: timestamp("consumed_at", {
      mode: "date",
      withTimezone: true,
    }),
  },
  (table) => [
    uniqueIndex("audit_export_one_unconsumed_unique")
      .on(sql`(1)`)
      .where(sql`${table.consumedAt} is null`),
    index("audit_export_requester_idx")
      .on(table.requestedByUserId)
      .where(sql`${table.requestedByUserId} is not null`),
    check(
      "audit_export_requester_role_valid",
      sql`${table.requestedByRole} in ('editor', 'admin', 'system_admin')`,
    ),
    check(
      "audit_export_reason_valid",
      sql`char_length(trim(${table.reason})) between 1 and 500`,
    ),
    check(
      "audit_export_event_count_valid",
      sql`${table.eventCount} between 1 and 10000`,
    ),
    check(
      "audit_export_checksum_valid",
      sql`${table.sha256} is null or ${table.sha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "audit_export_completion_valid",
      sql`(${table.completedAt} is null and ${table.sha256} is null)
        or (${table.completedAt} is not null and ${table.sha256} is not null)`,
    ),
    check(
      "audit_export_consumption_valid",
      sql`${table.consumedAt} is null or ${table.completedAt} is not null`,
    ),
  ],
);

export { auditExport };

/** Stored audit-export row. */
export type AuditExport = typeof auditExport.$inferSelect;
/** Values accepted when creating an audit-export row. */
export type NewAuditExport = typeof auditExport.$inferInsert;
