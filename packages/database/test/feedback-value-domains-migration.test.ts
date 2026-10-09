import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("feedback value domains baseline", () => {
  const database = new PGlite();

  beforeAll(async () => {
    await migrate(drizzle({ client: database }), {
      migrationsFolder: fileURLToPath(new URL("../drizzle/", import.meta.url)),
    });
  });

  afterAll(async () => {
    await database.close();
  });

  it.each([
    ["pending", "NULL"],
    ["requested", "'product_type'"],
    ["planned", "'feature'"],
    ["in_progress", "'improvement'"],
    ["completed", "'bug'"],
    ["merged", "NULL"],
    ["denied", "NULL"],
    ["canceled", "'feature'"],
  ])("allows the %s feedback lifecycle branch", async (status, category) => {
    await expect(
      database.exec(
        `INSERT INTO "feedback" ("submitter_clerk_id", "title", "description", "category", "status") VALUES ('feedback-owner', 'Domain test', 'Domain description', ${category}, '${status}')`,
      ),
    ).resolves.toBeDefined();
  });

  it.each([
    "submitted",
    "completed",
  ])("allows the %s notification type", async (type) => {
    await expect(
      database.exec(
        `INSERT INTO "feedback_notifications" ("feedback_id", "type") VALUES (1000, '${type}')`,
      ),
    ).resolves.toBeDefined();
  });

  it("rejects an invalid category insert and update", async () => {
    await expect(
      database.exec(
        `INSERT INTO "feedback" ("submitter_clerk_id", "title", "description", "category", "status") VALUES ('feedback-owner', 'Domain test', 'Domain description', 'unknown', 'pending')`,
      ),
    ).rejects.toThrow(/feedback_category_valid/iu);
    await expect(
      database.exec(
        `UPDATE "feedback" SET "category" = 'unknown' WHERE "status" = 'pending'`,
      ),
    ).rejects.toThrow(/feedback_category_valid/iu);
  });

  it("rejects an invalid status insert and update", async () => {
    await expect(
      database.exec(
        `INSERT INTO "feedback" ("submitter_clerk_id", "title", "description", "category", "status") VALUES ('feedback-owner', 'Domain test', 'Domain description', 'feature', 'unknown')`,
      ),
    ).rejects.toThrow(/feedback_status_valid/iu);
    await expect(
      database.exec(
        `UPDATE "feedback" SET "status" = 'unknown' WHERE "status" = 'requested'`,
      ),
    ).rejects.toThrow(/feedback_status_valid/iu);
  });

  it("rejects an invalid notification type insert and update", async () => {
    await expect(
      database.exec(
        `INSERT INTO "feedback_notifications" ("feedback_id", "type") VALUES (1000, 'unknown')`,
      ),
    ).rejects.toThrow(/feedback_notifications_type_valid/iu);
    await expect(
      database.exec(
        `UPDATE "feedback_notifications" SET "type" = 'unknown' WHERE "type" = 'submitted'`,
      ),
    ).rejects.toThrow(/feedback_notifications_type_valid/iu);
  });
});
