import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("schema repair migrations", () => {
  it("renames the legacy user table only when users is absent", () => {
    const migration = readFileSync(
      new URL("../drizzle/0024_repair_users_table_name.sql", import.meta.url),
      "utf8",
    );

    expect(migration).toContain("to_regclass('public.users') IS NULL");
    expect(migration).toContain("to_regclass('public.\"user\"') IS NOT NULL");
    expect(migration).toContain('ALTER TABLE "user" RENAME TO "users"');
  });

  it("reuses catalog tables created by the pre-merge migration history", () => {
    const migration = readFileSync(
      new URL("../drizzle/0028_tidy_luke_cage.sql", import.meta.url),
      "utf8",
    );

    expect(migration).toContain('ALTER TABLE "maker" RENAME TO "makers"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "collection_item"');
    expect(migration).toContain(
      'ALTER TABLE "color" ADD COLUMN IF NOT EXISTS "hex" text',
    );
  });

  it("backfills catalog ownership and keeps existing collections public", () => {
    const migration = readFileSync(
      new URL("../drizzle/0028_tidy_luke_cage.sql", import.meta.url),
      "utf8",
    );

    expect(migration).toContain(
      'UPDATE "product" SET "owner_clerk_id" = \'user_3FrjTtIKHL0ptK6jeljcf5kCM7J\'',
    );
    expect(migration).toContain(
      'SELECT DISTINCT "owner_id", false FROM "collection_item"',
    );
  });

  it("can resume after the former catalog migrations were applied", () => {
    const migration = readFileSync(
      new URL("../drizzle/0028_tidy_luke_cage.sql", import.meta.url),
      "utf8",
    );

    expect(migration).toContain(
      'CREATE TABLE IF NOT EXISTS "catalog_image_upload_file"',
    );
    expect(migration).toContain(
      'ALTER TABLE "collection_item" ADD COLUMN IF NOT EXISTS "collection_id"',
    );
    expect(migration).toContain(
      'ALTER TABLE "catalog_image_upload_session" DROP CONSTRAINT IF EXISTS "catalog_image_upload_session_target_consistent"',
    );
  });
});
