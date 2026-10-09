import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import process from "node:process";
import { setTimeout } from "node:timers";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

/** Unique Docker container name for the isolated storage integration test. */
const container = `pocket-trash-storage-test-${randomUUID()}`;
try {
  execFileSync(
    "docker",
    [
      "run",
      "--detach",
      "--rm",
      "--name",
      container,
      "-e",
      "POSTGRES_PASSWORD=storage-test",
      "-e",
      "POSTGRES_DB=storage_test",
      "-p",
      "127.0.0.1::5432",
      "postgres:17.7",
    ],
    { stdio: "pipe" },
  );
  const port = execFileSync("docker", ["port", container, "5432"], {
    encoding: "utf8",
  })
    .trim()
    .split(":")
    .at(-1);
  const url = `postgresql://postgres:storage-test@127.0.0.1:${port}/storage_test`;
  const pool = new pg.Pool({ connectionString: url });
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        await pool.query("select 1");
        break;
      } catch (error) {
        if (attempt === 29) throw error;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    await migrate(drizzle({ client: pool }), {
      migrationsFolder: fileURLToPath(
        new URL("../../database/drizzle/", import.meta.url),
      ),
    });
    const result = spawnSync(
      "pnpm",
      ["exec", "vitest", "run", "src/storage/storage.integration.test.ts"],
      {
        stdio: "inherit",
        env: { ...process.env, STORAGE_TEST_DATABASE_URL: url },
      },
    );
    process.exitCode = result.status ?? 1;
  } finally {
    await pool.end();
  }
} finally {
  execFileSync("docker", ["stop", container], { stdio: "pipe" });
}
