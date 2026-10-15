import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../src/schema/index.js";

/** Complete native migration history used by the Pens constraint tests. */
const migrationsFolder = fileURLToPath(new URL("../drizzle/", import.meta.url));

/**
 * Executes statements in one transaction so deferred constraints see final state.
 *
 * @param database - Disposable PostgreSQL database.
 * @param statements - SQL statements to execute before commit.
 * @returns Completion after the transaction commits.
 */
async function transaction(database: PGlite, statements: string) {
  await database.exec(`BEGIN; ${statements} COMMIT;`);
}

/**
 * Proves a deferred constraint rejects a transaction and restores the connection.
 *
 * @param database - Disposable PostgreSQL database.
 * @param statements - SQL statements expected to fail at commit.
 * @param pattern - Expected database error pattern.
 * @returns Completion after the rejection and rollback are observed.
 */
async function expectRejectedTransaction(
  database: PGlite,
  statements: string,
  pattern: RegExp,
) {
  await expect(transaction(database, statements)).rejects.toThrow(pattern);
  await database.exec("ROLLBACK;").catch(() => undefined);
}

describe("Pens catalog constraints", () => {
  const database = new PGlite();

  beforeAll(async () => {
    await migrate(drizzle({ client: database }), { migrationsFolder });
    await database.exec(`
      INSERT INTO makers (name, slug) VALUES ('Pens Test Maker', 'pens-test-maker');
      INSERT INTO users (clerk_id, username) VALUES ('pens-owner', 'pens-owner');
      INSERT INTO user_collection (owner_id, name, normalized_name)
      SELECT id, 'Pens', 'pens' FROM users WHERE clerk_id = 'pens-owner';
    `);
  }, 60_000);

  afterAll(async () => {
    await database.close();
  });

  it("seeds stable Pens lookup values and compiles the v1 relation graph", async () => {
    const seeded = await database.query<{
      /** Seeded mechanism slugs. */
      mechanisms: string;
      /** Seeded Pens product-type slugs. */
      types: string;
    }>(`
      SELECT
        (SELECT string_agg(slug, ',' ORDER BY slug) FROM mechanisms
          WHERE slug IN ('bolt-action', 'click', 'twist')) AS mechanisms,
        (SELECT string_agg(slug, ',' ORDER BY slug) FROM product_types
          WHERE slug IN ('pen', 'pen-actuator', 'pen-clip', 'pen-mechanism',
            'pen-tip', 'pen-top-cap', 'refill')) AS types;
    `);
    expect(seeded.rows[0]).toEqual({
      mechanisms: "bolt-action,click,twist",
      types:
        "pen,pen-actuator,pen-clip,pen-mechanism,pen-tip,pen-top-cap,refill",
    });

    const relational = drizzle({
      client: database,
      relations: schema.relations,
    });
    expect(
      relational.query.productDetailRefill
        .findMany({ with: { offerings: true, product: true } })
        .toSQL().sql,
    ).toContain("product_detail_refill");
  });

  it("removes dormant refill evidence and lifecycle storage", async () => {
    const tables = await database.query<{
      /** Dormant table that survived migration. */
      table_name: string;
    }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'catalog_market',
          'catalog_market_containment',
          'catalog_source_evidence',
          'refill_compatibility_assertion_evidence',
          'refill_compatibility_evidence',
          'refill_compatibility_group_membership_evidence',
          'refill_offering_evidence',
          'refill_offering_identifier_evidence',
          'refill_offering_market_status',
          'refill_offering_market_status_evidence'
        )
      ORDER BY table_name;
    `);
    expect(tables.rows).toEqual([]);

    const columns = await database.query<{
      /** Retired column that survived migration. */
      column_name: string;
      /** Table containing the retired column. */
      table_name: string;
    }>(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'refill_compatibility_assertion'
            AND column_name IN ('outcome', 'explanation', 'remedy', 'warning', 'approved_at'))
          OR (table_name = 'refill_compatibility_group_membership'
            AND column_name = 'approved_at')
          OR (table_name = 'refill_offering' AND column_name = 'approved_at')
          OR (table_name = 'refill_offering_identifier'
            AND column_name IN (
              'market_id', 'effective_date', 'approved_at', 'superseded_at', 'successor_id'
            ))
        )
      ORDER BY table_name, column_name;
    `);
    expect(columns.rows).toEqual([]);
  });

  it("defers exact product and collection subtype validation until commit", async () => {
    await transaction(
      database,
      `
        INSERT INTO product (product_type_id, maker_id, name, slug)
        SELECT pt.id, maker.id, 'Valid Pen', 'valid-pen'
        FROM product_types pt, makers maker
        WHERE pt.slug = 'pen' AND maker.slug = 'pens-test-maker';
        INSERT INTO product_detail_pen (id)
        SELECT id FROM product WHERE slug = 'valid-pen';
      `,
    );
    await expectRejectedTransaction(
      database,
      `INSERT INTO product (product_type_id, maker_id, name, slug)
       SELECT pt.id, maker.id, 'Missing Detail', 'missing-detail'
       FROM product_types pt, makers maker
       WHERE pt.slug = 'pen' AND maker.slug = 'pens-test-maker';`,
      /requires product_detail_pen/iu,
    );
    await expectRejectedTransaction(
      database,
      `
        INSERT INTO product (product_type_id, maker_id, name, slug)
        SELECT pt.id, maker.id, 'Wrong Part', 'wrong-part'
        FROM product_types pt, makers maker
        WHERE pt.slug = 'pen-clip' AND maker.slug = 'pens-test-maker';
        INSERT INTO product_detail_pen_part (id)
        SELECT id FROM product WHERE slug = 'wrong-part';
        INSERT INTO product_detail_pen_tip (id)
        SELECT id FROM product WHERE slug = 'wrong-part';
      `,
      /invalid concrete subtype/iu,
    );
    await transaction(
      database,
      `
        INSERT INTO collection_item (owner_id, collection_id, serial_number)
        SELECT owner_id, id, '  SAGA-42  ' FROM user_collection WHERE normalized_name = 'pens';
        INSERT INTO collection_detail_pen (id, product_pen_id)
        SELECT item.id, product.id FROM collection_item item, product
        WHERE item.serial_number = '  SAGA-42  ' AND product.slug = 'valid-pen';
      `,
    );
    await expect(
      database.exec(`UPDATE collection_item SET serial_number = '   '
        WHERE serial_number = '  SAGA-42  ';`),
    ).rejects.toThrow(/serial_number_valid/iu);
  });

  it("stores direct compatible and installed Pen parts", async () => {
    await transaction(
      database,
      `
        INSERT INTO product (product_type_id, maker_id, name, slug)
        SELECT pt.id, maker.id, 'Valid Tip', 'valid-tip'
        FROM product_types pt, makers maker
        WHERE pt.slug = 'pen-tip' AND maker.slug = 'pens-test-maker';
        INSERT INTO product_detail_pen_part (id)
        SELECT id FROM product WHERE slug = 'valid-tip';
        INSERT INTO product_detail_pen_tip (id)
        SELECT id FROM product WHERE slug = 'valid-tip';
        INSERT INTO pen_compatible_part (pen_product_id, part_product_id)
        SELECT pen.id, tip.id FROM product_detail_pen pen, product_detail_pen_tip tip;
        INSERT INTO collection_item (owner_id, collection_id)
        SELECT owner_id, id FROM user_collection WHERE normalized_name = 'pens';
        INSERT INTO collection_detail_pen_tip (id, product_pen_tip_id)
        SELECT item.id, tip.id
        FROM collection_item item, product_detail_pen_tip tip
        WHERE item.id NOT IN (SELECT id FROM collection_detail_pen);
        INSERT INTO collection_item_installed_pen_part
          (pen_collection_item_id, part_collection_item_id)
        SELECT pen.id, tip.id
        FROM collection_detail_pen pen, collection_detail_pen_tip tip;
      `,
    );
    await expect(
      database.query(`SELECT * FROM collection_item_installed_pen_part;`),
    ).resolves.toMatchObject({ rows: [expect.any(Object)] });
  });

  it("rejects terminology collisions", async () => {
    await expectRejectedTransaction(
      database,
      `INSERT INTO catalog_terminology_alias
        (concept_id, canonical_namespace, label, normalized_value)
       SELECT id, namespace, 'Pen', 'pen' FROM catalog_terminology_concept
       WHERE namespace = 'product-type' AND key = 'pen';`,
      /collides with a canonical term/iu,
    );
    await transaction(
      database,
      `
        INSERT INTO product (product_type_id, maker_id, name, slug)
        SELECT pt.id, maker.id, 'Evidence Refill', 'evidence-refill'
        FROM product_types pt, makers maker
        WHERE pt.slug = 'refill' AND maker.slug = 'pens-test-maker';
        INSERT INTO product_detail_refill (id, maker_id, model, normalized_model)
        SELECT id, maker_id, 'ER-1', 'er-1' FROM product WHERE slug = 'evidence-refill';
      `,
    );
  });

  it("stores direct refill facts without evidence and prevents duplicates", async () => {
    await database.exec(`
      INSERT INTO refill_tip_style (name, slug) VALUES ('Needle', 'needle');
      INSERT INTO refill_ink_color (name, slug) VALUES ('Test Black', 'test-black');
      INSERT INTO refill_offering
        (refill_product_id, tip_style_id, tip_size, normalized_tip_size, ink_color_id)
      SELECT refill.id, style.id, '0.5 mm', '0.5 mm', color.id
      FROM product_detail_refill refill, refill_tip_style style, refill_ink_color color;
      INSERT INTO refill_offering_identifier
        (offering_id, maker_id, kind, source_value, comparison_value)
      SELECT offering.id, maker.id, 'maker-code', 'ER-1', 'ER-1'
      FROM refill_offering offering, makers maker
      WHERE maker.slug = 'pens-test-maker';
      INSERT INTO refill_compatibility_group (concept_id, namespace)
      SELECT id, namespace FROM catalog_terminology_concept
      WHERE namespace = 'refill-compatibility-group' AND key = 'energel';
      INSERT INTO refill_compatibility_group_membership
        (group_id, refill_product_id)
      SELECT refill_compatibility_group.id, product_detail_refill.id
      FROM refill_compatibility_group, product_detail_refill;
      INSERT INTO refill_compatibility_assertion
        (pen_product_id, target_group_id)
      SELECT pen.id, refill_compatibility_group.id
      FROM product_detail_pen pen, refill_compatibility_group;
    `);
    await expectRejectedTransaction(
      database,
      `INSERT INTO refill_compatibility_group_membership
        (group_id, refill_product_id)
       SELECT refill_compatibility_group.id, product_detail_refill.id
       FROM refill_compatibility_group, product_detail_refill;`,
      /refill_compatibility_group_membership_unique/iu,
    );
    await expectRejectedTransaction(
      database,
      `INSERT INTO refill_compatibility_assertion
        (pen_product_id, target_group_id)
       SELECT pen.id, refill_compatibility_group.id
       FROM product_detail_pen pen, refill_compatibility_group;`,
      /refill_compatibility_assertion_scope_unique/iu,
    );
  });
});
