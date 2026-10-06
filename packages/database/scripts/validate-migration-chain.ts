import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

import {
  type AppliedMigration,
  compareMigrationHistories,
  loadRepositoryMigrations,
} from "./migration-history.js";

/** Repository migration directory resolved independently of the caller. */
const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

/**
 * Applies the complete repository migration chain to disposable PGlite.
 *
 * @rejects When discovery, SQL execution, or resulting history validation fails.
 */
async function main(): Promise<void> {
  const migrations = loadRepositoryMigrations(migrationsFolder);
  const database = new PGlite();

  try {
    await database.exec(`
      create schema drizzle;
      create table drizzle.__drizzle_migrations (
        id serial primary key,
        hash text not null,
        created_at bigint
      );
      begin;
    `);

    try {
      for (const migration of migrations) {
        for (const statement of migration.statements) {
          await database.exec(statement);
        }
        await database.query(
          "insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)",
          [migration.hash, migration.createdAt],
        );
      }
      await database.exec("commit;");
    } catch (error) {
      await database.exec("rollback;");
      throw error;
    }

    const result = await database.query<AppliedMigration>(`
      select hash, created_at::float8 as "createdAt"
      from drizzle.__drizzle_migrations
      order by id
    `);
    const comparison = compareMigrationHistories(migrations, result.rows);
    if (comparison.state !== "exact") {
      throw new Error(`${comparison.summary} ${comparison.guidance}`);
    }

    console.log(
      `Disposable migration chain passed (${migrations.length} migrations).`,
    );
  } finally {
    await database.close();
  }
}

await main();
