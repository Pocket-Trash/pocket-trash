import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import {
  syncCanonicalSagaCatalog,
  syncCanonicalSagaImage,
  syncCanonicalSagaMaterials,
} from "./grimsmo-catalog.js";

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

describe("canonical Grimsmo Saga catalog synchronization", () => {
  it("creates taxonomy, caps appearances at 100, and fills 30 images once", async () => {
    const { client, db } = await createTestDatabase();
    const sliderOptions = Array.from(
      { length: 105 },
      (_, index) => `Slider ${index + 1}`,
    );
    const snapshot = {
      appearances: sliderOptions.map((sliderOption) => ({
        colorNames: ["Bronze"],
        finishNames: ["Stonewashed"],
        sliderOption,
      })),
      colorNames: ["Bronze"],
      finishNames: ["Stonewashed"],
      images: Array.from({ length: 30 }, (_, index) => ({
        listingUrl: `https://grimsmoknives.com/products/saga-${index + 1}`,
        sourceHandle: `saga-${index + 1}`,
        sourceImageId: `image-${index + 1}`,
        sourceProductId: `product-${index + 1}`,
        sourceUrl: `https://cdn.example.test/saga-${index + 1}.jpg`,
      })),
      materialNames: ["Titanium", "Mystery Alloy"],
      sliderOptions,
    };

    try {
      const first = await syncCanonicalSagaCatalog(db, snapshot);
      expect(first).toMatchObject({
        cappedAppearanceCount: 7,
        newAppearanceCount: 98,
        newColorNames: ["Bronze"],
        newFinishNames: ["Stonewashed"],
        newMaterialNames: ["Mystery Alloy"],
        newSliderOptions: sliderOptions,
        plannedImageCount: 30,
      });
      expect(first.imageCandidates).toHaveLength(30);
      await expect(countRows(db, schema.finishOption)).resolves.toBe(100);
      await expect(countRows(db, schema.productMaterial)).resolves.toBe(2);

      for (const [index, image] of first.imageCandidates.entries()) {
        const sha256 = index.toString(16).padStart(64, "0");
        await syncCanonicalSagaImage(db, {
          listingId: image.listingId,
          productId: image.productId,
          uploaded: {
            contentType: "image/jpeg",
            fileName: `${sha256}.jpg`,
            objectPath: `images/products/${image.productId}/${sha256}.jpg`,
            position: image.position,
            sha256,
            size: 42,
            sourceImageId: image.sourceImageId,
            sourceUrl: image.sourceUrl,
            url: `https://cdn.pocket-trash.app/images/products/${image.productId}/${sha256}.jpg`,
          },
        });
      }
      await expect(countRows(db, schema.productImage)).resolves.toBe(30);
      const firstCandidate = first.imageCandidates[0];
      if (!firstCandidate) throw new Error("Expected a Saga image candidate.");
      const cappedHash = "f".repeat(64);
      await expect(
        syncCanonicalSagaImage(db, {
          listingId: firstCandidate.listingId,
          productId: firstCandidate.productId,
          uploaded: {
            contentType: "image/jpeg",
            fileName: `${cappedHash}.jpg`,
            objectPath: `images/products/${firstCandidate.productId}/${cappedHash}.jpg`,
            position: 30,
            sha256: cappedHash,
            size: 42,
            sourceImageId: firstCandidate.sourceImageId,
            sourceUrl: `${firstCandidate.sourceUrl}?replacement=1`,
            url: `https://cdn.pocket-trash.app/images/products/${firstCandidate.productId}/${cappedHash}.jpg`,
          },
        }),
      ).resolves.toEqual({
        capped: true,
        changed: false,
        productImageId: null,
      });
      await expect(countRows(db, schema.productImage)).resolves.toBe(30);

      const second = await syncCanonicalSagaCatalog(db, snapshot);
      expect(second).toMatchObject({
        cappedAppearanceCount: 7,
        imageCandidates: [],
        newAppearanceCount: 0,
        newColorNames: [],
        newFinishNames: [],
        newMaterialNames: [],
        newSliderOptions: [],
        plannedImageCount: 0,
      });
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
  const [baselineFinish, baselinePattern] = await Promise.all([
    db
      .insert(schema.finish)
      .values({ name: "Caramel PVD", slug: "caramel-pvd" })
      .returning({ id: schema.finish.id }),
    db
      .insert(schema.pattern)
      .values({ name: "Helix", slug: "helix" })
      .returning({ id: schema.pattern.id }),
  ]);
  if (!baselineFinish[0] || !baselinePattern[0])
    throw new Error("Failed to seed Saga appearance lookups.");
  const caramelPvd = baselineFinish[0];
  const baselineOptions = await db
    .insert(schema.finishOption)
    .values([
      { position: 0, productId: product.id },
      { patternId: baselinePattern[0].id, position: 1, productId: product.id },
    ])
    .returning({
      id: schema.finishOption.id,
      position: schema.finishOption.position,
    });
  await db.insert(schema.finishOptionFinish).values(
    baselineOptions.map((option) => ({
      finishId: caramelPvd.id,
      finishOptionId: option.id,
      position: 0,
    })),
  );
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
