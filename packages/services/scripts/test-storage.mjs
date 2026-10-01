import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import process from "node:process";
import { setTimeout } from "node:timers";
import { URL } from "node:url";
import pg from "pg";

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
    const migrations = new URL("../../database/drizzle/", import.meta.url);
    const journal = JSON.parse(
      readFileSync(new URL("meta/_journal.json", migrations), "utf8"),
    );
    for (const { tag } of journal.entries)
      await pool.query(readFileSync(new URL(`${tag}.sql`, migrations), "utf8"));
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
