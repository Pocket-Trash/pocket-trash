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
  createFeedbackService,
  FeedbackPlanRecoveryRequiredError,
} from "./index.js";

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
      expect((await service.listMine("user-test")).items).toEqual([
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
      expect((await service.listMine("user-at-limit")).items).toHaveLength(30);
      expect(
        (await service.listMine("user-at-limit", { offset: 30 })).items,
      ).toHaveLength(30);
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
      await service.updateAdmin({
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
      await service.updateAdmin({
        category: "feature",
        description: "Edited description",
        feedbackId: approved.id,
        title: "Edited title",
      });
      await service.approve(approved.id);
      await service.deny(denied.id);

      expect((await service.listMine("user-test")).items).toEqual([
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
      const secondPage = await service.listPending({ offset: 30 });

      expect(firstPage.items).toHaveLength(30);
      expect(firstPage.hasNext).toBe(true);
      expect(secondPage.items).toHaveLength(1);
      expect(secondPage.hasNext).toBe(false);
    } finally {
      await client.close();
    }
  }, 30_000);

  it("searches before the active cap and groups by status then votes", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });

    try {
      await migrate(client);
      const [needle, popular] = await db
        .insert(schema.feedback)
        .values([
          {
            category: "feature",
            description: "Needle description",
            status: "requested",
            submitterClerkId: "submitter-needle",
            title: "Old needle",
          },
          {
            category: "feature",
            description: "Popular request",
            status: "requested",
            submitterClerkId: "submitter-popular",
            title: "Popular",
          },
          ...Array.from({ length: 40 }, (_, index) => ({
            category: "feature" as const,
            description: `Filler ${index}`,
            status: "requested" as const,
            submitterClerkId: `submitter-${index}`,
            title: `Filler ${index}`,
          })),
          {
            category: "feature",
            description: "Planned request",
            status: "planned",
            submitterClerkId: "submitter-planned",
            title: "Planned",
          },
          {
            category: "feature",
            description: "In progress request",
            status: "in_progress",
            submitterClerkId: "submitter-progress",
            title: "In progress",
          },
        ])
        .returning();
      if (!needle || !popular) throw new Error("Failed to seed feedback.");
      await db.insert(schema.feedbackVotes).values([
        { feedbackId: popular.id, voterClerkId: "voter-1" },
        { feedbackId: popular.id, voterClerkId: "voter-2" },
      ]);
      const service = createFeedbackService(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      );

      const active = await service.listActive("viewer");
      const searched = await service.listActive("viewer", "old description");

      expect(active).toHaveLength(40);
      expect(active[0]?.status).toBe("in_progress");
      expect(active[1]?.status).toBe("planned");
      expect(active.findIndex(({ id }) => id === popular.id)).toBeLessThan(
        active.findIndex(({ status }) => status === "requested") + 2,
      );
      expect(active.some(({ id }) => id === needle.id)).toBe(false);
      expect(searched).toEqual([
        expect.objectContaining({ id: needle.id, voteCount: 0 }),
      ]);
      expect(searched[0]).not.toHaveProperty("submitterClerkId");
    } finally {
      await client.close();
    }
  }, 30_000);

  it("toggles ordinary votes without removing a submitter's permanent vote", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });

    try {
      await migrate(client);
      const service = createFeedbackService(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      );
      const created = await service.submit({
        category: "feature",
        description: "Vote safely",
        submitterClerkId: "submitter",
        title: "Permanent vote",
      });
      await service.approve(created.id);

      await expect(service.toggleVote(created.id, "submitter")).resolves.toBe(
        true,
      );
      await expect(service.toggleVote(created.id, "voter")).resolves.toBe(true);
      expect(await service.listActive("voter")).toEqual([
        expect.objectContaining({
          hasPermanentVote: false,
          hasVoted: true,
          id: created.id,
          voteCount: 2,
        }),
      ]);

      await expect(service.toggleVote(created.id, "voter")).resolves.toBe(
        false,
      );
      expect(await service.listActive("submitter")).toEqual([
        expect.objectContaining({
          hasPermanentVote: true,
          hasVoted: true,
          id: created.id,
          voteCount: 1,
        }),
      ]);
    } finally {
      await client.close();
    }
  }, 30_000);

  it("suggests at most five active duplicates and excludes pending and completed feedback", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });

    try {
      await migrate(client);
      await db.insert(schema.feedback).values([
        ...Array.from({ length: 6 }, (_, index) => ({
          category: "feature" as const,
          description: `Save a search ${index}`,
          status: "requested" as const,
          submitterClerkId: `active-${index}`,
          title: `Saved search ${index}`,
        })),
        {
          description: "Saved search pending",
          status: "pending",
          submitterClerkId: "pending",
          title: "Saved search pending",
        },
        {
          category: "feature",
          description: "Saved search completed",
          status: "completed",
          submitterClerkId: "completed",
          title: "Saved search completed",
        },
        {
          category: "feature",
          description: "A chair for email alerts",
          status: "requested",
          submitterClerkId: "substring-only",
          title: "Email alerts",
        },
      ]);
      const service = createFeedbackService(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      );

      const duplicates = await service.findDuplicates("viewer", "Saved search");

      expect(duplicates).toHaveLength(5);
      expect(duplicates.every(({ status }) => status === "requested")).toBe(
        true,
      );
      expect(duplicates[0]).not.toHaveProperty("submitterClerkId");
      await expect(service.findDuplicates("viewer", "ai")).resolves.toEqual([]);
    } finally {
      await client.close();
    }
  }, 30_000);

  it("searches and paginates eligible My Requests before applying the page limit", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });

    try {
      await migrate(client);
      const [needle] = await db
        .insert(schema.feedback)
        .values([
          {
            category: "feature",
            description: "Needle request",
            status: "completed",
            submitterClerkId: "owner",
            title: "Old needle",
          },
          ...Array.from({ length: 30 }, (_, index) => ({
            category: "feature" as const,
            description: `Visible ${index}`,
            status: "requested" as const,
            submitterClerkId: "owner",
            title: `Visible ${index}`,
          })),
          {
            category: "feature",
            description: "Hidden denied",
            status: "denied",
            submitterClerkId: "owner",
            title: "Hidden denied",
          },
        ])
        .returning();
      if (!needle) throw new Error("Failed to seed feedback.");
      const service = createFeedbackService(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      );

      const firstPage = await service.listMine("owner");
      const searched = await service.listMine("owner", {
        search: "needle",
      });

      expect(await service.hasMine("owner")).toBe(true);
      expect(firstPage.items).toHaveLength(30);
      expect(firstPage.hasNext).toBe(true);
      expect(searched).toEqual({
        hasNext: false,
        items: [
          expect.objectContaining({ id: needle.id, status: "completed" }),
        ],
      });
    } finally {
      await client.close();
    }
  }, 30_000);

  it("lists searchable admin active and archived feedback with bounded sorting", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });

    try {
      await migrate(client);
      const [lessPopular, morePopular, archived] = await db
        .insert(schema.feedback)
        .values([
          {
            category: "feature",
            description: "Used often by collectors",
            status: "requested",
            submitterClerkId: "active-less",
            title: "Saved searches",
          },
          {
            category: "feature",
            description: "Used often by makers",
            status: "requested",
            submitterClerkId: "active-more",
            title: "Saved searches",
          },
          {
            category: "bug",
            description: "Archived search result",
            status: "denied",
            submitterClerkId: "archived",
            title: "Archived request",
          },
        ])
        .returning();
      if (!lessPopular || !morePopular || !archived) {
        throw new Error("Failed to seed admin feedback.");
      }
      await db.insert(schema.feedbackVotes).values([
        { feedbackId: lessPopular.id, voterClerkId: "voter-1" },
        { feedbackId: morePopular.id, voterClerkId: "voter-1" },
        { feedbackId: morePopular.id, voterClerkId: "voter-2" },
      ]);
      const service = createFeedbackService(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      );

      const active = await service.listAdminActive({
        search: "saved often",
        sort: [{ direction: "asc", field: "title" }],
      });
      const votesAscending = await service.listAdminActive({
        sort: [{ direction: "asc", field: "votes" }],
      });
      const archive = await service.listArchive({ statuses: ["denied"] });

      expect(active.items.map(({ id }) => id)).toEqual([
        morePopular.id,
        lessPopular.id,
      ]);
      expect(votesAscending.items.map(({ id }) => id)).toEqual([
        lessPopular.id,
        morePopular.id,
      ]);
      expect(active.items[0]).not.toHaveProperty("submitterClerkId");
      expect(archive.items).toEqual([
        expect.objectContaining({ id: archived.id, status: "denied" }),
      ]);
      await expect(
        service.listAdminActive({
          sort: [
            { direction: "asc", field: "title" },
            { direction: "asc", field: "status" },
            { direction: "desc", field: "votes" },
          ],
        }),
      ).rejects.toThrow("At most 2 sorts");
    } finally {
      await client.close();
    }
  }, 30_000);

  it("edits through Completed and protects immutable or reserved feedback", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });

    try {
      await migrate(client);
      const [completed, merged, reserved, requested] = await db
        .insert(schema.feedback)
        .values([
          {
            category: "feature",
            description: "Completed description",
            status: "completed",
            submitterClerkId: "completed",
            title: "Completed title",
          },
          {
            category: "feature",
            description: "Merged description",
            status: "merged",
            submitterClerkId: "merged",
            title: "Merged title",
          },
          {
            category: "feature",
            description: "Reserved description",
            linearClientUuid: "11111111-1111-4111-8111-111111111111",
            status: "requested",
            submitterClerkId: "reserved",
            title: "Reserved title",
          },
          {
            category: "feature",
            description: "Requested description",
            status: "requested",
            submitterClerkId: "requested",
            title: "Requested title",
          },
        ])
        .returning();
      if (!completed || !merged || !reserved || !requested) {
        throw new Error("Failed to seed editable feedback.");
      }
      const service = createFeedbackService(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      );

      await service.updateAdmin({
        category: "improvement",
        description: "Updated description",
        feedbackId: completed.id,
        title: "Updated title",
      });
      await expect(
        service.updateAdmin({
          category: "improvement",
          description: "Cannot update",
          feedbackId: merged.id,
          title: "Cannot update",
        }),
      ).rejects.toThrow();
      await expect(service.deny(reserved.id)).rejects.toBeInstanceOf(
        FeedbackPlanRecoveryRequiredError,
      );
      await expect(service.deny(requested.id)).resolves.toBeUndefined();

      expect(await service.listArchive({ statuses: ["completed"] })).toEqual({
        hasNext: false,
        items: [
          expect.objectContaining({
            category: "improvement",
            id: completed.id,
            title: "Updated title",
          }),
        ],
      });
    } finally {
      await client.close();
    }
  }, 30_000);

  it("merges only pending feedback and transfers one removable vote", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });

    try {
      await migrate(client);
      const service = createFeedbackService(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      );
      const target = await service.submit({
        category: "feature",
        description: "Approved target",
        submitterClerkId: "target-owner",
        title: "Approved target",
      });
      await service.approve(target.id);
      const first = await service.submit({
        description: "First duplicate",
        submitterClerkId: "duplicate-owner",
        title: "First duplicate",
      });
      const second = await service.submit({
        description: "Second duplicate",
        submitterClerkId: "duplicate-owner",
        title: "Second duplicate",
      });

      await service.mergePending(first.id, target.id);
      await service.mergePending(second.id, target.id);

      expect(
        await db
          .select()
          .from(schema.feedbackVotes)
          .where(eq(schema.feedbackVotes.feedbackId, target.id)),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            isPermanent: true,
            voterClerkId: "target-owner",
          }),
          expect.objectContaining({
            isPermanent: false,
            voterClerkId: "duplicate-owner",
          }),
        ]),
      );
      expect(
        (
          await db
            .select()
            .from(schema.feedbackVotes)
            .where(eq(schema.feedbackVotes.feedbackId, target.id))
        ).filter(({ voterClerkId }) => voterClerkId === "duplicate-owner"),
      ).toHaveLength(1);
      expect(await service.listArchive({ statuses: ["merged"] })).toEqual({
        hasNext: false,
        items: expect.arrayContaining([
          expect.objectContaining({ id: first.id }),
          expect.objectContaining({ id: second.id }),
        ]),
      });
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
