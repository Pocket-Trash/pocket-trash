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
import { objectIsAttached } from "../../storage/object-lifecycle.js";
import { AuditPayloadTooLargeError } from "../audit/index.js";
import { createDbServices } from "../index.js";

describe("product deletion", () => {
  it("blocks references and atomically deletes owned data, queues images, audits, and redacts", async () => {
    const client = new PGlite();
    try {
      await migrate(client);
      const db = drizzle(client, { schema }) as unknown as Database;
      const services = createDbServices(
        db,
        createNoopLogger({ app: "test", environment: "test" }),
      );
      const [owner, editor, stranger] = await db
        .insert(schema.user)
        .values([
          { clerkId: "product-delete-owner", username: "Owner" },
          { clerkId: "product-delete-editor", username: "Editor" },
          { clerkId: "product-delete-stranger" },
        ])
        .returning();
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Delete maker", slug: "delete-maker" })
        .returning();
      const [spinnerType, buttonType] = await db
        .insert(schema.productType)
        .values([
          { name: "Spinner", slug: "spinner" },
          { name: "Button", slug: "spinner-button" },
        ])
        .returning();
      const [material] = await db
        .insert(schema.material)
        .values({ name: "Titanium", slug: "titanium" })
        .returning();
      const [finish] = await db
        .insert(schema.finish)
        .values({ name: "Polished", slug: "polished" })
        .returning();
      if (
        !owner ||
        !editor ||
        !stranger ||
        !maker ||
        !spinnerType ||
        !buttonType ||
        !material ||
        !finish
      )
        throw new Error("Deletion fixtures missing.");
      const ownerActor = { clerkId: owner.clerkId, role: "user" as const };
      const editorActor = { clerkId: editor.clerkId, role: "editor" as const };
      const [spinner, button, oversized] = await db
        .insert(schema.product)
        .values([
          {
            makerId: maker.id,
            productTypeId: spinnerType.id,
            ownerClerkId: owner.clerkId,
            name: "Spinner",
            slug: "spinner",
            description: "Catalog description",
          },
          {
            makerId: maker.id,
            productTypeId: buttonType.id,
            ownerClerkId: owner.clerkId,
            name: "Button",
            slug: "button",
          },
          {
            makerId: maker.id,
            productTypeId: spinnerType.id,
            ownerClerkId: owner.clerkId,
            name: "Oversized",
            slug: "oversized",
          },
        ])
        .returning();
      if (!spinner || !button || !oversized)
        throw new Error("Products missing.");
      await db
        .insert(schema.productSpinnerButton)
        .values({ id: button.id, diameterMm: "22" });
      await db
        .insert(schema.productSpinner)
        .values([
          { id: spinner.id, bearing: "R188", compatibleButtonId: button.id },
          { id: oversized.id },
        ]);
      await db
        .insert(schema.productMaterial)
        .values({ productId: spinner.id, materialId: material.id });
      const [option] = await db
        .insert(schema.finishOption)
        .values({ productId: spinner.id, position: 0 })
        .returning();
      if (!option) throw new Error("Finish missing.");
      await db.insert(schema.finishOptionFinish).values({
        finishOptionId: option.id,
        finishId: finish.id,
        position: 0,
      });
      const images = await db
        .insert(schema.productImage)
        .values([
          image(spinner.id, "active", 0),
          {
            ...image(spinner.id, "trashed", 1),
            sha256: "b".repeat(64),
            deletedAt: new Date(),
            deletedByClerkId: owner.clerkId,
            deletedByRole: "owner" as const,
          },
          {
            ...image(oversized.id, "oversized", 0),
            fileName: "x".repeat(270_000),
          },
        ])
        .returning();
      const [collection] = await db
        .insert(schema.userCollection)
        .values({ name: "Keep", normalizedName: "keep", ownerId: stranger.id })
        .returning();
      if (!collection) throw new Error("Collection missing.");
      const [spinnerItem, buttonItem] = await db
        .insert(schema.collectionItem)
        .values([
          { collectionId: collection.id, ownerId: stranger.id },
          { collectionId: collection.id, ownerId: stranger.id },
        ])
        .returning();
      if (!spinnerItem || !buttonItem) throw new Error("Items missing.");
      await db
        .insert(schema.collectionSpinner)
        .values({ id: spinnerItem.id, productSpinnerId: spinner.id });
      const request = {
        actor: ownerActor,
        confirmed: true,
        productId: spinner.id,
      };
      await expect(
        services.catalog.deleteProduct({ ...request, confirmed: false }),
      ).rejects.toThrow(/confirmation/);
      await expect(
        services.catalog.deleteProduct({
          ...request,
          actor: { clerkId: stranger.clerkId, role: "user" },
        }),
      ).rejects.toThrow(/does not exist/);
      await expect(
        services.catalog.deleteProduct({
          ...request,
          actor: editorActor,
          reason: " ",
        }),
      ).rejects.toThrow(/reason/);
      await expect(
        services.catalog.deleteProduct({
          ...request,
          actor: editorActor,
          reason: "x".repeat(1001),
        }),
      ).rejects.toThrow(/reason/);
      await expect(
        services.catalog.deleteProduct({
          ...request,
          actor: { clerkId: "missing-editor", role: "editor" },
          reason: "Review",
        }),
      ).rejects.toThrow(/does not exist/);
      await expect(services.catalog.deleteProduct(request)).resolves.toBe(
        false,
      );
      await db
        .delete(schema.collectionSpinner)
        .where(eq(schema.collectionSpinner.id, spinnerItem.id));
      await expect(
        services.catalog.deleteProduct({ ...request, productId: button.id }),
      ).resolves.toBe(false);
      await db
        .update(schema.productSpinner)
        .set({ compatibleButtonId: null })
        .where(eq(schema.productSpinner.id, spinner.id));
      await db
        .insert(schema.collectionSpinnerButton)
        .values({ id: buttonItem.id, productSpinnerButtonId: button.id });
      await expect(
        services.catalog.deleteProduct({ ...request, productId: button.id }),
      ).resolves.toBe(false);
      await db
        .delete(schema.collectionSpinnerButton)
        .where(eq(schema.collectionSpinnerButton.id, buttonItem.id));
      const [selected] = await db
        .insert(schema.finishOption)
        .values({
          collectionItemId: spinnerItem.id,
          sourceProductFinishOptionId: option.id,
          position: 0,
        })
        .returning();
      if (!selected) throw new Error("Selected finish missing.");
      await expect(services.catalog.deleteProduct(request)).resolves.toBe(
        false,
      );
      expect(await db.select().from(schema.auditEvent)).toHaveLength(0);
      expect(await db.select().from(schema.storageObjectDeletion)).toHaveLength(
        0,
      );
      await db
        .delete(schema.finishOption)
        .where(eq(schema.finishOption.id, selected.id));

      // Actual audit failure after cascading deletion must restore every row and queue entry.
      await client.exec(`CREATE FUNCTION fail_product_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END; $$;
        CREATE TRIGGER fail_product_delete BEFORE INSERT ON audit_event FOR EACH ROW EXECUTE FUNCTION fail_product_delete();`);
      await expect(services.catalog.deleteProduct(request)).rejects.toThrow();
      expect(
        await db
          .select()
          .from(schema.product)
          .where(eq(schema.product.id, spinner.id)),
      ).toHaveLength(1);
      expect(
        await db
          .select()
          .from(schema.productImage)
          .where(eq(schema.productImage.productId, spinner.id)),
      ).toHaveLength(2);
      expect(
        await db
          .select()
          .from(schema.finishOptionFinish)
          .where(eq(schema.finishOptionFinish.finishOptionId, option.id)),
      ).toHaveLength(1);
      expect(await db.select().from(schema.storageObjectDeletion)).toHaveLength(
        0,
      );
      await client.exec(
        "DROP TRIGGER fail_product_delete ON audit_event; DROP FUNCTION fail_product_delete();",
      );
      await expect(
        services.catalog.deleteProduct({ ...request, productId: oversized.id }),
      ).rejects.toBeInstanceOf(AuditPayloadTooLargeError);
      expect(
        await db
          .select()
          .from(schema.product)
          .where(eq(schema.product.id, oversized.id)),
      ).toHaveLength(1);
      expect(await db.select().from(schema.storageObjectDeletion)).toHaveLength(
        0,
      );

      // Shared paths are queued, but the existing cleanup worker rechecks attachments.
      await db.insert(schema.collectionImage).values({
        ...image(spinner.id, "active", 0),
        collectionId: collection.id,
      });
      await expect(
        services.catalog.deleteProduct({
          ...request,
          actor: editorActor,
          reason: " Owner requested removal ",
        }),
      ).resolves.toBe(true);
      expect(
        await db
          .select()
          .from(schema.product)
          .where(eq(schema.product.id, spinner.id)),
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(schema.productImage)
          .where(eq(schema.productImage.productId, spinner.id)),
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(schema.productSpinner)
          .where(eq(schema.productSpinner.id, spinner.id)),
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(schema.productMaterial)
          .where(eq(schema.productMaterial.productId, spinner.id)),
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(schema.finishOption)
          .where(eq(schema.finishOption.id, option.id)),
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(schema.finishOptionFinish)
          .where(eq(schema.finishOptionFinish.finishOptionId, option.id)),
      ).toHaveLength(0);
      expect(await db.select().from(schema.maker)).toHaveLength(1);
      expect(await db.select().from(schema.material)).toHaveLength(1);
      expect(await db.select().from(schema.finish)).toHaveLength(1);
      expect(await db.select().from(schema.collectionItem)).toHaveLength(2);
      expect(await db.select().from(schema.collectionImage)).toHaveLength(1);
      expect(await objectIsAttached(db, "active")).toBe(true);
      expect(await objectIsAttached(db, "trashed")).toBe(false);
      expect(
        (await db.select().from(schema.storageObjectDeletion))
          .map(({ objectPath }) => objectPath)
          .sort(),
      ).toEqual(["active", "trashed"]);
      const [event] = await db.select().from(schema.auditEvent);
      expect(event).toMatchObject({
        action: "products.product.deleted",
        targetId: String(spinner.id),
        actorUserId: editor.id,
        ownerUserId: owner.id,
        actorRole: "editor",
        authorizationType: "permission",
        permission: "products.manage",
        reason: "Owner requested removal",
        beforeState: {
          id: spinner.id,
          name: "Spinner",
          description: "Catalog description",
          bearing: "R188",
          materialIds: [material.id],
          finishOptions: [{ id: option.id, finishIds: [finish.id] }],
          images: expect.any(Array),
        },
        afterState: {
          deleted: true,
          queuedImageCount: 2,
          deletedFinishOptionCount: 1,
        },
      });
      expect(event?.beforeState?.images).toHaveLength(2);
      expect(event?.beforeState?.images).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: images[1]?.id,
            objectPath: "trashed",
            deletedAt: expect.any(String),
          }),
        ]),
      );
      await expect(services.catalog.deleteProduct(request)).rejects.toThrow(
        /does not exist/,
      );
      expect(await db.select().from(schema.auditEvent)).toHaveLength(1);
      await db.transaction((tx) => services.audit.redactAccount(tx, editor.id));
      expect((await db.select().from(schema.auditEvent))[0]).toMatchObject({
        actorUserId: null,
        reason: "[erased]",
        beforeState: event?.beforeState,
      });
      await db.transaction((tx) => services.audit.redactAccount(tx, owner.id));
      expect((await db.select().from(schema.auditEvent))[0]).toMatchObject({
        ownerUserId: null,
        beforeState: null,
        afterState: null,
        metadata: { redacted: true },
      });
      const concurrent = await Promise.allSettled(
        [0, 1].map(() =>
          services.catalog.deleteProduct({
            ...request,
            productId: button.id,
            actor: { ...ownerActor, role: "editor" },
          }),
        ),
      );
      expect(concurrent.filter(({ status }) => status === "fulfilled")).toEqual(
        [{ status: "fulfilled", value: true }],
      );
      expect(
        concurrent.filter(({ status }) => status === "rejected"),
      ).toHaveLength(1);
      expect(await db.select().from(schema.auditEvent)).toHaveLength(2);
      expect(
        (
          await db
            .select()
            .from(schema.auditEvent)
            .orderBy(schema.auditEvent.id)
        ).at(-1),
      ).toMatchObject({
        actorUserId: owner.id,
        ownerUserId: owner.id,
        authorizationType: "owner",
        permission: null,
        reason: null,
      });
    } finally {
      await client.close();
    }
  }, 60_000);
});

/**
 * Builds allowlisted product-image fixture values.
 *
 * @param productId - Parent catalog product.
 * @param objectPath - Exact storage key.
 * @param position - Image display order.
 * @returns Product image insert values.
 */
function image(productId: number, objectPath: string, position: number) {
  return {
    productId,
    objectPath,
    position,
    contentType: "image/png",
    fileName: `${objectPath}.png`,
    sha256: "a".repeat(64),
    size: 1,
    url: `https://cdn.test/${objectPath}`,
  };
}

/**
 * Applies migrations to an isolated in-memory database.
 *
 * @param client - PGlite database.
 * @rejects When a migration cannot be read or applied.
 */
async function migrate(client: PGlite) {
  const folder = fileURLToPath(
    new URL("../../../../database/drizzle", import.meta.url),
  );
  for (const file of readdirSync(folder)
    .filter((name) => name.endsWith(".sql"))
    .sort())
    await client.exec(
      readFileSync(join(folder, file), "utf8").replaceAll(
        "--> statement-breakpoint",
        "",
      ),
    );
}
