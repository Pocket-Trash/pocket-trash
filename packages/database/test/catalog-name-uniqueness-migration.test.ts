import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("catalog name uniqueness baseline", () => {
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
    ["makers", "('Bronze', 'bronze')", "('BRONZE', 'bronze-alt')"],
    ["materials", "('Bronze', 'bronze')", "('BRONZE', 'bronze-alt')"],
    ["finish", "('Bronze', 'bronze')", "('BRONZE', 'bronze-alt')"],
    [
      "color",
      "('Bronze', 'bronze', '#CD7F32')",
      "('BRONZE', 'bronze-alt', '#CD7F32')",
    ],
  ])("allows exactly one case variant in %s", async (table, first, second) => {
    const columns =
      table === "color" ? '"name", "slug", "hex"' : '"name", "slug"';
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
