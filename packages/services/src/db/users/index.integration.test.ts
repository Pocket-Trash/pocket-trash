import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createLogger } from "@package/logger";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it, vi } from "vitest";
import { type AuditService, createAuditService } from "../audit/index.js";
import { userBanAudit, userBanAuditEvents } from "../audit/users.js";
import { createUsersService, UserBanStateError } from "./index.js";

describe("user ban management", () => {
  it("authorizes transitions, preserves pending work, and edits ban reasons", async () => {
    const client = new PGlite();
    await migrate(client);
    const db = drizzle(client, { schema }) as unknown as Database;
    const logger = createLogger({
      app: "test",
      environment: "test",
      level: "error",
      transports: [],
    });
    const audit = createAuditService(logger, userBanAuditEvents, db);
    const service = createUsersService(db, logger, audit);
    const actor = { clerkId: "admin_123", role: "admin" as const };
    const provider =
      vi.fn<(clerkId: string, banned: boolean) => Promise<void>>();

    try {
      await expect(
        service.setBanState(
          {
            actor: { clerkId: "user_123", role: "user" },
            banned: true,
            reason: "Abuse",
            targetClerkId: "user_target",
          },
          provider,
        ),
      ).rejects.toBeInstanceOf(UserBanStateError);

      provider.mockRejectedValueOnce(new Error("raw provider secret"));
      await expect(
        service.setBanState(
          {
            actor,
            banned: true,
            reason: " Abuse reports ",
            targetClerkId: " user_target ",
          },
          provider,
        ),
      ).rejects.toThrow("raw provider secret");
      await expect(service.getBanState("user_target")).resolves.toMatchObject({
        reason: "Abuse reports",
        status: "pending_ban",
      });

      provider.mockResolvedValue(undefined);
      await expect(
        service.setBanState(
          {
            actor,
            banned: true,
            reason: "Abuse reports",
            targetClerkId: "user_target",
          },
          provider,
        ),
      ).resolves.toMatchObject({ status: "banned" });

      await expect(
        service.setBanState(
          {
            actor,
            banned: true,
            reason: "Updated evidence",
            targetClerkId: "user_target",
          },
          provider,
        ),
      ).resolves.toMatchObject({
        reason: "Updated evidence",
        status: "banned",
      });
      expect(provider).toHaveBeenCalledTimes(3);

      provider.mockRejectedValueOnce(new Error("timeout"));
      await expect(
        service.setBanState(
          {
            actor,
            banned: false,
            reason: "Appeal accepted",
            targetClerkId: "user_target",
          },
          provider,
        ),
      ).rejects.toThrow("timeout");
      await expect(
        service.setBanState(
          {
            actor,
            banned: true,
            reason: "Conflicting decision",
            targetClerkId: "user_target",
          },
          provider,
        ),
      ).rejects.toBeInstanceOf(UserBanStateError);
      await expect(
        service.setBanState(
          {
            actor,
            banned: false,
            reason: "Appeal accepted",
            targetClerkId: "user_target",
          },
          provider,
        ),
      ).resolves.toMatchObject({ status: "unbanned" });

      const events = await db
        .select()
        .from(schema.auditEvent)
        .orderBy(schema.auditEvent.id);
      expect(events.map(({ action }) => action)).toEqual([
        "user.banned",
        "user.ban_updated",
        "user.unbanned",
      ]);
      expect(events[0]).toMatchObject({
        actorRole: "admin",
        authorizationType: "permission",
        beforeState: { banned: false, status: "unmanaged" },
        afterState: { banned: true, status: "banned" },
        permission: "users.manage",
        reason: "Abuse reports",
      });

      const failedWriteAudit = {
        ...audit,
        write: vi.fn(async () => {
          throw new Error("temporary audit failure with private context");
        }),
      } as AuditService;
      const fallbackService = createUsersService(db, logger, failedWriteAudit);
      await expect(
        fallbackService.setBanState(
          {
            actor,
            banned: true,
            reason: "Repeat abuse",
            targetClerkId: "user_target",
          },
          provider,
        ),
      ).resolves.toMatchObject({ status: "banned" });
      expect(await db.select().from(schema.auditDelivery)).toHaveLength(1);
      await expect(audit.processDue()).resolves.toBe(true);
      await expect(audit.processDue()).resolves.toBe(false);

      const [actorUser] = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.clerkId, actor.clerkId));
      const [targetUser] = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.clerkId, "user_target"));
      if (!actorUser || !targetUser) throw new Error("Missing audit users.");
      await db.transaction(async (transaction) => {
        await audit.enqueue(transaction, "terminal-delivery", {
          actor: {
            role: actor.role,
            userId: actorUser.id,
            username: actorUser.username,
          },
          authorization: { permission: "users.manage", type: "permission" },
          data: {
            after: { banned: true, status: "banned" },
            before: { banned: true, status: "banned" },
          },
          definition: userBanAudit.banUpdated,
          occurredAt: new Date("2026-10-01T12:00:00.000Z"),
          ownerUserId: targetUser.id,
          reason: "Safe reason",
          requestId: "request-123",
          targetId: String(targetUser.id),
        });
      });
      const [queued] = await db
        .select()
        .from(schema.auditDelivery)
        .where(eq(schema.auditDelivery.deliveryKey, "terminal-delivery"));
      if (!queued) throw new Error("Missing queued audit delivery.");
      await db
        .update(schema.auditDelivery)
        .set({ payload: { ...queued.payload, actorRole: "invalid" } })
        .where(eq(schema.auditDelivery.deliveryKey, queued.deliveryKey));
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const now = new Date(`2026-10-01T12:0${attempt}:00.000Z`);
        await db
          .update(schema.auditDelivery)
          .set({ nextAttemptAt: now })
          .where(eq(schema.auditDelivery.deliveryKey, queued.deliveryKey));
        await expect(audit.processDue(now)).resolves.toBe(true);
      }
      await expect(audit.listDeliveryFailures(actor)).resolves.toEqual([
        {
          action: "user.ban_updated",
          attempts: 5,
          correlationId: null,
          errorCode: "audit_delivery_failed",
          requestId: "request-123",
          targetId: String(targetUser.id),
        },
      ]);
      await expect(
        audit.listDeliveryFailures({ clerkId: "user_123", role: "user" }),
      ).rejects.toThrow("Audit events do not exist.");

      await db.transaction(async (transaction) => {
        await audit.redactAccount(transaction, targetUser.id);
      });
      const [redactedDelivery] = await db
        .select()
        .from(schema.auditDelivery)
        .where(eq(schema.auditDelivery.deliveryKey, queued.deliveryKey));
      expect(redactedDelivery?.payload).toMatchObject({
        metadata: { redacted: true },
        ownerUserId: null,
        reason: "[erased]",
      });
    } finally {
      await client.close();
    }
  }, 30_000);
});

/**
 * Applies repository SQL migrations to an isolated PGlite database.
 *
 * @param client - Isolated database client.
 * @returns Completion after every migration is applied.
 */
async function migrate(client: PGlite): Promise<void> {
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
