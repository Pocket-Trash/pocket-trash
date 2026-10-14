import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createLogger } from "@package/logger";
import { drizzle } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { createDbServices } from "../index.js";

describe("catalog trends", () => {
  it("counts distinct approved public products for primary product types", async () => {
    const client = new PGlite();
    const db = drizzle({ client, relations: schema.relations });

    try {
      await migratePGliteDatabase(client);
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Trend Maker", slug: "trend-maker" })
        .returning({ id: schema.maker.id });
      const productTypes = await db
        .insert(schema.productType)
        .values([
          { name: "Spinner", slug: "spinner" },
          { name: "Slider", slug: "slider" },
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
      if (!maker) throw new Error("Trend maker fixture was not created.");
      const typeId = new Map(productTypes.map((type) => [type.slug, type.id]));
      const spinnerTypeId = typeId.get("spinner");
      const sliderTypeId = typeId.get("slider");
      const buttonTypeId = typeId.get("spinner-button");
      if (!spinnerTypeId || !sliderTypeId || !buttonTypeId)
        throw new Error("Trend product-type fixtures were not created.");

      const products = await db
        .insert(schema.product)
        .values([
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Public spinner one",
            productTypeId: spinnerTypeId,
            slug: "public-spinner-one",
          },
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Public spinner two",
            productTypeId: spinnerTypeId,
            slug: "public-spinner-two",
          },
          {
            approvalStatus: "pending",
            makerId: maker.id,
            name: "Pending slider",
            productTypeId: sliderTypeId,
            slug: "pending-slider",
          },
          {
            approvalStatus: "approved",
            isPrivate: true,
            makerId: maker.id,
            name: "Private slider",
            productTypeId: sliderTypeId,
            slug: "private-slider",
          },
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Public button",
            productTypeId: buttonTypeId,
            slug: "public-button",
          },
        ])
        .returning({ id: schema.product.id, slug: schema.product.slug });
      const materials = await db
        .insert(schema.material)
        .values([
          { name: "Titanium", slug: "titanium" },
          { name: "Zirconium", slug: "zirconium" },
        ])
        .returning({ id: schema.material.id });
      const firstSpinner = products.find(
        (product) => product.slug === "public-spinner-one",
      );
      if (!firstSpinner || materials.length !== 2)
        throw new Error(
          "Trend duplicate-prevention fixtures were not created.",
        );
      await db.insert(schema.productMaterial).values(
        materials.map((material) => ({
          materialId: material.id,
          productId: firstSpinner.id,
        })),
      );

      const trends = await createDbServices(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      ).catalog.listPublicProductTypeTrends();

      expect(trends).toEqual([
        {
          count: 2,
          productTypeId: spinnerTypeId,
          productTypeName: "Spinner",
          productTypeSlug: "spinner",
        },
      ]);
    } finally {
      await client.close();
    }
  }, 30_000);
});

/**
 * Applies the production migration chain to an isolated PGlite database.
 *
 * @param client - PGlite client to migrate.
 * @returns Completion after every migration is applied.
 */
async function migratePGliteDatabase(client: PGlite): Promise<void> {
  const migrationsFolder = fileURLToPath(
    new URL("../../../../database/drizzle", import.meta.url),
  );
  await migratePglite(drizzle({ client }), { migrationsFolder });
}
