import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("subtype table rename migration", () => {
  const database = new PGlite();

  beforeAll(async () => {
    const folder = new URL("../drizzle/", import.meta.url);
    const files = readdirSync(folder)
      .filter((name) => name.endsWith(".sql"))
      .sort();
    const renameMigration = files.find((name) =>
      readFileSync(new URL(name, folder), "utf8").includes(
        'ALTER TABLE "product_spinner" RENAME TO "product_detail_spinner"',
      ),
    );
    if (!renameMigration)
      throw new Error("Subtype rename migration not found.");

    for (const file of files.slice(0, files.indexOf(renameMigration))) {
      await runMigration(database, folder, file);
    }
    await seedSubtypeRows(database);
    await runMigration(database, folder, renameMigration);
  }, 60_000);

  afterAll(async () => {
    await database.close();
  });

  it("preserves shared IDs and exposes the renamed tables", async () => {
    await expect(
      database.query<{
        /** Preserved catalog detail identifier. */
        id: number;
      }>('SELECT id::integer AS id FROM "product_detail_spinner"'),
    ).resolves.toMatchObject({ rows: [{ id: 1000 }] });
    await expect(
      database.query<{
        /** Preserved collection detail identifier. */
        id: number;
      }>('SELECT id::integer AS id FROM "collection_detail_slider_insert"'),
    ).resolves.toMatchObject({ rows: [{ id: 1004 }] });
  });

  it("keeps old-name views updatable for rollout compatibility", async () => {
    await expect(
      database.query<{
        /** Catalog detail identifier read through the compatibility view. */
        id: number;
      }>('SELECT id::integer AS id FROM "product_spinner" FOR UPDATE'),
    ).resolves.toMatchObject({ rows: [{ id: 1000 }] });

    await database.exec(`
      INSERT INTO product (product_type_id, maker_id, name, slug)
      VALUES (1000, 1000, 'Compatibility spinner', 'compatibility-spinner');
      INSERT INTO product_spinner (id, bearing) VALUES (1005, 'R188');
      UPDATE product_spinner SET bearing = 'R188 hybrid' WHERE id = 1005;
    `);
    await expect(
      database.query<{
        /** Bearing value updated through the compatibility view. */
        bearing: string;
      }>("SELECT bearing FROM product_detail_spinner WHERE id = 1005"),
    ).resolves.toMatchObject({ rows: [{ bearing: "R188 hybrid" }] });

    await database.exec("DELETE FROM product_spinner WHERE id = 1005");
    await expect(
      database.query("SELECT id FROM product_detail_spinner WHERE id = 1005"),
    ).resolves.toMatchObject({ rows: [] });
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
});

/**
 * Applies one repository migration to a PGlite database.
 *
 * @param database - Migration target.
 * @param folder - Repository migration folder.
 * @param file - Migration filename.
 * @returns Completion after every statement is applied.
 */
async function runMigration(database: PGlite, folder: URL, file: string) {
  const sql = readFileSync(new URL(file, folder), "utf8").replaceAll(
    "--> statement-breakpoint",
    "",
  );
  await database.exec(sql);
}

/**
 * Inserts one row for every catalog and collection detail table before rename.
 *
 * @param database - Historical-schema fixture target.
 * @returns Completion after all representative rows are inserted.
 */
async function seedSubtypeRows(database: PGlite) {
  await database.exec(`
    INSERT INTO makers (name, slug) VALUES ('Rename maker', 'rename-maker');
    INSERT INTO product_types (name, slug) VALUES ('Rename type', 'rename-type');
    INSERT INTO product (product_type_id, maker_id, name, slug) VALUES
      (1000, 1000, 'Spinner', 'rename-spinner'),
      (1000, 1000, 'Spinner button', 'rename-spinner-button'),
      (1000, 1000, 'Slider', 'rename-slider'),
      (1000, 1000, 'Slider plate', 'rename-slider-plate'),
      (1000, 1000, 'Slider insert', 'rename-slider-insert');
    INSERT INTO product_spinner (id) VALUES (1000);
    INSERT INTO product_spinner_button (id) VALUES (1001);
    INSERT INTO product_slider (id, uses_inserts, magnet_layout)
      VALUES (1002, false, '2x4');
    INSERT INTO product_slider_plate (id) VALUES (1003);
    INSERT INTO product_slider_insert (id) VALUES (1004);

    INSERT INTO users (clerk_id, username) VALUES ('rename-owner', 'Rename owner');
    INSERT INTO user_collection (owner_id, name, normalized_name)
      VALUES (1000, 'Rename collection', 'renamecollection');
    INSERT INTO collection_item (owner_id, collection_id) VALUES
      (1000, 1000), (1000, 1000), (1000, 1000), (1000, 1000), (1000, 1000);
    INSERT INTO collection_spinner (id, product_spinner_id) VALUES (1000, 1000);
    INSERT INTO collection_spinner_button (id, product_spinner_button_id)
      VALUES (1001, 1001);
    INSERT INTO collection_slider (id, product_slider_id) VALUES (1002, 1002);
    INSERT INTO collection_slider_plate (id, product_slider_plate_id)
      VALUES (1003, 1003);
    INSERT INTO collection_slider_insert (id, product_slider_insert_id)
      VALUES (1004, 1004);
  `);
}
