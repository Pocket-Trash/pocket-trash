import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createLogger } from "@package/logger";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { createDbServices } from "../index.js";

/**
 * Applies every repository migration to an isolated test database.
 *
 * @returns The isolated database client and typed database connection.
 */
async function createTestDatabase() {
  const client = new PGlite();
  const db = drizzle({ client: client, relations: schema.relations });
  const migrationsFolder = fileURLToPath(
    new URL("../../../../database/drizzle", import.meta.url),
  );
  await migratePglite(drizzle({ client: client }), {
    migrationsFolder: migrationsFolder,
  });
  return { client, db };
}

describe("public material directory", () => {
  it("counts only public approved products and direct, currently-owned public items", async () => {
    const { client, db } = await createTestDatabase();

    try {
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Maker", slug: "maker" })
        .returning({ id: schema.maker.id });
      const [productType] = await db
        .insert(schema.productType)
        .values({ name: "Spinner", slug: "spinner" })
        .returning({ id: schema.productType.id });
      const materials = await db
        .insert(schema.material)
        .values([
          {
            description: "A durable **metal**.",
            name: "Aluminum",
            slug: "aluminum",
          },
          { name: "Steel", slug: "steel" },
          { name: "# Resin", slug: "resin" },
        ])
        .returning();
      if (!maker || !productType || materials.length !== 3) {
        throw new Error("Material fixtures were not created.");
      }
      const aluminum = materials[0];
      const steel = materials[1];
      if (!aluminum || !steel)
        throw new Error("Material fixtures are missing.");

      const products = await db
        .insert(schema.product)
        .values([
          {
            approvalStatus: "approved",
            isPrivate: false,
            makerId: maker.id,
            name: "Public spinner",
            productTypeId: productType.id,
            slug: "public-spinner",
          },
          {
            approvalStatus: "approved",
            isPrivate: true,
            makerId: maker.id,
            name: "Private spinner",
            productTypeId: productType.id,
            slug: "private-spinner",
          },
          {
            approvalStatus: "pending",
            isPrivate: false,
            makerId: maker.id,
            name: "Pending spinner",
            productTypeId: productType.id,
            slug: "pending-spinner",
          },
        ])
        .returning();
      await db
        .insert(schema.productDetailSpinner)
        .values(products.map(({ id }) => ({ id })));
      await db.insert(schema.productMaterial).values(
        products.map(({ id }) => ({
          materialId: aluminum.id,
          productId: id,
        })),
      );

      const [owner] = await db
        .insert(schema.user)
        .values({ clerkId: "owner", username: "owner" })
        .returning({ id: schema.user.id });
      if (!owner || !products[0])
        throw new Error("Owner fixtures are missing.");
      const collections = await db
        .insert(schema.userCollection)
        .values([
          {
            isPrivate: false,
            name: "Public collection",
            normalizedName: "public collection",
            ownerId: owner.id,
          },
          {
            isPrivate: true,
            name: "Private collection",
            normalizedName: "private collection",
            ownerId: owner.id,
          },
        ])
        .returning();
      if (!collections[0] || !collections[1]) {
        throw new Error("Collection fixtures are missing.");
      }
      const items = await db
        .insert(schema.collectionItem)
        .values([
          {
            approvalStatus: "approved",
            collectionId: collections[0].id,
            isPrivate: false,
            materialId: steel.id,
            ownerId: owner.id,
            owned: true,
          },
          {
            approvalStatus: "approved",
            collectionId: collections[0].id,
            isPrivate: false,
            materialId: steel.id,
            ownerId: owner.id,
            owned: false,
            soldAt: new Date(),
          },
          {
            approvalStatus: "approved",
            collectionId: collections[1].id,
            isPrivate: false,
            materialId: steel.id,
            ownerId: owner.id,
            owned: true,
          },
          {
            approvalStatus: "pending",
            collectionId: collections[0].id,
            isPrivate: false,
            materialId: steel.id,
            ownerId: owner.id,
            owned: true,
          },
          {
            approvalStatus: "approved",
            collectionId: collections[0].id,
            isPrivate: false,
            materialId: steel.id,
            ownerId: owner.id,
            owned: true,
          },
        ])
        .returning();
      await db.insert(schema.collectionDetailSpinner).values(
        items.map(({ id }, index) => ({
          id,
          productSpinnerId:
            products[index === items.length - 1 ? 1 : 0]?.id ?? 0,
        })),
      );
      await db.insert(schema.materialImage).values([
        {
          contentType: "image/webp",
          fileName: "active.webp",
          materialId: aluminum.id,
          objectPath: "materials/active.webp",
          position: 1,
          sha256: "a".repeat(64),
          size: 10,
          url: "https://cdn.test/active.webp",
        },
        {
          contentType: "image/webp",
          deletedAt: new Date(),
          deletedByRole: "admin",
          fileName: "deleted.webp",
          materialId: aluminum.id,
          objectPath: "materials/deleted.webp",
          position: 0,
          sha256: "b".repeat(64),
          size: 10,
          url: "https://cdn.test/deleted.webp",
        },
      ]);

      const service = createDbServices(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      ).catalog;
      const directory = await service.listPublicMaterials();

      expect(directory).toEqual([
        expect.objectContaining({
          collectionItemCount: 0,
          leadImage: null,
          name: "# Resin",
          productCount: 0,
        }),
        expect.objectContaining({
          collectionItemCount: 0,
          leadImage: expect.objectContaining({ fileName: "active.webp" }),
          name: "Aluminum",
          productCount: 1,
        }),
        expect.objectContaining({
          collectionItemCount: 1,
          name: "Steel",
          productCount: 0,
        }),
      ]);

      const detail = await service.getPublicMaterial("steel");
      expect(detail).toEqual(
        expect.objectContaining({
          collectionItemCount: 1,
          collectionItems: [
            expect.objectContaining({ collectionItemId: items[0]?.id }),
          ],
          name: "Steel",
          productCount: 0,
          products: [],
        }),
      );
      await expect(service.getPublicMaterial("aluminum")).resolves.toEqual(
        expect.objectContaining({
          productCount: 1,
          products: [
            expect.objectContaining({
              approvalStatus: "approved",
              name: "Public spinner",
            }),
          ],
        }),
      );
      await expect(service.getPublicMaterial("missing")).resolves.toBeNull();
      const [alpha, beta, empty, hidden, retained] = await db
        .insert(schema.materialSpecific)
        .values([
          {
            materialId: aluminum.id,
            name: "Alpha alloy",
            slug: "alpha",
            description: "Specific **copy**.",
          },
          { materialId: aluminum.id, name: "Beta alloy", slug: "beta" },
          { materialId: aluminum.id, name: "Empty alloy", slug: "empty" },
          { materialId: aluminum.id, name: "Hidden alloy", slug: "hidden" },
          { materialId: steel.id, name: "Retained grade", slug: "retained" },
        ])
        .returning();
      if (!alpha || !beta || !empty || !hidden || !retained)
        throw new Error("Missing specific fixtures.");
      await db.insert(schema.productMaterial).values([
        {
          productId: products[0].id,
          materialId: aluminum.id,
          materialSpecificId: alpha.id,
        },
        {
          productId: products[0].id,
          materialId: aluminum.id,
          materialSpecificId: beta.id,
        },
        {
          productId: products[1]?.id ?? 0,
          materialId: aluminum.id,
          materialSpecificId: hidden.id,
        },
        {
          productId: products[2]?.id ?? 0,
          materialId: aluminum.id,
          materialSpecificId: hidden.id,
        },
      ]);
      await db
        .update(schema.collectionItem)
        .set({ materialSpecificId: retained.id })
        .where(eq(schema.collectionItem.id, items[0]?.id ?? 0));
      await db.insert(schema.materialImage).values([
        {
          contentType: "image/webp",
          fileName: "alpha-2.webp",
          materialId: aluminum.id,
          materialSpecificId: alpha.id,
          objectPath: "materials/alpha-2.webp",
          position: 2,
          sha256: "c".repeat(64),
          size: 10,
          url: "https://cdn.test/alpha-2.webp",
        },
        {
          contentType: "image/webp",
          fileName: "alpha-1.webp",
          materialId: aluminum.id,
          materialSpecificId: alpha.id,
          objectPath: "materials/alpha-1.webp",
          position: 1,
          sha256: "d".repeat(64),
          size: 10,
          url: "https://cdn.test/alpha-1.webp",
        },
        {
          contentType: "image/webp",
          fileName: "beta.webp",
          materialId: aluminum.id,
          materialSpecificId: beta.id,
          objectPath: "materials/beta.webp",
          position: 0,
          sha256: "e".repeat(64),
          size: 10,
          url: "https://cdn.test/beta.webp",
        },
        {
          contentType: "image/webp",
          fileName: "empty-archived.webp",
          materialId: aluminum.id,
          materialSpecificId: empty.id,
          objectPath: "materials/empty-archived.webp",
          position: 0,
          sha256: "f".repeat(64),
          size: 10,
          url: "https://cdn.test/empty-archived.webp",
          deletedAt: new Date(),
          deletedByRole: "admin",
        },
      ]);
      const aggregate = await service.getPublicMaterial("aluminum");
      expect(aggregate?.productCount).toBe(1);
      expect(aggregate?.products).toHaveLength(1);
      expect(aggregate?.products[0]?.materials).toHaveLength(3);
      expect(
        new Set(
          aggregate?.products[0]?.materials.map(
            ({ assignmentId }) => assignmentId,
          ),
        ).size,
      ).toBe(3);
      expect(aggregate?.specifics.map(({ name }) => name)).toEqual([
        "Alpha alloy",
        "Beta alloy",
      ]);
      expect(aggregate?.images.map(({ fileName }) => fileName)).toEqual([
        "active.webp",
        "alpha-1.webp",
        "alpha-2.webp",
        "beta.webp",
      ]);
      const exact = await service.getPublicMaterial("aluminum", "alpha");
      expect(exact?.specific?.id).toBe(alpha.id);
      expect(exact?.description).toBe("Specific **copy**.");
      expect(exact?.productCount).toBe(1);
      expect(exact?.images.map(({ fileName }) => fileName)).toEqual([
        "alpha-1.webp",
        "alpha-2.webp",
      ]);
      expect(exact?.collectionItems).toEqual([]);
      expect(
        (await service.getPublicMaterial("aluminum", "beta"))?.description,
      ).toBe("A durable **metal**.");
      expect(await service.getPublicMaterial("aluminum", "empty")).toEqual(
        expect.objectContaining({
          specific: expect.objectContaining({ id: empty.id }),
          products: [],
          collectionItems: [],
          images: [],
        }),
      );
      expect(
        (await service.getPublicMaterial("aluminum", "hidden"))?.productCount,
      ).toBe(0);
      expect(
        (await service.getPublicMaterial("steel", "retained"))
          ?.collectionItemCount,
      ).toBe(1);
      expect(
        (await service.getPublicMaterial("steel", "retained"))
          ?.collectionItems[0]?.material?.specific?.id,
      ).toBe(retained.id);
      await expect(
        service.getPublicMaterial("steel", "alpha"),
      ).resolves.toBeNull();
      await expect(
        service.getPublicMaterial("aluminum", "missing"),
      ).resolves.toBeNull();
      await db
        .update(schema.materialImage)
        .set({ deletedAt: new Date(), deletedByRole: "admin" })
        .where(
          and(
            eq(schema.materialImage.materialId, aluminum.id),
            eq(schema.materialImage.fileName, "active.webp"),
          ),
        );
      // Equal public product counts break by specific name, not image position.
      expect(
        (await service.listPublicMaterials()).find(
          ({ id }) => id === aluminum.id,
        )?.leadImage?.fileName,
      ).toBe("alpha-1.webp");
      await db
        .delete(schema.productMaterial)
        .where(
          and(
            eq(schema.productMaterial.materialId, aluminum.id),
            eq(schema.productMaterial.materialSpecificId, alpha.id),
          ),
        );
      expect(
        (await service.listPublicMaterials()).find(
          ({ id }) => id === aluminum.id,
        )?.leadImage?.fileName,
      ).toBe("beta.webp");
      await db
        .update(schema.materialSpecific)
        .set({ slug: "beta-new" })
        .where(eq(schema.materialSpecific.id, beta.id));
      await expect(
        service.getPublicMaterial("aluminum", "beta"),
      ).resolves.toBeNull();
      expect(
        (await service.getPublicMaterial("aluminum", "beta-new"))?.specific?.id,
      ).toBe(beta.id);
    } finally {
      await client.close();
    }
  }, 30_000);

  it("keeps slider, plate, and insert counts consistent with effective assembly privacy", async () => {
    const { client, db } = await createTestDatabase();
    try {
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Maker", slug: "maker" })
        .returning();
      const [material] = await db
        .insert(schema.material)
        .values({ name: "Steel", slug: "steel" })
        .returning();
      const [owner] = await db
        .insert(schema.user)
        .values({ clerkId: "owner", username: "owner" })
        .returning();
      if (!maker || !material || !owner)
        throw new Error("Missing base fixtures.");
      const [specific] = await db
        .insert(schema.materialSpecific)
        .values({ materialId: material.id, name: "M390", slug: "m390" })
        .returning();
      const [collection] = await db
        .insert(schema.userCollection)
        .values({
          ownerId: owner.id,
          name: "Collection",
          normalizedName: "collection",
          isPrivate: false,
        })
        .returning();
      if (!specific || !collection)
        throw new Error("Missing collection fixtures.");
      const types = await db
        .insert(schema.productType)
        .values(
          ["slider", "slider-plate", "slider-insert"].map((slug) => ({
            name: slug,
            slug,
          })),
        )
        .returning();
      const products = await db
        .insert(schema.product)
        .values(
          types.map((type) => ({
            makerId: maker.id,
            productTypeId: type.id,
            name: type.name,
            slug: type.slug,
            approvalStatus: "approved" as const,
            isPrivate: false,
          })),
        )
        .returning();
      const [slider, plate, insert] = products;
      if (!slider || !plate || !insert)
        throw new Error("Missing slider fixtures.");
      await db
        .insert(schema.productDetailSlider)
        .values({ id: slider.id, usesInserts: false, magnetLayout: "2x2" });
      await db.insert(schema.productDetailSliderPlate).values({ id: plate.id });
      await db
        .insert(schema.productDetailSliderInsert)
        .values({ id: insert.id });
      const items = await db
        .insert(schema.collectionItem)
        .values(
          Array.from({ length: 5 }, (_, index) => ({
            ownerId: owner.id,
            collectionId: collection.id,
            materialId: material.id,
            materialSpecificId: index === 0 || index === 3 ? null : specific.id,
            approvalStatus: "approved" as const,
            owned: true,
            isPrivate: index === 1 || index === 3,
            privatedByClerkId: index === 1 ? owner.clerkId : null,
            privateReason: index === 1 ? "Owner preference" : null,
            privatedAt: index === 1 ? new Date() : null,
          })),
        )
        .returning();
      const [
        publicParent,
        ownedPlate,
        ownedInsert,
        privateParent,
        hiddenPlate,
      ] = items;
      if (
        !publicParent ||
        !ownedPlate ||
        !ownedInsert ||
        !privateParent ||
        !hiddenPlate
      )
        throw new Error("Missing owned fixtures.");
      await db.insert(schema.collectionDetailSliderPlate).values([
        { id: ownedPlate.id, productSliderPlateId: plate.id },
        { id: hiddenPlate.id, productSliderPlateId: plate.id },
      ]);
      await db
        .insert(schema.collectionDetailSliderInsert)
        .values({ id: ownedInsert.id, productSliderInsertId: insert.id });
      await db.insert(schema.collectionDetailSlider).values([
        {
          id: publicParent.id,
          productSliderId: slider.id,
          installedPlateId: ownedPlate.id,
        },
        {
          id: privateParent.id,
          productSliderId: slider.id,
          installedPlateId: hiddenPlate.id,
        },
      ]);
      const service = createDbServices(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      ).catalog;
      expect(
        (await service.listPublicMaterials())[0]?.collectionItemCount,
      ).toBe(3);
      const exact = await service.getPublicMaterial("steel", "m390");
      expect(exact?.collectionItemCount).toBe(2);
      expect(
        exact?.collectionItems
          .map(({ collectionItemId }) => collectionItemId)
          .sort(),
      ).toEqual([ownedPlate.id, ownedInsert.id].sort());
      await db
        .update(schema.collectionItem)
        .set({ privatedByClerkId: "staff" })
        .where(eq(schema.collectionItem.id, ownedPlate.id));
      expect(
        (await service.listPublicMaterials())[0]?.collectionItemCount,
      ).toBe(2);
      expect(
        (await service.getPublicMaterial("steel", "m390"))?.collectionItemCount,
      ).toBe(1);
      await db
        .update(schema.product)
        .set({ approvalStatus: "pending" })
        .where(eq(schema.product.id, insert.id));
      expect(
        (await service.listPublicMaterials())[0]?.collectionItemCount,
      ).toBe(1);
      expect(
        (await service.getPublicMaterial("steel", "m390"))?.collectionItemCount,
      ).toBe(0);
    } finally {
      await client.close();
    }
  }, 30_000);
});
