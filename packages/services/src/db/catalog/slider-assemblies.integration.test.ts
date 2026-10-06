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

describe("owned slider assemblies", () => {
  it("installs compatible components, moves the connected assembly, and grandfathers uninterrupted installs", async () => {
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
        .values({ clerkId: "assembly-owner", username: "Assembly owner" })
        .returning();
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Assembly maker" })
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
      /**
       * Returns a required fixture ID for the requested slug.
       *
       * @param ids - Fixture IDs indexed by slug.
       * @param slug - Fixture slug to resolve.
       * @returns The matching fixture ID.
       * @throws When the fixture was not created.
       */
      const requireId = (ids: Map<string, number>, slug: string) => {
        const id = ids.get(slug);
        if (!id) throw new Error(`Missing fixture ID for ${slug}.`);
        return id;
      };
      const products = await db
        .insert(schema.product)
        .values([
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Insert slider",
            productTypeId: requireId(typeId, "slider"),
            slug: "insert-slider",
          },
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Body slider",
            productTypeId: requireId(typeId, "slider"),
            slug: "body-slider",
          },
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Plate",
            productTypeId: requireId(typeId, "slider-plate"),
            slug: "plate",
          },
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Other plate",
            productTypeId: requireId(typeId, "slider-plate"),
            slug: "other-plate",
          },
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Insert",
            productTypeId: requireId(typeId, "slider-insert"),
            slug: "insert",
          },
        ])
        .returning();
      const productId = new Map(
        products.map((product) => [product.slug, product.id]),
      );
      const insertSliderProductId = requireId(productId, "insert-slider");
      const bodySliderProductId = requireId(productId, "body-slider");
      const plateProductId = requireId(productId, "plate");
      const otherPlateProductId = requireId(productId, "other-plate");
      const insertProductId = requireId(productId, "insert");
      await Promise.all([
        db.insert(schema.productSlider).values({
          id: insertSliderProductId,
          magnetSystem: "insert-driven",
        }),
        db.insert(schema.productSlider).values({
          id: bodySliderProductId,
          magnetSystem: "body-hosted",
        }),
        db
          .insert(schema.productSliderPlate)
          .values([{ id: plateProductId }, { id: otherPlateProductId }]),
        db.insert(schema.productSliderInsert).values({ id: insertProductId }),
      ]);
      await db.insert(schema.productMaterial).values(
        products.map((product) => ({
          materialId: material.id,
          productId: product.id,
        })),
      );
      const [family, otherFamily] = await db
        .insert(schema.compatibilityFamily)
        .values([
          { makerId: maker.id, name: "Family", slug: "family" },
          { makerId: maker.id, name: "Other", slug: "other" },
        ])
        .returning();
      if (!family || !otherFamily) throw new Error("Families missing.");
      await db.insert(schema.productCompatibilityFamily).values([
        {
          compatibilityFamilyId: family.id,
          productId: insertSliderProductId,
          reviewedByClerkId: owner.clerkId,
        },
        {
          compatibilityFamilyId: family.id,
          productId: bodySliderProductId,
          reviewedByClerkId: owner.clerkId,
        },
        {
          compatibilityFamilyId: family.id,
          productId: plateProductId,
          reviewedByClerkId: owner.clerkId,
        },
        {
          compatibilityFamilyId: otherFamily.id,
          productId: otherPlateProductId,
          reviewedByClerkId: owner.clerkId,
        },
        {
          compatibilityFamilyId: family.id,
          productId: insertProductId,
          reviewedByClerkId: owner.clerkId,
        },
      ]);
      await db.insert(schema.productIncludedComponent).values({
        componentProductId: plateProductId,
        productId: insertSliderProductId,
      });
      const [primary, spares, destination] = await db
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
            name: "Spares",
            normalizedName: "spares",
            ownerId: owner.id,
          },
          {
            isPrivate: false,
            name: "Destination",
            normalizedName: "destination",
            ownerId: owner.id,
          },
        ])
        .returning();
      if (!primary || !spares || !destination)
        throw new Error("Collections missing.");
      const actor = { clerkId: owner.clerkId, role: "user" as const };
      const service = createDbServices(
        db,
        createNoopLogger({ app: "test", environment: "test" }),
      ).collections;
      /**
       * Adds one owned slider or component fixture.
       *
       * @param collectionId - Destination collection ID.
       * @param productId - Catalog product ID.
       * @param productTypeSlug - Slider subtype slug.
       * @returns The new collection-item ID.
       */
      const add = async (
        collectionId: number,
        productId: number,
        productTypeSlug: "slider" | "slider-insert" | "slider-plate",
      ) =>
        await service.addSliderProduct({
          actor,
          collectionId,
          customFinish: null,
          displayName: productTypeSlug,
          finishOptionId: null,
          materialId: material.id,
          productId,
          productTypeSlug,
        });
      const insertSliderId = await add(
        primary.id,
        insertSliderProductId,
        "slider",
      );
      const bodySliderId = await add(primary.id, bodySliderProductId, "slider");
      const plateId = await add(spares.id, plateProductId, "slider-plate");
      const otherPlateId = await add(
        spares.id,
        otherPlateProductId,
        "slider-plate",
      );
      const insertId = await add(spares.id, insertProductId, "slider-insert");

      await expect(
        service.getOwnedItem(actor, insertSliderId),
      ).resolves.toEqual(
        expect.objectContaining({
          compatibilityFamilies: [
            expect.objectContaining({ id: family.id, name: family.name }),
          ],
          includedComponents: [
            expect.objectContaining({
              id: plateProductId,
              productTypeSlug: "slider-plate",
            }),
          ],
          installedInsertId: null,
          installedPlateId: null,
        }),
      );
      await service.updateItem({
        actor,
        collectionItemId: insertSliderId,
        customFinish: null,
        displayName: "Insert slider",
        finishOptionId: null,
        installedInsert: { collectionItemId: insertId },
        installedPlate: { collectionItemId: plateId },
        materialId: material.id,
      });
      await expect(
        service.getOwnedItem(actor, insertSliderId),
      ).resolves.toEqual(
        expect.objectContaining({
          hasGrandfatheredInstallation: false,
          installedInsertId: insertId,
          installedPlateId: plateId,
        }),
      );
      await expect(service.getOwnedItem(actor, plateId)).resolves.toEqual(
        expect.objectContaining({
          collectionId: primary.id,
          installedOnSliderId: insertSliderId,
        }),
      );

      await expect(
        service.updateItem({
          actor,
          collectionItemId: bodySliderId,
          customFinish: null,
          displayName: "Body slider",
          finishOptionId: null,
          installedInsert: { collectionItemId: insertId },
          materialId: material.id,
        }),
      ).rejects.toThrow("Body-hosted sliders cannot install inserts.");
      await expect(
        service.updateItem({
          actor,
          collectionItemId: bodySliderId,
          customFinish: null,
          displayName: "Body slider",
          finishOptionId: null,
          installedPlate: { collectionItemId: plateId },
          materialId: material.id,
        }),
      ).rejects.toThrow("already installed on another slider");
      await expect(
        service.updateItem({
          actor,
          collectionItemId: bodySliderId,
          customFinish: null,
          displayName: "Body slider",
          finishOptionId: null,
          installedPlate: { collectionItemId: otherPlateId },
          materialId: material.id,
        }),
      ).rejects.toThrow("does not share a compatibility family");

      await db.insert(schema.productCompatibilityFamily).values({
        compatibilityFamilyId: family.id,
        productId: otherPlateProductId,
        reviewedByClerkId: owner.clerkId,
      });
      await service.updateItem({
        actor,
        collectionItemId: insertSliderId,
        customFinish: null,
        displayName: "Insert slider",
        finishOptionId: null,
        installedPlate: { collectionItemId: otherPlateId },
        materialId: material.id,
      });
      await expect(service.getOwnedItem(actor, plateId)).resolves.toEqual(
        expect.objectContaining({
          collectionId: primary.id,
          installedOnSliderId: null,
        }),
      );

      await service.updateItem({
        actor,
        collectionId: destination.id,
        collectionItemId: otherPlateId,
        customFinish: null,
        displayName: "Plate",
        finishOptionId: null,
        materialId: material.id,
      });
      await expect(
        service.getOwnedItem(actor, insertSliderId),
      ).resolves.toEqual(
        expect.objectContaining({ collectionId: destination.id }),
      );
      await expect(service.getOwnedItem(actor, insertId)).resolves.toEqual(
        expect.objectContaining({ collectionId: destination.id }),
      );

      await db
        .delete(schema.productCompatibilityFamily)
        .where(
          eq(schema.productCompatibilityFamily.productId, otherPlateProductId),
        );
      await expect(
        service.getOwnedItem(actor, insertSliderId),
      ).resolves.toEqual(
        expect.objectContaining({ hasGrandfatheredInstallation: true }),
      );
      await service.updateItem({
        actor,
        collectionItemId: insertSliderId,
        customFinish: null,
        displayName: "Still installed",
        finishOptionId: null,
        materialId: material.id,
      });
      await service.updateItem({
        actor,
        collectionItemId: insertSliderId,
        customFinish: null,
        displayName: "Uninstalled",
        finishOptionId: null,
        installedPlate: null,
        materialId: material.id,
      });
      await expect(
        service.updateItem({
          actor,
          collectionItemId: insertSliderId,
          customFinish: null,
          displayName: "Reinstall rejected",
          finishOptionId: null,
          installedPlate: { collectionItemId: otherPlateId },
          materialId: material.id,
        }),
      ).rejects.toThrow("does not share a compatibility family");

      await service.deleteItem({
        actor,
        collectionItemId: insertId,
        confirmed: true,
      });
      await expect(
        service.getOwnedItem(actor, insertSliderId),
      ).resolves.toEqual(expect.objectContaining({ installedInsertId: null }));

      await db.insert(schema.productCompatibilityFamily).values({
        compatibilityFamilyId: family.id,
        productId: otherPlateProductId,
        reviewedByClerkId: owner.clerkId,
      });
      await service.updateItem({
        actor,
        collectionItemId: insertSliderId,
        customFinish: null,
        displayName: "Ready to delete",
        finishOptionId: null,
        installedPlate: { collectionItemId: otherPlateId },
        materialId: material.id,
      });
      await service.deleteItem({
        actor,
        collectionItemId: insertSliderId,
        confirmed: true,
      });
      await expect(service.getOwnedItem(actor, otherPlateId)).resolves.toEqual(
        expect.objectContaining({ installedOnSliderId: null }),
      );
    } finally {
      await client.close();
    }
  }, 30_000);
});
