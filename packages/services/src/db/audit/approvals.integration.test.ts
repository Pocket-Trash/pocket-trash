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
import type { Actor } from "../../authorization.js";
import {
  type CatalogApprovalAction,
  createCatalogService,
} from "../catalog/index.js";
import { createDbServices } from "../index.js";

describe("approval audit adoption", () => {
  it("records every decision atomically with permission provenance and erases identities safely", async () => {
    const client = new PGlite();
    try {
      await migrate(client);
      const db = drizzle(client, { schema }) as unknown as Database;
      const logger = createNoopLogger({ app: "test", environment: "test" });
      const services = createDbServices(db, logger);
      const [owner, staff] = await db
        .insert(schema.user)
        .values([
          { clerkId: "approval-audit-owner", username: "Owner" },
          { clerkId: "approval-audit-staff", username: "Editor" },
        ])
        .returning();
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Maker" })
        .returning();
      const [productType] = await db
        .insert(schema.productType)
        .values({ name: "Spinner", slug: "spinner" })
        .returning();
      if (!owner || !staff || !maker || !productType)
        throw new Error("Approval fixtures missing.");
      const [product] = await db
        .insert(schema.product)
        .values({
          makerId: maker.id,
          name: "Review product",
          ownerClerkId: owner.clerkId,
          productTypeId: productType.id,
          slug: "review-product",
        })
        .returning();
      const [collection] = await db
        .insert(schema.userCollection)
        .values({
          name: "Review collection",
          normalizedName: "reviewcollection",
          ownerId: owner.id,
        })
        .returning();
      if (!product || !collection) throw new Error("Approval targets missing.");
      const [item] = await db
        .insert(schema.collectionItem)
        .values({ collectionId: collection.id, ownerId: owner.id })
        .returning();
      if (!item) throw new Error("Approval item missing.");
      const editor: Actor = { clerkId: staff.clerkId, role: "editor" };
      const ownerStaff: Actor = { clerkId: owner.clerkId, role: "editor" };

      await expect(
        createCatalogService(db, logger).decideProductApproval({
          action: "approve",
          actor: editor,
          productId: product.id,
          reason: "Ready",
        }),
      ).rejects.toThrow("Product audit is not configured.");

      for (const domain of ["product", "item"] as const) {
        const table =
          domain === "product" ? schema.product : schema.collectionItem;
        const id = domain === "product" ? product.id : item.id;
        const targetType =
          domain === "product" ? "products.product" : "collections.item";
        const permission =
          domain === "product" ? "products.manage" : "collections.manage";
        /**
         * Applies a decision through the domain service under test.
         *
         * @param action - Requested approval transition.
         * @param reason - Decision explanation.
         * @param actor - Actor whose permission authorizes the decision.
         * @returns Persisted approval status.
         * @rejects When authorization, validation, persistence, or auditing fails.
         */
        const decide = (
          action: CatalogApprovalAction,
          reason: string,
          actor: Actor = editor,
        ) =>
          domain === "product"
            ? services.catalog.decideProductApproval({
                action,
                actor,
                productId: id,
                reason,
              })
            : services.collections.decideItemApproval({
                action,
                actor,
                collectionItemId: id,
                reason,
              });
        /**
         * Reads only durable decision fields to detect rollback.
         *
         * @returns Persisted target decision state.
         * @rejects When the database read fails.
         */
        const state = async () =>
          (
            await db
              .select({
                approvalStatus: table.approvalStatus,
                approvalDecidedAt: table.approvalDecidedAt,
                approvalDecisionReason: table.approvalDecisionReason,
                updatedAt: table.updatedAt,
              })
              .from(table)
              .where(eq(table.id, id))
          )[0];
        /**
         * Reads this domain's approval ledger in event order.
         *
         * @returns Target audit events.
         * @rejects When the database read fails.
         */
        const events = () =>
          db
            .select()
            .from(schema.auditEvent)
            .where(eq(schema.auditEvent.targetType, targetType))
            .orderBy(schema.auditEvent.id);
        const original = await state();
        for (const actor of [
          { clerkId: owner.clerkId, role: "user" as const },
          { clerkId: staff.clerkId, role: "user" as const },
          { clerkId: "missing-staff", role: "editor" as const },
        ])
          await expect(decide("approve", "Ready", actor)).rejects.toThrow(
            /does not exist/,
          );
        await expect(decide("approve", " ")).rejects.toThrow(/reason/);
        await expect(decide("approve", "x".repeat(1001))).rejects.toThrow(
          /reason/,
        );
        await expect(decide("reverse", "Invalid transition")).rejects.toThrow(
          /transition/,
        );
        expect(await state()).toEqual(original);
        expect(await events()).toHaveLength(0);

        // Fail the actual audit INSERT after the decision UPDATE, not a mocked writer.
        await client.exec(`CREATE FUNCTION fail_approval_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'approval audit unavailable'; END; $$;
          CREATE TRIGGER fail_approval_audit BEFORE INSERT ON audit_event FOR EACH ROW EXECUTE FUNCTION fail_approval_audit();`);
        await expect(decide("approve", "Ready")).rejects.toThrow();
        expect(await state()).toEqual(original);
        expect(await events()).toHaveLength(0);
        await client.exec(
          "DROP TRIGGER fail_approval_audit ON audit_event; DROP FUNCTION fail_approval_audit();",
        );

        let before = {
          approvalStatus: "pending",
          approvalDecidedAt: null as string | null,
        };
        for (const [action, status, suffix] of [
          ["approve", "approved", "approved"],
          ["reverse", "pending", "approval_reversed"],
          ["reject", "rejected", "rejected"],
          ["reverse", "pending", "approval_reversed"],
        ] as const) {
          const reason = `${domain} ${action} explanation`;
          await expect(decide(action, ` ${reason} `)).resolves.toBe(status);
          const current = await state();
          const ledger = await events();
          const event = ledger.at(-1);
          expect(current?.approvalDecisionReason).toBe(reason);
          expect(event).toMatchObject({
            action: `${targetType}.${suffix}`,
            targetType,
            targetId: String(id),
            actorUserId: staff.id,
            actorUsername: "Editor",
            actorRole: "editor",
            ownerUserId: owner.id,
            authorizationType: "permission",
            permission,
            reason,
            beforeState: before,
            afterState: {
              approvalStatus: status,
              approvalDecidedAt: current?.approvalDecidedAt?.toISOString(),
            },
            metadata: null,
          });
          expect(event?.occurredAt).toEqual(current?.approvalDecidedAt);
          expect(event?.recordedAt).toBeInstanceOf(Date);
          const count = ledger.length;
          await expect(decide(action, "Duplicate")).rejects.toThrow(
            /transition/,
          );
          expect(await state()).toEqual(current);
          expect(await events()).toHaveLength(count);
          before = {
            approvalStatus: status,
            approvalDecidedAt:
              current?.approvalDecidedAt?.toISOString() ?? null,
          };
        }

        // Approval is a staff capability even for an actor who owns the target.
        await decide("approve", "Owner acting as staff", ownerStaff);
        expect((await events()).at(-1)).toMatchObject({
          actorUserId: owner.id,
          ownerUserId: owner.id,
          authorizationType: "permission",
          permission,
        });
        await decide("reverse", "Reopen for concurrent decisions");
        const count = (await events()).length;
        const outcomes = await Promise.allSettled([
          decide("approve", "Concurrent approval"),
          decide("reject", "Concurrent rejection"),
        ]);
        expect(
          outcomes.filter(({ status }) => status === "fulfilled"),
        ).toHaveLength(1);
        expect(await events()).toHaveLength(count + 1);
      }

      const [ownerless] = await db
        .insert(schema.product)
        .values({
          makerId: maker.id,
          name: "Ownerless product",
          productTypeId: productType.id,
          slug: "ownerless",
        })
        .returning();
      if (!ownerless) throw new Error("Ownerless product missing.");
      await services.catalog.decideProductApproval({
        action: "approve",
        actor: editor,
        productId: ownerless.id,
        reason: "Ownerless review",
      });
      const allEvents = await db
        .select()
        .from(schema.auditEvent)
        .orderBy(schema.auditEvent.id);
      expect(allEvents.at(-1)).toMatchObject({
        ownerUserId: null,
        permission: "products.manage",
      });
      expect(allEvents).toHaveLength(15);
      const firstEvent = allEvents[0];
      if (!firstEvent) throw new Error("Approval event missing.");

      await db.transaction((tx) => services.audit.redactAccount(tx, staff.id));
      const actorRedacted = await db
        .select()
        .from(schema.auditEvent)
        .where(eq(schema.auditEvent.id, firstEvent.id));
      expect(actorRedacted[0]).toMatchObject({
        actorUserId: null,
        actorUsername: "Deleted user",
        ownerUserId: owner.id,
        reason: "[erased]",
        beforeState: firstEvent.beforeState,
        afterState: firstEvent.afterState,
      });
      await db.transaction((tx) => services.audit.redactAccount(tx, owner.id));
      const redacted = await db
        .select()
        .from(schema.auditEvent)
        .orderBy(schema.auditEvent.id);
      for (const event of redacted.slice(0, 14)) {
        expect(event).toMatchObject({
          actorUserId: null,
          ownerUserId: null,
          reason: "[erased]",
          beforeState: null,
          afterState: null,
          metadata: { redacted: true },
        });
      }
    } finally {
      await client.close();
    }
  }, 60_000);
});

/**
 * Applies repository migrations to an isolated in-memory database.
 *
 * @param client - PGlite test database.
 * @rejects When a migration cannot be read or executed.
 */
async function migrate(client: PGlite) {
  const folder = fileURLToPath(
    new URL("../../../../database/drizzle", import.meta.url),
  );
  for (const file of readdirSync(folder)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await client.exec(
      readFileSync(join(folder, file), "utf8").replaceAll(
        "--> statement-breakpoint",
        "",
      ),
    );
  }
}
