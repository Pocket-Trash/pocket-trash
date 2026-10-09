import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createNoopLogger } from "@package/logger";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { createFeatureFlagsService } from "../../flags/index.js";
import { createFeedbackService } from "../feedback/index.js";
import { createDbServices } from "../index.js";
import type { AuditService } from "./index.js";

describe("administration audit adoption", () => {
  it("audits feedback and feature-flag mutations with safe erasure links", async () => {
    const client = new PGlite();
    await migrate(client);
    const db = drizzle({
      client: client,
      relations: schema.relations,
    }) as unknown as Database;
    const logger = createNoopLogger({ app: "test", environment: "test" });
    const services = createDbServices(db, logger);
    const flags = createFeatureFlagsService(
      db,
      services.users,
      logger,
      services.audit,
    );
    const actor = { clerkId: "administration-auditor", role: "admin" } as const;

    try {
      const approved = await services.feedback.submit({
        category: "feature",
        description: "Original approved description",
        submitterClerkId: "feedback-owner",
        title: "Approved feedback",
      });
      const merged = await services.feedback.submit({
        description: "Merged description",
        submitterClerkId: "feedback-owner",
        title: "Merged feedback",
      });
      const denied = await services.feedback.submit({
        description: "Denied description",
        submitterClerkId: "feedback-owner",
        title: "Denied feedback",
      });
      const rejectingAudit = {
        ...services.audit,
        /**
         * Simulates a durable audit failure for transaction rollback checks.
         *
         * @rejects Always, to exercise source transaction rollback.
         */
        write: async () => {
          throw new Error("Audit write failed.");
        },
      } as unknown as AuditService;
      const rejectingFeedback = createFeedbackService(
        db,
        logger,
        rejectingAudit,
      );
      await expect(
        rejectingFeedback.updateAdmin({
          actor,
          category: "improvement",
          description: "Must roll back",
          feedbackId: approved.id,
          title: "Must roll back",
        }),
      ).rejects.toThrow("Audit write failed.");
      expect(
        (
          await db
            .select({ title: schema.feedback.title })
            .from(schema.feedback)
            .where(eq(schema.feedback.id, approved.id))
        )[0]?.title,
      ).toBe("Approved feedback");
      await services.feedback.updateAdmin({
        actor,
        category: "improvement",
        description: "Edited approved description",
        feedbackId: approved.id,
        title: "Edited approved feedback",
      });
      await services.feedback.approve({ actor, feedbackId: approved.id });
      await services.feedback.mergePending({
        actor,
        feedbackId: merged.id,
        targetId: approved.id,
      });
      await services.feedback.deny({ actor, feedbackId: denied.id });

      const adminFlag = await flags.create({
        actor,
        audience: "admin",
        description: "Initial description",
        name: "Admin flag",
        slug: "admin-audit",
      });
      const rejectingFlags = createFeatureFlagsService(
        db,
        services.users,
        logger,
        rejectingAudit,
      );
      await expect(
        rejectingFlags.update({
          actor,
          name: "Must roll back",
          slug: adminFlag.slug,
        }),
      ).rejects.toThrow("Audit write failed.");
      expect(
        (
          await db
            .select({ name: schema.featureFlags.name })
            .from(schema.featureFlags)
            .where(eq(schema.featureFlags.slug, adminFlag.slug))
        )[0]?.name,
      ).toBe("Admin flag");
      await flags.update({
        actor,
        description: "Updated description",
        name: "Updated admin flag",
        slug: adminFlag.slug,
      });
      await flags.setAdminOverride({
        actor,
        enabled: true,
        slug: adminFlag.slug,
        targetClerkId: "override-owner",
      });
      await flags.archive({ actor, slug: adminFlag.slug });

      const events = await db
        .select()
        .from(schema.auditEvent)
        .orderBy(schema.auditEvent.id);
      expect(events.map(({ action }) => action)).toEqual([
        "feedback.request.updated",
        "feedback.request.approved",
        "feedback.request.merged",
        "feedback.request.denied",
        "feature_flags.flag.created",
        "feature_flags.flag.updated",
        "feature_flags.user_override.set",
        "feature_flags.flag.archived",
      ]);
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: "feedback.request.merged",
            afterState: expect.objectContaining({
              mergedIntoFeedbackId: approved.id,
              status: "merged",
            }),
            authorizationType: "permission",
            permission: "feedback.manage",
          }),
          expect.objectContaining({
            action: "feature_flags.user_override.set",
            afterState: {
              enabled: true,
              slug: "admin-audit",
              source: "admin",
            },
            authorizationType: "permission",
            permission: "feature_flags.manage",
          }),
        ]),
      );
      expect(JSON.stringify(events)).not.toContain("feedback-owner");
      expect(JSON.stringify(events)).not.toContain("override-owner");

      const userFlag = await flags.create({
        actor,
        audience: "user",
        name: "User flag",
        slug: "user-audit-exclusion",
      });
      const countBeforePreference = (await db.select().from(schema.auditEvent))
        .length;
      await flags.setUserPreference({
        actorClerkId: "preference-owner",
        enabled: true,
        slug: userFlag.slug,
      });
      expect((await db.select().from(schema.auditEvent)).length).toBe(
        countBeforePreference,
      );

      const [feedbackOwner] = await db
        .select({ id: schema.user.id })
        .from(schema.user)
        .where(eq(schema.user.clerkId, "feedback-owner"));
      const [overrideOwner] = await db
        .select({ id: schema.user.id })
        .from(schema.user)
        .where(eq(schema.user.clerkId, "override-owner"));
      if (!feedbackOwner || !overrideOwner) {
        throw new Error("Audit owners were not created.");
      }
      await db.transaction(
        async (tx) => await services.audit.redactAccount(tx, feedbackOwner.id),
      );
      await db.transaction(
        async (tx) => await services.audit.redactAccount(tx, overrideOwner.id),
      );
      const redacted = await db.select().from(schema.auditEvent);
      expect(
        redacted
          .filter(({ action }) => action.startsWith("feedback."))
          .every(
            ({ metadata, ownerUserId }) =>
              ownerUserId === null && metadata?.redacted === true,
          ),
      ).toBe(true);
      expect(
        redacted.find(
          ({ action }) => action === "feature_flags.user_override.set",
        ),
      ).toEqual(
        expect.objectContaining({
          afterState: null,
          beforeState: null,
          metadata: { redacted: true },
          ownerUserId: null,
        }),
      );
      expect(
        redacted.find(({ action }) => action === "feature_flags.flag.archived")
          ?.afterState,
      ).toEqual(expect.objectContaining({ slug: "admin-audit" }));
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
 * @rejects When a migration cannot be discovered, read, or executed.
 */
async function migrate(client: PGlite): Promise<void> {
  const migrationsFolder = fileURLToPath(
    new URL("../../../../database/drizzle", import.meta.url),
  );
  await migratePglite(drizzle({ client: client }), {
    migrationsFolder: migrationsFolder,
  });
}
