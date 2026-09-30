import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export type AuditJson =
  | boolean
  | null
  | number
  | string
  | AuditJson[]
  | { [key: string]: AuditJson };
export type AuditJsonObject = { [key: string]: AuditJson };

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

export type AuditEvent = typeof auditEvent.$inferSelect;
export type NewAuditEvent = typeof auditEvent.$inferInsert;
