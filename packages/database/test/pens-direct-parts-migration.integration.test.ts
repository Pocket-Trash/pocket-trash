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
const directPartsMigration = "20261015021006_lumpy_sabra";

/**
 * Copies the migration history that precedes the direct-parts conversion.
 *
 * @param target - Temporary migration directory.
 * @returns Nothing after the baseline is copied.
 */
function copyBaseline(target: string) {
  for (const name of readdirSync(migrationsFolder).filter(
    (name) => name < directPartsMigration,
  )) {
    cpSync(join(migrationsFolder, name), join(target, name), {
      recursive: true,
    });
  }
}

it("converts configured and installed Pen parts without changing source listings", async (context) => {
  const baseline = mkdtempSync(join(tmpdir(), "pens-direct-parts-"));
  context.onTestFinished(() =>
    rmSync(baseline, { recursive: true, force: true }),
  );
  copyBaseline(baseline);

  const database = new PGlite();
  context.onTestFinished(() => database.close());
  const db = drizzle({ client: database });
  await migrate(db, { migrationsFolder: baseline });
  await database.exec(`
    INSERT INTO makers (name, slug) VALUES ('Migration Maker', 'migration-maker');
    INSERT INTO product (product_type_id, maker_id, name, slug)
      SELECT type.id, maker.id, 'Migration Pen', 'migration-pen'
      FROM product_types type, makers maker
      WHERE type.slug = 'pen' AND maker.slug = 'migration-maker';
    INSERT INTO product_detail_pen (id)
      SELECT id FROM product WHERE slug = 'migration-pen';
    INSERT INTO product (product_type_id, maker_id, name, slug)
      SELECT type.id, maker.id, 'Migration Tip', 'migration-tip'
      FROM product_types type, makers maker
      WHERE type.slug = 'pen-tip' AND maker.slug = 'migration-maker';
    INSERT INTO product_detail_pen_part (id)
      SELECT id FROM product WHERE slug = 'migration-tip';
    INSERT INTO product_detail_pen_tip (id)
      SELECT id FROM product WHERE slug = 'migration-tip';
    INSERT INTO pen_part_role_assignment (part_product_id, concept_id)
      SELECT tip.id, concept.id
      FROM product tip, catalog_terminology_concept concept
      WHERE tip.slug = 'migration-tip'
        AND concept.namespace = 'pen-part-role'
        AND concept.key = 'tip';
    INSERT INTO product_configuration_slot (product_id, slot_kind_id, position)
      SELECT pen.id, kind.id, 0
      FROM product pen, configuration_slot_kind kind
      WHERE pen.slug = 'migration-pen' AND kind.slug = 'tip';
    INSERT INTO product_configuration_choice
      (product_id, slot_id, position, part_product_id)
      SELECT pen.id, slot.id, 0, tip.id
      FROM product pen, product_configuration_slot slot, product tip
      WHERE pen.slug = 'migration-pen'
        AND slot.product_id = pen.id
        AND tip.slug = 'migration-tip';
    INSERT INTO catalog_source_listing
      (maker_id, source_system, source_record_id, listing_url)
      SELECT id, 'migration-test', 'pen-1', 'https://example.com/pen-1'
      FROM makers WHERE slug = 'migration-maker';
    INSERT INTO product_source_listing (product_id, listing_id)
      SELECT product.id, listing.id
      FROM product, catalog_source_listing listing
      WHERE product.slug = 'migration-pen';
    INSERT INTO catalog_source_listing_choice (listing_id, choice_id)
      SELECT listing.id, choice.id
      FROM catalog_source_listing listing, product_configuration_choice choice;
    INSERT INTO users (clerk_id, username) VALUES ('migration-owner', 'migration-owner');
    INSERT INTO user_collection (owner_id, name, normalized_name)
      SELECT id, 'Migration Pens', 'migration-pens'
      FROM users WHERE clerk_id = 'migration-owner';
    INSERT INTO collection_item (owner_id, collection_id)
      SELECT owner_id, id FROM user_collection WHERE normalized_name = 'migration-pens';
    INSERT INTO collection_detail_pen (id, product_pen_id)
      SELECT item.id, pen.id
      FROM collection_item item, product pen
      WHERE pen.slug = 'migration-pen';
    INSERT INTO collection_item (owner_id, collection_id)
      SELECT owner_id, id FROM user_collection WHERE normalized_name = 'migration-pens';
    INSERT INTO collection_detail_pen_tip (id, product_pen_tip_id)
      SELECT item.id, tip.id
      FROM collection_item item, product tip
      WHERE item.id NOT IN (SELECT id FROM collection_detail_pen)
        AND tip.slug = 'migration-tip';
    INSERT INTO collection_item_configuration_selection
      (collection_item_id, slot_id, choice_id, installed_part_collection_item_id)
      SELECT pen.id, slot.id, choice.id, tip.id
      FROM collection_detail_pen pen,
        product_configuration_slot slot,
        product_configuration_choice choice,
        collection_detail_pen_tip tip;
  `);

  await migrate(db, { migrationsFolder });

  await expect(
    database.query(`SELECT pen.slug AS pen_slug, part.slug AS part_slug
      FROM pen_compatible_part compatible
      JOIN product pen ON pen.id = compatible.pen_product_id
      JOIN product part ON part.id = compatible.part_product_id`),
  ).resolves.toMatchObject({
    rows: [{ pen_slug: "migration-pen", part_slug: "migration-tip" }],
  });
  await expect(
    database.query(`SELECT count(*)::int AS count
      FROM collection_item_installed_pen_part`),
  ).resolves.toMatchObject({ rows: [{ count: 1 }] });
  await expect(
    database.query(`SELECT source_record_id FROM catalog_source_listing`),
  ).resolves.toMatchObject({ rows: [{ source_record_id: "pen-1" }] });
  await expect(
    database.query(`SELECT to_regclass('product_configuration_choice') AS old_table,
      to_regprocedure('validate_product_configuration()') AS old_function`),
  ).resolves.toMatchObject({
    rows: [{ old_table: null, old_function: null }],
  });
  await expect(
    database.exec(`BEGIN;
      DELETE FROM pen_compatible_part;
      COMMIT;`),
  ).rejects.toThrow(/directly compatible/iu);
  await database.exec("ROLLBACK;").catch(() => undefined);
}, 60_000);
