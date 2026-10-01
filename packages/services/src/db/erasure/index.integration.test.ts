import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import {
  createLogger,
  type LogEvent,
  type LogTransport,
  loggerMessages,
} from "@package/logger";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it, vi } from "vitest";
import {
  AccountErasureInProgressError,
  createErasureService,
  createErasureSubjectHmac,
  ErasureOperationError,
  type ErasureOperations,
} from "./index.js";

describe("complete erasure service", () => {
  it("deduplicates, resumes fixed steps, and completes only after verification", async () => {
    const client = new PGlite();
    await migrate(client);
    const db = drizzle(client, { schema }) as unknown as Database;
    const events: LogEvent[] = [];
    let currentTime = new Date("2026-09-29T12:00:00.000Z");
    const service = createErasureService(
      db,
      captureLogger(events),
      () => currentTime,
    );
    const clerkId = "user_private_subject";
    const subjectHmac = await createErasureSubjectHmac(
      clerkId,
      "test-erasure-hmac-secret-at-least-32-characters",
    );
    const actor = { clerkId, role: "user" as const };

    try {
      await db.insert(schema.user).values({ clerkId, username: "private" });
      const first = await service.create({
        actor,
        initiator: "self",
        subjectHmac,
        targetClerkId: clerkId,
        verificationMethod: "clerk_reverification",
        verifiedAt: currentTime,
      });
      const duplicate = await service.create({
        actor,
        initiator: "self",
        subjectHmac,
        targetClerkId: clerkId,
        verificationMethod: "clerk_reverification",
        verifiedAt: currentTime,
      });
      expect(duplicate.id).toBe(first.id);
      expect(JSON.stringify(first)).not.toContain(clerkId);
      await expect(service.assertAccountActive(clerkId)).rejects.toBeInstanceOf(
        AccountErasureInProgressError,
      );

      let failSnapshot = true;
      const order: string[] = [];
      const operations = Object.fromEntries(
        [
          "snapshot",
          "inaccessible",
          "storage",
          "database",
          "providers",
          "verify",
        ].map((step) => [
          step,
          vi.fn(
            async ({
              targetClerkId,
            }: {
              /**
               * Target Clerk user identifier.
               */
              targetClerkId: string | null;
            }) => {
              order.push(`${step}:${targetClerkId ?? "removed"}`);
              if (step === "snapshot" && failSnapshot) {
                failSnapshot = false;
                throw new ErasureOperationError("storage_unavailable");
              }
              if (step === "providers") {
                return {
                  exceptions: [
                    {
                      code: "axiom_30_days",
                      expiresAt: new Date(
                        currentTime.getTime() + 29 * 24 * 60 * 60 * 1000,
                      ).toISOString(),
                    },
                  ],
                };
              }
              return undefined;
            },
          ),
        ]),
      ) as unknown as ErasureOperations;

      await expect(service.processDue(operations)).resolves.toBe(true);
      let receipt = await service.getReceipt({ id: first.id, subjectHmac });
      expect(receipt).toMatchObject({
        attempts: 1,
        errorCode: "storage_unavailable",
        status: "running",
      });
      expect(order).toEqual([`snapshot:${clerkId}`]);

      currentTime = new Date(currentTime.getTime() + 5 * 60 * 1000);
      await expect(
        Promise.all([
          service.processDue(operations),
          service.processDue(operations),
        ]),
      ).resolves.toEqual(expect.arrayContaining([true, false]));
      receipt = await service.getReceipt({ id: first.id, subjectHmac });
      expect(receipt).toMatchObject({
        attempts: 2,
        errorCode: null,
        status: "completed",
      });
      expect(receipt?.completedAt).toEqual(currentTime);
      expect(receipt?.expiresAt).toEqual(
        new Date(currentTime.getTime() + 30 * 24 * 60 * 60 * 1000),
      );
      await expect(service.getReceiptBySubject(subjectHmac)).resolves.toEqual(
        receipt,
      );
      expect(order).toEqual([
        `snapshot:${clerkId}`,
        `snapshot:${clerkId}`,
        `inaccessible:${clerkId}`,
        `storage:${clerkId}`,
        `database:${clerkId}`,
        `providers:${clerkId}`,
        `verify:${clerkId}`,
      ]);
      await expect(
        service.assertAccountActive(clerkId),
      ).resolves.toBeUndefined();
      await expect(service.getForAdmin(first.id)).resolves.toMatchObject({
        targetClerkId: null,
        verifiedByClerkId: null,
      });
      const auditEvents = await db
        .select()
        .from(schema.auditEvent)
        .where(eq(schema.auditEvent.targetId, first.id));
      const initiation = auditEvents.find(
        ({ action }) => action === "account.erasure.requested",
      );
      expect(initiation).toMatchObject({
        actorRole: "user",
        authorizationType: "owner",
        metadata: {
          attempts: 0,
          exceptionCount: 0,
          initiator: "self",
          status: "pending",
          verificationMethod: "clerk_reverification",
        },
        requestId: first.id,
      });
      expect(
        auditEvents.find(
          ({ action }) => action === "account.erasure.completed",
        ),
      ).toMatchObject({
        actorRole: "system",
        authorizationType: "system",
        metadata: {
          attempts: 2,
          exceptionCount: 1,
          initiationEventId: initiation?.id,
          status: "completed",
        },
        requestId: first.id,
      });
      expect(JSON.stringify(auditEvents)).not.toContain(subjectHmac);
      expect(JSON.stringify(events)).not.toContain(clerkId);
      expect(await service.processDue(operations)).toBe(false);

      currentTime = new Date(currentTime.getTime() + 30 * 24 * 60 * 60 * 1000);
      await expect(service.purgeExpiredReceipts()).resolves.toBe(1);
      await expect(
        service.getReceipt({ id: first.id, subjectHmac }),
      ).resolves.toBeNull();
    } finally {
      await client.close();
    }
  }, 30_000);

  it("converges after a retryable failure at every operation step", async () => {
    const client = new PGlite();
    await migrate(client);
    const db = drizzle(client, { schema }) as unknown as Database;
    let currentTime = new Date("2026-09-29T12:00:00.000Z");
    const service = createErasureService(
      db,
      captureLogger([]),
      () => currentTime,
    );
    const steps = [
      "snapshot",
      "inaccessible",
      "storage",
      "database",
      "providers",
      "verify",
    ] as const;

    try {
      for (const [index, failedStep] of steps.entries()) {
        const targetClerkId = `retry_${failedStep}`;
        await db.insert(schema.user).values({ clerkId: targetClerkId });
        const request = await service.create({
          actor: { clerkId: targetClerkId, role: "user" },
          initiator: "self",
          subjectHmac: (index + 1).toString(16).repeat(64),
          targetClerkId,
          verificationMethod: "clerk_reverification",
          verifiedAt: currentTime,
        });
        let failed = false;
        const operations = Object.fromEntries(
          steps.map((step) => [
            step,
            vi.fn(async () => {
              if (step === failedStep && !failed) {
                failed = true;
                throw new ErasureOperationError(`${step}_failed`);
              }
            }),
          ]),
        ) as unknown as ErasureOperations;

        await expect(service.processDue(operations)).resolves.toBe(true);
        await expect(
          service.getReceipt({
            id: request.id,
            subjectHmac: request.subjectHmac,
          }),
        ).resolves.toMatchObject({
          errorCode: `${failedStep}_failed`,
          status: "running",
        });

        currentTime = new Date(currentTime.getTime() + 5 * 60 * 1000);
        await expect(service.processDue(operations)).resolves.toBe(true);
        await expect(
          service.getReceipt({
            id: request.id,
            subjectHmac: request.subjectHmac,
          }),
        ).resolves.toMatchObject({ errorCode: null, status: "completed" });

        for (const [step, operation] of Object.entries(operations)) {
          expect(operation, step).toHaveBeenCalledTimes(
            step === failedStep ? 2 : 1,
          );
        }
      }
    } finally {
      await client.close();
    }
  }, 30_000);

  it("hides content and pauses on an unexpected Clerk deletion", async () => {
    const client = new PGlite();
    await migrate(client);
    const db = drizzle(client, { schema }) as unknown as Database;
    const events: LogEvent[] = [];
    const occurredAt = new Date("2026-09-29T13:00:00.000Z");
    const service = createErasureService(
      db,
      captureLogger(events),
      () => occurredAt,
    );
    const clerkId = "unexpected_deleted_user";
    const subjectHmac = await createErasureSubjectHmac(
      clerkId,
      "test-erasure-hmac-secret-at-least-32-characters",
    );

    try {
      const [user] = await db
        .insert(schema.user)
        .values({ clerkId })
        .returning();
      if (!user) throw new Error("User fixture was not created.");
      const [collection] = await db
        .insert(schema.userCollection)
        .values({
          isPrivate: false,
          name: "Public collection",
          normalizedName: "public collection",
          ownerId: user.id,
        })
        .returning();
      const [resource] = await db
        .insert(schema.resources)
        .values({
          description: "Public resource",
          isPrivate: false,
          name: "Public resource",
          uploaderClerkId: clerkId,
        })
        .returning();
      if (!collection || !resource) {
        throw new Error("Content fixtures were not created.");
      }

      const handled = await service.handleClerkDeletion({
        subjectHmac,
        targetClerkId: clerkId,
      });
      expect(handled.unexpected).toBe(true);
      const receipt = await service.getReceipt({
        id: handled.requestId,
        subjectHmac,
      });
      expect(receipt).toMatchObject({
        errorCode: "unexpected_clerk_deletion",
        status: "needs_attention",
        verificationReference: "clerk_webhook",
      });
      expect(receipt?.stepResults.inaccessible.status).toBe("completed");
      await expect(
        db
          .select()
          .from(schema.auditEvent)
          .where(eq(schema.auditEvent.targetId, handled.requestId)),
      ).resolves.toEqual([
        expect.objectContaining({
          action: "account.erasure.needs_attention",
          actorRole: "system",
          authorizationType: "system",
          metadata: {
            attempts: 0,
            errorCode: "unexpected_clerk_deletion",
            exceptionCount: 0,
            initiationEventId: null,
            status: "needs_attention",
          },
        }),
      ]);
      expect(
        await db
          .select({ isPrivate: schema.userCollection.isPrivate })
          .from(schema.userCollection)
          .where(eq(schema.userCollection.id, collection.id)),
      ).toEqual([{ isPrivate: true }]);
      expect(
        await db
          .select({ isPrivate: schema.resources.isPrivate })
          .from(schema.resources)
          .where(eq(schema.resources.id, resource.id)),
      ).toEqual([{ isPrivate: true }]);
      expect(JSON.stringify(events)).not.toContain(clerkId);
      expect(
        events.find(
          ({ message }) =>
            message === loggerMessages.database.erasure.unexpectedClerkDeletion,
        ),
      ).toMatchObject({
        attributes: {
          adminLink: "https://pocket-trash.app/admin/account-erasure",
          failureCategory: "unexpected_clerk_deletion",
          requestId: handled.requestId,
          state: "needs_attention",
        },
        level: "error",
      });
    } finally {
      await client.close();
    }
  }, 30_000);

  it("retries provider failures for 24 hours before alerting", async () => {
    const client = new PGlite();
    await migrate(client);
    const db = drizzle(client, { schema }) as unknown as Database;
    const events: LogEvent[] = [];
    let currentTime = new Date("2026-09-29T12:00:00.000Z");
    const service = createErasureService(
      db,
      captureLogger(events),
      () => currentTime,
    );
    const subjectHmac = "b".repeat(64);
    const operations = Object.fromEntries(
      [
        "snapshot",
        "inaccessible",
        "storage",
        "database",
        "providers",
        "verify",
      ].map((step) => [
        step,
        vi.fn(async () => {
          if (step === "providers") {
            throw new ErasureOperationError("clerk_delete_failed");
          }
        }),
      ]),
    ) as unknown as ErasureOperations;

    try {
      await db.insert(schema.user).values({ clerkId: "provider_failure_user" });
      const request = await service.create({
        actor: { clerkId: "provider_failure_user", role: "user" },
        initiator: "self",
        subjectHmac,
        targetClerkId: "provider_failure_user",
        verificationMethod: "clerk_reverification",
        verifiedAt: currentTime,
      });
      await service.processDue(operations);
      expect(events.at(-1)).toMatchObject({
        attributes: {
          adminLink: "https://pocket-trash.app/admin/account-erasure",
          failureCategory: "clerk_delete_failed",
          requestId: request.id,
          state: "running",
        },
        level: "warn",
      });

      currentTime = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000);
      await service.processDue(operations);
      expect(events.at(-1)).toMatchObject({
        attributes: {
          adminLink: "https://pocket-trash.app/admin/account-erasure",
          failureCategory: "clerk_delete_failed",
          requestId: request.id,
          state: "needs_attention",
        },
        level: "error",
      });
      const auditEvents = await db
        .select()
        .from(schema.auditEvent)
        .where(eq(schema.auditEvent.targetId, request.id));
      const initiation = auditEvents.find(
        ({ action }) => action === "account.erasure.requested",
      );
      expect(
        auditEvents.find(
          ({ action }) => action === "account.erasure.needs_attention",
        ),
      ).toMatchObject({
        actorRole: "system",
        authorizationType: "system",
        metadata: {
          attempts: 2,
          errorCode: "clerk_delete_failed",
          exceptionCount: 0,
          initiationEventId: initiation?.id,
          status: "needs_attention",
        },
      });
    } finally {
      await client.close();
    }
  }, 30_000);

  it("lets an admin retry without letting an exception bypass a failed step", async () => {
    const client = new PGlite();
    await migrate(client);
    const db = drizzle(client, { schema }) as unknown as Database;
    let currentTime = new Date("2026-09-29T14:00:00.000Z");
    const service = createErasureService(
      db,
      captureLogger([]),
      () => currentTime,
    );
    const subjectHmac = await createErasureSubjectHmac(
      "admin_target",
      "test-erasure-hmac-secret-at-least-32-characters",
    );
    let snapshotFails = true;
    const operations = Object.fromEntries(
      [
        "snapshot",
        "inaccessible",
        "storage",
        "database",
        "providers",
        "verify",
      ].map((step) => [
        step,
        vi.fn(async () => {
          if (step === "snapshot" && snapshotFails) {
            throw new ErasureOperationError("snapshot_blocked", false);
          }
          return undefined;
        }),
      ]),
    ) as unknown as ErasureOperations;

    try {
      const actor = { clerkId: "admin_123", role: "system_admin" as const };
      await db.insert(schema.user).values([
        { clerkId: actor.clerkId, username: "administrator" },
        { clerkId: "admin_target", username: "target" },
      ]);
      const created = await service.create({
        actor,
        initiator: "admin",
        subjectHmac,
        targetClerkId: "admin_target",
        verificationMethod: "verified_email",
        verificationReference: "privacy_ticket_123",
        verifiedAt: currentTime,
      });
      await expect(service.getForAdmin(created.id)).resolves.toMatchObject({
        verificationMethod: "verified_email",
        verificationReference: "privacy_ticket_123",
        verifiedAt: currentTime,
        verifiedByClerkId: "admin_123",
      });
      await service.processDue(operations);
      expect(
        await service.getReceipt({ id: created.id, subjectHmac }),
      ).toMatchObject({ status: "needs_attention" });

      await service.retry({
        actor,
        exception: {
          code: "neon_history_6_hours",
          expiresAt: new Date(currentTime.getTime() + 6 * 60 * 60 * 1000),
        },
        requestId: created.id,
      });
      await service.processDue(operations);
      expect(
        await service.getReceipt({ id: created.id, subjectHmac }),
      ).toMatchObject({ status: "needs_attention" });

      snapshotFails = false;
      currentTime = new Date(currentTime.getTime() + 60_000);
      await service.retry({ actor, requestId: created.id });
      await service.processDue(operations);
      const completed = await service.getReceipt({
        id: created.id,
        subjectHmac,
      });
      expect(completed).toMatchObject({ status: "completed" });
      expect(completed?.stepResults.snapshot.exceptions).toEqual([
        {
          code: "neon_history_6_hours",
          expiresAt: "2026-09-29T20:00:00.000Z",
        },
      ]);
      const auditEvents = await db
        .select()
        .from(schema.auditEvent)
        .where(eq(schema.auditEvent.targetId, created.id));
      expect(
        auditEvents.filter(
          ({ action }) => action === "account.erasure.retried",
        ),
      ).toHaveLength(2);
      expect(
        auditEvents.find(({ action }) => action === "account.erasure.retried"),
      ).toMatchObject({
        actorRole: "system_admin",
        actorUsername: "administrator",
        authorizationType: "permission",
        permission: "accounts.erase",
      });
      expect(JSON.stringify(auditEvents)).not.toContain("privacy_ticket_123");
    } finally {
      await client.close();
    }
  }, 30_000);
});

/**
 * Creates an in-memory logger for integration assertions.
 *
 * @param events - Array that receives captured structured log events.
 * @returns Logger that appends structured events to the supplied array.
 */
function captureLogger(events: LogEvent[]) {
  const transport: LogTransport = {
    /**
     * Captures a structured log event for assertions.
     *
     * @param event - Structured log event captured for assertions.
     */
    log(event) {
      events.push(event);
    },
  };
  return createLogger({
    app: "api",
    environment: "test",
    transports: [transport],
  });
}

/**
 * Applies database migrations to the integration-test database.
 *
 * @param client - In-memory Postgres client to migrate.
 * @rejects When migration files cannot be read or executed.
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
