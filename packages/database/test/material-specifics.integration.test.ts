import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../src/schema/index.js";

describe("material-specific constraints", () => {
  const database = new PGlite();

  beforeAll(async () => {
    await migrate(drizzle({ client: database }), {
      migrationsFolder: fileURLToPath(new URL("../drizzle/", import.meta.url)),
    });
    await database.exec(`
      INSERT INTO materials (name, slug) VALUES
        ('Stainless Steel', 'stainless-steel'), ('Titanium', 'titanium');
    `);
  }, 60_000);

  afterAll(async () => {
    await database.close();
  });

  it("allows parent-scoped names and rejects duplicate case variants", async () => {
    await database.exec(`
      INSERT INTO material_specific (material_id, name, slug) VALUES
        (1000, 'M390 Steel', 'm390-steel'), (1001, 'M390 Steel', 'm390-steel');
    `);
    await expect(
      database.exec(`
      INSERT INTO material_specific (material_id, name, slug)
      VALUES (1000, 'M390 STEEL', 'another-slug');
    `),
    ).rejects.toThrow(/unique/iu);
  });

  it("keeps parentage immutable and excludes the parent's normalized name", async () => {
    await expect(
      database.exec(`UPDATE material_specific SET material_id = 1001
      WHERE material_id = 1000;`),
    ).rejects.toThrow(/immutable/iu);
    await expect(
      database.exec(`INSERT INTO material_specific (material_id, name, slug)
      VALUES (1000, ' stainless steel ', 'parent-name');`),
    ).rejects.toThrow(/parent name/iu);
    await expect(
      database.exec(`INSERT INTO material_specific (material_id, name, slug)
      VALUES (1000, E'\\tstainless steel\\n', 'whitespace-parent');`),
    ).rejects.toThrow(/parent name/iu);
    await expect(
      database.exec(`INSERT INTO material_specific (material_id, name, slug)
      VALUES (1000, E'\\t\\n\\u00a0', 'blank');`),
    ).rejects.toThrow(/name_valid/iu);
    await expect(
      database.exec(`INSERT INTO material_specific (material_id, name, slug)
      VALUES (1000, E'\\u00a0M390 Steel\\u00a0', 'whitespace-duplicate');`),
    ).rejects.toThrow(/unique/iu);
    await expect(
      database.exec(`UPDATE materials SET name = ' M390 STEEL '
      WHERE id = 1000;`),
    ).rejects.toThrow(/parent name/iu);
  });

  it("preserves generic and specific assignments and rejects invalid pairs", async () => {
    await database.exec(`
      INSERT INTO makers (name, slug) VALUES ('KAP', 'kap');
      INSERT INTO product_types (name, slug) VALUES ('Spinner', 'spinner');
      INSERT INTO product (maker_id, product_type_id, name, slug)
        SELECT 1000, id, 'Bar Cell Mini', 'bar-cell-mini'
        FROM product_types WHERE slug = 'spinner';
      INSERT INTO product_material (product_id, material_id, material_specific_id)
        VALUES (1000, 1000, NULL), (1000, 1000, 1000);
    `);
    for (const pair of ["1000, NULL", "1000, 1000", "1001, 1000"]) {
      await expect(
        database.exec(`INSERT INTO product_material
        (product_id, material_id, material_specific_id) VALUES (1000, ${pair})`),
      ).rejects.toThrow(/unique|foreign key/iu);
    }
    await database.exec(`
      INSERT INTO users (clerk_id, username) VALUES ('material-owner', 'material-owner');
      INSERT INTO user_collection (owner_id, name, normalized_name)
        VALUES (1000, 'Materials', 'materials');
    `);
    await expect(
      database.exec(`INSERT INTO collection_item
      (owner_id, collection_id, material_specific_id) VALUES (1000, 1000, 1000)`),
    ).rejects.toThrow(/specific_requires_material/iu);
    await database.exec(`INSERT INTO collection_item
      (owner_id, collection_id, material_id, material_specific_id)
      VALUES (1000, 1000, 1000, 1000);
      DELETE FROM product_material WHERE material_specific_id = 1000;`);
    await expect(
      database.query(`SELECT material_specific_id::int AS specific
      FROM collection_item`),
    ).resolves.toMatchObject({ rows: [{ specific: 1000 }] });
  });

  it("enforces image duplicates per scope, including archived images", async () => {
    await database.exec(`INSERT INTO material_image
      (material_id, material_specific_id, position, file_name, content_type, size, sha256, object_path, url)
      VALUES (1000, NULL, 0, 'general.webp', 'image/webp', 1, repeat('a',64), 'general', 'https://example.com/general'),
        (1000, 1000, 0, 'specific.webp', 'image/webp', 1, repeat('a',64), 'specific', 'https://example.com/specific');
      UPDATE material_image SET deleted_at = now(), deleted_by_role = 'admin'
        WHERE object_path = 'general';`);
    await expect(
      database.exec(`INSERT INTO material_image
      (material_id, position, file_name, content_type, size, sha256, object_path, url)
      VALUES (1000, 1, 'duplicate.webp', 'image/webp', 1, repeat('a',64), 'duplicate', 'https://example.com/duplicate')`),
    ).rejects.toThrow(/scope_hash_unique/iu);
    await expect(
      database.exec(`UPDATE material_image SET material_id = 1001
      WHERE object_path = 'specific'`),
    ).rejects.toThrow(/specific_parent_fk/iu);
  });

  it("compiles the new relational graph with the existing rc4 client contract", () => {
    const db = drizzle({ client: database, relations: schema.relations });
    expect(
      db.query.materialSpecific
        .findMany({
          with: {
            material: true,
            products: true,
            images: true,
            collectionItems: true,
          },
        })
        .toSQL().sql,
    ).toContain("material_specific");
  });
});
