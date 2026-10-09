import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import {
  type AppliedMigration,
  compareMigrationHistories,
  loadRepositoryMigrations,
} from "./migration-history.js";

/** Repository migration directory, independent of the caller. */
const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

/**
 * Replays native migrations on disposable PostgreSQL and proves repeatability.
 *
 * @rejects When discovery, replay, repeated migration, or ledger validation fails.
 */
async function main(): Promise<void> {
  const migrations = loadRepositoryMigrations(migrationsFolder);
  const database = new PGlite();
  try {
    const db = drizzle({ client: database });
    await migrate(db, { migrationsFolder });
    await migrate(db, { migrationsFolder });
    const result = await database.query<AppliedMigration>(`
      select hash, created_at::float8 as "createdAt", name as tag
      from drizzle.__drizzle_migrations
      order by id
    `);
    const comparison = compareMigrationHistories(migrations, result.rows);
    if (comparison.state !== "exact")
      throw new Error(comparison.summary + " " + comparison.guidance);
    console.log(
      "Disposable native migration chain passed (" +
        migrations.length +
        " migrations; repeat unchanged).",
    );
  } finally {
    await database.close();
  }
}

await main();
