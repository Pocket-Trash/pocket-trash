import { sql } from "drizzle-orm";
import {
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

export const erasureInitiators = ["self", "admin"] as const;
export const erasureStatuses = [
  "pending",
  "running",
  "completed",
  "needs_attention",
] as const;
export const erasureVerificationMethods = [
  "clerk_reverification",
  "authenticated_request",
  "verified_email",
  "clerk_webhook",
] as const;
export const erasureStepNames = [
  "quiesce",
  "snapshot",
  "inaccessible",
  "storage",
  "database",
  "providers",
  "verify",
] as const;

export type ErasureInitiator = (typeof erasureInitiators)[number];
export type ErasureStatus = (typeof erasureStatuses)[number];
export type ErasureVerificationMethod =
  (typeof erasureVerificationMethods)[number];
export type ErasureStepName = (typeof erasureStepNames)[number];
export type ErasureRetentionException = {
  code: string;
  expiresAt: string;
};
export type ErasureStepResult = {
  completedAt?: string;
  exceptions?: ErasureRetentionException[];
  status: "pending" | "completed";
};
export type ErasureStepResults = Record<ErasureStepName, ErasureStepResult>;

export const erasureRequest = pgTable(
  "erasure_request",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectHmac: text("subject_hmac").notNull().unique(),
    targetClerkId: text("target_clerk_id"),
    initiator: text("initiator", { enum: erasureInitiators }).notNull(),
    verificationReference: text("verification_reference"),
    verificationMethod: text("verification_method", {
      enum: erasureVerificationMethods,
    }),
    verifiedByClerkId: text("verified_by_clerk_id"),
    verifiedAt: timestamp("verified_at", { mode: "date", withTimezone: true }),
    status: text("status", { enum: erasureStatuses })
      .default("pending")
      .notNull(),
    storageTargets: text("storage_targets").array(),
    stepResults: jsonb("step_results").$type<ErasureStepResults>().notNull(),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", {
      mode: "date",
      withTimezone: true,
    }),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true }),
    completedAt: timestamp("completed_at", {
      mode: "date",
      withTimezone: true,
    }),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("erasure_request_target_clerk_id_unique")
      .on(table.targetClerkId)
      .where(sql`${table.targetClerkId} is not null`),
    index("erasure_request_due_idx").on(table.status, table.nextAttemptAt),
    index("erasure_request_expiry_idx").on(table.expiresAt),
    check(
      "erasure_request_initiator_valid",
      sql`${table.initiator} in ('self', 'admin')`,
    ),
    check(
      "erasure_request_status_valid",
      sql`${table.status} in ('pending', 'running', 'completed', 'needs_attention')`,
    ),
    check(
      "erasure_request_verification_method_valid",
      sql`${table.verificationMethod} is null or ${table.verificationMethod} in ('clerk_reverification', 'authenticated_request', 'verified_email', 'clerk_webhook')`,
    ),
    check("erasure_request_attempts_valid", sql`${table.attempts} >= 0`),
    check(
      "erasure_request_completion_valid",
      sql`(${table.status} = 'completed') = (${table.completedAt} is not null and ${table.expiresAt} is not null and ${table.targetClerkId} is null)`,
    ),
  ],
);

export type ErasureRequest = typeof erasureRequest.$inferSelect;
export type NewErasureRequest = typeof erasureRequest.$inferInsert;
