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

/** Actors allowed to initiate an erasure request. */
export const erasureInitiators = ["self", "admin"] as const;
/** Durable lifecycle states for an erasure request. */
export const erasureStatuses = [
  "pending",
  "running",
  "completed",
  "needs_attention",
] as const;
/** Supported provenance methods for verified erasure requests. */
export const erasureVerificationMethods = [
  "clerk_reverification",
  "authenticated_request",
  "verified_email",
  "clerk_webhook",
] as const;
/** Ordered operation names in the erasure workflow. */
export const erasureStepNames = [
  "quiesce",
  "snapshot",
  "inaccessible",
  "storage",
  "database",
  "providers",
  "verify",
] as const;

/** Supported value for erasure initiator. */
export type ErasureInitiator = (typeof erasureInitiators)[number];
/** Supported value for erasure status. */
export type ErasureStatus = (typeof erasureStatuses)[number];
/** Supported value for erasure verification method. */
export type ErasureVerificationMethod =
  (typeof erasureVerificationMethods)[number];
/** Supported value for erasure step name. */
export type ErasureStepName = (typeof erasureStepNames)[number];
/** Temporary legal or operational reason that prevents deleting retained data. */
export type ErasureRetentionException = {
  /** Stable code identifying the retention exception. */
  code: string;
  /** ISO timestamp when the retention exception expires. */
  expiresAt: string;
};
/** Durable completion state and retention exceptions for one erasure step. */
export type ErasureStepResult = {
  /** ISO timestamp when the step completed. */
  completedAt?: string;
  /** Retention exceptions that remain after the step. */
  exceptions?: ErasureRetentionException[];
  /** Current durable state of the operation step. */
  status: "pending" | "completed";
};
/** Durable results keyed by every erasure workflow step. */
export type ErasureStepResults = Record<ErasureStepName, ErasureStepResult>;

/** Durable idempotent account-erasure requests and progress receipts. */
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
    check(
      "erasure_request_verification_provenance_valid",
      sql`${table.verifiedAt} is not null and (
        (
          ${table.initiator} = 'self'
          and ${table.verificationMethod} = 'clerk_reverification'
          and ${table.verificationReference} is null
          and (
            (${table.status} = 'completed' and ${table.targetClerkId} is null and ${table.verifiedByClerkId} is null)
            or (${table.status} <> 'completed' and ${table.targetClerkId} is not null and ${table.verifiedByClerkId} is not null and ${table.verifiedByClerkId} = ${table.targetClerkId})
          )
        )
        or (
          ${table.initiator} = 'admin'
          and ${table.verifiedByClerkId} is not null
          and (
            (${table.verificationMethod} in ('authenticated_request', 'verified_email') and ${table.verificationReference} is not null)
            or (${table.verificationMethod} = 'clerk_webhook' and ${table.verificationReference} = 'clerk_webhook' and ${table.verifiedByClerkId} = 'clerk_webhook')
          )
          and (
            (${table.status} = 'completed' and ${table.targetClerkId} is null)
            or (${table.status} <> 'completed' and ${table.targetClerkId} is not null)
          )
        )
      )`,
    ),
    check("erasure_request_attempts_valid", sql`${table.attempts} >= 0`),
    check(
      "erasure_request_completion_valid",
      sql`(${table.status} = 'completed') = (${table.completedAt} is not null and ${table.expiresAt} is not null and ${table.targetClerkId} is null)`,
    ),
  ],
);

/** Stored erasure-request row. */
export type ErasureRequest = typeof erasureRequest.$inferSelect;
/** Values accepted when creating an erasure-request row. */
export type NewErasureRequest = typeof erasureRequest.$inferInsert;
