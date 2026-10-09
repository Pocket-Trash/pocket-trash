import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadRepositoryMigrations } from "./migration-history.js";

/** Durable state recorded after a preview database passes preflight. */
interface PreviewState {
  /** Git commit used as the pull request's base ancestry. */
  baseSha: string;
  /** Fingerprint of the ordered Drizzle migration chain. */
  migrationFingerprint: string;
}

/** Repository migration directory. */
const migrationsDirectory = fileURLToPath(
  new URL("../drizzle/", import.meta.url),
);

/** Exit code indicating that preview state exists but is incompatible. */
const previewStateMismatchExitCode = 10;

/**
 * Computes a stable fingerprint of the ordered Drizzle migration chain.
 *
 * @returns SHA-256 fingerprint of timestamp-folder names and SQL contents.
 * @throws When the migration artifacts are invalid or unreadable.
 */
export function migrationFingerprint() {
  const migrations = loadRepositoryMigrations(migrationsDirectory).map(
    ({ createdAt, hash, tag }) => ({ createdAt, hash, tag }),
  );
  return createHash("sha256").update(JSON.stringify(migrations)).digest("hex");
}

/**
 * Reads the last successful preview preflight marker.
 *
 * @param databaseUrl - Direct Neon connection URL.
 * @returns Stored preview state, or `null` when no preflight marker exists.
 * @rejects When the preview state query fails unexpectedly.
 */
export async function readPreviewState(
  databaseUrl: string,
): Promise<PreviewState | null> {
  const query = neon(databaseUrl);
  try {
    const rows = await query`
      SELECT base_sha, migration_fingerprint
      FROM _pocket_trash_preview_state
      WHERE singleton = true
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      baseSha: String(row.base_sha),
      migrationFingerprint: String(row.migration_fingerprint),
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "42P01"
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Records a successful migration and seed preflight.
 *
 * @param databaseUrl - Direct Neon connection URL.
 * @param state - Validated ancestry and migration state.
 * @returns A promise that resolves after the marker is durable.
 * @rejects When the preview state cannot be persisted.
 */
export async function writePreviewState(
  databaseUrl: string,
  state: PreviewState,
) {
  const query = neon(databaseUrl);
  await query`
    CREATE TABLE IF NOT EXISTS _pocket_trash_preview_state (
      singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
      base_sha text NOT NULL,
      migration_fingerprint text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await query`
    INSERT INTO _pocket_trash_preview_state
      (singleton, base_sha, migration_fingerprint, updated_at)
    VALUES
      (true, ${state.baseSha}, ${state.migrationFingerprint}, now())
    ON CONFLICT (singleton) DO UPDATE SET
      base_sha = EXCLUDED.base_sha,
      migration_fingerprint = EXCLUDED.migration_fingerprint,
      updated_at = EXCLUDED.updated_at
  `;
}

/**
 * Runs the preview-state command-line interface.
 *
 * @returns A promise that resolves after the requested operation.
 * @throws When required input is absent or the command is unknown.
 * @rejects When migration files or preview state cannot be read or written.
 */
async function main() {
  const command = process.argv[2];
  const fingerprint = migrationFingerprint();
  if (command === "fingerprint") {
    process.stdout.write(`${fingerprint}\n`);
    return;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const baseSha = process.env.PREVIEW_BASE_SHA?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  if (!baseSha) throw new Error("PREVIEW_BASE_SHA is required.");

  if (command === "check") {
    const actual = await readPreviewState(databaseUrl);
    const expected = { baseSha, migrationFingerprint: fingerprint };
    process.stdout.write(`${JSON.stringify({ actual, expected })}\n`);
    if (
      actual?.baseSha !== expected.baseSha ||
      actual?.migrationFingerprint !== expected.migrationFingerprint
    ) {
      process.exitCode = previewStateMismatchExitCode;
    }
    return;
  }
  if (command === "mark") {
    await writePreviewState(databaseUrl, {
      baseSha,
      migrationFingerprint: fingerprint,
    });
    return;
  }
  throw new Error("Usage: preview-state.ts {fingerprint|check|mark}");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
