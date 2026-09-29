import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("catalog product details migration", () => {
  const database = new PGlite();

  beforeAll(async () => {
    await database.exec(`
      CREATE TABLE "collection_item" ("id" bigint PRIMARY KEY);
      CREATE TABLE "collection_spinner" ("id" bigint PRIMARY KEY);
      CREATE TABLE "product" ("id" bigint PRIMARY KEY);
      CREATE TABLE "product_spinner" ("id" bigint PRIMARY KEY);
      INSERT INTO "collection_item" ("id") VALUES (1);
      INSERT INTO "collection_spinner" ("id") VALUES (1);
      INSERT INTO "product" ("id") VALUES (1);
      INSERT INTO "product_spinner" ("id") VALUES (1);
    `);
    const migration = readFileSync(
      new URL("../drizzle/0030_nifty_madelyne_pryor.sql", import.meta.url),
      "utf8",
    ).replaceAll("--> statement-breakpoint", "");
    await database.exec(migration);
  });

  afterAll(async () => {
    await database.close();
  });

  it("backfills and defaults maker product URL validity", async () => {
    await database.exec('INSERT INTO "product" ("id") VALUES (2)');
    await expect(
      database.query<{ maker_product_url_valid: boolean }>(
        'SELECT "maker_product_url_valid" FROM "product" ORDER BY "id"',
      ),
    ).resolves.toMatchObject({
      rows: [
        { maker_product_url_valid: true },
        { maker_product_url_valid: true },
      ],
    });
  });

  it.each([
    ["product", "description", 5000],
    ["collection_item", "description", 5000],
    ["product_spinner", "bearing", 200],
    ["collection_spinner", "bearing", 200],
  ])("enforces %s.%s at %i characters", async (table, column, limit) => {
    await expect(
      database.exec(
        `UPDATE "${table}" SET "${column}" = repeat('x', ${limit}) WHERE "id" = 1`,
      ),
    ).resolves.toBeDefined();
    await expect(
      database.exec(
        `UPDATE "${table}" SET "${column}" = repeat('x', ${limit + 1}) WHERE "id" = 1`,
      ),
    ).rejects.toThrow(/constraint/iu);
  });
});
