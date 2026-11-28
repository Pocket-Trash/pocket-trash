import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

describe("fountain-pen database protections", () => {
  const database = new PGlite();
  beforeAll(async () => {
    await migrate(drizzle({ client: database }), {
      migrationsFolder: fileURLToPath(new URL("../drizzle/", import.meta.url)),
    });
    await database.exec(`BEGIN;
      INSERT INTO makers (name, slug) VALUES ('Fountain maker', 'fountain-maker');
      INSERT INTO materials (name, slug) VALUES ('Steel', 'steel'), ('Titanium', 'titanium');
      INSERT INTO users (clerk_id, username) VALUES ('fountain-one', 'fountain-one'), ('fountain-two', 'fountain-two');
      INSERT INTO user_collection (owner_id, name, normalized_name) SELECT id, 'Writing', 'writing' FROM users WHERE clerk_id IN ('fountain-one', 'fountain-two');
      INSERT INTO product (name, slug, maker_id, product_type_id)
        SELECT 'Bock 250 Steel', 'bock-250-steel', m.id, t.id FROM makers m, product_types t WHERE m.slug = 'fountain-maker' AND t.slug = 'nib';
      INSERT INTO product_material (product_id) SELECT id FROM product WHERE slug = 'bock-250-steel';
      INSERT INTO product_material_component (product_material_id, material_id)
        SELECT pm.id, m.id FROM product_material pm, materials m WHERE m.slug = 'steel';
      INSERT INTO product_detail_nib (id, manufacturer_size_code) SELECT id, '250' FROM product WHERE slug = 'bock-250-steel';
      INSERT INTO nib_plating_style_offering (nib_product_id, style) SELECT id, 'unplated' FROM product_detail_nib;
      INSERT INTO nib_plating_metal (name, slug) VALUES ('Rhodium', 'rhodium');
      INSERT INTO nib_mount (name, slug) VALUES ('Bock 250 housing', 'bock-250'), ('JoWo #6 housing', 'jowo-6');
      INSERT INTO nib_mount_compatibility (nib_product_id, mount_id) SELECT n.id, m.id FROM product_detail_nib n, nib_mount m WHERE m.slug = 'bock-250';
      INSERT INTO fountain_pen_connector_family (name, slug) VALUES ('International', 'international');
      INSERT INTO product (name, slug, maker_id, product_type_id)
        SELECT 'OG3', 'og3', m.id, t.id FROM makers m, product_types t WHERE m.slug = 'fountain-maker' AND t.slug = 'fountain-pen';
      INSERT INTO product_detail_fountain_pen (id) SELECT id FROM product WHERE slug = 'og3';
      INSERT INTO fountain_pen_section_option (pen_product_id, name, mount_id)
        SELECT p.id, m.name, m.id FROM product_detail_fountain_pen p, nib_mount m;
      INSERT INTO collection_item (owner_id, collection_id, display_name)
        SELECT owner_id, id, CASE WHEN owner_id = (SELECT id FROM users WHERE clerk_id = 'fountain-one') THEN 'Nib One' ELSE 'Nib Two' END FROM user_collection;
      INSERT INTO collection_item_material (collection_item_id, material_id) SELECT i.id, m.id FROM collection_item i, materials m WHERE m.slug = 'steel';
      INSERT INTO collection_detail_nib (id, product_nib_id) SELECT i.id, n.id FROM collection_item i, product_detail_nib n;
      INSERT INTO collection_item (owner_id, collection_id, display_name) SELECT c.owner_id, c.id, 'Pen One' FROM user_collection c JOIN users u ON u.id = c.owner_id WHERE u.clerk_id = 'fountain-one';
      INSERT INTO collection_detail_fountain_pen (id, product_fountain_pen_id, section_option_id)
        SELECT i.id, p.id, s.id FROM collection_item i, product_detail_fountain_pen p, fountain_pen_section_option s WHERE i.display_name = 'Pen One' AND s.name = 'Bock 250 housing';
      COMMIT;`);
  }, 60_000);
  beforeEach(async () => {
    await database.exec("BEGIN;");
  });
  afterEach(async () => {
    await database.exec("ROLLBACK;");
  });
  afterAll(async () => {
    await database.close();
  });

  it("accepts an explicit matching mount while keeping unknown capability values", async () => {
    await database.exec(
      `UPDATE collection_detail_fountain_pen SET nib_mode = 'owned', installed_nib_collection_item_id = (SELECT id FROM collection_item WHERE display_name = 'Nib One'); SET CONSTRAINTS ALL IMMEDIATE;`,
    );
    expect(
      (
        await database.query(
          "SELECT postable, owner_replaceable_nib FROM product_detail_fountain_pen",
        )
      ).rows,
    ).toEqual([{ postable: null, owner_replaceable_nib: null }]);
  });

  it.each([
    [
      "another owner's nib",
      `UPDATE collection_detail_fountain_pen SET nib_mode = 'owned', installed_nib_collection_item_id = (SELECT id FROM collection_item WHERE display_name = 'Nib Two')`,
    ],
    [
      "nominally similar sizes with different mounts",
      `UPDATE collection_detail_fountain_pen SET section_option_id = (SELECT id FROM fountain_pen_section_option WHERE name = 'JoWo #6 housing'), nib_mode = 'owned', installed_nib_collection_item_id = (SELECT id FROM collection_item WHERE display_name = 'Nib One')`,
    ],
    [
      "default mode on a section without an included nib",
      `UPDATE collection_detail_fountain_pen SET nib_mode = 'default'`,
    ],
    [
      "active connector data without Cartridge/converter",
      `UPDATE product_detail_fountain_pen SET connector_family_id = (SELECT id FROM fountain_pen_connector_family WHERE slug = 'international'), cartridge_converter_length = 'short'`,
    ],
    [
      "a classification from another terminology axis",
      `UPDATE product_detail_fountain_pen SET nib_construction_id = (SELECT id FROM catalog_terminology_concept WHERE namespace = 'fountain-pen-cap-closure' AND key = 'screw')`,
    ],
    [
      "a second nib base material",
      `INSERT INTO product_material_component (product_material_id, material_id) SELECT pm.id, m.id FROM product_material pm, materials m WHERE m.slug = 'titanium'`,
    ],
    [
      "actual plating not offered by the model",
      `UPDATE collection_detail_nib SET plating_style = 'full', coating_metal_id = (SELECT id FROM nib_plating_metal WHERE slug = 'rhodium')`,
    ],
    [
      "moving a subtype away from its catalog product",
      `INSERT INTO product (name, slug, maker_id, product_type_id) SELECT 'Other', 'other', maker_id, product_type_id FROM product WHERE slug = 'og3'; UPDATE product_detail_fountain_pen SET id = (SELECT id FROM product WHERE slug = 'other')`,
    ],
    [
      "adding a second collection subtype",
      `INSERT INTO collection_detail_nib (id, product_nib_id) SELECT i.id, p.id FROM collection_item i, product_detail_nib p WHERE i.display_name = 'Pen One'`,
    ],
    [
      "renaming an active Cartridge/converter reference",
      `INSERT INTO fountain_pen_filling_mechanism_assignment (pen_product_id, mechanism_id) SELECT p.id, m.id FROM product_detail_fountain_pen p, fountain_pen_filling_mechanism m WHERE m.slug = 'cartridge-converter'; UPDATE product_detail_fountain_pen SET cartridge_converter_length = 'short'; UPDATE fountain_pen_filling_mechanism SET slug = 'renamed' WHERE slug = 'cartridge-converter'`,
    ],
    [
      "removing the mount that permits an active installation",
      `UPDATE collection_detail_fountain_pen SET nib_mode = 'owned', installed_nib_collection_item_id = (SELECT id FROM collection_item WHERE display_name = 'Nib One'); DELETE FROM nib_mount_compatibility`,
    ],
  ])("rejects %s through the database boundary", async (_name, statements) => {
    await expect(
      database.exec(`${statements}; SET CONSTRAINTS ALL IMMEDIATE;`),
    ).rejects.toThrow();
  });
});
