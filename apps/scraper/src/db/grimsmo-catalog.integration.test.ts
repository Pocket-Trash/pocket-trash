import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { syncCanonicalSagaMaterials } from "./grimsmo-catalog.js";

describe("canonical Grimsmo Saga material synchronization", () => {
  it("adds resolved materials once and reports unknown names without staging writes", async () => {
    const { client, db } = await createTestDatabase();

    try {
      const first = await syncCanonicalSagaMaterials(db, [
        "Titanium",
        "Bronze",
        "Mystery Alloy",
        "titanium",
      ]);
      expect(first).toMatchObject({
        existingMaterialNames: ["Titanium"],
        newMaterialNames: ["Bronze"],
        unresolvedMaterialNames: ["mystery alloy"],
      });
      await expect(countRows(db, schema.productMaterial)).resolves.toBe(2);

      const second = await syncCanonicalSagaMaterials(db, [
        "Bronze",
        "Titanium",
      ]);
      expect(second).toMatchObject({
        existingMaterialNames: ["Bronze", "Titanium"],
        newMaterialNames: [],
        unresolvedMaterialNames: [],
      });
      await expect(countRows(db, schema.productMaterial)).resolves.toBe(2);
      await expect(countRows(db, schema.tmpProducts)).resolves.toBe(0);
      await expect(countRows(db, schema.tmpProductVariations)).resolves.toBe(0);
      await expect(countRows(db, schema.tmpImages)).resolves.toBe(0);
      await expect(countRows(db, schema.tmpGrimsmoPens)).resolves.toBe(0);
      await expect(countRows(db, schema.tmpGrimsmoPenVariations)).resolves.toBe(
        0,
      );
    } finally {
      await client.close();
    }
  }, 30_000);

  it("reports dry-run assignments without changing the canonical product", async () => {
    const { client, db } = await createTestDatabase();

    try {
      const planned = await syncCanonicalSagaMaterials(
        db,
        ["Copper", "Unknown"],
        { dryRun: true },
      );
      expect(planned).toMatchObject({
        existingMaterialNames: [],
        newMaterialNames: ["Copper"],
        unresolvedMaterialNames: ["unknown"],
      });
      await expect(countRows(db, schema.productMaterial)).resolves.toBe(1);
    } finally {
      await client.close();
    }
  }, 30_000);
});

/**
 * Creates a migrated database containing the approved canonical Saga baseline.
 *
 * @returns Disposable PGlite client and typed database.
 * @rejects When migrations or fixture inserts fail.
 */
async function createTestDatabase(): Promise<{
  /** Disposable in-memory PostgreSQL client. */
  client: PGlite;
  /** Typed database connected to the disposable client. */
  db: Database;
}> {
  const client = new PGlite();
  const migrationsFolder = fileURLToPath(
    new URL("../../../../packages/database/drizzle", import.meta.url),
  );
  await migratePglite(drizzle({ client }), { migrationsFolder });
  const db = drizzle({
    client,
    relations: schema.relations,
  }) as unknown as Database;
  const [maker] = await db
    .insert(schema.maker)
    .values({
      name: "Grimsmo",
      rootUrl: "https://grimsmoknives.com",
      slug: "grimsmo",
    })
    .returning({ id: schema.maker.id });
  const [productType] = await db
    .select({ id: schema.productType.id })
    .from(schema.productType)
    .where(eq(schema.productType.slug, "pen"))
    .limit(1);
  if (!maker || !productType) throw new Error("Failed to seed Saga identity.");
  const product = await db.transaction(async (transaction) => {
    const [created] = await transaction
      .insert(schema.product)
      .values({
        approvalStatus: "approved",
        makerId: maker.id,
        name: "Saga",
        productTypeId: productType.id,
        slug: "saga",
      })
      .returning({ id: schema.product.id });
    if (!created) throw new Error("Failed to seed Saga product.");
    await transaction
      .insert(schema.productDetailPen)
      .values({ id: created.id });
    return created;
  });
  if (!product) throw new Error("Failed to seed Saga product.");
  const materials = await db
    .insert(schema.material)
    .values([
      { name: "Titanium", slug: "titanium" },
      { name: "Bronze", slug: "bronze" },
      { name: "Copper", slug: "copper" },
    ])
    .returning({ id: schema.material.id, name: schema.material.name });
  const titanium = materials.find((material) => material.name === "Titanium");
  if (!titanium) throw new Error("Failed to seed Saga material.");
  await db.insert(schema.productMaterial).values({
    materialId: titanium.id,
    productId: product.id,
  });
  return { client, db };
}

/**
 * Counts rows in one schema table for persistence assertions.
 *
 * @param db - Database containing the test fixture.
 * @param table - Schema table to count.
 * @returns Number of rows persisted in the table.
 */
async function countRows(
  db: Database,
  table: Parameters<Database["select"]>[0] extends never ? never : object,
): Promise<number> {
  return (await db.select().from(table as typeof schema.product)).length;
}
