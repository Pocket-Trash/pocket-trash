import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createLogger } from "@package/logger";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import {
  type AuditEventDefinition,
  AuditEventValidationError,
  AuditExportInProgressError,
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
    const service = createAuditService(
      createLogger({
        app: "test",
        environment: "test",
        transports: [{ log() {} }],
      }),
      [profileUpdated, largeEvent],
    );
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
        db.transaction(
          async (tx) =>
            await service.write(tx, {
              actor: { role: "system", userId: null, username: "Fake user" },
              authorization: { type: "system" },
              data: { name: "Visible", secret: "must-not-be-stored" },
              definition: profileUpdated,
              occurredAt,
              targetId: "system-transition",
            }),
        ),
      ).rejects.toBeInstanceOf(AuditEventValidationError);

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

      await db.insert(schema.auditEvent).values({
        action: "test.unknown",
        actorRole: "user",
        actorUserId: actor.id,
        actorUsername: "Ada",
        authorizationType: "owner",
        metadata: { private: "Ada" },
        occurredAt,
        targetId: "unknown",
        targetType: "test.profile",
      });
      await expect(
        db.transaction(async (tx) => await service.redactAccount(tx, actor.id)),
      ).rejects.toBeInstanceOf(AuditEventValidationError);
    } finally {
      await client.close();
    }
  }, 30_000);

  it("authorizes, filters, and keyset-paginates audit events", async () => {
    const client = new PGlite();
    await migrate(client);
    const db = drizzle(client, { schema }) as unknown as Database;
    const service = createAuditService(
      createLogger({
        app: "test",
        environment: "test",
        transports: [{ log() {} }],
      }),
      [profileUpdated, largeEvent],
      db,
    );

    try {
      const [actor] = await db
        .insert(schema.user)
        .values({ clerkId: "audit_reader", username: "Ada" })
        .returning();
      if (!actor) throw new Error("Audit user was not created.");
      const startedAt = new Date("2026-09-01T00:00:00.000Z");
      await db.insert(schema.auditEvent).values(
        Array.from({ length: 51 }, (_, index) => ({
          action: "test.profile_updated",
          afterState: { index },
          actorRole: "admin" as const,
          actorUserId: actor.id,
          actorUsername: actor.username,
          authorizationType: "permission" as const,
          occurredAt: new Date(startedAt.getTime() + index * 1_000),
          permission: "audit.read" as const,
          recordedAt: new Date(startedAt.getTime() + index * 1_000),
          targetId: `profile-${index}`,
          targetType: "test.profile",
        })),
      );

      await expect(
        service.list({ actor: { clerkId: "user", role: "user" } }),
      ).rejects.toThrow("Audit events do not exist.");

      const input = {
        action: "test.profile_updated",
        actor: { clerkId: "admin", role: "admin" as const },
        actorUserId: actor.id,
        recordedFrom: startedAt,
        targetType: "test.profile",
      };
      const first = await service.list(input);
      expect(first).toMatchObject({
        coverageStartAt: startedAt,
        coveredDomains: ["audit", "test"],
      });
      expect(first.items).toHaveLength(50);
      expect(first.items[0]?.targetId).toBe("profile-50");
      expect(first.nextCursor).toEqual({
        id: first.items[49]?.id,
        recordedAt: first.items[49]?.recordedAt,
      });
      if (!first.nextCursor) throw new Error("Next cursor is missing.");

      const second = await service.list({
        ...input,
        cursor: first.nextCursor,
      });
      expect(second.items.map(({ targetId }) => targetId)).toEqual([
        "profile-0",
      ]);
      expect(second.nextCursor).toBeNull();
    } finally {
      await client.close();
    }
  }, 30_000);

  it("streams bounded exports, records completion, and redacts the ledger actor", async () => {
    const client = new PGlite();
    await migrate(client);
    const db = drizzle(client, { schema }) as unknown as Database;
    const service = createAuditService(
      createLogger({
        app: "test",
        environment: "test",
        transports: [{ log() {} }],
      }),
      [profileUpdated, largeEvent],
      db,
    );

    try {
      const [actor] = await db
        .insert(schema.user)
        .values({ clerkId: "audit_exporter", username: "Ada" })
        .returning();
      if (!actor) throw new Error("Audit user was not created.");
      const now = Date.now();
      const old = new Date(now - 61 * 24 * 60 * 60 * 1000);
      for (let start = 0; start < 10_001; start += 500) {
        await db.insert(schema.auditEvent).values(
          Array.from({ length: Math.min(500, 10_001 - start) }, (_, offset) => {
            const index = start + offset;
            return {
              action: "test.profile_updated",
              afterState: { index },
              actorRole: "admin" as const,
              actorUserId: actor.id,
              actorUsername: actor.username,
              authorizationType: "permission" as const,
              occurredAt: new Date(old.getTime() + index * 1_000),
              permission: "audit.read" as const,
              recordedAt: new Date(old.getTime() + index * 1_000),
              targetId: `profile-${index}`,
              targetType: "test.profile",
            };
          }),
        );
      }
      await db.insert(schema.auditEvent).values({
        action: "test.profile_updated",
        afterState: { recent: true },
        actorRole: "admin",
        actorUserId: actor.id,
        actorUsername: actor.username,
        authorizationType: "permission",
        occurredAt: new Date(now - 24 * 60 * 60 * 1000),
        permission: "audit.read",
        recordedAt: new Date(now - 24 * 60 * 60 * 1000),
        targetId: "recent",
        targetType: "test.profile",
      });
      const exportActor = {
        clerkId: actor.clerkId,
        role: "admin" as const,
      };

      await expect(
        service.createExport({
          actor: { clerkId: "user", role: "user" },
          reason: "Incident review",
        }),
      ).rejects.toThrow("Audit export does not exist.");
      const created = await service.createExport({
        actor: exportActor,
        reason: "Incident review",
      });
      expect(created).toMatchObject({
        completedAt: null,
        eventCount: 10_000,
        reason: "Incident review",
        sha256: null,
      });
      await expect(
        service.createExport({
          actor: exportActor,
          reason: "Another export",
        }),
      ).rejects.toBeInstanceOf(AuditExportInProgressError);

      const canceled = await service.downloadExport({
        actor: exportActor,
        exportId: created.id,
      });
      const canceledReader = canceled.body.getReader();
      await canceledReader.read();
      await canceledReader.cancel();
      await expect(service.getActiveExport(exportActor)).resolves.toMatchObject(
        {
          completedAt: null,
          sha256: null,
        },
      );

      const download = await service.downloadExport({
        actor: exportActor,
        exportId: created.id,
      });
      const json = await new Response(download.body).text();
      const parsed = JSON.parse(json) as {
        events: Array<{ targetId: string }>;
        export: { count: number; id: string };
      };
      expect(parsed.export).toEqual({
        count: 10_000,
        createdAt: expect.any(String),
        cutoffAt: created.cutoffAt.toISOString(),
        highWaterEventId: expect.any(Number),
        id: created.id,
      });
      expect(parsed.events).toHaveLength(10_000);
      expect(parsed.events[0]?.targetId).toBe("profile-0");
      expect(parsed.events.at(-1)?.targetId).toBe("profile-9999");
      expect(
        parsed.events.some(({ targetId }) => targetId === "profile-10000"),
      ).toBe(false);
      expect(parsed.events.some(({ targetId }) => targetId === "recent")).toBe(
        false,
      );

      const active = await service.getActiveExport(exportActor);
      expect(active).toMatchObject({
        completedAt: expect.any(Date),
        sha256: createHash("sha256").update(json).digest("hex"),
      });
      const repeat = await service.downloadExport({
        actor: exportActor,
        exportId: created.id,
      });
      await expect(new Response(repeat.body).text()).resolves.toBe(json);
      await expect(
        db
          .select()
          .from(schema.auditEvent)
          .where(eq(schema.auditEvent.action, "audit.export.completed")),
      ).resolves.toHaveLength(2);

      await db.transaction(
        async (transaction) =>
          await service.redactAccount(transaction, actor.id),
      );
      await expect(
        db
          .select()
          .from(schema.auditExport)
          .where(eq(schema.auditExport.id, created.id)),
      ).resolves.toEqual([
        expect.objectContaining({
          reason: "[erased]",
          requestedByUserId: null,
          requestedByUsername: "Deleted user",
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
