import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import {
  type AuditEventDefinition,
  AuditPayloadTooLargeError,
  createAuditService,
} from "./index.js";

const profileUpdated = {
  action: "test.profile_updated",
  targetType: "test.profile",
  serialize: (input: { name: string; secret: string }) => ({
    after: { name: input.name },
  }),
  redact: () => ({ metadata: { redacted: true } }),
} satisfies AuditEventDefinition<{ name: string; secret: string }>;

const largeEvent = {
  action: "test.large_event",
  targetType: "test.payload",
  serialize: (input: { value: string }) => ({
    metadata: { value: input.value },
  }),
  redact: () => ({ metadata: { redacted: true } }),
} satisfies AuditEventDefinition<{ value: string }>;

describe("audit service", () => {
  it("writes in the caller transaction, enforces payload limits, and redacts erasures", async () => {
    const client = new PGlite();
    await migrate(client);
    const db = drizzle(client, { schema }) as unknown as Database;
    const service = createAuditService([profileUpdated, largeEvent]);
    const occurredAt = new Date("2026-09-30T16:00:00.000Z");

    try {
      const [actor, owner] = await db
        .insert(schema.user)
        .values([
          { clerkId: "audit_actor", username: "Ada" },
          { clerkId: "audit_owner", username: "Grace" },
        ])
        .returning();
      if (!actor || !owner) throw new Error("Audit users were not created.");

      const event = await db.transaction(
        async (tx) =>
          await service.write(tx, {
            actor: {
              role: "admin",
              userId: actor.id,
              username: actor.username,
            },
            authorization: {
              permission: "users.manage",
              type: "permission",
            },
            data: { name: "Visible", secret: "must-not-be-stored" },
            definition: profileUpdated,
            occurredAt,
            ownerUserId: owner.id,
            reason: "Investigating abuse",
            requestId: "request-123",
            targetId: "profile-123",
          }),
      );

      expect(event).toMatchObject({
        action: "test.profile_updated",
        actorRole: "admin",
        actorUserId: actor.id,
        actorUsername: "Ada",
        afterState: { name: "Visible" },
        authorizationType: "permission",
        beforeState: null,
        metadata: null,
        occurredAt,
        ownerUserId: owner.id,
        permission: "users.manage",
        reason: "Investigating abuse",
        targetId: "profile-123",
        targetType: "test.profile",
      });
      expect(JSON.stringify(event)).not.toContain("must-not-be-stored");

      await expect(
        db.transaction(async (tx) => {
          await tx.insert(schema.user).values({ clerkId: "rolled_back" });
          await service.write(tx, {
            actor: {
              role: "admin",
              userId: actor.id,
              username: actor.username,
            },
            authorization: { type: "owner" },
            data: { value: "x".repeat(256 * 1024) },
            definition: largeEvent,
            occurredAt,
            ownerUserId: actor.id,
            targetId: "large",
          });
        }),
      ).rejects.toBeInstanceOf(AuditPayloadTooLargeError);
      await expect(
        db
          .select()
          .from(schema.user)
          .where(eq(schema.user.clerkId, "rolled_back")),
      ).resolves.toEqual([]);

      await expect(
        db
          .update(schema.auditEvent)
          .set({ reason: "changed" })
          .where(eq(schema.auditEvent.id, event.id)),
      ).rejects.toThrow();
      await expect(
        db.delete(schema.auditEvent).where(eq(schema.auditEvent.id, event.id)),
      ).rejects.toThrow();

      await db.transaction(
        async (tx) => await service.redactAccount(tx, actor.id),
      );
      await db.transaction(
        async (tx) => await service.redactAccount(tx, owner.id),
      );
      await expect(
        db
          .select()
          .from(schema.auditEvent)
          .where(eq(schema.auditEvent.id, event.id)),
      ).resolves.toEqual([
        expect.objectContaining({
          actorUserId: null,
          actorUsername: "Deleted user",
          afterState: null,
          beforeState: null,
          metadata: { redacted: true },
          ownerUserId: null,
          reason: "[erased]",
        }),
      ]);
    } finally {
      await client.close();
    }
  }, 30_000);
});

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
