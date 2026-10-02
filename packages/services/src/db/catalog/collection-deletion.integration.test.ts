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
import { objectIsAttached } from "../../storage/object-lifecycle.js";
import { AuditPayloadTooLargeError } from "../audit/index.js";
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
      const [finish] = await db
        .insert(schema.finish)
        .values({ name: "Polished", slug: "polished" })
        .returning();
      const [option] = await db
        .insert(schema.finishOption)
        .values({ collectionItemId: buttonItem.id, position: 0 })
        .returning();
      if (!finish || !option) throw new Error("Finish fixtures missing.");
      await db.insert(schema.finishOptionFinish).values({
        finishOptionId: option.id,
        finishId: finish.id,
        position: 0,
      });

      await db
        .insert(schema.collectionImage)
        .values([
          image(source.id, "source-cover"),
          image(doomed.id, "doomed-cover"),
        ]);
      await db.insert(schema.collectionItemImage).values([
        itemImage(buttonItem.id, "button-image"),
        {
          ...itemImage(buttonItem.id, "trashed-button-image"),
          sha256: "b".repeat(64),
          deletedAt: new Date(),
          deletedByRole: "owner",
          deletedByClerkId: owner.clerkId,
        },
        itemImage(doomedItem.id, "doomed-item-image"),
      ]);

      const deletion = {
        actor: { clerkId: owner.clerkId, role: "user" as const },
        confirmed: true,
        collectionId: source.id,
        destinationCollectionId: destination.id,
      };
      await expect(
        services.collections.deleteCollection({
          ...deletion,
          confirmed: false,
        }),
      ).rejects.toThrow(/confirmation/);
      await expect(
        services.collections.deleteCollection({
          ...deletion,
          destinationCollectionId: source.id,
        }),
      ).rejects.toThrow(/Destination/);
      const [foreign] = await db
        .insert(schema.userCollection)
        .values({
          ownerId: stranger.id,
          name: "Foreign",
          normalizedName: "foreign",
        })
        .returning();
      if (!foreign) throw new Error("Foreign collection missing.");
      await expect(
        services.collections.deleteCollection({
          ...deletion,
          destinationCollectionId: foreign.id,
        }),
      ).rejects.toThrow(/Destination/);
      await client.exec(`create function reject_collection_audit() returns trigger language plpgsql as $$
        begin raise exception 'forced audit failure'; end $$;
        create trigger reject_collection_audit before insert on audit_event for each row execute function reject_collection_audit();`);
      await expect(
        services.collections.deleteCollection(deletion),
      ).rejects.toThrow();
      await client.exec("drop trigger reject_collection_audit on audit_event;");
      expect(await db.select().from(schema.auditEvent)).toHaveLength(0);
      expect(await db.select().from(schema.collectionImage)).toHaveLength(2);

      await expect(
        services.collections.deleteCollection({
          confirmed: true,
          actor: { clerkId: stranger.clerkId, role: "user" },
          collectionId: source.id,
          destinationCollectionId: destination.id,
        }),
      ).rejects.toThrow("Collection does not exist.");
      await expect(
        services.collections.deleteCollection({
          confirmed: true,
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
        confirmed: true,
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
      ).toHaveLength(2);
      const [moveEvent] = await db.select().from(schema.auditEvent);
      expect(moveEvent).toMatchObject({
        actorUserId: admin.id,
        ownerUserId: owner.id,
        authorizationType: "permission",
        permission: "collections.manage",
        reason: "Owner requested help",
        beforeState: {
          id: source.id,
          name: "Source",
          images: [{ objectPath: "source-cover" }],
          items: [
            { id: spinnerItem.id, installedButtonId: buttonItem.id },
            {
              id: buttonItem.id,
              images: expect.any(Array),
              finishOptions: [
                { id: option.id, finishes: [{ id: finish.id, position: 0 }] },
              ],
            },
          ],
        },
        afterState: {
          deleted: true,
          deletedItemIds: [],
          movedItemIds: [spinnerItem.id, buttonItem.id],
          queuedImageCount: 1,
        },
      });
      const itemDeletion = {
        actor: { clerkId: admin.clerkId, role: "editor" as const },
        confirmed: true,
        collectionItemId: buttonItem.id,
        reason: " Owner requested deletion ",
      };
      await expect(
        services.collections.deleteItem({ ...itemDeletion, confirmed: false }),
      ).rejects.toThrow(/confirmation/);
      await expect(
        services.collections.deleteItem({
          ...itemDeletion,
          actor: { clerkId: stranger.clerkId, role: "user" },
        }),
      ).rejects.toThrow(/does not exist/);
      await expect(
        services.collections.deleteItem({
          ...itemDeletion,
          actor: { clerkId: "missing", role: "admin" },
        }),
      ).rejects.toThrow(/does not exist/);
      await expect(
        services.collections.deleteItem({ ...itemDeletion, reason: " " }),
      ).rejects.toThrow(/reason/i);
      await expect(
        services.collections.deleteItem({
          ...itemDeletion,
          reason: "x".repeat(1001),
        }),
      ).rejects.toThrow(/reason/i);
      await client.exec(
        "create trigger reject_collection_audit before insert on audit_event for each row execute function reject_collection_audit();",
      );
      await expect(
        services.collections.deleteItem(itemDeletion),
      ).rejects.toThrow();
      await client.exec("drop trigger reject_collection_audit on audit_event;");
      expect(
        (await db.select().from(schema.collectionSpinner))[0]
          ?.installedButtonId,
      ).toBe(buttonItem.id);
      expect(await db.select().from(schema.finishOption)).toHaveLength(1);
      expect(await db.select().from(schema.storageObjectDeletion)).toHaveLength(
        1,
      );
      await services.collections.deleteItem(itemDeletion);
      expect(
        (await db.select().from(schema.collectionSpinner))[0]
          ?.installedButtonId,
      ).toBeNull();
      expect(await db.select().from(schema.finishOption)).toHaveLength(0);
      expect(await db.select().from(schema.finishOptionFinish)).toHaveLength(0);
      expect(await db.select().from(schema.finish)).toHaveLength(1);
      expect(await db.select().from(schema.product)).toHaveLength(2);
      const itemEvent = (
        await db.select().from(schema.auditEvent).orderBy(schema.auditEvent.id)
      ).at(-1);
      expect(itemEvent).toMatchObject({
        action: "collections.item.deleted",
        actorRole: "editor",
        targetId: String(buttonItem.id),
        reason: "Owner requested deletion",
        authorizationType: "permission",
        permission: "collections.manage",
        beforeState: {
          id: buttonItem.id,
          collectionId: destination.id,
          productSpinnerButtonId: buttonProduct.id,
          finishOptions: [{ id: option.id }],
          images: expect.any(Array),
        },
        afterState: {
          deleted: true,
          detachedSpinnerIds: [spinnerItem.id],
          queuedImageCount: 2,
        },
      });
      expect(itemEvent?.beforeState?.images).toHaveLength(2);
      expect(JSON.stringify(itemEvent?.beforeState)).not.toContain(
        owner.clerkId,
      );
      expect(JSON.stringify(itemEvent?.beforeState)).not.toContain("https://");
      await expect(
        services.collections.deleteItem(itemDeletion),
      ).rejects.toThrow(/does not exist/);
      const [retainedButton] = await db
        .insert(schema.collectionItem)
        .values({ collectionId: destination.id, ownerId: owner.id })
        .returning();
      if (!retainedButton) throw new Error("Retained button missing.");
      await db.insert(schema.collectionSpinnerButton).values({
        id: retainedButton.id,
        productSpinnerButtonId: buttonProduct.id,
      });
      await db
        .update(schema.collectionSpinner)
        .set({ installedButtonId: retainedButton.id })
        .where(eq(schema.collectionSpinner.id, spinnerItem.id));
      await services.collections.deleteItem({
        actor: { clerkId: owner.clerkId, role: "editor" },
        confirmed: true,
        collectionItemId: spinnerItem.id,
      });
      expect(
        await db
          .select()
          .from(schema.collectionItem)
          .where(eq(schema.collectionItem.id, retainedButton.id)),
      ).toHaveLength(1);
      expect(
        (
          await db
            .select()
            .from(schema.auditEvent)
            .orderBy(schema.auditEvent.id)
        ).at(-1),
      ).toMatchObject({
        authorizationType: "owner",
        permission: null,
        reason: null,
        afterState: { retainedButtonId: retainedButton.id },
      });
      await db
        .update(schema.collectionItem)
        .set({ displayName: "x".repeat(256 * 1024) })
        .where(eq(schema.collectionItem.id, doomedItem.id));
      await expect(
        services.collections.deleteItem({
          actor: deletion.actor,
          confirmed: true,
          collectionItemId: doomedItem.id,
        }),
      ).rejects.toThrow(AuditPayloadTooLargeError);
      await expect(
        services.collections.deleteCollection({
          ...deletion,
          collectionId: doomed.id,
          destinationCollectionId: null,
        }),
      ).rejects.toThrow(AuditPayloadTooLargeError);
      expect(
        await db
          .select()
          .from(schema.userCollection)
          .where(eq(schema.userCollection.id, doomed.id)),
      ).toHaveLength(1);
      expect(
        await db
          .select()
          .from(schema.collectionItem)
          .where(eq(schema.collectionItem.id, doomedItem.id)),
      ).toHaveLength(1);
      expect(await objectIsAttached(db, "doomed-item-image")).toBe(true);
      await db
        .update(schema.collectionItem)
        .set({ displayName: null })
        .where(eq(schema.collectionItem.id, doomedItem.id));
      // Legacy cross-collection links must be cleared without deleting their spinner.
      await db.insert(schema.collectionSpinnerButton).values({
        id: doomedItem.id,
        productSpinnerButtonId: buttonProduct.id,
      });
      const [externalSpinner] = await db
        .insert(schema.collectionItem)
        .values({ collectionId: destination.id, ownerId: owner.id })
        .returning();
      if (!externalSpinner) throw new Error("External spinner missing.");
      await db.insert(schema.collectionSpinner).values({
        id: externalSpinner.id,
        installedButtonId: doomedItem.id,
        productSpinnerId: spinnerProduct.id,
      });

      await services.collections.deleteCollection({
        confirmed: true,
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
      ).toEqual([
        "button-image",
        "doomed-cover",
        "doomed-item-image",
        "source-cover",
        "trashed-button-image",
      ]);
      expect(await objectIsAttached(db, "doomed-item-image")).toBe(false);
      const events = await db
        .select()
        .from(schema.auditEvent)
        .orderBy(schema.auditEvent.id);
      expect(events).toHaveLength(4);
      expect(events.at(-1)).toMatchObject({
        beforeState: {
          id: doomed.id,
          images: [{ objectPath: "doomed-cover" }],
          items: [
            {
              id: doomedItem.id,
              images: [{ objectPath: "doomed-item-image" }],
            },
          ],
        },
        afterState: {
          deletedItemIds: [doomedItem.id],
          movedItemIds: [],
          queuedImageCount: 2,
          detachedSpinnerIds: [externalSpinner.id],
        },
      });
      expect(
        (
          await db
            .select()
            .from(schema.collectionSpinner)
            .where(eq(schema.collectionSpinner.id, externalSpinner.id))
        )[0]?.installedButtonId,
      ).toBeNull();
      expect(
        await db
          .select()
          .from(schema.collectionItem)
          .where(eq(schema.collectionItem.id, externalSpinner.id)),
      ).toHaveLength(1);
      await db.transaction((tx) => services.audit.redactAccount(tx, admin.id));
      expect(
        (
          await db
            .select()
            .from(schema.auditEvent)
            .orderBy(schema.auditEvent.id)
        )[1],
      ).toMatchObject({
        actorUserId: null,
        reason: "[erased]",
        beforeState: itemEvent?.beforeState,
      });
      await db.transaction((tx) => services.audit.redactAccount(tx, owner.id));
      for (const event of await db.select().from(schema.auditEvent)) {
        expect(event).toMatchObject({
          ownerUserId: null,
          beforeState: null,
          afterState: null,
          metadata: { redacted: true },
        });
      }
      const concurrent = await Promise.allSettled(
        [0, 1].map(() =>
          services.collections.deleteCollection({
            ...deletion,
            collectionId: destination.id,
            destinationCollectionId: null,
          }),
        ),
      );
      expect(
        concurrent.filter(({ status }) => status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        concurrent.filter(({ status }) => status === "rejected"),
      ).toHaveLength(1);
      expect(await db.select().from(schema.auditEvent)).toHaveLength(5);
    } finally {
      await client.close();
    }
  }, 60_000);

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
          confirmed: true,
        }),
      ).rejects.toThrow("Collection item does not exist.");
      await expect(
        services.collections.deleteItem({
          actor: { clerkId: admin.clerkId, role: "admin" },
          collectionItemId: deletedSpinner.id,
          confirmed: true,
        }),
      ).rejects.toThrow("A moderation reason is required.");

      await services.collections.deleteItem({
        actor: { clerkId: owner.clerkId, role: "user" },
        collectionItemId: deletedSpinner.id,
        confirmed: true,
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

      await db
        .update(schema.collectionItem)
        .set({ owned: false })
        .where(eq(schema.collectionItem.id, keptSpinner.id));
      await expect(
        services.collections.deleteItem({
          actor: { clerkId: owner.clerkId, role: "user" },
          collectionItemId: keptSpinner.id,
          confirmed: true,
        }),
      ).rejects.toThrow("Collection item does not exist.");

      await services.collections.deleteItem({
        actor: { clerkId: owner.clerkId, role: "user" },
        collectionItemId: deletedButton.id,
        confirmed: true,
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
