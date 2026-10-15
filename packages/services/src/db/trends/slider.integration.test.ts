import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { drizzle } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { createTrendsService } from "./index.js";

describe("public Slider Trends query", () => {
  it("uses included components without counting standalone components", async () => {
    const client = new PGlite();
    const db = drizzle({ client, relations: schema.relations });

    try {
      await migratePGliteDatabase(client);
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Slider Maker", slug: "slider-maker" })
        .returning({ id: schema.maker.id });
      const types = await db
        .insert(schema.productType)
        .values([
          { name: "Slider", slug: "slider" },
          {
            isPartOrAccessory: true,
            name: "Slider Plate",
            slug: "slider-plate",
          },
          {
            isPartOrAccessory: true,
            name: "Slider Insert",
            slug: "slider-insert",
          },
        ])
        .returning({
          id: schema.productType.id,
          slug: schema.productType.slug,
        });
      if (!maker) throw new Error("Slider fixture maker was not created.");
      const sliderType = types.find(({ slug }) => slug === "slider");
      const plateType = types.find(({ slug }) => slug === "slider-plate");
      const insertType = types.find(({ slug }) => slug === "slider-insert");
      if (!sliderType || !plateType || !insertType)
        throw new Error("Slider fixture product types were not created.");
      const products = await db
        .insert(schema.product)
        .values([
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Parent Slider",
            productTypeId: sliderType.id,
            slug: "parent-slider",
          },
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Included Plate",
            productTypeId: plateType.id,
            slug: "included-plate",
          },
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Included Insert",
            productTypeId: insertType.id,
            slug: "included-insert",
          },
        ])
        .returning({ id: schema.product.id, slug: schema.product.slug });
      const slider = products.find(({ slug }) => slug === "parent-slider");
      const plate = products.find(({ slug }) => slug === "included-plate");
      const insert = products.find(({ slug }) => slug === "included-insert");
      if (!slider || !plate || !insert)
        throw new Error("Slider fixture products were not created.");
      await db.insert(schema.productDetailSliderPlate).values({ id: plate.id });
      await db
        .insert(schema.productDetailSliderInsert)
        .values({ id: insert.id, magnetLayout: "2x3" });
      await db.insert(schema.productDetailSlider).values({
        id: slider.id,
        includedInsertProductId: insert.id,
        includedPlateProductId: plate.id,
        magnetLayout: null,
        usesInserts: true,
        width: "2",
        widthUnit: "in",
      });
      const materials = await db
        .insert(schema.material)
        .values([
          { name: "Titanium", slug: "titanium" },
          { name: "Zirconium", slug: "zirconium" },
          { name: "Ultem", slug: "ultem" },
        ])
        .returning({ id: schema.material.id, slug: schema.material.slug });
      const titanium = materials.find(({ slug }) => slug === "titanium");
      const zirconium = materials.find(({ slug }) => slug === "zirconium");
      const ultem = materials.find(({ slug }) => slug === "ultem");
      if (!titanium || !zirconium || !ultem)
        throw new Error("Slider fixture materials were not created.");
      const productMaterials = await db
        .insert(schema.productMaterial)
        .values([
          { productId: slider.id },
          { productId: plate.id },
          { productId: insert.id },
        ])
        .returning({
          id: schema.productMaterial.id,
          productId: schema.productMaterial.productId,
        });
      await db.insert(schema.productMaterialComponent).values(
        productMaterials.map(({ id, productId }) => ({
          materialId:
            productId === slider.id
              ? titanium.id
              : productId === plate.id
                ? zirconium.id
                : ultem.id,
          productMaterialId: id,
        })),
      );

      const trends = await createTrendsService(
        db as unknown as Database,
      ).getPublicSliderTrends();

      expect(trends).toMatchObject({
        catalogProductCount: 1,
        productTypeId: sliderType.id,
      });
      expect(
        trends?.trends.find(({ metric }) => metric === "bodyMaterial")?.values,
      ).toEqual([
        expect.objectContaining({ catalogCount: 1, label: "Titanium" }),
      ]);
      expect(
        trends?.trends.find(({ metric }) => metric === "plateMaterial")?.values,
      ).toEqual([
        expect.objectContaining({ catalogCount: 1, label: "Zirconium" }),
      ]);
      expect(
        trends?.trends.find(({ metric }) => metric === "magnetLayout")?.values,
      ).toEqual([expect.objectContaining({ label: "2×3" })]);
      expect(
        trends?.trends.find(({ metric }) => metric === "positionCount")?.values,
      ).toEqual([expect.objectContaining({ label: "2" })]);
      expect(JSON.stringify(trends)).not.toContain("Ultem");
    } finally {
      await client.close();
    }
  }, 30_000);
});

/**
 * Applies the production migration chain to an isolated in-memory database.
 *
 * @param client - Empty PGlite client.
 * @returns Completion after every migration is applied.
 */
async function migratePGliteDatabase(client: PGlite): Promise<void> {
  const migrationsFolder = fileURLToPath(
    new URL("../../../../database/drizzle", import.meta.url),
  );
  await migratePglite(drizzle({ client }), { migrationsFolder });
}
