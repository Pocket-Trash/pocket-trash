import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("catalog name uniqueness migration", () => {
  const database = new PGlite();

  beforeAll(async () => {
    await database.exec(`
      CREATE TABLE "makers" ("id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, "name" text NOT NULL);
      CREATE TABLE "materials" ("id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, "name" text NOT NULL, "slug" text NOT NULL);
      CREATE TABLE "finish" ("id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, "name" text NOT NULL, "slug" text NOT NULL);
      CREATE TABLE "color" ("id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, "name" text NOT NULL, "slug" text NOT NULL, "hex" text NOT NULL);
    `);
    const migrations = new URL("../drizzle/", import.meta.url);
    const migration = readdirSync(migrations).find(
      (name) =>
        name.endsWith(".sql") &&
        readFileSync(new URL(name, migrations), "utf8").includes(
          "makers_name_case_insensitive_unique",
        ),
    );
    if (!migration) throw new Error("Catalog name migration was not found.");
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
    ["makers", "('Bronze')", "('BRONZE')"],
    ["materials", "('Bronze', 'bronze')", "('BRONZE', 'bronze-alt')"],
    ["finish", "('Bronze', 'bronze')", "('BRONZE', 'bronze-alt')"],
    [
      "color",
      "('Bronze', 'bronze', '#CD7F32')",
      "('BRONZE', 'bronze-alt', '#CD7F32')",
    ],
  ])("allows exactly one case variant in %s", async (table, first, second) => {
    const columns =
      table === "makers"
        ? '"name"'
        : table === "color"
          ? '"name", "slug", "hex"'
          : '"name", "slug"';
    const results = await Promise.allSettled([
      database.exec(`INSERT INTO "${table}" (${columns}) VALUES ${first}`),
      database.exec(`INSERT INTO "${table}" (${columns}) VALUES ${second}`),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(
      1,
    );
    await expect(
      database.query<{
        /** Number of rows that retain the tested normalized name. */
        count: number;
      }>(
        `SELECT count(*)::int AS count FROM "${table}" WHERE lower("name") = 'bronze'`,
      ),
    ).resolves.toMatchObject({ rows: [{ count: 1 }] });
  });
});
