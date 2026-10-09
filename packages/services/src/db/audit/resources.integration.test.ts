import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createNoopLogger } from "@package/logger";
import { createUploadStorage } from "@package/storage";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { createResourcesService } from "../../resources/index.js";
import { createDbServices } from "../index.js";

describe("resource audit adoption", () => {
  it("audits resource mutations and rolls back staff writes without reasons", async () => {
    const client = new PGlite();
    await migrate(client);
    const db = drizzle({
      client: client,
      relations: schema.relations,
    }) as unknown as Database;
    const logger = createNoopLogger({ app: "test", environment: "test" });
    const services = createDbServices(db, logger);
    const storage = createUploadStorage({
      accessKey: "key",
      cdnBaseUrl: "https://cdn.test",
      endpoint: "https://storage.test",
      /**
       * Accepts a fake object upload.
       *
       * @returns A successful fake storage response.
       */
      fetch: async () => new Response(null, { status: 201 }),
      folderPrefix: "resources/dev",
      imageFolderPrefix: "images/dev",
      zoneName: "zone",
    });
    const resources = createResourcesService(
      db,
      storage,
      logger,
      async (path) => `https://cdn.test/${path}`,
      services.audit,
    );

    try {
      const [owner, admin, systemAdmin] = await db
        .insert(schema.user)
        .values([
          { clerkId: "resource_owner", username: "Owner" },
          { clerkId: "resource_admin", username: "Admin" },
          { clerkId: "resource_system_admin", username: "System Admin" },
        ])
        .returning();
      if (!owner || !admin || !systemAdmin) {
        throw new Error("Resource audit fixtures were not created.");
      }
      const ownerActor = { clerkId: owner.clerkId, role: "user" } as const;
      const adminActor = { clerkId: admin.clerkId, role: "admin" } as const;
      const created = await resources.create({
        actor: ownerActor,
        categories: ["Tools"],
        description: "Original description",
        files: [file("model.pdf", "application/pdf", "%PDF-1.7")],
        images: [
          {
            bytes: Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=",
              "base64",
            ),
            contentType: "image/png",
            fileName: "cover.png",
          },
        ],
        name: "Original resource",
      });

      await expect(
        resources.addVersion({
          actor: adminActor,
          files: [file("model-v2.pdf", "application/pdf", "%PDF-1.7 v2")],
          resourceId: created.id,
        }),
      ).rejects.toThrow(/reason/i);
      await resources.addVersion({
        actor: adminActor,
        files: [file("model-v2.pdf", "application/pdf", "%PDF-1.7 v2")],
        reason: "Owner requested help",
        resourceId: created.id,
      });

      const [image] = await db
        .select({ id: schema.resourceImages.id })
        .from(schema.resourceImages)
        .where(eq(schema.resourceImages.resourceId, created.id));
      if (!image) throw new Error("Resource image fixture was not created.");
      const adminEdit = {
        actor: adminActor,
        categories: ["Tools"],
        description: "Changed description",
        images: [],
        name: "Changed resource",
        resourceId: created.id,
        retainedImageIds: [image.id],
      };
      await expect(resources.update(adminEdit)).rejects.toThrow(/reason/i);
      const [unchanged] = await db
        .select({ name: schema.resources.name })
        .from(schema.resources)
        .where(eq(schema.resources.id, created.id));
      expect(unchanged?.name).toBe("Original resource");
      await resources.update({ ...adminEdit, reason: "Owner requested help" });
      await resources.markPrivate({
        actor: adminActor,
        reason: "Needs review",
        resourceId: created.id,
      });
      await resources.setVisibility({
        actor: adminActor,
        isPublic: true,
        reason: "Review completed",
        resourceId: created.id,
      });
      await resources.softDelete({
        actor: adminActor,
        reason: "Owner requested help",
        resourceId: created.id,
      });
      await resources.restore({
        actor: adminActor,
        reason: "Owner requested help",
        resourceId: created.id,
      });
      await resources.softDelete({ actor: ownerActor, resourceId: created.id });
      await resources.permanentlyDelete({
        actor: { clerkId: systemAdmin.clerkId, role: "system_admin" },
        reason: "Expired retention period",
        resourceId: created.id,
      });

      const events = await db
        .select()
        .from(schema.auditEvent)
        .orderBy(schema.auditEvent.id);
      expect(events.map(({ action }) => action)).toEqual([
        "resources.resource.created",
        "resources.version.added",
        "resources.resource.updated",
        "resources.resource.visibility_changed",
        "resources.resource.visibility_changed",
        "resources.resource.soft_deleted",
        "resources.resource.restored",
        "resources.resource.soft_deleted",
        "resources.resource.purged",
      ]);
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actorUserId: owner.id,
            authorizationType: "owner",
            ownerUserId: owner.id,
          }),
          expect.objectContaining({
            actorUserId: admin.id,
            authorizationType: "permission",
            permission: "resources.manage",
            reason: "Owner requested help",
          }),
          expect.objectContaining({
            actorUserId: systemAdmin.id,
            authorizationType: "permission",
            permission: "resources.purge",
            reason: "Expired retention period",
          }),
        ]),
      );

      await db.transaction(async (transaction) => {
        await services.audit.redactAccount(transaction, owner.id);
      });
      const redacted = await db
        .select({ after: schema.auditEvent.afterState })
        .from(schema.auditEvent)
        .where(eq(schema.auditEvent.ownerUserId, owner.id));
      expect(redacted.every(({ after }) => after === null)).toBe(true);
    } finally {
      await client.close();
    }
  }, 30_000);
});

/**
 * Creates a small upload fixture.
 *
 * @param fileName - Fixture file name.
 * @param contentType - Fixture media type.
 * @param value - Fixture contents.
 * @returns Upload input.
 */
function file(fileName: string, contentType: string, value: string) {
  return {
    bytes: new TextEncoder().encode(value),
    contentType,
    fileName,
  };
}

/**
 * Applies repository migrations to PGlite.
 *
 * @param client - PGlite client.
 * @returns Completion after all migrations run.
 * @rejects When a migration cannot be discovered, read, or executed.
 */
async function migrate(client: PGlite) {
  const migrationsFolder = fileURLToPath(
    new URL("../../../../database/drizzle", import.meta.url),
  );
  await migratePglite(drizzle({ client: client }), {
    migrationsFolder: migrationsFolder,
  });
}
