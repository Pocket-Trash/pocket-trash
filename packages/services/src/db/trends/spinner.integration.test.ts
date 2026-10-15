import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { drizzle } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { createTrendsService } from "./index.js";

describe("public Spinner Trends query", () => {
  it("excludes standalone Buttons and their materials", async () => {
    const client = new PGlite();
    const db = drizzle({ client, relations: schema.relations });

    try {
      await migratePGliteDatabase(client);
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Spinner Maker", slug: "spinner-maker" })
        .returning({ id: schema.maker.id });
      const types = await db
        .insert(schema.productType)
        .values([
          { name: "Spinner", slug: "spinner" },
          {
            isPartOrAccessory: true,
            name: "Spinner Button",
            slug: "spinner-button",
          },
        ])
        .returning({
          id: schema.productType.id,
          slug: schema.productType.slug,
        });
      if (!maker) throw new Error("Spinner fixture maker was not created.");
      const spinnerType = types.find(({ slug }) => slug === "spinner");
      const buttonType = types.find(({ slug }) => slug === "spinner-button");
      if (!spinnerType || !buttonType)
        throw new Error("Spinner fixture product types were not created.");
      const products = await db
        .insert(schema.product)
        .values([
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Parent Spinner",
            productTypeId: spinnerType.id,
            slug: "parent-spinner",
          },
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Standalone Button",
            productTypeId: buttonType.id,
            slug: "standalone-button",
          },
        ])
        .returning({ id: schema.product.id, slug: schema.product.slug });
      const spinner = products.find(({ slug }) => slug === "parent-spinner");
      const button = products.find(({ slug }) => slug === "standalone-button");
      if (!spinner || !button)
        throw new Error("Spinner fixture products were not created.");
      await db.insert(schema.productDetailSpinner).values({
        bearing: "R188",
        id: spinner.id,
        width: "2",
        widthUnit: "in",
      });
      await db.insert(schema.productDetailSpinnerButton).values({
        diameter: "25",
        diameterUnit: "mm",
        id: button.id,
      });
      const materials = await db
        .insert(schema.material)
        .values([
          { name: "Titanium", slug: "titanium" },
          { name: "Zirconium", slug: "zirconium" },
        ])
        .returning({ id: schema.material.id, slug: schema.material.slug });
      const titanium = materials.find(({ slug }) => slug === "titanium");
      const zirconium = materials.find(({ slug }) => slug === "zirconium");
      if (!titanium || !zirconium)
        throw new Error("Spinner fixture materials were not created.");
      await db.insert(schema.productMaterial).values([
        { materialId: titanium.id, productId: spinner.id },
        { materialId: zirconium.id, productId: button.id },
      ]);

      const trends = await createTrendsService(
        db as unknown as Database,
      ).getPublicSpinnerTrends();

      expect(trends).toMatchObject({
        catalogProductCount: 1,
        productTypeId: spinnerType.id,
      });
      expect(
        trends?.trends.find(({ metric }) => metric === "bodyMaterial")?.values,
      ).toEqual([
        expect.objectContaining({ catalogCount: 1, label: "Titanium" }),
      ]);
      expect(
        trends?.trends.find(({ metric }) => metric === "width")?.values,
      ).toEqual([
        expect.objectContaining({ catalogCount: 1, numericValue: 50.8 }),
      ]);
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
