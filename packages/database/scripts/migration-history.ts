import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** One migration as recorded by Drizzle's journal and history table. */
export type MigrationRecord = {
  /** Millisecond timestamp used by Drizzle to order migrations. */
  createdAt: number;
  /** SHA-256 digest of the unmodified SQL file. */
  hash: string;
  /** Journal tag and SQL filename without its extension. */
  tag: string;
};

/** A repository migration plus the SQL statements Drizzle executes. */
export type RepositoryMigration = MigrationRecord & {
  /** SQL chunks separated by Drizzle statement breakpoints. */
  statements: string[];
};

/** Applied migration data read from a database history table. */
export type AppliedMigration = {
  /** Millisecond timestamp stored by Drizzle. */
  createdAt: number;
  /** SHA-256 digest stored by Drizzle. */
  hash: string;
};

/** Supported relationships between repository and database histories. */
export type MigrationHistoryState =
  | "exact"
  | "behind"
  | "ahead"
  | "diverged"
  | "reordered"
  | "missing-history";

/** Result of comparing a database migration history with the repository. */
export type MigrationHistoryComparison = {
  /** Safe next step that never recommends editing Drizzle history rows. */
  guidance: string;
  /** Human-readable description of the comparison. */
  summary: string;
  /** Machine-readable relationship between the histories. */
  state: MigrationHistoryState;
};

/** Shape of the Drizzle migration journal used by this repository. */
type MigrationJournal = {
  /** Ordered migration entries. */
  entries: Array<{
    /** Whether Drizzle statement breakpoints are enabled. */
    breakpoints: boolean;
    /** Zero-based migration position. */
    idx: number;
    /** Migration filename without its extension. */
    tag: string;
    /** Millisecond timestamp used by Drizzle. */
    when: number;
  }>;
};

/** Separator emitted by Drizzle Kit between executable statements. */
const statementBreakpoint = "--> statement-breakpoint";

/**
 * Loads migrations in journal order and calculates Drizzle-compatible hashes.
 *
 * @param migrationsFolder - Directory containing SQL files and `meta/_journal.json`.
 * @returns Validated repository migrations in execution order.
 * @throws When the journal is malformed or disagrees with the SQL files.
 */
export function loadRepositoryMigrations(
  migrationsFolder: string,
): RepositoryMigration[] {
  const journalPath = join(migrationsFolder, "meta", "_journal.json");
  const journal = JSON.parse(
    readFileSync(journalPath, "utf8"),
  ) as MigrationJournal;

  if (!Array.isArray(journal.entries)) {
    throw new Error(`${journalPath} does not contain a migration entry list.`);
  }

  const migrations = journal.entries.map((entry, position) => {
    if (entry.idx !== position) {
      throw new Error(
        `Migration ${entry.tag} has journal index ${entry.idx}; expected ${position}.`,
      );
    }
    if (!entry.tag || !Number.isSafeInteger(entry.when)) {
      throw new Error(`Migration journal entry ${position} is malformed.`);
    }
    const previous = journal.entries[position - 1];
    if (previous && entry.when <= previous.when) {
      throw new Error(
        `Migration ${entry.tag} timestamp ${entry.when} must be newer than ${previous.tag} timestamp ${previous.when}.`,
      );
    }

    const sql = readFileSync(
      join(migrationsFolder, `${entry.tag}.sql`),
      "utf8",
    );
    return {
      createdAt: entry.when,
      hash: createHash("sha256").update(sql).digest("hex"),
      statements: sql
        .split(statementBreakpoint)
        .map((statement) => statement.trim())
        .filter(Boolean),
      tag: entry.tag,
    };
  });

  const journalTags = new Set(migrations.map(({ tag }) => tag));
  if (journalTags.size !== migrations.length) {
    throw new Error("Migration journal contains duplicate tags.");
  }

  const orphanedSqlFiles = readdirSync(migrationsFolder)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.slice(0, -4))
    .filter((tag) => !journalTags.has(tag));
  if (orphanedSqlFiles.length > 0) {
    throw new Error(
      `SQL files missing from the migration journal: ${orphanedSqlFiles.join(", ")}.`,
    );
  }

  return migrations;
}

/**
 * Compares an applied database history with the repository migration chain.
 *
 * @param expected - Repository migrations in journal order.
 * @param applied - Applied rows in insertion order, or `null` when no history table exists.
 * @returns Classified state with safe repair guidance.
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
        "Do not create or edit history rows by hand. Confirm the selected database is your personal Neon branch, recreate it from the current development branch, then run pnpm db:migrate and retry.",
    };
  }

  const expectedKeys = expected.map(historyKey);
  const appliedKeys = applied.map(historyKey);
  if (arraysEqual(expectedKeys, appliedKeys)) {
    return {
      state: "exact",
      summary: `Migration history exactly matches all ${expected.length} repository migrations.`,
      guidance: "No repair is needed.",
    };
  }

  if (
    applied.length < expected.length &&
    arraysEqual(appliedKeys, expectedKeys.slice(0, applied.length))
  ) {
    return {
      state: "behind",
      summary: `The database is ${expected.length - applied.length} migration(s) behind the repository.`,
      guidance:
        "Confirm the selected database is your personal Neon branch, run pnpm db:migrate, and rerun validation. Never migrate production from a local command.",
    };
  }

  if (
    applied.length > expected.length &&
    arraysEqual(expectedKeys, appliedKeys.slice(0, expected.length))
  ) {
    return {
      state: "ahead",
      summary: `The database is ${applied.length - expected.length} migration(s) ahead of the repository.`,
      guidance:
        "Do not delete migration files or history rows. Recreate your personal Neon branch from the current development branch, run pnpm db:migrate, and retry.",
    };
  }

  if (
    expected.length === applied.length &&
    arraysEqual([...expectedKeys].sort(), [...appliedKeys].sort())
  ) {
    return {
      state: "reordered",
      summary:
        "The database contains the expected migrations in a different order.",
      guidance:
        "Do not reorder or edit history rows. Recreate your personal Neon branch from the current development branch, run pnpm db:migrate, and retry.",
    };
  }

  return {
    state: "diverged",
    summary:
      "The database migration history and repository chain have different hashes or timestamps.",
    guidance:
      "Do not rewrite migration files or history rows. Recreate your personal Neon branch from the current development branch, run pnpm db:migrate, and retry.",
  };
}

/**
 * Creates a stable comparison key for a migration history row.
 *
 * @param migration - Migration row to identify.
 * @returns Hash and timestamp comparison key.
 */
function historyKey(migration: AppliedMigration): string {
  return `${migration.createdAt}:${migration.hash}`;
}

/**
 * Checks ordered string arrays for exact equality.
 *
 * @param left - First ordered array.
 * @param right - Second ordered array.
 * @returns Whether both arrays contain the same values in the same order.
 */
function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}
