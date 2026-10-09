import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createNoopLogger } from "@package/logger";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { createDbServices } from "../index.js";

describe("owned slider assemblies", () => {
  it("installs available components and moves the connected assembly", async () => {
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
        .values({ clerkId: "assembly-owner", username: "Assembly owner" })
        .returning();
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Assembly maker", slug: "assembly-maker" })
        .returning();
      const [material] = await db
        .insert(schema.material)
        .values({ name: "Titanium", slug: "titanium" })
        .returning();
      if (!owner || !maker || !material) throw new Error("Fixtures missing.");
      const productTypes = await db
        .insert(schema.productType)
        .values([
          { name: "Spinner", slug: "spinner" },
          { name: "Spinner button", slug: "spinner-button" },
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
            name: "Spinner",
            productTypeId: requireId(typeId, "spinner"),
            slug: "spinner",
          },
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Spinner button",
            productTypeId: requireId(typeId, "spinner-button"),
            slug: "spinner-button",
          },
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
      const spinnerProductId = requireId(productId, "spinner");
      const spinnerButtonProductId = requireId(productId, "spinner-button");
      const bodySliderProductId = requireId(productId, "body-slider");
      const plateProductId = requireId(productId, "plate");
      const otherPlateProductId = requireId(productId, "other-plate");
      const insertProductId = requireId(productId, "insert");
      await Promise.all([
        db.insert(schema.productDetailSpinner).values({ id: spinnerProductId }),
        db
          .insert(schema.productDetailSpinnerButton)
          .values({ id: spinnerButtonProductId }),
        db.insert(schema.productDetailSlider).values({
          id: insertSliderProductId,
          magnetLayout: "2x4",
          usesInserts: true,
        }),
        db.insert(schema.productDetailSlider).values({
          id: bodySliderProductId,
          magnetLayout: "2x4",
          usesInserts: false,
        }),
        db
          .insert(schema.productDetailSliderPlate)
          .values([{ id: plateProductId }, { id: otherPlateProductId }]),
        db
          .insert(schema.productDetailSliderInsert)
          .values({ id: insertProductId }),
      ]);
      await db.insert(schema.productMaterial).values(
        products.map((product) => ({
          materialId: material.id,
          productId: product.id,
        })),
      );
      await db
        .update(schema.productDetailSlider)
        .set({ includedPlateProductId: plateProductId })
        .where(eq(schema.productDetailSlider.id, insertSliderProductId));
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
      const { spinnerItemId } = await service.addSpinner({
        actor,
        buttonCustomFinish: null,
        buttonFinishOptionId: null,
        buttonMaterialId: null,
        buttonProductId: null,
        collectionId: primary.id,
        displayName: "Spinner",
        spinnerCustomFinish: null,
        spinnerFinishOptionId: null,
        spinnerMaterialId: material.id,
        spinnerProductId,
      });
      const spinnerButtonId = await service.addSpinnerButton({
        actor,
        collectionId: spares.id,
        customFinish: null,
        displayName: "Spinner button",
        finishOptionId: null,
        materialId: material.id,
        productId: spinnerButtonProductId,
      });

      await db
        .update(schema.collectionItem)
        .set({ approvalStatus: "approved" })
        .where(eq(schema.collectionItem.ownerId, owner.id));
      await service.setItemVisibility({
        actor,
        collectionItemId: plateId,
        isPrivate: true,
      });
      await service.setItemVisibility({
        actor,
        collectionItemId: spinnerButtonId,
        isPrivate: true,
      });
      await service.updateItem({
        actor,
        collectionItemId: spinnerItemId,
        customFinish: null,
        displayName: "Spinner",
        finishOptionId: null,
        installedButton: {
          collectionItemId: spinnerButtonId,
          customFinish: null,
          finishOptionId: null,
          materialId: material.id,
        },
        materialId: material.id,
      });
      await expect(
        service.getPublicCollection({
          collectionId: primary.id,
          ownerUserId: owner.id,
        }),
      ).resolves.toEqual(expect.objectContaining({ itemCount: 4 }));
      await expect(
        service.getOwnedItem(actor, spinnerButtonId),
      ).resolves.toEqual(
        expect.objectContaining({
          isPrivate: false,
          privacyInheritedFromItemId: spinnerItemId,
          savedIsPrivate: true,
        }),
      );
      await expect(
        service.setItemVisibility({
          actor,
          collectionItemId: spinnerButtonId,
          isPrivate: false,
        }),
      ).rejects.toThrow("Privacy is inherited from the installed parent");
      await service.updateItem({
        actor,
        collectionItemId: spinnerItemId,
        customFinish: null,
        displayName: "Spinner",
        finishOptionId: null,
        installedButton: null,
        materialId: material.id,
      });
      await expect(
        service.getOwnedItem(actor, spinnerButtonId),
      ).resolves.toEqual(
        expect.objectContaining({
          isPrivate: true,
          privacyInheritedFromItemId: null,
          savedIsPrivate: true,
        }),
      );
      const spinnerButtonAudits = await db
        .select({ afterState: schema.auditEvent.afterState })
        .from(schema.auditEvent)
        .where(
          and(
            eq(schema.auditEvent.action, "collections.item.updated"),
            eq(schema.auditEvent.targetId, String(spinnerButtonId)),
          ),
        );
      expect(spinnerButtonAudits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            afterState: expect.objectContaining({
              inheritedFromItemId: spinnerItemId,
            }),
          }),
          expect.objectContaining({
            afterState: expect.objectContaining({
              inheritedFromItemId: null,
              savedIsPrivate: true,
            }),
          }),
        ]),
      );

      await expect(
        service.getOwnedItem(actor, insertSliderId),
      ).resolves.toEqual(
        expect.objectContaining({
          includedPlate: expect.objectContaining({
            id: plateProductId,
            productTypeSlug: "slider-plate",
          }),
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
          installedInsertId: insertId,
          installedPlateId: plateId,
        }),
      );
      await expect(service.getOwnedItem(actor, plateId)).resolves.toEqual(
        expect.objectContaining({
          collectionId: primary.id,
          isPrivate: false,
          privacyInheritedFromItemId: insertSliderId,
          savedIsPrivate: true,
          installedOnSliderId: insertSliderId,
        }),
      );
      await expect(
        service.setItemVisibility({
          actor,
          collectionItemId: plateId,
          isPrivate: false,
        }),
      ).rejects.toThrow("Privacy is inherited from the installed parent");

      await db
        .update(schema.product)
        .set({ isPrivate: true })
        .where(eq(schema.product.id, plateProductId));
      await expect(
        service.getPublicItem({
          collectionId: primary.id,
          collectionItemId: insertSliderId,
          ownerUserId: owner.id,
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          installedPlateId: null,
          installedPlateUnavailable: true,
        }),
      );
      await db
        .update(schema.product)
        .set({ isPrivate: false })
        .where(eq(schema.product.id, plateProductId));
      await db
        .update(schema.collectionItem)
        .set({ privatedByClerkId: "assembly-staff" })
        .where(eq(schema.collectionItem.id, plateId));
      await expect(
        service.getPublicItem({
          collectionId: primary.id,
          collectionItemId: plateId,
          ownerUserId: owner.id,
        }),
      ).resolves.toBeNull();
      await expect(
        service.getPublicItem({
          collectionId: primary.id,
          collectionItemId: insertSliderId,
          ownerUserId: owner.id,
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          installedPlateId: null,
          installedPlateUnavailable: true,
        }),
      );
      await db
        .update(schema.collectionItem)
        .set({ privatedByClerkId: owner.clerkId })
        .where(eq(schema.collectionItem.id, plateId));

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
      ).rejects.toThrow("This slider does not use inserts.");
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
          isPrivate: true,
          privacyInheritedFromItemId: null,
          savedIsPrivate: true,
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

      await expect(
        service.getOwnedItem(actor, insertSliderId),
      ).resolves.toEqual(
        expect.objectContaining({ installedPlateId: otherPlateId }),
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
      await service.updateItem({
        actor,
        collectionItemId: insertSliderId,
        customFinish: null,
        displayName: "Reinstalled",
        finishOptionId: null,
        installedPlate: { collectionItemId: otherPlateId },
        materialId: material.id,
      });

      await service.deleteItem({
        actor,
        collectionItemId: insertId,
        confirmed: true,
      });
      await expect(
        service.getOwnedItem(actor, insertSliderId),
      ).resolves.toEqual(expect.objectContaining({ installedInsertId: null }));

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
        expect.objectContaining({
          installedOnSliderId: null,
          privacyInheritedFromItemId: null,
        }),
      );

      const [staff] = await db
        .insert(schema.user)
        .values({ clerkId: "assembly-staff", username: "Assembly staff" })
        .returning();
      if (!staff) throw new Error("Staff fixture missing.");
      const staffActor = { clerkId: staff.clerkId, role: "admin" as const };
      await service.setItemVisibility({
        actor: staffActor,
        collectionItemId: otherPlateId,
        isPrivate: true,
        reason: "Unsafe component",
      });
      await expect(
        service.updateItem({
          actor,
          collectionItemId: bodySliderId,
          customFinish: null,
          displayName: "Blocked public install",
          finishOptionId: null,
          installedPlate: { collectionItemId: otherPlateId },
          materialId: material.id,
        }),
      ).rejects.toThrow("slider-plate");

      await service.setItemVisibility({
        actor,
        collectionItemId: bodySliderId,
        isPrivate: true,
      });
      await service.updateItem({
        actor,
        collectionItemId: bodySliderId,
        customFinish: null,
        displayName: "Private assembly",
        finishOptionId: null,
        installedPlate: { collectionItemId: otherPlateId },
        materialId: material.id,
      });
      await expect(
        service.setItemVisibility({
          actor,
          collectionItemId: bodySliderId,
          isPrivate: false,
        }),
      ).rejects.toThrow("slider-plate");
      await service.updateItem({
        actor,
        collectionItemId: bodySliderId,
        customFinish: null,
        displayName: "Detached assembly",
        finishOptionId: null,
        installedPlate: null,
        materialId: material.id,
      });
      await expect(service.getOwnedItem(actor, otherPlateId)).resolves.toEqual(
        expect.objectContaining({
          isAdminPrivate: true,
          isPrivate: true,
          privacyInheritedFromItemId: null,
          savedIsPrivate: true,
        }),
      );
    } finally {
      await client.close();
    }
  }, 30_000);
});
