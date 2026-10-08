import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Renamed table, removed compatibility view, and fixture identifier. */
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

describe("subtype compatibility view removal migration", () => {
  const database = new PGlite();
  let cleanupSql = "";

  beforeAll(async () => {
    const folder = new URL("../drizzle/", import.meta.url);
    const files = readdirSync(folder)
      .filter((name) => name.endsWith(".sql"))
      .sort();
    const cleanupMigration = files.find((name) =>
      readFileSync(new URL(name, folder), "utf8").includes(
        'DROP VIEW "product_spinner"',
      ),
    );
    if (!cleanupMigration)
      throw new Error(
        "Subtype compatibility-view cleanup migration not found.",
      );
    cleanupSql = readFileSync(new URL(cleanupMigration, folder), "utf8");

    for (const file of files.slice(0, files.indexOf(cleanupMigration))) {
      await runMigration(database, folder, file);
    }
    await seedSubtypeRows(database);
    await runMigration(database, folder, cleanupMigration);
  }, 60_000);

  afterAll(async () => {
    await database.close();
  });

  it("drops exactly the ten compatibility views", () => {
    const droppedViews = [...cleanupSql.matchAll(/DROP VIEW "([^"]+)"/gu)]
      .map((match) => match[1])
      .sort();

    expect(droppedViews).toEqual(detailTables.map(([, view]) => view).sort());
    expect(cleanupSql).not.toMatch(/(?:ALTER|DROP) TABLE/iu);
  });

  it.each(
    detailTables,
  )("preserves %s and its shared ID", async (table, _view, id) => {
    await expect(
      database.query<{
        /** Preserved detail identifier. */
        id: number;
      }>(`SELECT id::integer AS id FROM "${table}"`),
    ).resolves.toMatchObject({ rows: [{ id }] });
  });

  it.each(
    detailTables,
  )("removes the %s compatibility view", async (_table, view) => {
    await expect(database.query(`SELECT id FROM "${view}"`)).rejects.toThrow(
      /does not exist/iu,
    );
  });

  it("keeps renamed tables writable", async () => {
    await database.exec(`
      INSERT INTO product (product_type_id, maker_id, name, slug)
      VALUES (1000, 1000, 'Writable spinner', 'writable-spinner');
      INSERT INTO product_detail_spinner (id, bearing) VALUES (1005, 'R188');
      UPDATE product_detail_spinner SET bearing = 'R188 hybrid' WHERE id = 1005;
    `);
    await expect(
      database.query<{
        /** Updated bearing value. */
        bearing: string;
      }>("SELECT bearing FROM product_detail_spinner WHERE id = 1005"),
    ).resolves.toMatchObject({ rows: [{ bearing: "R188 hybrid" }] });

    await database.exec("DELETE FROM product_detail_spinner WHERE id = 1005");
    await expect(
      database.query("SELECT id FROM product_detail_spinner WHERE id = 1005"),
    ).resolves.toMatchObject({ rows: [] });
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
 * Inserts one row for every renamed catalog and collection detail table.
 *
 * @param database - Migration target.
 * @returns Completion after the fixtures are inserted.
 */
async function seedSubtypeRows(database: PGlite) {
  await database.exec(`
    INSERT INTO makers (name, slug) VALUES ('Cleanup maker', 'cleanup-maker');
    INSERT INTO product_types (name, slug) VALUES ('Cleanup type', 'cleanup-type');
    INSERT INTO product (product_type_id, maker_id, name, slug) VALUES
      (1000, 1000, 'Spinner', 'cleanup-spinner'),
      (1000, 1000, 'Spinner button', 'cleanup-spinner-button'),
      (1000, 1000, 'Slider', 'cleanup-slider'),
      (1000, 1000, 'Slider plate', 'cleanup-slider-plate'),
      (1000, 1000, 'Slider insert', 'cleanup-slider-insert');
    INSERT INTO product_detail_spinner (id) VALUES (1000);
    INSERT INTO product_detail_spinner_button (id) VALUES (1001);
    INSERT INTO product_detail_slider (id, uses_inserts, magnet_layout)
      VALUES (1002, false, '2x4');
    INSERT INTO product_detail_slider_plate (id) VALUES (1003);
    INSERT INTO product_detail_slider_insert (id) VALUES (1004);

    INSERT INTO users (clerk_id, username) VALUES ('cleanup-owner', 'Cleanup owner');
    INSERT INTO user_collection (owner_id, name, normalized_name)
      VALUES (1000, 'Cleanup collection', 'cleanupcollection');
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
