import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("maker profiles migration", () => {
  const database = new PGlite();

  beforeAll(async () => {
    await database.exec(`
      CREATE TABLE "makers" (
        "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        "name" text NOT NULL
      );
      INSERT INTO "makers" ("name") VALUES
        ('Café Works'),
        ('Cafe Works'),
        ('東京');
    `);
    const migration = readFileSync(
      new URL("../drizzle/0053_maker-profiles.sql", import.meta.url),
      "utf8",
    ).replaceAll("--> statement-breakpoint", "");
    await database.exec(migration);
  });

  afterAll(async () => {
    await database.close();
  });

  it("backfills unique slugs with the shared catalog normalization rules", async () => {
    await expect(
      database.query<{
        /** Backfilled maker name. */
        name: string;
        /** Backfilled unique maker slug. */
        slug: string;
      }>('SELECT "name", "slug" FROM "makers" ORDER BY "id"'),
    ).resolves.toMatchObject({
      rows: [
        { name: "Café Works", slug: "cafe-works" },
        { name: "Cafe Works", slug: "cafe-works-2" },
        { name: "東京", slug: "maker" },
      ],
    });
  });
});
