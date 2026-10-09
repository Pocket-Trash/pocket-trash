import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createNoopLogger } from "@package/logger";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { createDbServices } from "../index.js";

describe("product audit adoption", () => {
  it("records product administration and rolls back staff edits without reasons", async () => {
    const client = new PGlite();
    await migrate(client);
    const db = drizzle({
      client: client,
      relations: schema.relations,
    }) as unknown as Database;
    const services = createDbServices(
      db,
      createNoopLogger({ app: "test", environment: "test" }),
    );

    try {
      const [owner, admin] = await db
        .insert(schema.user)
        .values([
          { clerkId: "product_owner", username: "Owner" },
          { clerkId: "product_admin", username: "Admin" },
        ])
        .returning();
      const [productType, finish, material] = await Promise.all([
        db
          .insert(schema.productType)
          .values({ name: "Spinner", slug: "spinner" })
          .returning()
          .then(([row]) => row),
        db
          .insert(schema.finish)
          .values({ name: "Stonewashed", slug: "stonewashed" })
          .returning()
          .then(([row]) => row),
        db
          .insert(schema.material)
          .values({ name: "Titanium", slug: "titanium" })
          .returning()
          .then(([row]) => row),
      ]);
      if (!owner || !admin || !productType || !finish || !material) {
        throw new Error("Product audit fixtures were not created.");
      }

      const maker = await services.catalog.createMaker({
        actor: { clerkId: admin.clerkId, role: "admin" },
        name: "Maker",
        rootUrl: null,
      });
      const product = await services.catalog.createProduct({
        actor: { clerkId: owner.clerkId, role: "user" },
        finishOptions: [
          {
            colorEffectId: null,
            colorIds: [],
            finishIds: [finish.id],
          },
        ],
        makerId: maker.id,
        materialIds: [material.id],
        name: "Original",
        productTypeSlug: "spinner",
        slug: "original",
        specs: {},
      });
      const adminEdit = {
        actor: { clerkId: admin.clerkId, role: "admin" } as const,
        finishOptions: [
          {
            colorEffectId: null,
            colorIds: [],
            finishIds: [finish.id],
          },
        ],
        makerId: maker.id,
        materialIds: [material.id],
        name: "Changed",
        productId: product.id,
        productTypeSlug: "spinner" as const,
        slug: "changed",
        specs: {},
      };

      await expect(services.catalog.updateProduct(adminEdit)).rejects.toThrow(
        /reason/i,
      );
      const [unchanged] = await db
        .select({ name: schema.product.name })
        .from(schema.product)
        .where(eq(schema.product.id, product.id));
      expect(unchanged?.name).toBe("Original");

      await services.catalog.updateProduct({
        ...adminEdit,
        reason: "Owner requested help",
      });
      const events = await db
        .select()
        .from(schema.auditEvent)
        .orderBy(schema.auditEvent.id);
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: "products.maker.created",
            actorUserId: admin.id,
            authorizationType: "permission",
            permission: "products.manage",
          }),
          expect.objectContaining({
            action: "products.product.created",
            actorUserId: owner.id,
            authorizationType: "owner",
            ownerUserId: owner.id,
          }),
          expect.objectContaining({
            action: "products.product.updated",
            actorUserId: admin.id,
            authorizationType: "permission",
            ownerUserId: owner.id,
            permission: "products.manage",
            reason: "Owner requested help",
          }),
        ]),
      );
    } finally {
      await client.close();
    }
  }, 30_000);

  it("audits reusable slider magnet preset CRUD", async () => {
    const client = new PGlite();
    await migrate(client);
    const db = drizzle({
      client: client,
      relations: schema.relations,
    }) as unknown as Database;
    const services = createDbServices(
      db,
      createNoopLogger({ app: "test", environment: "test" }),
    );
    try {
      const [admin] = await db
        .insert(schema.user)
        .values({ clerkId: "preset_admin", username: "Preset admin" })
        .returning();
      if (!admin) throw new Error("Preset administrator fixture is required.");
      const actor = { clerkId: admin.clerkId, role: "admin" as const };
      const created = await services.catalog.createSliderMagnetPreset({
        actor,
        configuration: {
          sideA: ["N52", "N52", "N52", "N52"],
          sideB: null,
        },
        magnetLayout: "2x2",
        name: "Compact strong",
      });
      const updated = await services.catalog.updateSliderMagnetPreset({
        actor,
        configuration: {
          sideA: ["N48", "N48", "N48", "N48"],
          sideB: null,
        },
        magnetLayout: "2x2",
        name: "Compact medium",
        presetId: created.id,
      });
      expect(updated.name).toBe("Compact medium");
      expect(await services.catalog.listSliderMagnetPresets()).toContainEqual(
        updated,
      );
      await services.catalog.deleteSliderMagnetPreset({
        actor,
        presetId: created.id,
      });
      expect(
        await db
          .select({ action: schema.auditEvent.action })
          .from(schema.auditEvent)
          .where(eq(schema.auditEvent.actorUserId, admin.id))
          .orderBy(schema.auditEvent.id),
      ).toEqual([
        { action: "products.slider_magnet_preset.created" },
        { action: "products.slider_magnet_preset.updated" },
        { action: "products.slider_magnet_preset.deleted" },
      ]);
    } finally {
      await client.close();
    }
  }, 30_000);
});

/**
 * Applies repository migrations to an in-memory test database.
 *
 * @param client - PGlite test database.
 * @rejects When a migration cannot be read or executed.
 */
async function migrate(client: PGlite) {
  const migrationsFolder = fileURLToPath(
    new URL("../../../../database/drizzle", import.meta.url),
  );
  await migratePglite(drizzle({ client: client }), {
    migrationsFolder: migrationsFolder,
  });
}
