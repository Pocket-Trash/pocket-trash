import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  NeonDbError,
  type NeonQueryFunction,
  neon,
} from "@neondatabase/serverless";

import {
  type AppliedMigration,
  loadRepositoryMigrations,
} from "./migration-history.js";
import {
  createMigrationRepairBundle,
  type MigrationRepairSchemaState,
  type MigrationSchemaGroupState,
  migrationHistoryReconciliationTag,
  planMigrationRepair,
} from "./migration-repair.js";

/** Database package directory resolved independently of the caller. */
const packageFolder = dirname(
  fileURLToPath(new URL("../package.json", import.meta.url)),
);

/** Repository migration directory resolved independently of the caller. */
const migrationsFolder = join(packageFolder, "drizzle");

/** Shape of the schema-presence query used to plan a legacy repair. */
type MigrationSchemaPresenceRow = {
  /** Whether all catalog-manifest tables exist. */
  catalogManifestCount: number;
  /** Whether the installed insert column exists. */
  installedInsert: boolean;
  /** Whether the installed plate column exists. */
  installedPlate: boolean;
  /** Whether the insert setup column exists. */
  insertSetup: boolean;
};

/**
 * Applies the exact legacy repair when needed, then runs the normal chain.
 *
 * @rejects When configuration, repair planning, or migration execution fails.
 */
async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run database migrations.");
  }

  const migrations = loadRepositoryMigrations(migrationsFolder);
  const database = neon(databaseUrl);
  const applied = await readAppliedMigrations(database);
  const marker = migrations.find(
    ({ tag }) => tag === migrationHistoryReconciliationTag,
  );
  const markerApplied =
    marker !== undefined &&
    applied?.some(
      ({ createdAt, hash }) =>
        createdAt === marker.createdAt && hash === marker.hash,
    ) === true;

  if (applied && !markerApplied) {
    const repairTags = planMigrationRepair(
      applied,
      await readMigrationRepairSchemaState(database),
    );
    if (repairTags.length > 0) {
      applyMigrationRepair(repairTags, databaseUrl);
    }
  }

  runDrizzleMigration("drizzle.config.ts", { DATABASE_URL: databaseUrl });
}

/**
 * Reads the current Drizzle migration history when it exists.
 *
 * @param database - Neon query client for the migration target.
 * @returns Applied rows in insertion order, or `null` for a fresh database.
 * @rejects When the history query fails for a reason other than a missing table.
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

/**
 * Inspects schema groups owned by migrations following the rebased stack.
 *
 * @param database - Neon query client for the migration target.
 * @returns Atomic presence state for each repairable schema group.
 * @rejects When PostgreSQL cannot inspect the schema.
 */
async function readMigrationRepairSchemaState(
  database: NeonQueryFunction<false, false>,
): Promise<MigrationRepairSchemaState> {
  const [rows] = await database.transaction(
    (transaction) => [
      transaction`
        select
          exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'collection_slider'
              and column_name = 'installed_plate_id'
          ) as "installedPlate",
          exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'collection_slider'
              and column_name = 'installed_insert_id'
          ) as "installedInsert",
          exists (
            select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name = 'collection_slider_insert'
              and column_name = 'setup'
          ) as "insertSetup",
          (
            select count(*)::int
            from information_schema.tables
            where table_schema = 'public'
              and table_name in (
                'catalog_manifest_application',
                'catalog_manifest_object',
                'catalog_manifest_record'
              )
          ) as "catalogManifestCount"
      `,
    ],
    { readOnly: true },
  );
  const row = rows?.[0] as MigrationSchemaPresenceRow | undefined;
  if (!row) throw new Error("Database schema inspection returned no rows.");

  return {
    installedSliderComponents: classifyPresence([
      row.installedPlate,
      row.installedInsert,
    ]),
    insertSetup: classifyPresence([row.insertSetup]),
    catalogManifest: classifyCount(row.catalogManifestCount, 3),
  };
}

/**
 * Classifies a group of boolean schema-presence checks.
 *
 * @param values - Presence of every object in one migration-owned group.
 * @returns Whether none, some, or all group members exist.
 */
export function classifyPresence(
  values: readonly boolean[],
): MigrationSchemaGroupState {
  if (values.every((value) => value)) return "present";
  if (values.every((value) => !value)) return "absent";
  return "partial";
}

/**
 * Classifies a counted schema group against its expected size.
 *
 * @param actual - Number of objects currently present.
 * @param expected - Number of objects owned by the migration.
 * @returns Whether none, some, or all group members exist.
 * @throws When the count is outside the expected range.
 */
export function classifyCount(
  actual: number,
  expected: number,
): MigrationSchemaGroupState {
  if (!Number.isInteger(actual) || actual < 0 || actual > expected) {
    throw new Error(`Invalid schema object count ${actual} of ${expected}.`);
  }
  if (actual === 0) return "absent";
  if (actual === expected) return "present";
  return "partial";
}

/**
 * Applies a temporary ordered bundle through Drizzle Kit.
 *
 * @param tags - Repository migration tags selected for forward repair.
 * @param databaseUrl - Target database connection URL.
 */
function applyMigrationRepair(
  tags: readonly string[],
  databaseUrl: string,
): void {
  const temporaryFolder = mkdtempSync(
    join(tmpdir(), "pocket-trash-migration-repair-"),
  );
  try {
    createMigrationRepairBundle(migrationsFolder, temporaryFolder, tags);
    process.stdout.write(
      `Applying forward migration repair: ${tags.join(", ")}\n`,
    );
    runDrizzleMigration("drizzle.config.ts", {
      DATABASE_URL: databaseUrl,
      MIGRATION_REPAIR_FOLDER: temporaryFolder,
    });
  } finally {
    rmSync(temporaryFolder, { force: true, recursive: true });
  }
}

/**
 * Runs the repository-local Drizzle Kit migration command.
 *
 * @param configFile - Drizzle configuration filename in the database package.
 * @param environment - Environment overrides required by the command.
 * @throws When the child process cannot start or exits unsuccessfully.
 */
function runDrizzleMigration(
  configFile: string,
  environment: NodeJS.ProcessEnv,
): void {
  const result = spawnSync(
    "pnpm",
    ["exec", "drizzle-kit", "migrate", `--config=${configFile}`],
    {
      cwd: packageFolder,
      env: { ...process.env, ...environment },
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Drizzle migration failed with exit code ${result.status ?? "unknown"}.`,
    );
  }
}

await main();
