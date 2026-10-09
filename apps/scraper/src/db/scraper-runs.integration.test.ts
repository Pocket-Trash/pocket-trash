import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { finishScraperRun, startScraperRun } from "./autmog.js";

describe("scraper run locking", () => {
  it("allows exactly one concurrent run while preserving historical runs", async () => {
    const client = new PGlite();
    await migrate(client);
    const db = drizzle({
      client,
      relations: schema.relations,
    }) as unknown as Database;
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

/**
 * Counts active scraper runs for one source and job type in integration tests.
 *
 * @param db - Database used for scraper persistence.
 *
 * @param input - Operation-specific normalized values and controls.
 *
 * @returns Number of matching runs still marked running.
 *
 * @rejects When counting matching scraper runs fails.
 */
async function countRunning(
  db: Database,
  input: {
    /**
     * Scraper job category used for run locking.
     */
    jobType: string;
    /** Scraper source identifier used by the run lock. */
    source: string;
  },
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

/**
 * Wraps a database to force the active-run unique constraint path in tests.
 *
 * @param db - Database used for scraper persistence.
 *
 * @returns Database proxy that fails scraper-run inserts with the target constraint.
 */
function withActiveRunUniqueViolation(db: Database): Database {
  return new Proxy(db, {
    /**
     * Intercepts database property access to inject an active-run conflict in tests.
     *
     * @param target - Proxied database object.
     *
     * @param property - Database property requested through the proxy.
     *
     * @param receiver - Proxy receiver used for default property access.
     *
     * @returns The proxied property value or conflict-injecting insert function.
     */
    get(target, property, receiver) {
      if (property !== "insert") {
        return Reflect.get(target, property, receiver);
      }
      return () => ({
        /**
         * Returns the next mocked insert-builder stage.
         *
         * @returns Mocked builder exposing the rejecting `returning` stage.
         */
        values: () => ({
          /**
           * Rejects the mocked insert with an active-run unique violation.
           *
           * @returns A rejected promise carrying the simulated unique violation.
           *
           * @rejects Always, with the simulated active-run unique violation.
           */
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

/**
 * Applies repository SQL migrations to the integration-test database.
 *
 * @param client - PGlite client receiving repository migrations.
 *
 * @rejects When migration files cannot be read or their SQL cannot be applied.
 */
async function migrate(client: PGlite) {
  const migrationsFolder = fileURLToPath(
    new URL("../../../../packages/database/drizzle", import.meta.url),
  );
  await migratePglite(drizzle({ client: client }), {
    migrationsFolder: migrationsFolder,
  });
}
