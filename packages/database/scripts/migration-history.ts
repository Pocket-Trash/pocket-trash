import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readMigrationFiles } from "drizzle-orm/migrator";

/** One timestamp-folder migration and its native Drizzle ledger identity. */
export type MigrationRecord = {
  /** UTC milliseconds encoded in the folder's timestamp. */
  createdAt: number;
  /** SHA-256 digest of the unmodified migration SQL. */
  hash: string;
  /** Complete migration folder name stored in the v1 ledger. */
  tag: string;
};

/** Repository migration with the statements executed by Drizzle. */
export type RepositoryMigration = MigrationRecord & {
  /** Nonempty SQL chunks separated by native statement breakpoints. */
  statements: string[];
};

/** Applied row from the native v1 migration ledger. */
export type AppliedMigration = {
  /** UTC timestamp stored by Drizzle. */
  createdAt: number | null;
  /** Native SQL digest. */
  hash: string;
  /** Native migration name; null identifies unsupported legacy history. */
  tag: string | null;
};

/** Relationships between named repository and database migration sets. */
export type MigrationHistoryState =
  | "exact"
  | "behind"
  | "ahead"
  | "diverged"
  | "missing-history";

/** Safe, read-only classification of a database's migration ledger. */
export type MigrationHistoryComparison = {
  /** Safe next step without editing ledger rows. */
  guidance: string;
  /** Human-readable classification. */
  summary: string;
  /** Machine-readable classification. */
  state: MigrationHistoryState;
};

/**
 * Loads native v1 migrations without silently omitting malformed artifacts.
 *
 * @param migrationsFolder - Directory containing timestamp-folder migrations.
 * @returns Native migration identities in folder-name order.
 * @throws When legacy, incomplete, or invalid timestamp artifacts are present.
 */
export function loadRepositoryMigrations(
  migrationsFolder: string,
): RepositoryMigration[] {
  for (const entry of readdirSync(migrationsFolder, { withFileTypes: true })) {
    if (
      !entry.isDirectory() ||
      !/^\d{14}_[\w-]+$/u.test(entry.name) ||
      !existsSync(join(migrationsFolder, entry.name, "migration.sql"))
    ) {
      throw new Error(
        "Unsupported migration artifact: " +
          entry.name +
          ". Use the fresh timestamp-folder history, not legacy SQL or journals.",
      );
    }
  }
  return readMigrationFiles({ migrationsFolder }).map((migration) => {
    const timestamp = new Date(migration.folderMillis);
    if (
      !Number.isSafeInteger(migration.folderMillis) ||
      timestamp.toISOString().replace(/[-:T]/gu, "").slice(0, 14) !==
        migration.name.slice(0, 14)
    ) {
      throw new Error("Invalid migration timestamp: " + migration.name);
    }
    return {
      createdAt: migration.folderMillis,
      hash: migration.hash,
      tag: migration.name,
      statements: migration.sql
        .map((statement) => statement.trim())
        .filter(Boolean),
    };
  });
}

/**
 * Compares named migration sets without assuming application order or a prefix.
 *
 * @param expected - Repository migrations.
 * @param applied - Native ledger rows, or null when no ledger exists.
 * @returns Classified state with safe next steps.
 */
export function compareMigrationHistories(
  expected: readonly MigrationRecord[],
  applied: readonly AppliedMigration[] | null,
): MigrationHistoryComparison {
  if (applied === null) {
    return {
      state: "missing-history",
      summary: "The drizzle.__drizzle_migrations history table is missing.",
      guidance:
        "Do not create history rows by hand. Confirm the selected personal branch has the fresh baseline, then run pnpm db:migrate.",
    };
  }
  const repository = new Map(
    expected.map((migration) => [migration.tag, migration]),
  );
  const names = new Set<string>();
  for (const migration of applied) {
    const match =
      migration.tag === null ? undefined : repository.get(migration.tag);
    if (
      migration.tag === null ||
      names.has(migration.tag) ||
      (match &&
        (match.hash !== migration.hash ||
          match.createdAt !== migration.createdAt))
    ) {
      return divergedHistory();
    }
    names.add(migration.tag);
  }
  const missing = expected.filter(({ tag }) => !names.has(tag));
  const unknown = applied.filter(
    ({ tag }) => tag !== null && !repository.has(tag),
  );
  if (missing.length && unknown.length) return divergedHistory();
  if (unknown.length) {
    return {
      state: "ahead",
      summary:
        "The database has " +
        unknown.length +
        " migration(s) absent from the repository.",
      guidance:
        "Do not delete migrations or history rows. Confirm you are on the correct code and personal branch; recreate the personal branch from rebuilt development if needed.",
    };
  }
  if (missing.length) {
    return {
      state: "behind",
      summary:
        "The database is missing " + missing.length + " named migration(s).",
      guidance:
        "Confirm the selected personal branch, run pnpm db:migrate, and retry. Never migrate production from a local command.",
    };
  }
  return {
    state: "exact",
    summary:
      "Migration history matches all " +
      expected.length +
      " repository migrations by name, timestamp, and hash.",
    guidance: "No repair is needed.",
  };
}

/**
 * Describes conflicting, duplicate, or legacy ledger identities.
 *
 * @returns Safe divergence guidance.
 */
function divergedHistory(): MigrationHistoryComparison {
  return {
    state: "diverged",
    summary:
      "Database history contains conflicting, duplicate, or legacy migration identities.",
    guidance:
      "Do not rewrite migration files or history rows. Confirm the selected personal database and recreate it from rebuilt development if needed.",
  };
}
