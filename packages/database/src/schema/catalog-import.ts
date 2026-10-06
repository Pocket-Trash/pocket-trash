import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Durable operation kinds for catalog manifest application attempts. */
export const catalogManifestOperations = ["apply", "rollback"] as const;

/** Durable terminal and in-progress outcomes for catalog manifest attempts. */
export const catalogManifestOutcomes = [
  "running",
  "succeeded",
  "failed",
  "rolled_back",
] as const;

/** Durable object ownership states retained after activation or rollback. */
export const catalogManifestObjectStates = ["active", "rolled_back"] as const;

/**
 * Auditable catalog manifest application attempts.
 *
 * Terminal rows are made immutable by the matching database trigger.
 */
export const catalogManifestApplication = pgTable(
  "catalog_manifest_application",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    manifestVersion: text("manifest_version").notNull(),
    manifestHash: text("manifest_hash").notNull(),
    approvalPayloadHash: text("approval_payload_hash").notNull(),
    operation: text("operation", { enum: catalogManifestOperations }).notNull(),
    environment: text("environment", {
      enum: ["development", "preview", "production"],
    }).notNull(),
    ownerClerkId: text("owner_clerk_id").notNull(),
    actorClerkId: text("actor_clerk_id").notNull(),
    recordCount: bigint("record_count", { mode: "number" }).notNull(),
    imageCount: bigint("image_count", { mode: "number" }).notNull(),
    totalBytes: bigint("total_bytes", { mode: "number" }).notNull(),
    outcome: text("outcome", { enum: catalogManifestOutcomes })
      .default("running")
      .notNull(),
    errorCode: text("error_code"),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    index("catalog_manifest_application_hash_started_idx").on(
      table.manifestHash,
      table.startedAt,
    ),
    check(
      "catalog_manifest_application_hash_valid",
      sql`${table.manifestHash} ~ '^[0-9a-f]{64}$' and ${table.approvalPayloadHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "catalog_manifest_application_counts_valid",
      sql`${table.recordCount} >= 0 and ${table.imageCount} >= 0 and ${table.totalBytes} >= 0`,
    ),
    check(
      "catalog_manifest_application_outcome_valid",
      sql`${table.outcome} in ('running', 'succeeded', 'failed', 'rolled_back')`,
    ),
    check(
      "catalog_manifest_application_operation_valid",
      sql`${table.operation} in ('apply', 'rollback')`,
    ),
    check(
      "catalog_manifest_application_environment_valid",
      sql`${table.environment} in ('development', 'preview', 'production')`,
    ),
    check(
      "catalog_manifest_application_terminal_consistent",
      sql`(${table.outcome} = 'running' and ${table.finishedAt} is null and ${table.errorCode} is null)
        or (${table.outcome} = 'failed' and ${table.finishedAt} is not null and ${table.errorCode} is not null)
        or (${table.outcome} in ('succeeded', 'rolled_back') and ${table.finishedAt} is not null and ${table.errorCode} is null)`,
    ),
  ],
);

/** Durable ownership of one catalog record created or updated by a manifest. */
export const catalogManifestRecord = pgTable(
  "catalog_manifest_record",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => catalogManifestApplication.id, {
        onDelete: "restrict",
      }),
    manifestHash: text("manifest_hash").notNull(),
    recordKey: text("record_key").notNull(),
    entityType: text("entity_type").notNull(),
    recordId: text("record_id").notNull(),
    appliedFingerprint: text("applied_fingerprint").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    rolledBackAt: timestamp("rolled_back_at", {
      mode: "date",
      withTimezone: true,
    }),
  },
  (table) => [
    uniqueIndex("catalog_manifest_record_hash_key_unique").on(
      table.manifestHash,
      table.recordKey,
    ),
    uniqueIndex("catalog_manifest_record_active_entity_unique")
      .on(table.entityType, table.recordId)
      .where(sql`${table.rolledBackAt} is null`),
    index("catalog_manifest_record_application_idx").on(table.applicationId),
    check(
      "catalog_manifest_record_hashes_valid",
      sql`${table.manifestHash} ~ '^[0-9a-f]{64}$' and ${table.appliedFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "catalog_manifest_record_identity_valid",
      sql`char_length(trim(${table.recordKey})) between 1 and 200
        and char_length(trim(${table.entityType})) between 1 and 100
        and char_length(trim(${table.recordId})) between 1 and 200`,
    ),
  ],
);

/** Durable ownership and verification metadata for one manifest image object. */
export const catalogManifestObject = pgTable(
  "catalog_manifest_object",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => catalogManifestApplication.id, {
        onDelete: "restrict",
      }),
    manifestHash: text("manifest_hash").notNull(),
    imageKey: text("image_key").notNull(),
    ownerRecordKey: text("owner_record_key").notNull(),
    objectPath: text("object_path").notNull(),
    url: text("url").notNull(),
    sha256: text("sha256").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    state: text("state", { enum: catalogManifestObjectStates })
      .default("active")
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    rolledBackAt: timestamp("rolled_back_at", {
      mode: "date",
      withTimezone: true,
    }),
  },
  (table) => [
    uniqueIndex("catalog_manifest_object_hash_key_unique").on(
      table.manifestHash,
      table.imageKey,
    ),
    uniqueIndex("catalog_manifest_object_path_unique").on(table.objectPath),
    index("catalog_manifest_object_application_idx").on(table.applicationId),
    check(
      "catalog_manifest_object_hashes_valid",
      sql`${table.manifestHash} ~ '^[0-9a-f]{64}$' and ${table.sha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check("catalog_manifest_object_size_positive", sql`${table.size} > 0`),
    check(
      "catalog_manifest_object_state_valid",
      sql`${table.state} in ('active', 'rolled_back')`,
    ),
    check(
      "catalog_manifest_object_state_consistent",
      sql`(${table.state} = 'active' and ${table.rolledBackAt} is null)
        or (${table.state} = 'rolled_back' and ${table.rolledBackAt} is not null)`,
    ),
  ],
);

/** Stored catalog manifest application row. */
export type CatalogManifestApplication =
  typeof catalogManifestApplication.$inferSelect;
/** Stored manifest-owned catalog record row. */
export type CatalogManifestRecord = typeof catalogManifestRecord.$inferSelect;
/** Stored manifest-owned image object row. */
export type CatalogManifestObject = typeof catalogManifestObject.$inferSelect;
