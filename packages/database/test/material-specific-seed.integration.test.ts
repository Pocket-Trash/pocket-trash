import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { expect, it } from "vitest";
import {
  loadKapedcSeedData,
  seedCatalog,
  seedKapedcProducts,
} from "../scripts/seed.js";
import type { createDb } from "../src/client.js";
import * as schema from "../src/schema/index.js";

it("seeds canonical M390 and preserves both Bar Cell Mini offers and their IDs on rerun", async (context) => {
  const client = new PGlite();
  context.onTestFinished(() => client.close());
  const db = drizzle({ client, relations: schema.relations });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../drizzle/", import.meta.url)),
  });
  expect(await db.select().from(schema.materialSpecific)).toEqual([]);
  const seedDb = db as unknown as ReturnType<typeof createDb>;
  const snapshot = await loadKapedcSeedData();
  await seedCatalog(seedDb);
  await seedKapedcProducts(seedDb, snapshot);
  const first = await db.select().from(schema.productMaterial);
  const specifics = await db.select().from(schema.materialSpecific);
  await seedCatalog(seedDb);
  await seedKapedcProducts(seedDb, snapshot);
  expect(await db.select().from(schema.productMaterial)).toEqual(first);
  expect(await db.select().from(schema.materialSpecific)).toEqual(specifics);
  const rows =
    await client.query(`SELECT m.slug, s.slug AS specific FROM product_material a
    JOIN product p ON p.id = a.product_id JOIN materials m ON m.id = a.material_id
    LEFT JOIN material_specific s ON s.id = a.material_specific_id
    WHERE p.slug = 'bar-cell-mini' AND m.slug = 'stainless-steel' ORDER BY s.slug NULLS FIRST`);
  expect(rows.rows).toEqual([
    { slug: "stainless-steel", specific: null },
    { slug: "stainless-steel", specific: "m390-steel" },
  ]);
}, 60_000);
