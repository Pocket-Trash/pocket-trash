import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createNoopLogger } from "@package/logger";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import { createDbServices } from "../index.js";

describe("collection deletion", () => {
  it("authorizes and atomically moves linked items or deletes them with queued images", async () => {
    const client = new PGlite();
    await migrate(client);
    const db = drizzle(client, { schema }) as unknown as Database;
    const services = createDbServices(
      db,
      createNoopLogger({ app: "test", environment: "test" }),
    );

    try {
      const [owner, admin, stranger] = await db
        .insert(schema.user)
        .values([
          { clerkId: "deletion-owner", username: "Owner" },
          { clerkId: "deletion-admin", username: "Admin" },
          { clerkId: "deletion-stranger", username: "Stranger" },
        ])
        .returning();
      if (!owner || !admin || !stranger) throw new Error("Users missing.");
      const [source, destination, doomed] = await db
        .insert(schema.userCollection)
        .values([
          { name: "Source", normalizedName: "source", ownerId: owner.id },
          {
            name: "Destination",
            normalizedName: "destination",
            ownerId: owner.id,
          },
          { name: "Doomed", normalizedName: "doomed", ownerId: owner.id },
        ])
        .returning();
      if (!source || !destination || !doomed)
        throw new Error("Collections missing.");

      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Deletion test maker" })
        .returning();
      const [spinnerType, buttonType] = await db
        .insert(schema.productType)
        .values([
          { name: "Spinner", slug: "spinner" },
          { name: "Spinner button", slug: "spinner-button" },
        ])
        .returning();
      if (!maker || !spinnerType || !buttonType)
        throw new Error("Catalog fixtures missing.");
      const [spinnerProduct, buttonProduct] = await db
        .insert(schema.product)
        .values([
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Test spinner",
            productTypeId: spinnerType.id,
            slug: "test-spinner",
          },
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Test button",
            productTypeId: buttonType.id,
            slug: "test-button",
          },
        ])
        .returning();
      if (!spinnerProduct || !buttonProduct)
        throw new Error("Products missing.");
      await db.insert(schema.productSpinner).values({ id: spinnerProduct.id });
      await db
        .insert(schema.productSpinnerButton)
        .values({ id: buttonProduct.id });

      const [spinnerItem, buttonItem, doomedItem] = await db
        .insert(schema.collectionItem)
        .values([
          { collectionId: source.id, ownerId: owner.id },
          { collectionId: source.id, ownerId: owner.id },
          { collectionId: doomed.id, ownerId: owner.id },
        ])
        .returning();
      if (!spinnerItem || !buttonItem || !doomedItem)
        throw new Error("Items missing.");
      await db.insert(schema.collectionSpinnerButton).values({
        id: buttonItem.id,
        productSpinnerButtonId: buttonProduct.id,
      });
      await db.insert(schema.collectionSpinner).values({
        id: spinnerItem.id,
        installedButtonId: buttonItem.id,
        productSpinnerId: spinnerProduct.id,
      });

      await db
        .insert(schema.collectionImage)
        .values([
          image(source.id, "source-cover"),
          image(doomed.id, "doomed-cover"),
        ]);
      await db
        .insert(schema.collectionItemImage)
        .values([
          itemImage(buttonItem.id, "button-image"),
          itemImage(doomedItem.id, "doomed-item-image"),
        ]);

      await expect(
        services.collections.deleteCollection({
          actor: { clerkId: stranger.clerkId, role: "user" },
          collectionId: source.id,
          destinationCollectionId: destination.id,
        }),
      ).rejects.toThrow("Collection does not exist.");
      await expect(
        services.collections.deleteCollection({
          actor: { clerkId: admin.clerkId, role: "admin" },
          collectionId: source.id,
          destinationCollectionId: destination.id,
        }),
      ).rejects.toThrow(/reason/i);

      expect(
        await db
          .select({ collectionId: schema.collectionItem.collectionId })
          .from(schema.collectionItem)
          .where(
            inArray(schema.collectionItem.id, [spinnerItem.id, buttonItem.id]),
          ),
      ).toEqual([{ collectionId: source.id }, { collectionId: source.id }]);
      expect(await db.select().from(schema.storageObjectDeletion)).toEqual([]);

      await services.collections.deleteCollection({
        actor: { clerkId: admin.clerkId, role: "admin" },
        collectionId: source.id,
        destinationCollectionId: destination.id,
        reason: "Owner requested help",
      });
      expect(
        await db
          .select({ collectionId: schema.collectionItem.collectionId })
          .from(schema.collectionItem)
          .where(
            inArray(schema.collectionItem.id, [spinnerItem.id, buttonItem.id]),
          ),
      ).toEqual([
        { collectionId: destination.id },
        { collectionId: destination.id },
      ]);
      expect(
        await db
          .select({ objectPath: schema.storageObjectDeletion.objectPath })
          .from(schema.storageObjectDeletion),
      ).toEqual([{ objectPath: "source-cover" }]);
      expect(
        await db
          .select()
          .from(schema.collectionItemImage)
          .where(
            eq(schema.collectionItemImage.collectionItemId, buttonItem.id),
          ),
      ).toHaveLength(1);

      await services.collections.deleteCollection({
        actor: { clerkId: owner.clerkId, role: "user" },
        collectionId: doomed.id,
        destinationCollectionId: null,
      });
      expect(
        await db
          .select()
          .from(schema.collectionItem)
          .where(eq(schema.collectionItem.id, doomedItem.id)),
      ).toEqual([]);
      expect(
        (
          await db
            .select({ objectPath: schema.storageObjectDeletion.objectPath })
            .from(schema.storageObjectDeletion)
        )
          .map(({ objectPath }) => objectPath)
          .sort(),
      ).toEqual(["doomed-cover", "doomed-item-image", "source-cover"]);
    } finally {
      await client.close();
    }
  }, 30_000);

  it("deletes owned items while preserving spinner button relationships", async () => {
    const client = new PGlite();
    await migrate(client);
    const db = drizzle(client, { schema }) as unknown as Database;
    const services = createDbServices(
      db,
      createNoopLogger({ app: "test", environment: "test" }),
    );

    try {
      const [owner, admin, stranger] = await db
        .insert(schema.user)
        .values([
          { clerkId: "item-owner", username: "Owner" },
          { clerkId: "item-admin", username: "Admin" },
          { clerkId: "item-stranger", username: "Stranger" },
        ])
        .returning();
      if (!owner || !admin || !stranger) throw new Error("Users missing.");
      const [collection] = await db
        .insert(schema.userCollection)
        .values({
          name: "Items",
          normalizedName: "items",
          ownerId: owner.id,
          updatedAt: new Date(0),
        })
        .returning();
      if (!collection) throw new Error("Collection missing.");

      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Item deletion maker" })
        .returning();
      const [spinnerType, buttonType] = await db
        .insert(schema.productType)
        .values([
          { name: "Spinner", slug: "spinner" },
          { name: "Spinner button", slug: "spinner-button" },
        ])
        .returning();
      if (!maker || !spinnerType || !buttonType)
        throw new Error("Catalog fixtures missing.");
      const [spinnerProduct, buttonProduct] = await db
        .insert(schema.product)
        .values([
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Item spinner",
            productTypeId: spinnerType.id,
            slug: "item-spinner",
          },
          {
            approvalStatus: "approved",
            makerId: maker.id,
            name: "Item button",
            productTypeId: buttonType.id,
            slug: "item-button",
          },
        ])
        .returning();
      if (!spinnerProduct || !buttonProduct)
        throw new Error("Products missing.");
      await db.insert(schema.productSpinner).values({ id: spinnerProduct.id });
      await db
        .insert(schema.productSpinnerButton)
        .values({ id: buttonProduct.id });

      const [deletedSpinner, keptButton, keptSpinner, deletedButton] = await db
        .insert(schema.collectionItem)
        .values([
          {
            collectionId: collection.id,
            displayName: "Deleted spinner",
            ownerId: owner.id,
          },
          {
            collectionId: collection.id,
            displayName: "Kept button",
            ownerId: owner.id,
          },
          {
            collectionId: collection.id,
            displayName: "Kept spinner",
            ownerId: owner.id,
          },
          {
            collectionId: collection.id,
            displayName: "Deleted button",
            ownerId: owner.id,
          },
        ])
        .returning();
      if (!deletedSpinner || !keptButton || !keptSpinner || !deletedButton)
        throw new Error("Collection items missing.");
      await db.insert(schema.collectionSpinnerButton).values([
        {
          id: keptButton.id,
          productSpinnerButtonId: buttonProduct.id,
        },
        {
          id: deletedButton.id,
          productSpinnerButtonId: buttonProduct.id,
        },
      ]);
      await db.insert(schema.collectionSpinner).values([
        {
          id: deletedSpinner.id,
          installedButtonId: keptButton.id,
          productSpinnerId: spinnerProduct.id,
        },
        {
          id: keptSpinner.id,
          installedButtonId: deletedButton.id,
          productSpinnerId: spinnerProduct.id,
        },
      ]);
      await db
        .insert(schema.collectionItemImage)
        .values([
          itemImage(deletedSpinner.id, "deleted-spinner-image"),
          itemImage(deletedButton.id, "deleted-button-image"),
        ]);

      await expect(
        services.collections.deleteItem({
          actor: { clerkId: stranger.clerkId, role: "user" },
          collectionItemId: deletedSpinner.id,
        }),
      ).rejects.toThrow("Collection item does not exist.");
      await expect(
        services.collections.deleteItem({
          actor: { clerkId: admin.clerkId, role: "admin" },
          collectionItemId: deletedSpinner.id,
        }),
      ).rejects.toThrow("Collection item does not exist.");

      await services.collections.deleteItem({
        actor: { clerkId: owner.clerkId, role: "user" },
        collectionItemId: deletedSpinner.id,
      });
      expect(
        await db
          .select()
          .from(schema.collectionItem)
          .where(eq(schema.collectionItem.id, deletedSpinner.id)),
      ).toEqual([]);
      expect(
        await db
          .select()
          .from(schema.collectionSpinner)
          .where(eq(schema.collectionSpinner.id, deletedSpinner.id)),
      ).toEqual([]);
      expect(
        await db
          .select()
          .from(schema.collectionSpinnerButton)
          .where(eq(schema.collectionSpinnerButton.id, keptButton.id)),
      ).toHaveLength(1);

      await services.collections.deleteItem({
        actor: { clerkId: owner.clerkId, role: "user" },
        collectionItemId: deletedButton.id,
      });
      expect(
        await db
          .select()
          .from(schema.collectionSpinnerButton)
          .where(eq(schema.collectionSpinnerButton.id, deletedButton.id)),
      ).toEqual([]);
      expect(
        await db
          .select({
            installedButtonId: schema.collectionSpinner.installedButtonId,
          })
          .from(schema.collectionSpinner)
          .where(eq(schema.collectionSpinner.id, keptSpinner.id)),
      ).toEqual([{ installedButtonId: null }]);

      expect(
        (
          await db
            .select({ objectPath: schema.storageObjectDeletion.objectPath })
            .from(schema.storageObjectDeletion)
        )
          .map(({ objectPath }) => objectPath)
          .sort(),
      ).toEqual(["deleted-button-image", "deleted-spinner-image"]);
      expect(
        await db
          .select({ action: schema.auditEvent.action })
          .from(schema.auditEvent)
          .where(
            inArray(schema.auditEvent.targetId, [
              String(deletedSpinner.id),
              String(deletedButton.id),
            ]),
          ),
      ).toEqual([
        { action: "collections.item.deleted" },
        { action: "collections.item.deleted" },
      ]);
      const [updatedCollection] = await db
        .select({ updatedAt: schema.userCollection.updatedAt })
        .from(schema.userCollection)
        .where(eq(schema.userCollection.id, collection.id));
      expect(updatedCollection?.updatedAt).toEqual(expect.any(Date));
      expect(updatedCollection?.updatedAt.getTime()).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  }, 30_000);
});

/**
 * Builds a collection image fixture.
 *
 * @param collectionId - Parent collection identifier.
 * @param objectPath - Stored object path.
 * @returns Collection image values.
 */
function image(collectionId: number, objectPath: string) {
  return {
    collectionId,
    contentType: "image/png",
    fileName: `${objectPath}.png`,
    objectPath,
    position: 0,
    sha256: "a".repeat(64),
    size: 1,
    url: `https://cdn.test/${objectPath}`,
  };
}

/**
 * Builds a collection item image fixture.
 *
 * @param collectionItemId - Parent item identifier.
 * @param objectPath - Stored object path.
 * @returns Collection item image values.
 */
function itemImage(collectionItemId: number, objectPath: string) {
  return {
    collectionItemId,
    contentType: "image/png",
    fileName: `${objectPath}.png`,
    objectPath,
    position: 0,
    sha256: "a".repeat(64),
    size: 1,
    url: `https://cdn.test/${objectPath}`,
  };
}

/**
 * Applies repository migrations to the in-memory database.
 *
 * @param client - In-memory PostgreSQL client.
 * @returns Completion after all migrations run.
 */
async function migrate(client: PGlite) {
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
}
