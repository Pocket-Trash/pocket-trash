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
      /** Seeded configuration-slot slugs. */
      slots: string;
      /** Seeded Pens product-type slugs. */
      types: string;
    }>(`
      SELECT
        (SELECT string_agg(slug, ',' ORDER BY slug) FROM mechanisms
          WHERE slug IN ('bolt-action', 'click', 'twist')) AS mechanisms,
        (SELECT string_agg(slug, ',' ORDER BY slug) FROM configuration_slot_kind) AS slots,
        (SELECT string_agg(slug, ',' ORDER BY slug) FROM product_types
          WHERE slug IN ('pen', 'pen-actuator', 'pen-clip', 'pen-mechanism',
            'pen-tip', 'pen-top-cap', 'refill')) AS types;
    `);
    expect(seeded.rows[0]).toEqual({
      mechanisms: "bolt-action,click,twist",
      slots: "actuator,appearance,clip,material,mechanism,tip,top-cap",
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

  it("enforces carrier kinds, required slots, ordered rules, and unique rule signatures", async () => {
    await database.exec(
      `INSERT INTO materials (name, slug) VALUES ('Pens Titanium', 'pens-titanium');`,
    );
    await expectRejectedTransaction(
      database,
      `INSERT INTO product_configuration_slot (product_id, slot_kind_id, position, required)
       SELECT product.id, kind.id, 0, true
       FROM product, configuration_slot_kind kind
       WHERE product.slug = 'valid-pen' AND kind.slug = 'material';`,
      /must contain a choice/iu,
    );
    await transaction(
      database,
      `
        INSERT INTO product_material (product_id, material_id)
        SELECT product.id, materials.id FROM product, materials
        WHERE product.slug = 'valid-pen' AND materials.slug = 'pens-titanium';
        INSERT INTO product_configuration_slot (product_id, slot_kind_id, position, required)
        SELECT product.id, kind.id, 0, true FROM product, configuration_slot_kind kind
        WHERE product.slug = 'valid-pen' AND kind.slug = 'material';
        INSERT INTO product_configuration_choice
          (product_id, slot_id, position, product_material_id)
        SELECT slot.product_id, slot.id, 0, assignment.id
        FROM product_configuration_slot slot
        JOIN configuration_slot_kind kind ON kind.id = slot.slot_kind_id
        JOIN product_material assignment ON assignment.product_id = slot.product_id
        WHERE kind.slug = 'material';
      `,
    );
    await transaction(
      database,
      `
        INSERT INTO finish_option (product_id, position)
        SELECT id, 0 FROM product WHERE slug = 'valid-pen';
        INSERT INTO product_configuration_slot (product_id, slot_kind_id, position, required)
        SELECT product.id, kind.id, 1, false FROM product, configuration_slot_kind kind
        WHERE product.slug = 'valid-pen' AND kind.slug = 'appearance';
        INSERT INTO product_configuration_choice
          (product_id, slot_id, position, finish_option_id)
        SELECT slot.product_id, slot.id, 0, finish.id
        FROM product_configuration_slot slot
        JOIN configuration_slot_kind kind ON kind.id = slot.slot_kind_id
        JOIN finish_option finish ON finish.product_id = slot.product_id
        WHERE kind.slug = 'appearance';
        INSERT INTO product_configuration_choice_rule (product_id, target_choice_id, position)
        SELECT target.product_id, target.id, 0
        FROM product_configuration_choice target
        JOIN product_configuration_slot slot ON slot.id = target.slot_id
        WHERE slot.position = 1;
        INSERT INTO product_configuration_choice_requirement
          (rule_id, product_id, required_choice_id)
        SELECT rule.id, rule.product_id, required.id
        FROM product_configuration_choice_rule rule
        JOIN product_configuration_choice required ON required.product_id = rule.product_id
        JOIN product_configuration_slot slot ON slot.id = required.slot_id
        WHERE slot.position = 0;
      `,
    );
    await expectRejectedTransaction(
      database,
      `UPDATE product_configuration_slot SET position = 2
       WHERE product_id = (SELECT id FROM product WHERE slug = 'valid-pen')
         AND position = 0;`,
      /earlier slot/iu,
    );
    await expectRejectedTransaction(
      database,
      `INSERT INTO product_configuration_choice_rule (product_id, target_choice_id, position)
       SELECT product_id, id, 1 FROM product_configuration_choice
       WHERE slot_id = (SELECT id FROM product_configuration_slot WHERE position = 1
         AND product_id = (SELECT id FROM product WHERE slug = 'valid-pen'));`,
      /at least one requirement/iu,
    );
  });

  it("rejects terminology collisions, invalid market graphs, and unsupported approved claims", async () => {
    await expectRejectedTransaction(
      database,
      `INSERT INTO catalog_terminology_alias
        (concept_id, canonical_namespace, label, normalized_value)
       SELECT id, namespace, 'Pen', 'pen' FROM catalog_terminology_concept
       WHERE namespace = 'product-type' AND key = 'pen';`,
      /collides with a canonical term/iu,
    );
    await database.exec(`
      INSERT INTO catalog_market (kind, code, display_name, display_name_key) VALUES
        ('region', 'TEST-REGION', 'Test Region', 'test.region'),
        ('country', 'XZ', 'Test Country', 'test.country');
      INSERT INTO catalog_market_containment (parent_market_id, child_market_id)
      SELECT parent.id, child.id FROM catalog_market parent, catalog_market child
      WHERE parent.code = 'TEST-REGION' AND child.code = 'XZ';
    `);
    await expectRejectedTransaction(
      database,
      `INSERT INTO catalog_market_containment (parent_market_id, child_market_id)
       SELECT parent.id, child.id FROM catalog_market parent, catalog_market child
       WHERE parent.code = 'XZ' AND child.code = 'TEST-REGION';`,
      /country cannot contain|containment may not contain a cycle/iu,
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
    await expectRejectedTransaction(
      database,
      `
        INSERT INTO refill_tip_style (name, slug) VALUES ('Needle', 'needle');
        INSERT INTO refill_ink_color (name, slug) VALUES ('Test Black', 'test-black');
        INSERT INTO refill_offering
          (refill_product_id, tip_style_id, tip_size, normalized_tip_size, ink_color_id, approved_at)
        SELECT refill.id, style.id, '0.5 mm', '0.5 mm', color.id, now()
        FROM product_detail_refill refill, refill_tip_style style, refill_ink_color color;
      `,
      /require supporting evidence/iu,
    );
  });

  it("keeps catalog evidence append-only and validates structured compatibility evidence", async () => {
    await database.exec(`
      INSERT INTO catalog_source_evidence
        (publisher, source_kind, original_url, capture_date, claim)
      VALUES ('Pilot', 'catalog', 'https://example.com/catalog', '2026-10-10', 'A refill exists.');
    `);
    await expect(
      database.exec("UPDATE catalog_source_evidence SET claim = 'Changed';"),
    ).rejects.toThrow(/append-only/iu);
    await expect(
      database.exec(`INSERT INTO refill_compatibility_evidence
        (kind, summary, source_url)
        VALUES ('manufacturer-statement', 'Incomplete evidence', 'https://example.com');`),
    ).rejects.toThrow(/fields_valid/iu);
  });

  it("requires support for every approved refill claim and preserves successor scope", async () => {
    await database.exec(`
      INSERT INTO refill_tip_style (name, slug) VALUES ('Needle', 'needle');
      INSERT INTO refill_ink_color (name, slug) VALUES ('Test Black', 'test-black');
      INSERT INTO refill_offering
        (refill_product_id, tip_style_id, tip_size, normalized_tip_size, ink_color_id)
      SELECT refill.id, style.id, '0.5 mm', '0.5 mm', color.id
      FROM product_detail_refill refill, refill_tip_style style, refill_ink_color color;
    `);
    await expectRejectedTransaction(
      database,
      `INSERT INTO refill_offering_market_status
        (offering_id, market_id, lifecycle, approved_at)
       SELECT offering.id, market.id, 'current', now()
       FROM refill_offering offering, catalog_market market
       WHERE market.code = 'GLOBAL';`,
      /require supporting evidence/iu,
    );
    await expectRejectedTransaction(
      database,
      `INSERT INTO refill_offering_identifier
        (offering_id, maker_id, kind, source_value, comparison_value, market_id, approved_at)
       SELECT offering.id, maker.id, 'maker-code', 'ER-1', 'ER-1', market.id, now()
       FROM refill_offering offering, makers maker, catalog_market market
       WHERE maker.slug = 'pens-test-maker' AND market.code = 'GLOBAL';`,
      /require supporting evidence/iu,
    );
    await database.exec(`
      INSERT INTO refill_compatibility_group (concept_id, namespace)
      SELECT id, namespace FROM catalog_terminology_concept
      WHERE namespace = 'refill-compatibility-group' AND key = 'energel';
    `);
    await expectRejectedTransaction(
      database,
      `INSERT INTO refill_compatibility_group_membership
        (group_id, refill_product_id, approved_at)
       SELECT refill_compatibility_group.id, product_detail_refill.id, now()
       FROM refill_compatibility_group, product_detail_refill;`,
      /require supporting evidence/iu,
    );
    await expectRejectedTransaction(
      database,
      `INSERT INTO refill_compatibility_assertion
        (pen_product_id, target_group_id, outcome, approved_at)
       SELECT pen.id, refill_compatibility_group.id, 'compatible', now()
       FROM product_detail_pen pen, refill_compatibility_group;`,
      /require supporting evidence/iu,
    );
    await database.exec(`
      INSERT INTO refill_offering_market_status (offering_id, market_id, lifecycle)
      SELECT offering.id, market.id, 'current'
      FROM refill_offering offering, catalog_market market
      WHERE market.code IN ('GLOBAL', 'TEST-REGION');
    `);
    await expectRejectedTransaction(
      database,
      `UPDATE refill_offering_market_status current
       SET superseded_at = now(), successor_id = successor.id
       FROM refill_offering_market_status successor, catalog_market current_market,
         catalog_market successor_market
       WHERE current.market_id = current_market.id
         AND successor.market_id = successor_market.id
         AND current_market.code = 'GLOBAL'
         AND successor_market.code = 'TEST-REGION';`,
      /must preserve offering and market/iu,
    );
  });

  it("rejects overlapping incomparable market claims", async () => {
    await database.exec(`
      INSERT INTO catalog_market (kind, code, display_name, display_name_key) VALUES
        ('region', 'TEST-A', 'Test A', 'test.a'),
        ('region', 'TEST-B', 'Test B', 'test.b'),
        ('country', 'XY', 'Overlap Country', 'test.xy');
      INSERT INTO catalog_market_containment (parent_market_id, child_market_id)
      SELECT parent.id, child.id FROM catalog_market parent, catalog_market child
      WHERE parent.code IN ('TEST-A', 'TEST-B') AND child.code = 'XY';
    `);
    await expectRejectedTransaction(
      database,
      `INSERT INTO refill_offering_market_status (offering_id, market_id, lifecycle)
       SELECT offering.id, market.id,
         CASE WHEN market.code = 'TEST-A' THEN 'current' ELSE 'historical' END
       FROM refill_offering offering, catalog_market market
       WHERE market.code IN ('TEST-A', 'TEST-B');`,
      /overlapping incomparable markets/iu,
    );
  });
});
