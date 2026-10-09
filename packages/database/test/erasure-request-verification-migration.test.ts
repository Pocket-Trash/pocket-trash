import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("erasure request verification baseline", () => {
  const database = new PGlite();

  beforeAll(async () => {
    await migrate(drizzle({ client: database }), {
      migrationsFolder: fileURLToPath(new URL("../drizzle/", import.meta.url)),
    });
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it.each([
    [
      "pending self-service",
      "'self_user', 'self', NULL, 'clerk_reverification', 'self_user', now(), 'pending'",
    ],
    [
      "completed self-service receipt",
      "NULL, 'self', NULL, 'clerk_reverification', NULL, now(), 'completed'",
    ],
    [
      "pending admin",
      "'admin_target', 'admin', 'privacy_ticket_1', 'verified_email', 'admin_user', now(), 'pending'",
    ],
    [
      "completed admin receipt",
      "NULL, 'admin', 'privacy_ticket_2', 'authenticated_request', 'admin_user', now(), 'completed'",
    ],
    [
      "pending Clerk webhook",
      "'webhook_target', 'admin', 'clerk_webhook', 'clerk_webhook', 'clerk_webhook', now(), 'needs_attention'",
    ],
    [
      "completed Clerk webhook receipt",
      "NULL, 'admin', 'clerk_webhook', 'clerk_webhook', 'clerk_webhook', now(), 'completed'",
    ],
  ])("allows %s provenance", async (_name, values) => {
    await expect(insert(values)).resolves.toBeDefined();
  });

  it.each([
    [
      "missing verification time",
      "'self_user', 'self', NULL, 'clerk_reverification', 'self_user', NULL, 'pending'",
    ],
    [
      "missing verification actor",
      "'self_user', 'self', NULL, 'clerk_reverification', NULL, now(), 'pending'",
    ],
    [
      "missing admin evidence",
      "'admin_target', 'admin', NULL, 'verified_email', 'admin_user', now(), 'pending'",
    ],
    [
      "mismatched self-service method",
      "'self_user', 'self', 'privacy_ticket', 'verified_email', 'self_user', now(), 'pending'",
    ],
    [
      "mismatched self-service actor",
      "'self_user', 'self', NULL, 'clerk_reverification', 'other_user', now(), 'pending'",
    ],
    [
      "mismatched webhook evidence",
      "'webhook_target', 'admin', 'privacy_ticket', 'clerk_webhook', 'admin_user', now(), 'needs_attention'",
    ],
    [
      "unredacted completed self-service actor",
      "NULL, 'self', NULL, 'clerk_reverification', 'self_user', now(), 'completed'",
    ],
  ])("rejects %s", async (_name, values) => {
    await expect(insert(values)).rejects.toThrow(
      /erasure_request_verification_provenance_valid/iu,
    );
  });

  /**
   * Inserts one raw verification-provenance tuple for constraint testing.
   *
   * @param values - SQL values for the provenance columns.
   * @returns The database execution promise.
   * @rejects When PostgreSQL rejects the inserted tuple.
   */
  function insert(values: string) {
    return database.exec(`
      INSERT INTO erasure_request (
        subject_hmac, step_results, target_clerk_id, initiator,
        verification_reference, verification_method, verified_by_clerk_id,
        verified_at, status, completed_at, expires_at
      ) SELECT gen_random_uuid()::text, '{}'::jsonb, target, initiator,
        reference, method, actor, verified::timestamptz, status,
        CASE WHEN status = 'completed' THEN now() END,
        CASE WHEN status = 'completed' THEN now() + interval '30 days' END
      FROM (VALUES (${values})) AS provenance(target, initiator, reference, method, actor, verified, status);
    `);
  }
});
