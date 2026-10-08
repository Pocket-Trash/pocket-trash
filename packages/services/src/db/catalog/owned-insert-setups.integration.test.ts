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

describe("owned slider insert setups", () => {
  it("snapshots owner setups and resolves only host-safe live defaults", async () => {
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
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Other insert",
            productTypeId: insertTypeId,
            slug: "other-insert",
          },
        ])
        .returning();
      const sliderProductId = products.find(
        ({ slug }) => slug === "setup-slider",
      )?.id;
      const insertProductId = products.find(
        ({ slug }) => slug === "matching-insert",
      )?.id;
      const otherInsertProductId = products.find(
        ({ slug }) => slug === "other-insert",
      )?.id;
      if (!sliderProductId || !insertProductId || !otherInsertProductId)
        throw new Error("Products missing.");
      await Promise.all([
        db.insert(schema.productSlider).values({
          id: sliderProductId,
          magnetSystem: "insert-driven",
        }),
        db
          .insert(schema.productSliderInsert)
          .values([{ id: insertProductId }, { id: otherInsertProductId }]),
      ]);
      await db.insert(schema.productMaterial).values(
        products.map((product) => ({
          materialId: material.id,
          productId: product.id,
        })),
      );
      const clickOptions = await db
        .insert(schema.productInsertClickOption)
        .values([
          {
            clickCount: 3,
            insertProductId,
            insertionPosition: 0,
          },
          {
            clickCount: 5,
            insertProductId,
            insertionPosition: 1,
          },
          {
            clickCount: 9,
            insertProductId: otherInsertProductId,
            insertionPosition: 0,
          },
        ])
        .returning();
      const threeClick = clickOptions.find(
        ({ clickCount }) => clickCount === 3,
      );
      const fiveClick = clickOptions.find(({ clickCount }) => clickCount === 5);
      const otherClick = clickOptions.find(
        ({ clickCount }) => clickCount === 9,
      );
      if (!threeClick || !fiveClick || !otherClick)
        throw new Error("Click options missing.");
      const [configurationLabel] = await db
        .insert(schema.magnetConfigurationLabel)
        .values({ name: "Standard", normalizedName: "standard" })
        .returning();
      const [groupLabel] = await db
        .insert(schema.magnetGroupLabel)
        .values({ name: "Main", normalizedName: "main" })
        .returning();
      if (!configurationLabel || !groupLabel)
        throw new Error("Magnet labels missing.");
      const [matchingOffer, otherOffer] = await db
        .insert(schema.productInsertMagnetOffer)
        .values([
          {
            clickOptionId: fiveClick.id,
            configurationLabelId: configurationLabel.id,
            insertProductId,
            isAdvertisedDefault: true,
          },
          {
            clickOptionId: otherClick.id,
            configurationLabelId: configurationLabel.id,
            insertProductId: otherInsertProductId,
            isAdvertisedDefault: true,
          },
        ])
        .returning();
      if (!matchingOffer || !otherOffer) throw new Error("Offers missing.");
      const offerGroups = await db
        .insert(schema.productInsertMagnetGroup)
        .values([
          {
            diameterMm: "3",
            displayOrder: 0,
            grade: "N52",
            groupKey: "main",
            groupLabelId: groupLabel.id,
            offerId: matchingOffer.id,
            thicknessMm: "2",
          },
          {
            diameterMm: "4",
            displayOrder: 0,
            grade: "N50",
            groupKey: "other",
            groupLabelId: groupLabel.id,
            offerId: otherOffer.id,
            thicknessMm: "2",
          },
        ])
        .returning();
      const matchingGroup = offerGroups.find(
        ({ offerId }) => offerId === matchingOffer.id,
      );
      const otherGroup = offerGroups.find(
        ({ offerId }) => offerId === otherOffer.id,
      );
      if (!matchingGroup || !otherGroup) throw new Error("Groups missing.");
      await db.insert(schema.productInsertMagnetSlot).values([
        {
          displayOrder: 0,
          groupId: matchingGroup.id,
          half: "half-a",
          offerId: matchingOffer.id,
          slotKey: "A1",
          state: "occupied",
        },
        {
          displayOrder: 0,
          groupId: otherGroup.id,
          half: "half-a",
          offerId: otherOffer.id,
          slotKey: "A1",
          state: "occupied",
        },
      ]);
      await db.insert(schema.productSliderInsertOffer).values({
        insertOfferId: otherOffer.id,
        insertProductId: otherInsertProductId,
        isAdvertisedDefault: true,
        sliderProductId,
      });
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
        materialId: material.id,
        productId: sliderProductId,
        productTypeSlug: "slider",
      });
      const insertId = await service.addSliderProduct({
        actor,
        collectionId: collection.id,
        customFinish: null,
        displayName: "Insert",
        finishOptionId: null,
        materialId: material.id,
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
        materialId: material.id,
      });
      expect(
        (await service.getOwnedItem(actor, sliderId))?.effectiveSliderSetup,
      ).toMatchObject({ clickCount: 5, source: "insert-default" });

      const customizedConfiguration = {
        groups: [],
        label: "Observed layout",
        slots: [
          {
            documentedColumn: null,
            documentedRow: null,
            groupKey: null,
            half: "half-a" as const,
            key: "A1",
            state: "unknown" as const,
          },
        ],
        sourceLabel: "Copied and customized",
        sourceNotes: null,
      };
      await service.updateItem({
        actor,
        collectionItemId: insertId,
        customFinish: null,
        displayName: "Insert",
        finishOptionId: null,
        insertSetup: {
          clickOptionId: threeClick.id,
          configuration: customizedConfiguration,
          sourceOfferId: matchingOffer.id,
        },
        materialId: material.id,
      });
      await expect(
        service.updateItem({
          actor,
          collectionItemId: insertId,
          customFinish: null,
          displayName: "Insert",
          finishOptionId: null,
          insertSetup: {
            clickOptionId: otherClick.id,
            configuration: customizedConfiguration,
            sourceOfferId: otherOffer.id,
          },
          materialId: material.id,
        }),
      ).rejects.toThrow(/does not belong/iu);
      expect(
        (await service.getOwnedItem(actor, insertId))?.ownedInsertSetup,
      ).toEqual({
        clickCount: 3,
        configuration: customizedConfiguration,
        sourceOfferId: matchingOffer.id,
      });
      expect(
        (await service.getOwnedItem(actor, sliderId))?.effectiveSliderSetup,
      ).toMatchObject({ clickCount: 3, source: "owned-insert" });

      await service.updateItem({
        actor,
        collectionItemId: sliderId,
        customFinish: null,
        displayName: "Slider",
        finishOptionId: null,
        installedInsert: null,
        materialId: material.id,
      });
      expect(
        (await service.getOwnedItem(actor, insertId))?.ownedInsertSetup,
      ).toMatchObject({ clickCount: 3, sourceOfferId: matchingOffer.id });
      await service.updateItem({
        actor,
        collectionItemId: sliderId,
        customFinish: null,
        displayName: "Slider",
        finishOptionId: null,
        installedInsert: { collectionItemId: insertId },
        materialId: material.id,
      });
      expect(
        (await service.getOwnedItem(actor, sliderId))?.effectiveSliderSetup,
      ).toMatchObject({ clickCount: 3, source: "owned-insert" });

      await db
        .delete(schema.productInsertMagnetOffer)
        .where(eq(schema.productInsertMagnetOffer.id, matchingOffer.id));
      await db
        .delete(schema.productInsertClickOption)
        .where(eq(schema.productInsertClickOption.id, threeClick.id));
      expect(
        (await service.getOwnedItem(actor, insertId))?.ownedInsertSetup,
      ).toMatchObject({ clickCount: 3, sourceOfferId: matchingOffer.id });
      await service.updateItem({
        actor,
        collectionItemId: insertId,
        customFinish: null,
        displayName: "Insert",
        finishOptionId: null,
        insertSetup: null,
        materialId: material.id,
      });
      expect(
        (await service.getOwnedItem(actor, sliderId))?.effectiveSliderSetup,
      ).toEqual({
        clickCount: null,
        configuration: null,
        isLiveCatalog: false,
        source: "not-recorded",
      });
    } finally {
      await client.close();
    }
  }, 30_000);
});
