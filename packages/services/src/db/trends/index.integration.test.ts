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
      expect(
        await createTrendsService(
          db as unknown as Database,
        ).getPublicCollectionItemTrends(
          new Date(generatedAt.getTime() + PUBLIC_TRENDS_STALE_MS + 1),
        ),
      ).toMatchObject({ stale: true });
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
        makerId: maker.id,
        name: "Private-source slider",
        productTypeId: sliderTypeId,
        slug: "private-source-slider",
      },
      {
        makerId: maker.id,
        name: "Suppressed spinner",
        productTypeId: spinnerTypeId,
        slug: "suppressed-spinner",
      },
      {
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
  return { accessoryTypeId, sliderProductId, sliderTypeId };
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
