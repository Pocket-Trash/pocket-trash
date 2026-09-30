import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("feedback value domains migration", () => {
  const database = new PGlite();

  beforeAll(async () => {
    await database.exec(`
      CREATE TABLE "feedback" (
        "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        "category" text,
        "status" text NOT NULL,
        CONSTRAINT "feedback_approved_category_required"
          CHECK ("status" in ('pending', 'merged', 'denied') or "category" is not null)
      );
      CREATE TABLE "feedback_notifications" (
        "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        "type" text NOT NULL
      );
    `);
    const migrations = new URL("../drizzle/", import.meta.url);
    const migration = readdirSync(migrations).find(
      (name) =>
        name.endsWith(".sql") &&
        readFileSync(new URL(name, migrations), "utf8").includes(
          "feedback_notifications_type_valid",
        ),
    );
    if (!migration) throw new Error("Feedback value migration was not found.");
    await database.exec(
      readFileSync(new URL(migration, migrations), "utf8").replaceAll(
        "--> statement-breakpoint",
        "",
      ),
    );
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
        `INSERT INTO "feedback" ("category", "status") VALUES (${category}, '${status}')`,
      ),
    ).resolves.toBeDefined();
  });

  it.each([
    "submitted",
    "completed",
  ])("allows the %s notification type", async (type) => {
    await expect(
      database.exec(
        `INSERT INTO "feedback_notifications" ("type") VALUES ('${type}')`,
      ),
    ).resolves.toBeDefined();
  });

  it("rejects an invalid category insert and update", async () => {
    await expect(
      database.exec(
        `INSERT INTO "feedback" ("category", "status") VALUES ('unknown', 'pending')`,
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
        `INSERT INTO "feedback" ("category", "status") VALUES ('feature', 'unknown')`,
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
        `INSERT INTO "feedback_notifications" ("type") VALUES ('unknown')`,
      ),
    ).rejects.toThrow(/feedback_notifications_type_valid/iu);
    await expect(
      database.exec(
        `UPDATE "feedback_notifications" SET "type" = 'unknown' WHERE "type" = 'submitted'`,
      ),
    ).rejects.toThrow(/feedback_notifications_type_valid/iu);
  });
});
