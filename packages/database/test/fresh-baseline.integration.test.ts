import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Final table, obsolete name, and seeded shared fixture identifier. */
const detailTables = [
  ["collection_detail_slider", "collection_slider", 1002],
  ["collection_detail_slider_insert", "collection_slider_insert", 1004],
  ["collection_detail_slider_plate", "collection_slider_plate", 1003],
  ["collection_detail_spinner", "collection_spinner", 1000],
  ["collection_detail_spinner_button", "collection_spinner_button", 1001],
  ["product_detail_slider", "product_slider", 1002],
  ["product_detail_slider_insert", "product_slider_insert", 1004],
  ["product_detail_slider_plate", "product_slider_plate", 1003],
  ["product_detail_spinner", "product_spinner", 1000],
  ["product_detail_spinner_button", "product_spinner_button", 1001],
] as const;

describe("fresh subtype baseline", () => {
  const database = new PGlite();

  beforeAll(async () => {
    await migrate(drizzle({ client: database }), {
      migrationsFolder: fileURLToPath(new URL("../drizzle/", import.meta.url)),
    });
    await seedSubtypeRows(database);
  }, 60_000);

  afterAll(async () => {
    await database.close();
  });

  it.each(
    detailTables,
  )("preserves shared IDs in %s", async (table, _view, id) => {
    await expect(
      database.query<{
        /** Preserved detail identifier. */
        id: number;
      }>(`SELECT id::integer AS id FROM "${table}"`),
    ).resolves.toMatchObject({ rows: [{ id }] });
  });

  it.each(
    detailTables,
  )("never creates the obsolete name %s / %s", async (_table, oldName) => {
    await expect(database.query(`SELECT id FROM "${oldName}"`)).rejects.toThrow(
      /does not exist/iu,
    );
  });

  it("supports current-table locking and CRUD with cascading base deletion", async () => {
    await expect(
      database.query(
        "SELECT id::integer AS id FROM product_detail_spinner FOR UPDATE",
      ),
    ).resolves.toMatchObject({ rows: [{ id: 1000 }] });
    await database.exec(`
      INSERT INTO product (product_type_id, maker_id, name, slug)
        SELECT id, 1000, 'Writable spinner', 'writable-spinner'
        FROM product_types WHERE slug = 'rename-type';
      INSERT INTO product_detail_spinner (id, bearing) VALUES (1005, 'R188');
      UPDATE product_detail_spinner SET bearing = 'R188 hybrid' WHERE id = 1005;
    `);
    await expect(
      database.query(
        "SELECT bearing FROM product_detail_spinner WHERE id = 1005",
      ),
    ).resolves.toMatchObject({ rows: [{ bearing: "R188 hybrid" }] });
    await expect(
      database.exec("INSERT INTO product_detail_spinner (id) VALUES (1005)"),
    ).rejects.toThrow(/unique/iu);
    await database.exec("DELETE FROM product WHERE id = 1005");
    await expect(
      database.query("SELECT id FROM product_detail_spinner WHERE id = 1005"),
    ).resolves.toMatchObject({ rows: [] });
  });

  it("allows uninstalled spinners and moves a uniquely installed button", async () => {
    await database.exec(`
      INSERT INTO collection_item (owner_id, collection_id) VALUES (1000, 1000);
      INSERT INTO collection_detail_spinner (id, product_spinner_id) VALUES (1005, 1000);
      UPDATE collection_detail_spinner SET installed_button_id = 1001 WHERE id = 1000;
    `);
    await expect(
      database.exec(
        "UPDATE collection_detail_spinner SET installed_button_id = 1001 WHERE id = 1005",
      ),
    ).rejects.toThrow(/unique/iu);
    await database.exec(
      "UPDATE collection_detail_spinner SET installed_button_id = NULL WHERE id = 1000",
    );
    await database.exec(
      "UPDATE collection_detail_spinner SET installed_button_id = 1001 WHERE id = 1005",
    );
    await database.exec("DELETE FROM collection_item WHERE id = 1005");
    await expect(
      database.query(
        "SELECT id FROM collection_detail_spinner WHERE id = 1005",
      ),
    ).resolves.toMatchObject({ rows: [] });
  });

  it.each([
    ["product_detail_spinner", 1000, "weight", "g"],
    ["product_detail_spinner", 1000, "length", "mm"],
    ["product_detail_spinner", 1000, "width", "mm"],
    ["product_detail_spinner", 1000, "thickness", "mm"],
    ["product_detail_spinner", 1000, "thickness_with_button", "mm"],
    ["product_detail_spinner", 1000, "button_diameter", "mm"],
    ["product_detail_spinner", 1000, "spin_diameter", "mm"],
    ["product_detail_spinner_button", 1001, "weight", "g"],
    ["product_detail_spinner_button", 1001, "diameter", "mm"],
    ["product_detail_spinner_button", 1001, "thickness", "mm"],
    ["product_detail_slider", 1002, "weight", "g"],
    ["product_detail_slider", 1002, "length", "mm"],
    ["product_detail_slider", 1002, "width", "mm"],
    ["product_detail_slider", 1002, "thickness", "mm"],
  ])("enforces positive paired measurements in %s.%s / %s", async (table, id, measurement, unit) => {
    await database.exec(
      `UPDATE "${table}" SET "${measurement}_value" = 1, "${measurement}_unit" = '${unit}' WHERE id = ${id}`,
    );
    for (const value of [0, -1]) {
      await expect(
        database.exec(
          `UPDATE "${table}" SET "${measurement}_value" = ${value} WHERE id = ${id}`,
        ),
      ).rejects.toThrow(/constraint/iu);
    }
    await expect(
      database.exec(
        `UPDATE "${table}" SET "${measurement}_unit" = NULL WHERE id = ${id}`,
      ),
    ).rejects.toThrow(/constraint/iu);
    await database.exec(
      `UPDATE "${table}" SET "${measurement}_value" = NULL, "${measurement}_unit" = NULL WHERE id = ${id}`,
    );
  });

  it.each([
    ["product", "description", 5000],
    ["collection_item", "description", 5000],
    ["product_detail_spinner", "bearing", 200],
    ["collection_detail_spinner", "bearing", 200],
  ])("limits %s.%s to %i characters", async (table, column, limit) => {
    await database.exec(
      `UPDATE "${table}" SET "${column}" = repeat('x', ${limit}) WHERE id = 1000`,
    );
    await expect(
      database.exec(
        `UPDATE "${table}" SET "${column}" = repeat('x', ${limit + 1}) WHERE id = 1000`,
      ),
    ).rejects.toThrow(/constraint/iu);
  });

  it("retains foreign-key and check enforcement under new names", async () => {
    await expect(
      database.exec(
        "INSERT INTO collection_detail_spinner (id, product_spinner_id) VALUES (9999, 9999)",
      ),
    ).rejects.toThrow(/foreign key/iu);
    await expect(
      database.exec(
        "UPDATE product_detail_spinner SET weight_value = '-1', weight_unit = 'g' WHERE id = 1000",
      ),
    ).rejects.toThrow(/product_detail_spinner_weight_consistent/iu);
  });

  it("uses final table-owned constraint and index names", async () => {
    const result = await database.query<{
      /** Constraint or index name. */
      objectName: string;
      /** Renamed table that owns the object. */
      tableName: string;
    }>(`
      SELECT constraint_name AS "objectName", table_name AS "tableName"
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name LIKE '%_detail_%'
        AND constraint_name NOT LIKE '%_not_null'
      UNION ALL
      SELECT indexname AS "objectName", tablename AS "tableName"
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename LIKE '%_detail_%'
    `);

    expect(result.rows.length).toBeGreaterThan(10);
    expect(
      result.rows.filter(
        ({ objectName, tableName }) => !objectName.startsWith(tableName),
      ),
    ).toEqual([]);
  });
});

/**
 * Inserts one row for every catalog and collection detail table on the fresh schema.
 *
 * @param database - Fresh-schema fixture target.
 * @returns Completion after all representative rows are inserted.
 */
async function seedSubtypeRows(database: PGlite) {
  await database.exec(`
    INSERT INTO makers (name, slug) VALUES ('Rename maker', 'rename-maker');
    INSERT INTO product_types (name, slug) VALUES ('Rename type', 'rename-type');
    INSERT INTO product (product_type_id, maker_id, name, slug)
    SELECT product_types.id, 1000, values.name, values.slug
    FROM product_types
    CROSS JOIN (VALUES
      ('Spinner', 'rename-spinner'),
      ('Spinner button', 'rename-spinner-button'),
      ('Slider', 'rename-slider'),
      ('Slider plate', 'rename-slider-plate'),
      ('Slider insert', 'rename-slider-insert')
    ) AS values(name, slug)
    WHERE product_types.slug = 'rename-type';
    INSERT INTO product_detail_spinner (id) VALUES (1000);
    INSERT INTO product_detail_spinner_button (id) VALUES (1001);
    INSERT INTO product_detail_slider (id, uses_inserts, magnet_layout)
      VALUES (1002, false, '2x4');
    INSERT INTO product_detail_slider_plate (id) VALUES (1003);
    INSERT INTO product_detail_slider_insert (id) VALUES (1004);

    INSERT INTO users (clerk_id, username) VALUES ('rename-owner', 'Rename owner');
    INSERT INTO user_collection (owner_id, name, normalized_name)
      VALUES (1000, 'Rename collection', 'renamecollection');
    INSERT INTO collection_item (owner_id, collection_id) VALUES
      (1000, 1000), (1000, 1000), (1000, 1000), (1000, 1000), (1000, 1000);
    INSERT INTO collection_detail_spinner (id, product_spinner_id) VALUES (1000, 1000);
    INSERT INTO collection_detail_spinner_button (id, product_spinner_button_id)
      VALUES (1001, 1001);
    INSERT INTO collection_detail_slider (id, product_slider_id) VALUES (1002, 1002);
    INSERT INTO collection_detail_slider_plate (id, product_slider_plate_id)
      VALUES (1003, 1003);
    INSERT INTO collection_detail_slider_insert (id, product_slider_insert_id)
      VALUES (1004, 1004);
  `);
}
