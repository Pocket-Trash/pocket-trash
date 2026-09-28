import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createLogger } from "@package/logger";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import { createFeedbackService } from "./index.js";

describe("feedback lifecycle", () => {
  it("creates a pending request, permanent vote, and submitted notification atomically", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });

    try {
      await migrate(client);
      const service = createFeedbackService(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      );

      const created = await service.submit({
        description: "Let people save searches.",
        submitterClerkId: "user-test",
        title: "Saved searches",
      });

      expect(created).toMatchObject({
        category: null,
        description: "Let people save searches.",
        status: "pending",
        title: "Saved searches",
      });
      expect(await service.listMine("user-test")).toEqual([
        expect.objectContaining({ id: created.id, voteCount: 1 }),
      ]);
      expect((await service.listPending()).items).toEqual([
        expect.objectContaining({ id: created.id, voteCount: 1 }),
      ]);

      const votes = await db.select().from(schema.feedbackVotes);
      const notifications = await db
        .select()
        .from(schema.feedbackNotifications);
      expect(votes).toEqual([
        expect.objectContaining({
          feedbackId: created.id,
          isPermanent: true,
          voterClerkId: "user-test",
        }),
      ]);
      expect(notifications).toEqual([
        expect.objectContaining({
          feedbackId: created.id,
          type: "submitted",
        }),
      ]);
    } finally {
      await client.close();
    }
  }, 30_000);

  it("allows only one concurrent submission at the active-request limit", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });

    try {
      await migrate(client);
      await db.insert(schema.feedback).values(
        Array.from({ length: 60 }, (_, index) => ({
          description: `Description ${index}`,
          status: index === 59 ? ("denied" as const) : ("pending" as const),
          submitterClerkId: "user-at-limit",
          title: `Request ${index}`,
        })),
      );
      const service = createFeedbackService(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      );

      const results = await Promise.allSettled([
        service.submit({
          description: "Last available request",
          submitterClerkId: "user-at-limit",
          title: "Request 60",
        }),
        service.submit({
          description: "One too many",
          submitterClerkId: "user-at-limit",
          title: "Request 61",
        }),
      ]);

      expect(
        results.filter(({ status }) => status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter(({ status }) => status === "rejected"),
      ).toHaveLength(1);
      expect(await service.listMine("user-at-limit")).toHaveLength(60);
    } finally {
      await client.close();
    }
  }, 30_000);

  it("requires a category for approval and hides denied feedback from its submitter", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });

    try {
      await migrate(client);
      const service = createFeedbackService(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      );
      const approved = await service.submit({
        description: "First description",
        submitterClerkId: "user-test",
        title: "First title",
      });
      const denied = await service.submit({
        description: "Second description",
        submitterClerkId: "user-test",
        title: "Second title",
      });

      await expect(service.approve(approved.id)).rejects.toThrow();
      await service.updatePending({
        category: "feature",
        description: "Edited description",
        feedbackId: approved.id,
        title: "Edited title",
      });
      await service.updatePending({
        description: "Edited description",
        feedbackId: approved.id,
        title: "Edited title",
      });
      expect(
        (await service.listPending()).items.find(
          ({ id }) => id === approved.id,
        ),
      ).toEqual(expect.objectContaining({ category: null, id: approved.id }));
      await expect(service.approve(approved.id)).rejects.toThrow();
      await service.updatePending({
        category: "feature",
        description: "Edited description",
        feedbackId: approved.id,
        title: "Edited title",
      });
      await service.approve(approved.id);
      await service.deny(denied.id);

      expect(await service.listMine("user-test")).toEqual([
        expect.objectContaining({
          category: "feature",
          id: approved.id,
          status: "requested",
          title: "Edited title",
        }),
      ]);
      expect((await service.listPending()).items).toEqual([]);
    } finally {
      await client.close();
    }
  }, 30_000);

  it("paginates the pending queue at thirty newest requests", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });

    try {
      await migrate(client);
      await db.insert(schema.feedback).values(
        Array.from({ length: 31 }, (_, index) => ({
          description: `Description ${index}`,
          submitterClerkId: `user-${index}`,
          title: `Request ${index}`,
        })),
      );
      const service = createFeedbackService(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      );

      const firstPage = await service.listPending();
      const secondPage = await service.listPending(30);

      expect(firstPage.items).toHaveLength(30);
      expect(firstPage.hasNext).toBe(true);
      expect(secondPage.items).toHaveLength(1);
      expect(secondPage.hasNext).toBe(false);
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
