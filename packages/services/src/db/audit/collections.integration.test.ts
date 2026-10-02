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

describe("collection audit adoption", () => {
  it("records owner and staff writes, requires staff reasons, and redacts owners", async () => {
    const client = new PGlite();
    await migrate(client);
    const db = drizzle(client, { schema }) as unknown as Database;
    const services = createDbServices(
      db,
      createNoopLogger({ app: "test", environment: "test" }),
    );

    try {
      const [owner, admin] = await db
        .insert(schema.user)
        .values([
          { clerkId: "collection_owner", username: "Owner" },
          { clerkId: "collection_admin", username: "Admin" },
        ])
        .returning();
      if (!owner || !admin) throw new Error("Audit users were not created.");

      const collection = await services.collections.createCollection({
        actor: { clerkId: owner.clerkId, role: "user" },
        description: "Original",
        isPrivate: false,
        name: "Collection",
        summary: "Original summary",
      });
      expect(collection).toEqual(
        expect.objectContaining({
          description: "Original",
          summary: "Original summary",
        }),
      );
      await expect(
        services.collections.updateCollection({
          actor: { clerkId: admin.clerkId, role: "admin" },
          collectionId: collection.id,
          description: "Must roll back",
          isPrivate: false,
          name: "Changed",
          summary: "Must roll back",
        }),
      ).rejects.toThrow(/reason/i);

      const [unchanged] = await db
        .select({ name: schema.userCollection.name })
        .from(schema.userCollection)
        .where(eq(schema.userCollection.id, collection.id));
      expect(unchanged?.name).toBe("Collection");

      const updated = await services.collections.updateCollection({
        actor: { clerkId: admin.clerkId, role: "admin" },
        collectionId: collection.id,
        description: "Reviewed",
        isPrivate: false,
        name: "Changed",
        reason: "Owner requested help",
        summary: "Reviewed summary",
      });
      expect(updated).toEqual(
        expect.objectContaining({
          description: "Reviewed",
          summary: "Reviewed summary",
        }),
      );

      const events = await db
        .select()
        .from(schema.auditEvent)
        .where(eq(schema.auditEvent.targetId, String(collection.id)));
      expect(events).toEqual([
        expect.objectContaining({
          action: "collections.collection.created",
          actorUserId: owner.id,
          authorizationType: "owner",
          ownerUserId: owner.id,
        }),
        expect.objectContaining({
          action: "collections.collection.updated",
          actorUserId: admin.id,
          authorizationType: "permission",
          permission: "collections.manage",
          reason: "Owner requested help",
        }),
      ]);
      const updatedEvent = events[1];
      if (!updatedEvent)
        throw new Error("Updated audit event was not recorded.");

      await db.transaction(
        async (tx) => await services.audit.redactAccount(tx, admin.id),
      );
      const [actorRedacted] = await db
        .select()
        .from(schema.auditEvent)
        .where(eq(schema.auditEvent.id, updatedEvent.id));
      expect(actorRedacted).toEqual(
        expect.objectContaining({
          actorUserId: null,
          afterState: expect.objectContaining({ name: "Changed" }),
          ownerUserId: owner.id,
        }),
      );

      await db.transaction(
        async (tx) => await services.audit.redactAccount(tx, owner.id),
      );
      const [ownerRedacted] = await db
        .select()
        .from(schema.auditEvent)
        .where(eq(schema.auditEvent.id, updatedEvent.id));
      expect(ownerRedacted).toEqual(
        expect.objectContaining({
          afterState: null,
          metadata: { redacted: true },
          ownerUserId: null,
        }),
      );
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
