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

describe("collection-item approval", () => {
  it("preserves existing items, authorizes decisions, and gates public reads without changing ownership or privacy", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema }) as unknown as Database;
    const folder = fileURLToPath(
      new URL("../../../../database/drizzle", import.meta.url),
    );
    const files = readdirSync(folder)
      .filter((name) => name.endsWith(".sql"))
      .sort();
    const approvalMigration = files.indexOf("0051_stiff_spectrum.sql");
    expect(approvalMigration).toBeGreaterThan(0);
    try {
      for (const file of files.slice(0, approvalMigration))
        await runMigration(client, folder, file);
      const [owner, editor] = await db
        .insert(schema.user)
        .values([
          { clerkId: "approval-owner", username: "Owner" },
          { clerkId: "approval-editor", username: "Editor" },
        ])
        .returning();
      if (!owner || !editor) throw new Error("Users missing.");
      const [collection] = await db
        .insert(schema.userCollection)
        .values({
          isPrivate: false,
          name: "Review collection",
          normalizedName: "reviewcollection",
          ownerId: owner.id,
        })
        .returning();
      if (!collection) throw new Error("Collection missing.");
      const {
        rows: [legacy],
      } = await client.query<{
        /** Identifier inserted before approval columns existed. */
        id: number;
      }>(
        "INSERT INTO collection_item (owner_id, collection_id) VALUES ($1, $2) RETURNING id::integer AS id",
        [owner.id, collection.id],
      );
      for (const file of files.slice(approvalMigration))
        await runMigration(client, folder, file);
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Review maker" })
        .returning();
      const [productType] = await db
        .insert(schema.productType)
        .values({ name: "Spinner", slug: "spinner" })
        .returning();
      if (!maker || !productType || !legacy)
        throw new Error("Catalog fixtures missing.");
      const [product] = await db
        .insert(schema.product)
        .values({
          approvalStatus: "approved",
          makerId: maker.id,
          name: "Review spinner",
          productTypeId: productType.id,
          slug: "review-spinner",
        })
        .returning();
      if (!product) throw new Error("Product missing.");
      await db.insert(schema.productSpinner).values({ id: product.id });
      const [material] = await db
        .insert(schema.material)
        .values({ name: "Titanium", slug: "titanium" })
        .returning();
      if (!material) throw new Error("Material missing.");
      await db
        .insert(schema.productMaterial)
        .values({ productId: product.id, materialId: material.id });
      const [item] = await db
        .insert(schema.collectionItem)
        .values({
          collectionId: collection.id,
          ownerId: owner.id,
        })
        .returning();
      if (!item) throw new Error("Item missing.");
      await db
        .insert(schema.finishOption)
        .values({ collectionItemId: item.id, position: 0 });
      await db.insert(schema.collectionSpinner).values([
        { id: item.id, productSpinnerId: product.id },
        { id: legacy.id, productSpinnerId: product.id },
      ]);
      const services = createDbServices(
        db,
        createNoopLogger({ app: "test", environment: "test" }),
      );
      const ownerActor = { clerkId: owner.clerkId, role: "user" as const };
      const editorActor = { clerkId: editor.clerkId, role: "editor" as const };
      const stranger = { clerkId: "approval-stranger", role: "user" as const };
      const target = {
        collectionId: collection.id,
        collectionItemId: item.id,
        ownerUserId: owner.id,
      };
      const decision = {
        action: "approve" as const,
        actor: editorActor,
        collectionItemId: item.id,
        reason: " Ready ",
      };
      expect(item.approvalStatus).toBe("pending");
      expect(
        (await services.collections.getOwnedItem(ownerActor, legacy.id))
          ?.approvalStatus,
      ).toBe("approved");
      await expect(
        services.collections.getPublicItem(target),
      ).resolves.toBeNull();
      await expect(
        services.collections.getPublicItem({ ...target, viewer: stranger }),
      ).resolves.toBeNull();
      await expect(
        services.collections.getPublicItem({ ...target, viewer: ownerActor }),
      ).resolves.toMatchObject({
        approvalStatus: "pending",
        canEdit: true,
        canAdminister: false,
      });
      await expect(
        services.collections.getOwnedItem(editorActor, item.id),
      ).resolves.toMatchObject({
        approvalStatus: "pending",
        canAdminister: true,
      });
      expect(await services.collections.listOwned(ownerActor)).toHaveLength(2);
      expect(
        await services.collections.listCollectionItems(target),
      ).toHaveLength(1);
      expect(
        await services.collections.listCollectionItems({
          ...target,
          viewer: stranger,
        }),
      ).toHaveLength(1);
      expect(
        await services.collections.listCollectionItems({
          ...target,
          viewer: ownerActor,
        }),
      ).toHaveLength(2);
      expect(
        await services.collections.listCollectionItems({
          ...target,
          viewer: editorActor,
        }),
      ).toHaveLength(2);
      expect(
        await services.collections.listCollectionItems({
          ...target,
          ownerUserId: editor.id,
          viewer: editorActor,
        }),
      ).toEqual([]);
      expect(
        await services.collections.listProductItems(product.id),
      ).toHaveLength(1);
      expect(
        (await services.collections.getPublicCollection(target))?.itemCount,
      ).toBe(1);

      await services.collections.setCollectionVisibility({
        actor: ownerActor,
        collectionId: collection.id,
        isPrivate: true,
      });
      expect(await services.collections.listCollectionItems(target)).toEqual(
        [],
      );
      expect(
        await services.collections.listCollectionItems({
          ...target,
          viewer: ownerActor,
        }),
      ).toHaveLength(2);
      expect(
        await services.collections.listCollectionItems({
          ...target,
          viewer: editorActor,
        }),
      ).toHaveLength(2);
      await expect(
        services.collections.getPublicCollection(target),
      ).resolves.toBeNull();
      await services.collections.setCollectionVisibility({
        actor: ownerActor,
        collectionId: collection.id,
        isPrivate: false,
      });
      expect(
        (
          await services.collections.getPublicCollection({
            ...target,
            viewer: ownerActor,
          })
        )?.itemCount,
      ).toBe(2);
      const publicOwners = await services.collections.listOwners(editorActor);
      expect(publicOwners[0]?.items).toHaveLength(1);
      expect(publicOwners[0]?.collections[0]?.itemCount).toBe(1);

      for (const actor of [ownerActor, stranger]) {
        await expect(
          services.collections.decideItemApproval({ ...decision, actor }),
        ).rejects.toThrow("Collection item does not exist.");
      }
      for (const reason of [" ", "x".repeat(1001)]) {
        await expect(
          services.collections.decideItemApproval({ ...decision, reason }),
        ).rejects.toThrow("A decision reason is required.");
      }
      await expect(
        services.collections.decideItemApproval({
          ...decision,
          collectionItemId: 999999,
        }),
      ).rejects.toThrow("Collection item does not exist.");
      await expect(
        services.collections.decideItemApproval({
          ...decision,
          action: "reverse",
        }),
      ).rejects.toThrow("Approval transition is invalid.");
      expect(
        (
          await db
            .select()
            .from(schema.collectionItem)
            .where(eq(schema.collectionItem.id, item.id))
        )[0],
      ).toEqual(item);

      const concurrent = await Promise.allSettled([
        services.collections.decideItemApproval(decision),
        services.collections.decideItemApproval({
          ...decision,
          action: "reject",
        }),
      ]);
      expect(
        concurrent.filter(({ status }) => status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        concurrent.filter(({ status }) => status === "rejected"),
      ).toHaveLength(1);
      const [decided] = await db
        .select()
        .from(schema.collectionItem)
        .where(eq(schema.collectionItem.id, item.id));
      expect(decided).toMatchObject({
        approvalDecisionReason: "Ready",
        approvalDecidedAt: expect.any(Date),
        ownerId: owner.id,
        isPrivate: false,
      });
      if (!decided || decided.approvalStatus === "pending")
        throw new Error("Decision missing.");
      await expect(
        services.collections.decideItemApproval({
          ...decision,
          action: decided.approvalStatus === "approved" ? "reject" : "approve",
        }),
      ).rejects.toThrow("Approval transition is invalid.");
      expect(
        (
          await db
            .select()
            .from(schema.collectionItem)
            .where(eq(schema.collectionItem.id, item.id))
        )[0],
      ).toEqual(decided);
      await expect(
        services.collections.decideItemApproval({
          ...decision,
          action: "reverse",
          reason: "Needs another review",
        }),
      ).resolves.toBe("pending");
      await expect(
        services.collections.decideItemApproval({
          ...decision,
          action: "reject",
          reason: "Not suitable",
        }),
      ).resolves.toBe("rejected");
      await expect(
        services.collections.getPublicItem(target),
      ).resolves.toBeNull();
      expect(
        (await services.collections.getOwnedItem(ownerActor, item.id))
          ?.approvalStatus,
      ).toBe("rejected");
      await services.collections.updateItem({
        actor: ownerActor,
        collectionItemId: item.id,
        customFinish: null,
        finishOptionId: null,
        materialId: material.id,
        displayName: "Owner-edited spinner",
      });
      await expect(
        services.collections.getOwnedItem(ownerActor, item.id),
      ).resolves.toMatchObject({
        approvalStatus: "rejected",
        displayName: "Owner-edited spinner",
        canEdit: true,
      });
      await services.collections.setItemVisibility({
        actor: ownerActor,
        collectionItemId: item.id,
        isPrivate: false,
      });
      expect(
        (await services.collections.getOwnedItem(ownerActor, item.id))
          ?.approvalStatus,
      ).toBe("rejected");
      await expect(
        services.collections.decideItemApproval({
          ...decision,
          actor: ownerActor,
        }),
      ).rejects.toThrow("Collection item does not exist.");
      await services.collections.decideItemApproval({
        ...decision,
        action: "reverse",
      });
      await services.collections.decideItemApproval(decision);
      await expect(
        services.collections.getPublicItem(target),
      ).resolves.toMatchObject({ approvalStatus: "approved" });
      expect(
        await services.collections.listProductItems(product.id),
      ).toHaveLength(2);
      expect(
        (await services.collections.getPublicCollection(target))?.itemCount,
      ).toBe(2);
      await services.collections.setItemVisibility({
        actor: ownerActor,
        collectionItemId: item.id,
        isPrivate: true,
      });
      await expect(
        services.collections.getPublicItem(target),
      ).resolves.toBeNull();
      expect(
        (await services.collections.getOwnedItem(ownerActor, item.id))
          ?.approvalStatus,
      ).toBe("approved");
      expect(
        (await services.collections.getPublicCollection(target))?.itemCount,
      ).toBe(1);

      await expect(
        db
          .update(schema.collectionItem)
          .set({ approvalDecisionReason: " " })
          .where(eq(schema.collectionItem.id, item.id)),
      ).rejects.toThrow();
      await expect(
        db
          .update(schema.collectionItem)
          .set({ approvalDecidedAt: null })
          .where(eq(schema.collectionItem.id, item.id)),
      ).rejects.toThrow();
      await expect(
        client.exec(
          `UPDATE collection_item SET approval_status = 'invalid' WHERE id = ${item.id}`,
        ),
      ).rejects.toThrow();
    } finally {
      await client.close();
    }
  }, 60_000);
});

/**
 * Applies one repository SQL migration to the isolated test database.
 *
 * @param client - Isolated PostgreSQL client.
 * @param folder - Repository migration directory.
 * @param file - SQL migration filename.
 * @returns Completion after executing the migration.
 * @rejects When migration SQL cannot be read or applied.
 */
async function runMigration(client: PGlite, folder: string, file: string) {
  await client.exec(
    readFileSync(join(folder, file), "utf8").replaceAll(
      "--> statement-breakpoint",
      "",
    ),
  );
}
