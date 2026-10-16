import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { expect, it } from "vitest";

/** Complete native migration history. */
const migrationsFolder = fileURLToPath(new URL("../drizzle/", import.meta.url));
/** Migration under test. */
const productTypeImagesMigration = "20261016073358_funny_microbe";
/** Product-type slugs backfilled by the migration. */
const productTypeSlugs = [
  "pen",
  "pen-actuator",
  "pen-clip",
  "pen-mechanism",
  "pen-tip",
  "pen-top-cap",
  "refill",
  "spinner",
  "spinner-button",
  "slider",
  "slider-plate",
  "slider-insert",
  "fountain-pen",
] as const;

/**
 * Copies the migration history preceding required product-type images.
 *
 * @param target - Temporary migration directory.
 * @returns Nothing after the baseline is copied.
 */
function copyBaseline(target: string) {
  for (const name of readdirSync(migrationsFolder).filter(
    (name) => name < productTypeImagesMigration,
  )) {
    cpSync(join(migrationsFolder, name), join(target, name), {
      recursive: true,
    });
  }
}

it("backfills every canonical product type before requiring image metadata", async (context) => {
  const baseline = mkdtempSync(join(tmpdir(), "product-type-images-"));
  context.onTestFinished(() =>
    rmSync(baseline, { force: true, recursive: true }),
  );
  copyBaseline(baseline);

  const database = new PGlite();
  context.onTestFinished(() => database.close());
  const db = drizzle({ client: database });
  await migrate(db, { migrationsFolder: baseline });
  for (const slug of productTypeSlugs) {
    await database.query(
      `INSERT INTO product_types (name, slug)
       VALUES ($1, $2)
       ON CONFLICT (slug) DO NOTHING`,
      [slug, slug],
    );
  }
  await database.exec(
    "UPDATE product_types SET image_url = NULL, image_alt = NULL",
  );

  await migrate(db, { migrationsFolder });

  await expect(
    database.query(`SELECT count(*)::int AS count
      FROM product_types
      WHERE image_url = 'https://cdn.pocket-trash.app/assets/static/no-image.png'
        AND image_alt = 'No image set'`),
  ).resolves.toMatchObject({ rows: [{ count: productTypeSlugs.length }] });
  await expect(
    database.exec(`INSERT INTO product_types
      (name, slug, image_url, image_alt)
      VALUES ('Invalid', 'invalid', 'http://example.com/image.png', 'Image')`),
  ).rejects.toThrow(/product_types_image_url_valid/iu);
  await expect(
    database.exec(`INSERT INTO product_types
      (name, slug, image_url, image_alt)
      VALUES ('Blank', 'blank', 'https://example.com/image.png', '  ')`),
  ).rejects.toThrow(/product_types_image_alt_valid/iu);
}, 60_000);

it("rejects an unknown product type instead of assigning category art", async (context) => {
  const baseline = mkdtempSync(join(tmpdir(), "unknown-product-type-"));
  context.onTestFinished(() =>
    rmSync(baseline, { force: true, recursive: true }),
  );
  copyBaseline(baseline);

  const database = new PGlite();
  context.onTestFinished(() => database.close());
  const db = drizzle({ client: database });
  await migrate(db, { migrationsFolder: baseline });
  await database.exec(
    "INSERT INTO product_types (name, slug) VALUES ('Unknown', 'unknown')",
  );

  await expect(migrate(db, { migrationsFolder })).rejects.toThrow(
    /Unexpected product type prevents image metadata backfill/iu,
  );
}, 60_000);
