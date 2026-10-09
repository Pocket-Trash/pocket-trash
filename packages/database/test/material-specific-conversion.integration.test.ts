import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { expect, it, onTestFinished } from "vitest";

/** Complete native rc4 migration chain. */
const migrationsFolder = fileURLToPath(new URL("../drizzle/", import.meta.url));

it("converts populated M390 without merging generic assignments or changing image metadata", async (context) => {
  const baseline = mkdtempSync(join(tmpdir(), "material-baseline-"));
  context.onTestFinished(() =>
    rmSync(baseline, { recursive: true, force: true }),
  );
  for (const name of [
    "20261008225705_fresh_baseline",
    "20261008225717_database_protections",
  ]) {
    cpSync(join(migrationsFolder, name), join(baseline, name), {
      recursive: true,
    });
  }
  const database = new PGlite();
  context.onTestFinished(() => database.close());
  const db = drizzle({ client: database });
  await migrate(db, { migrationsFolder: baseline });
  await database.exec(`
    INSERT INTO materials (name, slug, description) VALUES
      ('Stainless Steel', 'stainless-steel', NULL), ('M390 Steel', 'm390-steel', 'Reviewed steel');
    INSERT INTO makers (name, slug) VALUES ('KAP', 'kap');
    INSERT INTO product_types (name, slug) VALUES ('Spinner', 'spinner');
    INSERT INTO product (maker_id, product_type_id, name, slug)
      VALUES (1000, 1000, 'Bar Cell Mini', 'bar-cell-mini');
    INSERT INTO product_material (product_id, material_id) VALUES (1000, 1000), (1000, 1001);
    INSERT INTO users (clerk_id, username) VALUES ('conversion-owner', 'conversion-owner');
    INSERT INTO user_collection (owner_id, name, normalized_name) VALUES (1000, 'Steel', 'steel');
    INSERT INTO collection_item (owner_id, collection_id, material_id) VALUES (1000, 1000, 1001);
    INSERT INTO material_image
      (material_id, position, file_name, content_type, size, sha256, object_path, url, uploaded_by_clerk_id, deleted_at, deleted_by_role)
      VALUES (1001, 3, 'm390.webp', 'image/webp', 1, repeat('a',64), 'old/m390', 'https://example.com/m390', 'conversion-owner', now(), 'admin');
  `);
  await migrate(db, { migrationsFolder });
  await migrate(db, { migrationsFolder });
  await expect(
    database.query(`SELECT material_id::int, material_specific_id::int
    FROM product_material ORDER BY material_specific_id NULLS FIRST`),
  ).resolves.toMatchObject({
    rows: [
      { material_id: 1000, material_specific_id: null },
      { material_id: 1000, material_specific_id: 1000 },
    ],
  });
  await expect(
    database.query(`SELECT material_id::int, material_specific_id::int
    FROM collection_item`),
  ).resolves.toMatchObject({
    rows: [{ material_id: 1000, material_specific_id: 1000 }],
  });
  await expect(
    database.query(`SELECT id::int, material_id::int, material_specific_id::int,
    position, object_path, uploaded_by_clerk_id, deleted_by_role FROM material_image`),
  ).resolves.toMatchObject({
    rows: [
      {
        id: 1000,
        material_id: 1000,
        material_specific_id: 1000,
        position: 3,
        object_path: "old/m390",
        uploaded_by_clerk_id: "conversion-owner",
        deleted_by_role: "admin",
      },
    ],
  });
  await expect(
    database.query(`SELECT name, description FROM material_specific`),
  ).resolves.toMatchObject({
    rows: [{ name: "M390 Steel", description: "Reviewed steel" }],
  });
  await expect(
    database.query(`SELECT id FROM materials WHERE slug = 'm390-steel'`),
  ).resolves.toMatchObject({ rows: [] });
}, 60_000);

it.each([
  "live upload",
  "Autmog reference",
  "destination collision",
])("rolls back conversion on %s", async (blocker) => {
  const baseline = mkdtempSync(join(tmpdir(), "material-blocker-"));
  onTestFinished(() => rmSync(baseline, { recursive: true, force: true }));
  for (const name of [
    "20261008225705_fresh_baseline",
    "20261008225717_database_protections",
    ...(blocker === "destination collision"
      ? ["20261009061932_clean_mojo"]
      : []),
  ]) {
    cpSync(join(migrationsFolder, name), join(baseline, name), {
      recursive: true,
    });
  }
  const database = new PGlite();
  onTestFinished(() => database.close());
  const db = drizzle({ client: database });
  await migrate(db, { migrationsFolder: baseline });
  await database.exec(`INSERT INTO materials (name, slug) VALUES
    ('Stainless Steel', 'stainless-steel'), ('M390 Steel', 'm390-steel');`);
  if (blocker === "live upload")
    await database.exec(`INSERT INTO upload_session
    (id, uploader_clerk_id, target_type, target_id, expires_at)
    VALUES ('00000000-0000-4000-8000-000000000001', 'pending-owner', 'material', 1001, now() + interval '1 hour');`);
  if (blocker === "destination collision")
    await database.exec(`INSERT INTO material_specific
    (material_id, name, slug) VALUES (1000, 'Existing M390', 'm390-steel');`);
  if (blocker === "Autmog reference")
    await database.exec(`
    INSERT INTO makers (name, slug) VALUES ('Autmog', 'autmog');
    INSERT INTO tmp_products (source) VALUES ('autmog');
    INSERT INTO tmp_autmog_pens (product_id, maker_id, source_product_id, source_handle, title,
      product_url, normalized_data, details_hash, image_set_hash)
      VALUES (1000, 1000, 'source-pen', 'source-pen', 'Source pen', 'https://example.com/pen', '{}', repeat('a',64), repeat('b',64));
    INSERT INTO tmp_autmog_pen_materials (pen_id, material_id) VALUES (1000, 1001);
  `);
  const autmogBefore = await database.query(
    `SELECT row_to_json(p) AS data FROM tmp_autmog_pens p`,
  );
  const definitionsBefore =
    await database.query(`SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_name LIKE 'tmp_autmog_%' ORDER BY table_name, ordinal_position`);
  await expect(migrate(db, { migrationsFolder })).rejects.toThrow(
    /upload|Autmog|destination/iu,
  );
  await expect(
    database.query(`SELECT id::int FROM materials WHERE slug = 'm390-steel'`),
  ).resolves.toMatchObject({ rows: [{ id: 1001 }] });
  expect(
    (
      await database.query(
        `SELECT row_to_json(p) AS data FROM tmp_autmog_pens p`,
      )
    ).rows,
  ).toEqual(autmogBefore.rows);
  expect(
    (
      await database.query(`SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_name LIKE 'tmp_autmog_%' ORDER BY table_name, ordinal_position`)
    ).rows,
  ).toEqual(definitionsBefore.rows);
}, 60_000);
