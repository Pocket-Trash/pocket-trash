import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("collection spinner button migration", () => {
  const database = new PGlite();

  beforeAll(async () => {
    await database.exec(`
      CREATE TABLE "collection_spinner" (
        "id" bigint PRIMARY KEY,
        "installed_button_id" bigint
      );
    `);
    const migrations = new URL("../drizzle/", import.meta.url);
    const migration = readdirSync(migrations).find(
      (name) =>
        name.endsWith(".sql") &&
        readFileSync(new URL(name, migrations), "utf8").includes(
          "collection_spinner_installed_button_unique",
        ),
    );
    if (!migration) throw new Error("Spinner button migration was not found.");
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

  it("allows uninstalled spinners and moving a button between spinners", async () => {
    await database.exec(
      'INSERT INTO "collection_spinner" ("id", "installed_button_id") VALUES (1, NULL), (2, NULL)',
    );
    await database.exec(
      'UPDATE "collection_spinner" SET "installed_button_id" = 10 WHERE "id" = 1',
    );
    await expect(
      database.exec(
        'UPDATE "collection_spinner" SET "installed_button_id" = 10 WHERE "id" = 2',
      ),
    ).rejects.toThrow(/unique/iu);
    await database.exec(
      'UPDATE "collection_spinner" SET "installed_button_id" = NULL WHERE "id" = 1',
    );
    await expect(
      database.exec(
        'UPDATE "collection_spinner" SET "installed_button_id" = 10 WHERE "id" = 2',
      ),
    ).resolves.toBeDefined();
  });
});
