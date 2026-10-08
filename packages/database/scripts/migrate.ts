import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Database package directory resolved independently of the caller. */
const packageFolder = dirname(
  fileURLToPath(new URL("../package.json", import.meta.url)),
);

/**
 * Applies the repository migration chain to the configured database.
 *
 * @rejects When the database URL is missing or Drizzle Kit fails.
 */
async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run database migrations.");
  }

  const result = spawnSync(
    "pnpm",
    ["exec", "drizzle-kit", "migrate", "--config=drizzle.config.ts"],
    {
      cwd: packageFolder,
      env: { ...process.env, DATABASE_URL: databaseUrl },
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
