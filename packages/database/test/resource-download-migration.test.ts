import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("resource download migration", () => {
  it("resets pre-live events before requiring user and version data", () => {
    const migration = readFileSync(
      new URL("../drizzle/0034_next_lady_mastermind.sql", import.meta.url),
      "utf8",
    );
    const reset = migration.indexOf('TRUNCATE TABLE "resource_downloads"');

    expect(reset).toBeGreaterThanOrEqual(0);
    expect(reset).toBeLessThan(
      migration.indexOf(
        'ALTER TABLE "resource_downloads" ALTER COLUMN "version_id" SET NOT NULL',
      ),
    );
    expect(reset).toBeLessThan(
      migration.indexOf(
        'ALTER TABLE "resource_downloads" ADD COLUMN "user_clerk_id" text NOT NULL',
      ),
    );
  });
});
