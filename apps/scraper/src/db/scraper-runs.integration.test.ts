import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import { finishScraperRun, startScraperRun } from "./autmog.js";

describe("scraper run locking", () => {
  it("allows exactly one concurrent run while preserving historical runs", async () => {
    const client = new PGlite();
    await migrate(client);
    const db = drizzle(client, { schema }) as unknown as Database;
    const input = { jobType: "scrape", source: "autmog" };

    try {
      const starts = await Promise.allSettled([
        startScraperRun(db, input),
        startScraperRun(db, input),
      ]);
      const successes = starts.filter(
        (result) => result.status === "fulfilled",
      );
      const rejections = starts.filter(
        (result) => result.status === "rejected",
      );

      expect(successes).toHaveLength(1);
      expect(rejections).toHaveLength(1);
      expect(rejections[0]).toMatchObject({
        reason: new Error("Scraper run already active for autmog:scrape."),
      });
      await expect(countRunning(db, input)).resolves.toBe(1);

      const activeRun = successes[0];
      if (activeRun?.status !== "fulfilled") {
        throw new Error("Expected one scraper run to start.");
      }
      await finishScraperRun(db, activeRun.value.id, { status: "completed" });

      const completedSuccessor = await startScraperRun(db, input);
      await finishScraperRun(db, completedSuccessor.id, { status: "failed" });

      await expect(startScraperRun(db, input)).resolves.toMatchObject({
        status: "running",
      });
      await expect(countRunning(db, input)).resolves.toBe(1);

      await expect(
        startScraperRun(withActiveRunUniqueViolation(db), {
          jobType: "forced-conflict",
          source: "autmog",
        }),
      ).rejects.toThrow(
        "Scraper run already active for autmog:forced-conflict.",
      );
    } finally {
      await client.close();
    }
  }, 30_000);
});

async function countRunning(
  db: Database,
  input: { jobType: string; source: string },
) {
  const rows = await db
    .select({ id: schema.scraperRuns.id })
    .from(schema.scraperRuns)
    .where(
      and(
        eq(schema.scraperRuns.source, input.source),
        eq(schema.scraperRuns.jobType, input.jobType),
        eq(schema.scraperRuns.status, "running"),
      ),
    );
  return rows.length;
}

function withActiveRunUniqueViolation(db: Database): Database {
  return new Proxy(db, {
    get(target, property, receiver) {
      if (property !== "insert") {
        return Reflect.get(target, property, receiver);
      }
      return () => ({
        values: () => ({
          returning: () =>
            Promise.reject(
              new Error("Failed query", {
                cause: Object.assign(new Error("Duplicate active run"), {
                  code: "23505",
                  constraint: "scraper_runs_active_source_job_unique",
                }),
              }),
            ),
        }),
      });
    },
  }) as Database;
}

async function migrate(client: PGlite) {
  const migrationsFolder = fileURLToPath(
    new URL("../../../../packages/database/drizzle", import.meta.url),
  );
  for (const file of readdirSync(migrationsFolder)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await client.exec(
      readFileSync(join(migrationsFolder, file), "utf8").replaceAll(
        "--> statement-breakpoint",
        "",
      ),
    );
  }
}
