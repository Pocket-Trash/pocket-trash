import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("resource gallery migration", () => {
  it("backfills preview metadata before dropping the legacy columns", () => {
    const migration = readFileSync(
      new URL("../drizzle/0025_flashy_misty_knight.sql", import.meta.url),
      "utf8",
    );
    const backfill = migration.indexOf('INSERT INTO "resource_images"');
    const drop = migration.indexOf(
      'ALTER TABLE "resources" DROP COLUMN "preview_image_file_name"',
    );

    expect(backfill).toBeGreaterThan(-1);
    expect(drop).toBeGreaterThan(backfill);
    expect(migration).toContain('DELETE FROM "resource_upload_sessions"');
  });
});
