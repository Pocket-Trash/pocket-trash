import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { createTrendsService, PUBLIC_TRENDS_STALE_MS } from "./index.js";

/** Collection-item fixture with its type-specific product mapping. */
type FixtureItem = {
  /** Detail table used by the physical item. */
  kind: "slider" | "slider-plate" | "spinner";
  /** Collection-item row. */
  item: typeof schema.collectionItem.$inferInsert;
  /** Catalog product linked through the detail table. */
  productId: number;
};

describe("public collection-item Trends", () => {
  it("suppresses four contributors, publishes five, rounds, and includes private sources", async () => {
    const client = new PGlite();
    const db = drizzle({ client, relations: schema.relations });

    try {
      await migratePGliteDatabase(client);
      const fixture = await createFixture(db as unknown as Database);
      const generatedAt = new Date("2026-10-14T00:00:00.000Z");
      const trends = await createTrendsService(
        db as unknown as Database,
      ).refreshPublicCollectionItemTrends(generatedAt);

      expect(trends).toEqual({
        generatedAt,
        hasSuppressedValues: true,
        stale: false,
        values: [
          {
            collectorCount: 5,
            count: 10,
            productTypeId: fixture.sliderTypeId,
            productTypeName: "Slider",
          },
        ],
      });
      await expect(
        createTrendsService(
          db as unknown as Database,
        ).getPublicPartAccessoryTrends(generatedAt),
      ).resolves.toEqual({
        generatedAt,
        hasSuppressedValues: false,
        stale: false,
        values: [
          {
            count: 5,
            productTypeId: fixture.accessoryTypeId,
            productTypeName: "Slider Plate",
          },
        ],
      });
      const stored = await db
        .select()
        .from(schema.publicCollectionItemProductTypeTrend);
      expect(stored).toEqual([
        {
          generationId: expect.any(Number),
          productTypeId: fixture.sliderTypeId,
          roundedCollectorCount: 5,
          roundedItemCount: 10,
        },
      ]);
      await expect(
        db.select().from(schema.publicPartAccessoryProductTypeTrend),
      ).resolves.toEqual([
        {
          generationId: expect.any(Number),
          productTypeId: fixture.accessoryTypeId,
          roundedItemCount: 5,
        },
      ]);
      const materialTrends = await createTrendsService(
        db as unknown as Database,
      ).getPublicCollectionMaterialTrends(generatedAt);
      expect(materialTrends).toMatchObject({
        hasSuppressedValues: true,
        stale: false,
      });
      expect(
        materialTrends?.itemValues.filter(
          ({ isSpecificBreakdown, productTypeId }) =>
            productTypeId === null && !isSpecificBreakdown,
        ),
      ).toEqual([
        expect.objectContaining({
          count: 10,
          materialName: "Steel",
          materialSpecificName: null,
        }),
        expect.objectContaining({
          count: 10,
          materialName: "Titanium",
          materialSpecificName: null,
        }),
      ]);
      expect(materialTrends?.itemValues).toContainEqual(
        expect.objectContaining({
          count: 10,
          isSpecificBreakdown: true,
          materialName: "Titanium",
          materialSpecificName: "6Al-4V",
        }),
      );
      const makerProductTrends = await createTrendsService(
        db as unknown as Database,
      ).getPublicCollectionMakerProductTrends(generatedAt);
      expect(makerProductTrends).toMatchObject({
        hasSuppressedValues: true,
        stale: false,
      });
      expect(makerProductTrends?.makerValues).toContainEqual(
        expect.objectContaining({
          collectorCount: 5,
          itemCount: 15,
          makerName: "Trend Maker",
          materialId: null,
          productId: null,
          productTypeId: null,
        }),
      );
      expect(makerProductTrends?.productValues).toContainEqual(
        expect.objectContaining({
          collectorCount: 5,
          itemCount: 10,
          makerName: "Trend Maker",
          materialId: null,
          productId: fixture.sliderProductId,
          productName: "Private-source slider",
          productTypeId: null,
        }),
      );
      expect(makerProductTrends?.productValues).toContainEqual(
        expect.objectContaining({
          collectorCount: 5,
          itemCount: 10,
          materialId: fixture.titaniumMaterialId,
          materialSpecificId: fixture.titaniumSpecificId,
          productId: fixture.sliderProductId,
          productTypeId: fixture.sliderTypeId,
        }),
      );
      expect(
        await createTrendsService(
          db as unknown as Database,
        ).getPublicCatalogMaterialTrends(),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            count: 1,
            materialName: "Steel",
            productTypeId: null,
          }),
          expect.objectContaining({
            count: 1,
            materialName: "Titanium",
            materialSpecificName: "6Al-4V",
            productTypeId: fixture.sliderTypeId,
          }),
          expect.objectContaining({
            count: 1,
            materialId: null,
            productTypeId: null,
          }),
        ]),
      );
      expect(
        await createTrendsService(
          db as unknown as Database,
        ).getPublicCollectionItemTrends(
          new Date(generatedAt.getTime() + PUBLIC_TRENDS_STALE_MS + 1),
        ),
      ).toMatchObject({ stale: true });
      const activityNow = new Date("2030-01-01T00:00:00.000Z");
      const activity = await createTrendsService(
        db as unknown as Database,
      ).getPublicActivityTrends("all", activityNow);
      expect(activity).toMatchObject({ granularity: "month", range: "all" });
      expect(activity.values).toContainEqual(
        expect.objectContaining({ catalogCount: 3, collectionCount: 20 }),
      );
      await expect(
        createTrendsService(db as unknown as Database).getUserActivityTrends(
          "owner-0",
          "all",
          activityNow,
        ),
      ).resolves.toMatchObject({
        values: [expect.objectContaining({ count: 5 })],
      });
    } finally {
      await client.close();
    }
  }, 30_000);

  it("recomputes owner history from effective dates and repeated ownership periods", async () => {
    const client = new PGlite();
    const db = drizzle({ client, relations: schema.relations });

    try {
      await migratePGliteDatabase(client);
      const [owner, otherOwner] = await db
        .insert(schema.user)
        .values([
          { clerkId: "history-owner", username: "history-owner" },
          { clerkId: "other-history-owner", username: "other-history-owner" },
        ])
        .returning({ id: schema.user.id });
      if (!owner || !otherOwner)
        throw new Error("History owners were not created.");
      const [collection, otherCollection] = await db
        .insert(schema.userCollection)
        .values([
          {
            name: "History collection",
            normalizedName: "history collection",
            ownerId: owner.id,
          },
          {
            name: "Other history collection",
            normalizedName: "other history collection",
            ownerId: otherOwner.id,
          },
        ])
        .returning({ id: schema.userCollection.id });
      if (!collection || !otherCollection)
        throw new Error("History collections were not created.");
      const [reacquiredItem, imputedItem, otherItem] = await db
        .insert(schema.collectionItem)
        .values([
          { collectionId: collection.id, ownerId: owner.id },
          { collectionId: collection.id, ownerId: owner.id },
          { collectionId: otherCollection.id, ownerId: otherOwner.id },
        ])
        .returning({ id: schema.collectionItem.id });
      if (!reacquiredItem || !imputedItem || !otherItem)
        throw new Error("History items were not created.");
      const [firstPeriod] = await db
        .insert(schema.collectionItemOwnershipPeriod)
        .values([
          {
            collectionItemId: reacquiredItem.id,
            effectiveEndDate: "2026-03-05",
            effectiveStartDate: "2026-01-10",
            endedRecordedAt: new Date("2026-03-06T00:00:00.000Z"),
            entryReason: "purchase",
            exitReason: "sale",
            startedRecordedAt: new Date("2026-01-11T00:00:00.000Z"),
          },
          {
            collectionItemId: reacquiredItem.id,
            effectiveStartDate: "2026-05-01",
            entryReason: "trade",
            startedRecordedAt: new Date("2026-05-02T00:00:00.000Z"),
          },
          {
            collectionItemId: imputedItem.id,
            effectiveStartDate: "2026-02-01",
            entryReason: "unknown",
            startDateImputed: true,
            startedRecordedAt: new Date("2026-02-01T12:00:00.000Z"),
          },
          {
            collectionItemId: otherItem.id,
            effectiveStartDate: "2026-01-01",
            entryReason: "gift",
          },
        ])
        .returning({ id: schema.collectionItemOwnershipPeriod.id });
      if (!firstPeriod) throw new Error("History periods were not created.");

      const service = createTrendsService(db as unknown as Database);
      const now = new Date("2026-06-15T12:00:00.000Z");
      await expect(
        service.getUserCollectionHistoryTrends("history-owner", "all", now),
      ).resolves.toEqual({
        exactDateCount: 2,
        granularity: "month",
        imputedDateCount: 1,
        range: "all",
        values: [
          historyPoint("2026-01-01", 1, 0, 1),
          historyPoint("2026-02-01", 1, 0, 2),
          historyPoint("2026-03-01", 0, 1, 1),
          historyPoint("2026-04-01", 0, 0, 1),
          historyPoint("2026-05-01", 1, 0, 2),
          historyPoint("2026-06-01", 0, 0, 2),
        ],
      });
      await expect(
        service.getUserCollectionHistoryTrends("history-owner", "week", now),
      ).resolves.toMatchObject({
        granularity: "day",
        range: "week",
        values: Array.from({ length: 7 }, () =>
          expect.objectContaining({ collectionCount: 2 }),
        ),
      });

      await db
        .update(schema.collectionItemOwnershipPeriod)
        .set({ effectiveStartDate: "2025-12-10" })
        .where(eq(schema.collectionItemOwnershipPeriod.id, firstPeriod.id));
      const corrected = await service.getUserCollectionHistoryTrends(
        "history-owner",
        "all",
        now,
      );
      expect(corrected.values[0]).toEqual(historyPoint("2025-12-01", 1, 0, 1));
      expect(corrected.values[1]).toEqual(historyPoint("2026-01-01", 0, 0, 1));
    } finally {
      await client.close();
    }
  }, 30_000);

  it("atomically swaps generations and retains the active dataset after failure", async () => {
    const client = new PGlite();
    const db = drizzle({ client, relations: schema.relations });

    try {
      await migratePGliteDatabase(client);
      const fixture = await createFixture(db as unknown as Database);
      const service = createTrendsService(db as unknown as Database);
      const firstGeneratedAt = new Date("2026-10-14T00:00:00.000Z");
      await service.refreshPublicCollectionItemTrends(firstGeneratedAt);
      const [extraOwner] = await db
        .insert(schema.user)
        .values({ clerkId: "owner-extra", username: "owner-extra" })
        .returning({ id: schema.user.id });
      if (!extraOwner) throw new Error("Extra owner was not created.");
      const [extraCollection] = await db
        .insert(schema.userCollection)
        .values({
          isPrivate: true,
          name: "Extra private collection",
          normalizedName: "extra private collection",
          ownerId: extraOwner.id,
        })
        .returning({ id: schema.userCollection.id });
      if (!extraCollection)
        throw new Error("Extra collection was not created.");
      const [extraItem] = await db
        .insert(schema.collectionItem)
        .values({
          approvalStatus: "pending",
          collectionId: extraCollection.id,
          isPrivate: true,
          ownerId: extraOwner.id,
        })
        .returning({ id: schema.collectionItem.id });
      if (!extraItem) throw new Error("Extra collection item was not created.");
      await db.insert(schema.collectionDetailSlider).values({
        id: extraItem.id,
        productSliderId: fixture.sliderProductId,
      });
      const secondGeneratedAt = new Date("2026-10-15T00:00:00.000Z");
      await service.refreshPublicCollectionItemTrends(secondGeneratedAt);

      const generations = await db.select().from(schema.publicTrendsGeneration);
      expect(generations).toHaveLength(2);
      expect(generations.filter(({ active }) => active)).toHaveLength(1);
      expect(
        await service.getPublicCollectionItemTrends(secondGeneratedAt),
      ).toMatchObject({ generatedAt: secondGeneratedAt });

      const failing = createTrendsService(db as unknown as Database, {
        /**
         * Forces the pre-activation transaction to fail.
         *
         * @returns A rejected promise.
         * @rejects Always, to verify rollback behavior.
         */
        beforeActivate: () =>
          Promise.reject(new Error("forced refresh failure")),
      });
      await expect(
        failing.refreshPublicCollectionItemTrends(
          new Date("2026-10-16T00:00:00.000Z"),
        ),
      ).rejects.toThrow("forced refresh failure");
      expect(
        await service.getPublicCollectionItemTrends(secondGeneratedAt),
      ).toMatchObject({ generatedAt: secondGeneratedAt });
      expect(
        await db.select().from(schema.publicTrendsGeneration),
      ).toHaveLength(2);
    } finally {
      await client.close();
    }
  }, 30_000);
});

/**
 * Builds one expected monthly owner-history point.
 *
 * @param bucketStart - UTC month start.
 * @param acquisitionCount - Acquisitions effective in the month.
 * @param departureCount - Departures effective in the month.
 * @param collectionCount - Collection size at month end.
 * @returns Expected owner-history point.
 */
function historyPoint(
  bucketStart: string,
  acquisitionCount: number,
  departureCount: number,
  collectionCount: number,
) {
  return {
    acquisitionCount,
    bucketStart: new Date(`${bucketStart}T00:00:00.000Z`),
    collectionCount,
    departureCount,
  };
}

/**
 * Creates five-owner publishable data, four-owner suppressed data, and an excluded accessory.
 *
 * @param database - Migrated integration-test database.
 * @returns Stable identifiers used by assertions and follow-up writes.
 * @rejects When fixture records cannot be created.
 */
async function createFixture(database: Database) {
  const [maker] = await database
    .insert(schema.maker)
    .values({ name: "Trend Maker", slug: "trend-maker" })
    .returning({ id: schema.maker.id });
  const productTypes = await database
    .insert(schema.productType)
    .values([
      { name: "Slider", slug: "slider" },
      { name: "Spinner", slug: "spinner" },
      {
        includeInTrends: true,
        isPartOrAccessory: true,
        name: "Slider Plate",
        slug: "slider-plate",
      },
    ])
    .returning({ id: schema.productType.id, slug: schema.productType.slug });
  if (!maker) throw new Error("Trend maker was not created.");
  const typeIds = new Map(productTypes.map((row) => [row.slug, row.id]));
  const sliderTypeId = typeIds.get("slider");
  const spinnerTypeId = typeIds.get("spinner");
  const accessoryTypeId = typeIds.get("slider-plate");
  if (!sliderTypeId || !spinnerTypeId || !accessoryTypeId)
    throw new Error("Trend product types were not created.");
  const products = await database
    .insert(schema.product)
    .values([
      {
        approvalStatus: "approved",
        isPrivate: false,
        makerId: maker.id,
        name: "Private-source slider",
        productTypeId: sliderTypeId,
        slug: "private-source-slider",
      },
      {
        approvalStatus: "approved",
        isPrivate: false,
        makerId: maker.id,
        name: "Suppressed spinner",
        productTypeId: spinnerTypeId,
        slug: "suppressed-spinner",
      },
      {
        approvalStatus: "approved",
        isPrivate: false,
        makerId: maker.id,
        name: "Excluded plate",
        productTypeId: accessoryTypeId,
        slug: "excluded-plate",
      },
    ])
    .returning({ id: schema.product.id, slug: schema.product.slug });
  const productIds = new Map(products.map((row) => [row.slug, row.id]));
  const sliderProductId = productIds.get("private-source-slider");
  const spinnerProductId = productIds.get("suppressed-spinner");
  const accessoryProductId = productIds.get("excluded-plate");
  if (!sliderProductId || !spinnerProductId || !accessoryProductId)
    throw new Error("Trend products were not created.");
  const [steel, titanium] = await database
    .insert(schema.material)
    .values([
      { name: "Steel", slug: "steel" },
      { name: "Titanium", slug: "titanium" },
    ])
    .returning({ id: schema.material.id, slug: schema.material.slug });
  if (!steel || !titanium) throw new Error("Trend materials were not created.");
  const [titaniumSpecific] = await database
    .insert(schema.materialSpecific)
    .values({ materialId: titanium.id, name: "6Al-4V", slug: "6al-4v" })
    .returning({ id: schema.materialSpecific.id });
  if (!titaniumSpecific)
    throw new Error("Trend material specific was not created.");
  await database.insert(schema.productMaterial).values([
    { materialId: steel.id, productId: sliderProductId },
    {
      materialId: titanium.id,
      materialSpecificId: titaniumSpecific.id,
      productId: sliderProductId,
    },
  ]);

  const owners = await database
    .insert(schema.user)
    .values(
      Array.from({ length: 5 }, (_, index) => ({
        clerkId: `owner-${index}`,
        username: `owner-${index}`,
      })),
    )
    .returning({ id: schema.user.id });
  const firstOwner = owners[0];
  if (!firstOwner) throw new Error("Trend owners were not created.");
  const collections = await database
    .insert(schema.userCollection)
    .values(
      owners.map((owner, index) => ({
        isPrivate: true,
        name: `Private collection ${index}`,
        normalizedName: `private collection ${index}`,
        ownerId: owner.id,
      })),
    )
    .returning({
      id: schema.userCollection.id,
      ownerId: schema.userCollection.ownerId,
    });
  const collectionByOwner = new Map(
    collections.map((row) => [row.ownerId, row.id]),
  );
  await database.insert(schema.productDetailSlider).values({
    id: sliderProductId,
    magnetLayout: "2x4",
    usesInserts: false,
  });
  await database.insert(schema.productDetailSpinner).values({
    id: spinnerProductId,
  });
  await database.insert(schema.productDetailSliderPlate).values({
    id: accessoryProductId,
  });
  const itemSpecs: FixtureItem[] = [
    ...owners.flatMap((owner, index) =>
      Array.from({ length: index < 3 ? 2 : 1 }, () => ({
        kind: "slider" as const,
        item: {
          approvalStatus: "pending" as const,
          collectionId: requiredCollection(collectionByOwner, owner.id),
          isPrivate: true,
          ownerId: owner.id,
        },
        productId: sliderProductId,
      })),
    ),
    ...owners.slice(0, 4).map((owner) => ({
      kind: "spinner" as const,
      item: {
        collectionId: requiredCollection(collectionByOwner, owner.id),
        ownerId: owner.id,
      },
      productId: spinnerProductId,
    })),
    ...owners.map((owner) => ({
      kind: "slider-plate" as const,
      item: {
        collectionId: requiredCollection(collectionByOwner, owner.id),
        ownerId: owner.id,
      },
      productId: accessoryProductId,
    })),
    {
      kind: "slider" as const,
      item: {
        collectionId: requiredCollection(collectionByOwner, firstOwner.id),
        owned: false,
        ownerId: firstOwner.id,
        soldAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      productId: sliderProductId,
    },
  ];
  const insertedItems = await database
    .insert(schema.collectionItem)
    .values(itemSpecs.map(({ item }) => item))
    .returning({ id: schema.collectionItem.id });
  await database
    .insert(schema.collectionDetailSlider)
    .values(
      insertedItems.flatMap((item, index) =>
        itemSpecs[index]?.kind === "slider"
          ? [{ id: item.id, productSliderId: itemSpecs[index].productId }]
          : [],
      ),
    );
  await database
    .insert(schema.collectionDetailSpinner)
    .values(
      insertedItems.flatMap((item, index) =>
        itemSpecs[index]?.kind === "spinner"
          ? [{ id: item.id, productSpinnerId: itemSpecs[index].productId }]
          : [],
      ),
    );
  await database
    .insert(schema.collectionDetailSliderPlate)
    .values(
      insertedItems.flatMap((item, index) =>
        itemSpecs[index]?.kind === "slider-plate"
          ? [{ id: item.id, productSliderPlateId: itemSpecs[index].productId }]
          : [],
      ),
    );
  const storedAccessory = await database
    .select({ id: schema.collectionDetailSliderPlate.id })
    .from(schema.collectionDetailSliderPlate)
    .where(
      eq(
        schema.collectionDetailSliderPlate.productSliderPlateId,
        accessoryProductId,
      ),
    );
  expect(storedAccessory).toHaveLength(5);
  return {
    accessoryTypeId,
    sliderProductId,
    sliderTypeId,
    titaniumMaterialId: titanium.id,
    titaniumSpecificId: titaniumSpecific.id,
  };
}

/**
 * Returns the collection identifier for an owner fixture.
 *
 * @param collections - Owner-to-collection fixture map.
 * @param ownerId - Owner identifier.
 * @returns Matching collection identifier.
 * @throws When the fixture is incomplete.
 */
function requiredCollection(
  collections: Map<number, number>,
  ownerId: number,
): number {
  const collectionId = collections.get(ownerId);
  if (!collectionId) throw new Error("Owner collection was not created.");
  return collectionId;
}

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
