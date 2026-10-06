import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createNoopLogger } from "@package/logger";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import { createDbServices } from "../index.js";

describe("standalone slider collection items", () => {
  it("creates, reads, counts, moves, edits, audits, and permanently deletes every slider subtype", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema }) as unknown as Database;
    const folder = fileURLToPath(
      new URL("../../../../database/drizzle", import.meta.url),
    );
    try {
      for (const file of readdirSync(folder)
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        await client.exec(
          readFileSync(join(folder, file), "utf8").replaceAll(
            "--> statement-breakpoint",
            "",
          ),
        );
      }
      const [owner] = await db
        .insert(schema.user)
        .values({ clerkId: "slider-owner", username: "Slider owner" })
        .returning();
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Slider maker" })
        .returning();
      const [material] = await db
        .insert(schema.material)
        .values({ name: "Titanium", slug: "titanium" })
        .returning();
      if (!owner || !maker || !material) throw new Error("Fixtures missing.");
      const productTypes = await db
        .insert(schema.productType)
        .values([
          { name: "Slider", slug: "slider" },
          { name: "Slider plate", slug: "slider-plate" },
          { name: "Slider insert", slug: "slider-insert" },
        ])
        .returning();
      const typeId = new Map(productTypes.map((type) => [type.slug, type.id]));
      const sliderTypeId = typeId.get("slider");
      const sliderPlateTypeId = typeId.get("slider-plate");
      const sliderInsertTypeId = typeId.get("slider-insert");
      if (!sliderTypeId || !sliderPlateTypeId || !sliderInsertTypeId) {
        throw new Error("Product types missing.");
      }
      const productTypeIds = {
        slider: sliderTypeId,
        "slider-insert": sliderInsertTypeId,
        "slider-plate": sliderPlateTypeId,
      };
      const products = await db
        .insert(schema.product)
        .values(
          (["slider", "slider-plate", "slider-insert"] as const).map(
            (slug) => ({
              approvalStatus: "approved" as const,
              makerId: maker.id,
              name: slug,
              productTypeId: productTypeIds[slug],
              slug,
            }),
          ),
        )
        .returning();
      const productId = new Map(
        products.map((product) => [product.slug, product.id]),
      );
      const sliderProductId = productId.get("slider");
      const sliderPlateProductId = productId.get("slider-plate");
      const sliderInsertProductId = productId.get("slider-insert");
      if (!sliderProductId || !sliderPlateProductId || !sliderInsertProductId) {
        throw new Error("Products missing.");
      }
      const productIds = {
        slider: sliderProductId,
        "slider-insert": sliderInsertProductId,
        "slider-plate": sliderPlateProductId,
      };
      await Promise.all([
        db.insert(schema.productSlider).values({
          id: sliderProductId,
          magnetSystem: "body-hosted",
        }),
        db.insert(schema.productSliderPlate).values({
          id: sliderPlateProductId,
        }),
        db.insert(schema.productSliderInsert).values({
          id: sliderInsertProductId,
        }),
      ]);
      await db.insert(schema.productMaterial).values(
        products.map((product) => ({
          materialId: material.id,
          productId: product.id,
        })),
      );
      const collections = await db
        .insert(schema.userCollection)
        .values([
          {
            isPrivate: false,
            name: "Primary",
            normalizedName: "primary",
            ownerId: owner.id,
          },
          {
            isPrivate: false,
            name: "Moved",
            normalizedName: "moved",
            ownerId: owner.id,
          },
        ])
        .returning();
      const primary = collections[0];
      const destination = collections[1];
      if (!primary || !destination) throw new Error("Collections missing.");
      const actor = { clerkId: owner.clerkId, role: "user" as const };
      const collectionsService = createDbServices(
        db,
        createNoopLogger({ app: "test", environment: "test" }),
      ).collections;

      const itemIds = await Promise.all(
        (["slider", "slider-plate", "slider-insert"] as const).map((slug) =>
          collectionsService.addSliderProduct({
            actor,
            collectionId: primary.id,
            customFinish: null,
            displayName: slug,
            finishOptionId: null,
            materialId: material.id,
            productId: productIds[slug],
            productTypeSlug: slug,
          }),
        ),
      );
      const sliderItemId = itemIds[0];
      const insertItemId = itemIds[2];
      if (!sliderItemId || !insertItemId) throw new Error("Items missing.");
      await expect(collectionsService.listOwned(actor)).resolves.toEqual(
        expect.arrayContaining(
          (["slider", "slider-plate", "slider-insert"] as const).map(
            (productTypeSlug) => expect.objectContaining({ productTypeSlug }),
          ),
        ),
      );
      await expect(
        collectionsService.countOwnedProducts({
          actorClerkId: actor.clerkId,
          productIds: [...productId.values()],
        }),
      ).resolves.toEqual(
        Object.fromEntries([...productId.values()].map((id) => [id, 1])),
      );

      await collectionsService.updateItem({
        actor,
        collectionId: destination.id,
        collectionItemId: sliderItemId,
        customFinish: null,
        displayName: "Moved slider",
        finishOptionId: null,
        materialId: material.id,
      });
      await expect(
        collectionsService.getOwnedItem(actor, sliderItemId),
      ).resolves.toMatchObject({
        collectionId: destination.id,
        displayName: "Moved slider",
        productTypeSlug: "slider",
      });

      await collectionsService.deleteItem({
        actor,
        collectionItemId: insertItemId,
        confirmed: true,
      });
      await expect(
        collectionsService.getOwnedItem(actor, insertItemId),
      ).resolves.toBeNull();
      const events = await db
        .select({ action: schema.auditEvent.action })
        .from(schema.auditEvent)
        .where(eq(schema.auditEvent.targetType, "collections.item"));
      expect(events.map(({ action }) => action)).toEqual(
        expect.arrayContaining([
          "collections.item.created",
          "collections.item.moved",
          "collections.item.updated",
          "collections.item.deleted",
        ]),
      );
    } finally {
      await client.close();
    }
  }, 30_000);
});
