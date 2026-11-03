import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createNoopLogger } from "@package/logger";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { createDbServices } from "../index.js";

describe("standalone slider collection items", () => {
  it("creates, reads, counts, moves, edits, audits, and permanently deletes every slider subtype", async () => {
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
        .values({ clerkId: "slider-owner", username: "Slider owner" })
        .returning();
      const [otherOwner] = await db
        .insert(schema.user)
        .values({ clerkId: "other-owner", username: "Other owner" })
        .returning();
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Slider maker", slug: "slider-maker" })
        .returning();
      const [material] = await db
        .insert(schema.material)
        .values({ name: "Titanium", slug: "titanium" })
        .returning();
      if (!owner || !otherOwner || !maker || !material) {
        throw new Error("Fixtures missing.");
      }
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
        db.insert(schema.productDetailSlider).values({
          id: sliderProductId,
          magnetLayout: "2x4",
          usesInserts: false,
        }),
        db.insert(schema.productDetailSliderPlate).values({
          id: sliderPlateProductId,
        }),
        db.insert(schema.productDetailSliderInsert).values({
          id: sliderInsertProductId,
        }),
      ]);
      const productMaterials = await db
        .insert(schema.productMaterial)
        .values(products.map((product) => ({ productId: product.id })))
        .returning({ id: schema.productMaterial.id });
      await db.insert(schema.productMaterialComponent).values(
        productMaterials.map(({ id }) => ({
          materialId: material.id,
          productMaterialId: id,
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
        (["slider", "slider-plate", "slider-insert"] as const).map(
          async (slug) =>
            collectionsService.addSliderProduct({
              actor,
              collectionId: primary.id,
              customFinish: null,
              displayName: slug,
              finishOptionId: null,
              materialAssignmentId: (
                await db
                  .select({ id: schema.productMaterial.id })
                  .from(schema.productMaterial)
                  .where(eq(schema.productMaterial.productId, productIds[slug]))
              )[0]!.id,
              productId: productIds[slug],
              productTypeSlug: slug,
              ...(slug === "slider"
                ? {
                    ownership: {
                      effectiveStartDate: "2025-01-15",
                      entryReason: "purchase" as const,
                    },
                  }
                : {}),
            }),
        ),
      );
      const sliderItemId = itemIds[0];
      const insertItemId = itemIds[2];
      if (!sliderItemId || !insertItemId) throw new Error("Items missing.");
      await expect(
        db
          .select()
          .from(schema.collectionItemOwnershipPeriod)
          .where(
            eq(
              schema.collectionItemOwnershipPeriod.collectionItemId,
              itemIds[1]!,
            ),
          ),
      ).resolves.toEqual([
        expect.objectContaining({
          effectiveStartDate: expect.any(String),
          entryReason: "unknown",
          startDateImputed: true,
        }),
      ]);
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
      });
      await expect(
        collectionsService.getOwnedItem(actor, sliderItemId),
      ).resolves.toMatchObject({
        collectionId: destination.id,
        displayName: "Moved slider",
        productTypeSlug: "slider",
      });

      await collectionsService.updateItem({
        actor,
        collectionItemId: sliderItemId,
        customFinish: null,
        displayName: "Moved slider",
        finishOptionId: null,
        metadata: {
          statuses: { public: ["favorite"], private: ["favorite", "grail"] },
        },
      });
      await expect(
        collectionsService.getOwnedItem(actor, sliderItemId),
      ).resolves.toMatchObject({
        metadata: {
          statuses: { public: ["favorite"], private: ["favorite", "grail"] },
        },
      });
      await expect(
        collectionsService.updateItem({
          actor: { clerkId: otherOwner.clerkId, role: "admin" },
          collectionItemId: sliderItemId,
          customFinish: null,
          displayName: "Must not change",
          finishOptionId: null,
          metadata: { statuses: { public: [], private: [] } },
        }),
      ).rejects.toThrow();

      await expect(
        collectionsService.getOwnedItem(
          { clerkId: otherOwner.clerkId, role: "admin" },
          sliderItemId,
        ),
      ).resolves.toMatchObject({
        metadata: { statuses: { public: [], private: [] } },
      });
      await db
        .update(schema.collectionItem)
        .set({ approvalStatus: "approved" })
        .where(eq(schema.collectionItem.id, sliderItemId));
      await expect(
        collectionsService.getPublicItem({
          collectionId: destination.id,
          collectionItemId: sliderItemId,
          ownerUserId: owner.id,
        }),
      ).resolves.toMatchObject({
        metadata: { statuses: { public: ["favorite"], private: [] } },
      });
      await db
        .update(schema.collectionItem)
        .set({ approvalStatus: "pending" })
        .where(eq(schema.collectionItem.id, sliderItemId));
      await collectionsService.updateItem({
        actor,
        collectionItemId: sliderItemId,
        customFinish: null,
        displayName: "Moved slider",
        finishOptionId: null,
        metadata: {
          statuses: { public: ["favorite"], private: ["grail"] },
          pricePaid: { amountMinor: 0, currencyCode: "JPY", isPublic: true },
        },
      });
      await expect(
        collectionsService.getOwnedItem(actor, sliderItemId),
      ).resolves.toMatchObject({
        metadata: {
          pricePaid: { amountMinor: 0, currencyCode: "JPY", isPublic: true },
        },
      });
      await db
        .update(schema.collectionItem)
        .set({ approvalStatus: "approved" })
        .where(eq(schema.collectionItem.id, sliderItemId));
      await expect(
        collectionsService.getPublicItem({
          collectionId: destination.id,
          collectionItemId: sliderItemId,
          ownerUserId: owner.id,
        }),
      ).resolves.toMatchObject({
        metadata: {
          pricePaid: { amountMinor: 0, currencyCode: "JPY", isPublic: true },
          priceSold: undefined,
        },
      });
      await db
        .update(schema.collectionItem)
        .set({ approvalStatus: "pending" })
        .where(eq(schema.collectionItem.id, sliderItemId));
      const noteEdit = {
        actor,
        collectionItemId: sliderItemId,
        customFinish: null,
        displayName: "Moved slider",
        finishOptionId: null,
      };
      await collectionsService.updateItem({
        ...noteEdit,
        metadata: {
          statuses: { public: [], private: [] },
          pricePaid: { amountMinor: 0, currencyCode: "JPY", isPublic: true },
          notes: [
            {
              name: "Care",
              content: "Keep the bearing dry.",
              isPublic: true,
              position: 0,
            },
            {
              name: "Condition",
              content: "Private **condition** notes.",
              isPublic: false,
              position: 0,
            },
          ],
        },
      });
      await expect(
        collectionsService.getOwnedItem(actor, sliderItemId),
      ).resolves.toMatchObject({
        metadata: {
          notes: [
            expect.objectContaining({
              name: "Care",
              content: "Keep the bearing dry.",
              isPublic: true,
              position: 0,
            }),
            expect.objectContaining({
              name: "Condition",
              isPublic: false,
              position: 0,
            }),
          ],
        },
      });
      const savedNotes = (
        await collectionsService.getOwnedItem(actor, sliderItemId)
      )?.metadata?.notes;
      const care = savedNotes?.find((note) => note.name === "Care");
      const condition = savedNotes?.find((note) => note.name === "Condition");
      if (!care || !condition) throw new Error("Notes missing.");
      const noteMetadata = {
        statuses: { public: [], private: [] },
        pricePaid: { amountMinor: 0, currencyCode: "JPY", isPublic: true },
      };
      await collectionsService.updateItem({
        ...noteEdit,
        metadata: {
          ...noteMetadata,
          notes: [
            care,
            condition,
            {
              name: "Setup",
              content: "A **ceramic** bearing.",
              isPublic: true,
              position: 1,
            },
          ],
        },
      });
      const setup = (
        await collectionsService.getOwnedItem(actor, sliderItemId)
      )?.metadata?.notes?.find((note) => note.name === "Setup");
      if (!setup) throw new Error("Setup note missing.");
      const [privateBefore] = await db
        .select()
        .from(schema.collectionItemNote)
        .where(eq(schema.collectionItemNote.id, condition.id));
      await collectionsService.updateItem({
        ...noteEdit,
        metadata: {
          ...noteMetadata,
          notes: [
            { ...care, position: 1 },
            condition,
            { ...setup, position: 0 },
          ],
        },
      });
      const reordered = (
        await collectionsService.getOwnedItem(actor, sliderItemId)
      )?.metadata?.notes;
      expect(
        reordered?.filter((note) => note.isPublic).map((note) => note.name),
      ).toEqual(["Setup", "Care"]);
      const [privateAfter] = await db
        .select()
        .from(schema.collectionItemNote)
        .where(eq(schema.collectionItemNote.id, condition.id));
      expect(privateAfter?.updatedAt).toEqual(privateBefore?.updatedAt);
      await collectionsService.updateItem({
        ...noteEdit,
        metadata: {
          ...noteMetadata,
          notes: [
            { ...care, isPublic: false, position: 1 },
            condition,
            { ...setup, position: 0 },
          ],
        },
      });
      await expect(
        collectionsService.getOwnedItem(actor, sliderItemId),
      ).resolves.toMatchObject({
        metadata: {
          notes: [
            expect.objectContaining({
              name: "Setup",
              isPublic: true,
              position: 0,
            }),
            expect.objectContaining({
              name: "Condition",
              isPublic: false,
              position: 0,
            }),
            expect.objectContaining({
              name: "Care",
              isPublic: false,
              position: 1,
            }),
          ],
        },
      });
      await collectionsService.updateItem({
        ...noteEdit,
        metadata: {
          ...noteMetadata,
          notes: [
            { ...care, isPublic: true, position: 0 },
            { ...setup, position: 1 },
            condition,
          ],
        },
      });
      expect(
        (
          await collectionsService.getOwnedItem(actor, sliderItemId)
        )?.metadata?.notes
          ?.filter((note) => note.isPublic)
          .map((note) => note.name),
      ).toEqual(["Care", "Setup"]);
      await collectionsService.updateItem({
        ...noteEdit,
        metadata: {
          ...noteMetadata,
          notes: [
            { ...care, isPublic: false, position: 1 },
            { ...setup, position: 0 },
            condition,
          ],
        },
      });
      await expect(
        collectionsService.updateItem({
          ...noteEdit,
          displayName: "Must roll back notes",
          metadata: {
            ...noteMetadata,
            notes: [
              {
                name: "Roy's",
                content: "First valid note.",
                isPublic: false,
                position: 0,
              },
              {
                name: "RÓY’S",
                content: "Second valid note.",
                isPublic: true,
                position: 0,
              },
            ],
          },
        }),
      ).rejects.toThrow("duplicateNoteNameError");
      await expect(
        collectionsService.updateItem({
          ...noteEdit,
          metadata: {
            ...noteMetadata,
            notes: [
              {
                name: "Short",
                content: "😀😀😀",
                isPublic: false,
                position: 0,
              },
            ],
          },
        }),
      ).rejects.toThrow("noteContentError");
      await expect(
        collectionsService.getOwnedItem(actor, sliderItemId),
      ).resolves.toMatchObject({
        displayName: "Moved slider",
        metadata: {
          notes: expect.arrayContaining([
            expect.objectContaining({
              name: "Condition",
              content: "Private **condition** notes.",
            }),
          ]),
        },
      });
      await db
        .update(schema.collectionItem)
        .set({ approvalStatus: "approved" })
        .where(eq(schema.collectionItem.id, sliderItemId));
      await expect(
        collectionsService.getPublicItem({
          collectionId: destination.id,
          collectionItemId: sliderItemId,
          ownerUserId: owner.id,
        }),
      ).resolves.toMatchObject({
        metadata: {
          notes: [
            expect.objectContaining({
              name: "Setup",
              content: "A **ceramic** bearing.",
            }),
          ],
        },
      });
      await db
        .update(schema.userCollection)
        .set({ isPrivate: true })
        .where(eq(schema.userCollection.id, destination.id));
      await expect(
        collectionsService.getOwnedItem(
          { clerkId: otherOwner.clerkId, role: "admin" },
          sliderItemId,
        ),
      ).resolves.toMatchObject({ metadata: { notes: [] } });
      await expect(
        collectionsService.getOwnedItem(actor, sliderItemId),
      ).resolves.toMatchObject({
        metadata: {
          notes: expect.arrayContaining([
            expect.objectContaining({ name: "Setup", isPublic: true }),
          ]),
        },
      });
      await db
        .update(schema.userCollection)
        .set({ isPrivate: false })
        .where(eq(schema.userCollection.id, destination.id));
      await db
        .update(schema.collectionItem)
        .set({ approvalStatus: "pending" })
        .where(eq(schema.collectionItem.id, sliderItemId));
      const priceEdit = {
        actor,
        collectionItemId: sliderItemId,
        customFinish: null,
        displayName: "Moved slider",
        finishOptionId: null,
      };
      const incompletePrice = {
        amountMinor: 100,
        currencyCode: "USD",
        isPublic: false,
      };
      Reflect.deleteProperty(incompletePrice, "currencyCode");
      await expect(
        collectionsService.updateItem({
          ...priceEdit,
          metadata: {
            statuses: { public: [], private: [] },
            pricePaid: incompletePrice,
          },
        }),
      ).rejects.toThrow("moneyPairError");
      for (const pricePaid of [
        { amountMinor: -1, currencyCode: "USD", isPublic: false },
        { amountMinor: 1.5, currencyCode: "JPY", isPublic: false },
        { amountMinor: 100, currencyCode: "XXX", isPublic: false },
      ]) {
        await expect(
          collectionsService.updateItem({
            ...priceEdit,
            displayName: "Must roll back",
            metadata: { statuses: { public: [], private: [] }, pricePaid },
          }),
        ).rejects.toThrow();
      }
      await expect(
        collectionsService.updateItem({
          ...priceEdit,
          metadata: {
            statuses: { public: [], private: [] },
            priceSold: { amountMinor: 100, currencyCode: "USD" },
          },
        }),
      ).rejects.toThrow("soldPriceError");
      await expect(
        collectionsService.getOwnedItem(actor, sliderItemId),
      ).resolves.toMatchObject({
        displayName: "Moved slider",
        metadata: { pricePaid: { amountMinor: 0, currencyCode: "JPY" } },
      });
      const statusEdit = {
        actor,
        collectionItemId: sliderItemId,
        customFinish: null,
        displayName: "Moved slider",
        finishOptionId: null,
      };
      await expect(
        collectionsService.updateItem({
          ...statusEdit,
          metadata: { statuses: { public: ["sold"], private: [] } },
        }),
      ).rejects.toThrow("explicit sale date");
      await collectionsService.updateItem({
        ...statusEdit,
        metadata: {
          saleDate: "2025-01-20",
          pricePaid: {
            amountMinor: 25999,
            currencyCode: "USD",
            isPublic: false,
          },
          priceSold: { amountMinor: 35999, currencyCode: "USD" },
          statuses: { public: ["sold"], private: ["sold"] },
        },
      });
      await collectionsService.updateItem({
        ...statusEdit,
        metadata: {
          statuses: { public: [], private: ["sold"] },
          pricePaid: {
            amountMinor: 25999,
            currencyCode: "USD",
            isPublic: false,
          },
          priceSold: { amountMinor: 35999, currencyCode: "USD" },
        },
      });
      await expect(
        collectionsService.getOwnedItem(actor, sliderItemId),
      ).resolves.toMatchObject({
        metadata: { statuses: { public: [], private: ["sold"] } },
        ownershipPeriods: [
          expect.objectContaining({
            effectiveEndDate: "2025-01-20",
            exitReason: "sale",
          }),
        ],
      });
      await expect(
        collectionsService.getOwnedItem(actor, sliderItemId),
      ).resolves.toMatchObject({
        metadata: { priceSold: { amountMinor: 35999, currencyCode: "USD" } },
      });
      await expect(
        collectionsService.getOwnedItem(
          { clerkId: otherOwner.clerkId, role: "admin" },
          sliderItemId,
        ),
      ).resolves.toMatchObject({
        metadata: { pricePaid: undefined, priceSold: undefined },
      });
      await collectionsService.updateItem({
        ...statusEdit,
        metadata: {
          statuses: { public: [], private: [] },
          pricePaid: {
            amountMinor: 25999,
            currencyCode: "USD",
            isPublic: false,
          },
          priceSold: { amountMinor: 35999, currencyCode: "USD" },
        },
      });
      await expect(
        collectionsService.getOwnedItem(actor, sliderItemId),
      ).resolves.toMatchObject({
        metadata: { priceSold: undefined, pricePaid: { amountMinor: 25999 } },
      });
      await expect(
        db
          .update(schema.collectionItemOwnershipPeriod)
          .set({ pricePaidMinor: 1, pricePaidCurrencyCode: null })
          .where(
            eq(
              schema.collectionItemOwnershipPeriod.collectionItemId,
              sliderItemId,
            ),
          ),
      ).rejects.toThrow();
      await expect(
        db
          .update(schema.collectionItemOwnershipPeriod)
          .set({ priceSoldMinor: 1, priceSoldCurrencyCode: "USD" })
          .where(
            eq(
              schema.collectionItemOwnershipPeriod.collectionItemId,
              sliderItemId,
            ),
          ),
      ).rejects.toThrow();
      await expect(
        collectionsService.getOwnedItem(actor, sliderItemId),
      ).resolves.toMatchObject({
        metadata: { statuses: { public: [], private: [] } },
        ownershipPeriods: [
          expect.objectContaining({ effectiveEndDate: null, exitReason: null }),
        ],
      });

      const [initialPeriod] = await db
        .select()
        .from(schema.collectionItemOwnershipPeriod)
        .where(
          eq(
            schema.collectionItemOwnershipPeriod.collectionItemId,
            sliderItemId,
          ),
        );
      if (!initialPeriod) throw new Error("Ownership period missing.");
      await expect(
        collectionsService.updateItem({
          actor: { clerkId: otherOwner.clerkId, role: "user" },
          collectionItemId: sliderItemId,
          customFinish: null,
          displayName: "Unauthorized",
          finishOptionId: null,
          ownership: {
            effectiveEndDate: null,
            effectiveStartDate: "2025-01-10",
            entryReason: "gift",
            exitReason: null,
            periodId: initialPeriod.id,
          },
        }),
      ).rejects.toThrow();
      await expect(
        collectionsService.updateItem({
          actor,
          collectionItemId: sliderItemId,
          customFinish: null,
          displayName: "Must roll back",
          finishOptionId: null,
          ownership: {
            effectiveEndDate: "2024-01-01",
            effectiveStartDate: "2025-01-10",
            entryReason: "gift",
            exitReason: "sale",
            periodId: initialPeriod.id,
          },
        }),
      ).rejects.toThrow("departure cannot precede acquisition");
      await expect(
        collectionsService.getOwnedItem(actor, sliderItemId),
      ).resolves.toMatchObject({ displayName: "Moved slider" });

      await collectionsService.updateItem({
        actor,
        collectionItemId: sliderItemId,
        customFinish: null,
        displayName: "Moved slider",
        finishOptionId: null,
        ownership: {
          effectiveEndDate: "2025-02-01",
          effectiveStartDate: "2025-01-10",
          entryReason: "gift",
          exitReason: "sale",
          periodId: initialPeriod.id,
        },
        metadata: {
          statuses: { public: [], private: [] },
          pricePaid: {
            amountMinor: 12300,
            currencyCode: "USD",
            isPublic: true,
          },
          priceSold: { amountMinor: 23400, currencyCode: "USD" },
        },
      });
      await expect(
        collectionsService.getOwnedItem(actor, sliderItemId),
      ).resolves.toMatchObject({
        metadata: { statuses: { public: [], private: ["sold"] } },
      });
      await expect(
        collectionsService.updateItem({
          actor,
          collectionItemId: sliderItemId,
          customFinish: null,
          displayName: "Must still roll back",
          finishOptionId: null,
          ownership: {
            effectiveEndDate: null,
            effectiveStartDate: "2025-01-20",
            entryReason: "trade",
            exitReason: null,
            periodId: null,
          },
        }),
      ).rejects.toThrow("Ownership periods cannot overlap");
      await collectionsService.updateItem({
        actor,
        collectionItemId: sliderItemId,
        customFinish: null,
        displayName: "Moved slider",
        finishOptionId: null,
        ownership: {
          effectiveEndDate: null,
          effectiveStartDate: "2025-03-01",
          entryReason: "trade",
          exitReason: null,
          periodId: null,
        },
      });
      const periods = await db
        .select()
        .from(schema.collectionItemOwnershipPeriod)
        .where(
          eq(
            schema.collectionItemOwnershipPeriod.collectionItemId,
            sliderItemId,
          ),
        )
        .orderBy(asc(schema.collectionItemOwnershipPeriod.id));
      expect(periods).toEqual([
        expect.objectContaining({
          effectiveEndDate: "2025-02-01",
          effectiveStartDate: "2025-01-10",
          endedRecordedAt: expect.any(Date),
          entryReason: "gift",
          exitReason: "sale",
          startedRecordedAt: initialPeriod.startedRecordedAt,
          pricePaidMinor: 12300,
          priceSoldMinor: 23400,
        }),
        expect.objectContaining({
          effectiveEndDate: null,
          effectiveStartDate: "2025-03-01",
          entryReason: "trade",
        }),
      ]);
      await expect(
        collectionsService.getOwnedItem(actor, sliderItemId),
      ).resolves.toMatchObject({
        ownershipPeriods: [
          expect.objectContaining({ effectiveEndDate: "2025-02-01" }),
          expect.objectContaining({ effectiveEndDate: null }),
        ],
      });

      const duplicateItemId = await collectionsService.addSliderProduct({
        actor,
        collectionId: primary.id,
        customFinish: null,
        displayName: "Another physical slider",
        finishOptionId: null,
        materialAssignmentId: (
          await db
            .select({ id: schema.productMaterial.id })
            .from(schema.productMaterial)
            .where(eq(schema.productMaterial.productId, sliderProductId))
        )[0]!.id,
        ownership: {
          effectiveStartDate: "2025-03-02",
          entryReason: "purchase",
        },
        productId: sliderProductId,
        productTypeSlug: "slider",
      });
      expect(duplicateItemId).not.toBe(sliderItemId);

      await db.insert(schema.collectionItemNote).values({
        id: "cascade-fixture",
        collectionItemId: insertItemId,
        name: "Cascade",
        normalizedName: "cascade",
        content: "Cascade deletion note.",
        isPublic: false,
        position: 0,
      });
      await collectionsService.deleteItem({
        actor,
        collectionItemId: insertItemId,
        confirmed: true,
      });
      await expect(
        db
          .select()
          .from(schema.collectionItemNote)
          .where(eq(schema.collectionItemNote.collectionItemId, insertItemId)),
      ).resolves.toEqual([]);
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
