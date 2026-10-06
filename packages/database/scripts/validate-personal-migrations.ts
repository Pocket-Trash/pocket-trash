import { fileURLToPath } from "node:url";
import {
  NeonDbError,
  type NeonQueryFunction,
  neon,
} from "@neondatabase/serverless";

import {
  type AppliedMigration,
  compareMigrationHistories,
  loadRepositoryMigrations,
} from "./migration-history.js";

/** Repository migration directory resolved independently of the caller. */
const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

/**
 * Reads and validates the selected personal Neon migration history.
 *
 * The Neon query client is configured read-only and this command never applies
 * migrations or repairs history.
 *
 * @rejects When configuration, database access, or history validation fails.
 */
async function main(): Promise<void> {
  const databaseUrl = getPersonalDatabaseUrl();

  const migrations = loadRepositoryMigrations(migrationsFolder);
  const database = neon(databaseUrl);
  const applied = await readAppliedMigrations(database);
  const comparison = compareMigrationHistories(migrations, applied);

  console.log(`Personal Neon migration state: ${comparison.state}.`);
  console.log(comparison.summary);
  if (comparison.state !== "exact") {
    throw new Error(comparison.guidance);
  }
}

/**
 * Requires proof that the Infisical runner selected a personal database URL.
 *
 * @returns Selected personal Neon connection URL.
 * @throws When no personal selector was applied or its URL does not match.
 */
function getPersonalDatabaseUrl(): string {
  const initials = process.env.URL_INITIALS?.trim().toUpperCase();
  const databaseUrl = process.env.DATABASE_URL;
  if (!initials || !/^[A-Z0-9]+$/u.test(initials)) {
    throw new Error(
      "No personal database selector was applied. Set URL_INITIALS in .env.local and configure its DATABASE_URL_<INITIALS> secret in Infisical /local/database.",
    );
  }

  const selectedName = `DATABASE_URL_${initials}`;
  const selectedUrl = process.env[selectedName];
  if (!databaseUrl || !selectedUrl || databaseUrl !== selectedUrl) {
    throw new Error(
      `${selectedName} was not positively selected as DATABASE_URL. Check .env.local and Infisical /local/database, then retry.`,
    );
  }

  return databaseUrl;
}

/**
 * Reads Drizzle history inside a database-enforced read-only transaction.
 *
 * @param database - Neon query client for the selected personal branch.
 * @returns Applied rows, or `null` when the history table is absent.
 * @rejects When Neon rejects the query for any reason other than a missing table.
 */
async function readAppliedMigrations(
  database: NeonQueryFunction<false, false>,
): Promise<AppliedMigration[] | null> {
  try {
    const [rows] = await database.transaction(
      (transaction) => [
        transaction`
          select hash, created_at::float8 as "createdAt"
          from drizzle.__drizzle_migrations
          order by id
        `,
      ],
      { readOnly: true },
    );
    return rows as AppliedMigration[];
  } catch (error) {
    if (error instanceof NeonDbError && error.code === "42P01") return null;
    throw error;
  }
}

await main();
