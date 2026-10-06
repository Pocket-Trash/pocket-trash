import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createLogger } from "@package/logger";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import { createDbServices } from "../index.js";

/**
 * Applies every repository migration to an isolated test database.
 *
 * @returns The isolated database client and typed database connection.
 */
async function createTestDatabase() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  const migrationsFolder = fileURLToPath(
    new URL("../../../../database/drizzle", import.meta.url),
  );
  for (const file of readdirSync(migrationsFolder)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await client.exec(
      readFileSync(join(migrationsFolder, file), "utf8").replaceAll(
        "--> statement-breakpoint",
        "",
      ),
    );
  }
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
        .insert(schema.productSpinner)
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
      await db.insert(schema.collectionSpinner).values(
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
    } finally {
      await client.close();
    }
  }, 30_000);
});
