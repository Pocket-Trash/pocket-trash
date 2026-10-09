import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createNoopLogger } from "@package/logger";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { createDbServices } from "../index.js";

describe("owned slider magnet snapshots", () => {
  it("keeps an owned snapshot while the installed insert supplies the layout", async () => {
    const client = new PGlite();
    const db = drizzle({
      client: client,
      relations: schema.relations,
    }) as unknown as Database;
    const folder = fileURLToPath(
      new URL("../../../../database/drizzle", import.meta.url),
    );
    try {
      await migratePglite(drizzle({ client: client }), {
        migrationsFolder: folder,
      });
      const [owner] = await db
        .insert(schema.user)
        .values({ clerkId: "setup-owner", username: "Setup owner" })
        .returning();
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Setup maker", slug: "setup-maker" })
        .returning();
      const [material] = await db
        .insert(schema.material)
        .values({ name: "Titanium", slug: "titanium-setup" })
        .returning();
      if (!owner || !maker || !material) throw new Error("Fixtures missing.");
      const types = await db
        .insert(schema.productType)
        .values([
          { name: "Slider", slug: "slider" },
          { name: "Slider insert", slug: "slider-insert" },
        ])
        .returning();
      const sliderTypeId = types.find(({ slug }) => slug === "slider")?.id;
      const insertTypeId = types.find(
        ({ slug }) => slug === "slider-insert",
      )?.id;
      if (!sliderTypeId || !insertTypeId)
        throw new Error("Product types missing.");
      const products = await db
        .insert(schema.product)
        .values([
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Setup slider",
            productTypeId: sliderTypeId,
            slug: "setup-slider",
          },
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Matching insert",
            productTypeId: insertTypeId,
            slug: "matching-insert",
          },
        ])
        .returning();
      const sliderProductId = products.find(
        ({ slug }) => slug === "setup-slider",
      )?.id;
      const insertProductId = products.find(
        ({ slug }) => slug === "matching-insert",
      )?.id;
      if (!sliderProductId || !insertProductId)
        throw new Error("Products missing.");
      await db.insert(schema.productDetailSlider).values({
        id: sliderProductId,
        magnetLayout: "2x4",
        usesInserts: true,
      });
      await db
        .insert(schema.productDetailSliderInsert)
        .values({ id: insertProductId });
      await db.insert(schema.productMaterial).values(
        products.map((product) => ({
          materialId: material.id,
          productId: product.id,
        })),
      );
      const [collection] = await db
        .insert(schema.userCollection)
        .values({
          isPrivate: false,
          name: "Setups",
          normalizedName: "setups",
          ownerId: owner.id,
        })
        .returning();
      if (!collection) throw new Error("Collection missing.");
      const actor = { clerkId: owner.clerkId, role: "user" as const };
      const service = createDbServices(
        db,
        createNoopLogger({ app: "test", environment: "test" }),
      ).collections;
      const sliderId = await service.addSliderProduct({
        actor,
        collectionId: collection.id,
        customFinish: null,
        displayName: "Slider",
        finishOptionId: null,
        materialAssignmentId: (
          await db
            .select({ id: schema.productMaterial.id })
            .from(schema.productMaterial)
            .where(eq(schema.productMaterial.productId, sliderProductId))
        )[0]!.id,
        productId: sliderProductId,
        productTypeSlug: "slider",
      });
      const insertId = await service.addSliderProduct({
        actor,
        collectionId: collection.id,
        customFinish: null,
        displayName: "Insert",
        finishOptionId: null,
        materialAssignmentId: (
          await db
            .select({ id: schema.productMaterial.id })
            .from(schema.productMaterial)
            .where(eq(schema.productMaterial.productId, insertProductId))
        )[0]!.id,
        productId: insertProductId,
        productTypeSlug: "slider-insert",
      });
      await service.updateItem({
        actor,
        collectionItemId: sliderId,
        customFinish: null,
        displayName: "Slider",
        finishOptionId: null,
        installedInsert: { collectionItemId: insertId },
      });
      const configuration = {
        sideA: Array.from({ length: 8 }, () => "N52" as const),
        sideB: null,
      };
      await service.updateItem({
        actor,
        collectionItemId: sliderId,
        customFinish: null,
        displayName: "Slider",
        finishOptionId: null,
        magnetConfiguration: configuration,
      });
      expect(
        (await service.getOwnedItem(actor, sliderId))?.magnetConfiguration,
      ).toEqual(configuration);
      expect(
        (await service.getOwnedItem(actor, sliderId))?.effectiveSliderSetup,
      ).toMatchObject({
        clickCount: 3,
        configuration,
        magnetLayout: "2x4",
        source: "installed-insert",
      });
    } finally {
      await client.close();
    }
  }, 30_000);
});
