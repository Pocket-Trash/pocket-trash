import type { Database, FeedbackCategory } from "@package/database";
import { schema } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import { and, count, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { hashLogIdentifier } from "../../logging.js";

const activeStatuses: (typeof schema.feedbackStatuses)[number][] = [
  "pending",
  "requested",
  "planned",
  "in_progress",
];
const hiddenFromSubmitterStatuses: (typeof schema.feedbackStatuses)[number][] =
  ["merged", "denied", "canceled"];

export type SubmitFeedbackInput = {
  category?: FeedbackCategory;
  description: string;
  submitterClerkId: string;
  title: string;
};

export type UpdatePendingFeedbackInput = {
  category?: FeedbackCategory;
  description: string;
  feedbackId: number;
  title: string;
};

export type FeedbackService = {
  approve(feedbackId: number): Promise<void>;
  deny(feedbackId: number): Promise<void>;
  listMine(
    submitterClerkId: string,
  ): Promise<(typeof schema.feedback.$inferSelect & { voteCount: number })[]>;
  listPending(offset?: number): Promise<{
    hasNext: boolean;
    items: (typeof schema.feedback.$inferSelect & {
      submitterUsername: string | null;
      voteCount: number;
    })[];
  }>;
  submit(
    input: SubmitFeedbackInput,
  ): Promise<typeof schema.feedback.$inferSelect>;
  updatePending(input: UpdatePendingFeedbackInput): Promise<void>;
};

export class FeedbackSubmissionLimitError extends Error {}
export class FeedbackStateError extends Error {}

export function createFeedbackService(
  db: Database,
  logger: Logger,
): FeedbackService {
  return {
    async approve(feedbackId) {
      await logger.operation(
        loggerMessages.database.feedback.approve,
        async () => {
          assertPositiveInteger(feedbackId, "feedbackId");
          const updated = await db
            .update(schema.feedback)
            .set({ status: "requested", updatedAt: new Date() })
            .where(
              and(
                eq(schema.feedback.id, feedbackId),
                eq(schema.feedback.status, "pending"),
                sql`${schema.feedback.category} is not null`,
              ),
            )
            .returning({ id: schema.feedback.id });
          if (updated.length === 0) throw new FeedbackStateError();
        },
      );
    },

    async deny(feedbackId) {
      await logger.operation(
        loggerMessages.database.feedback.deny,
        async () => {
          assertPositiveInteger(feedbackId, "feedbackId");
          const updated = await db
            .update(schema.feedback)
            .set({ status: "denied", updatedAt: new Date() })
            .where(
              and(
                eq(schema.feedback.id, feedbackId),
                eq(schema.feedback.status, "pending"),
              ),
            )
            .returning({ id: schema.feedback.id });
          if (updated.length === 0) throw new FeedbackStateError();
        },
      );
    },

    async listMine(submitterClerkId) {
      return await logger.operation(
        loggerMessages.database.feedback.listMine,
        async () => {
          const clerkId = normalizedClerkId(submitterClerkId);
          return await db
            .select({
              category: schema.feedback.category,
              createdAt: schema.feedback.createdAt,
              description: schema.feedback.description,
              id: schema.feedback.id,
              status: schema.feedback.status,
              submitterClerkId: schema.feedback.submitterClerkId,
              title: schema.feedback.title,
              updatedAt: schema.feedback.updatedAt,
              voteCount: sql<number>`(
                select count(*)::int from feedback_votes
                where feedback_id = ${schema.feedback.id}
              )`,
            })
            .from(schema.feedback)
            .where(
              and(
                eq(schema.feedback.submitterClerkId, clerkId),
                notInArray(schema.feedback.status, hiddenFromSubmitterStatuses),
              ),
            )
            .orderBy(desc(schema.feedback.updatedAt));
        },
        { attributes: { clerkIdHash: hashLogIdentifier(submitterClerkId) } },
      );
    },

    async listPending(offset = 0) {
      return await logger.operation(
        loggerMessages.database.feedback.listPending,
        async () => {
          if (!Number.isSafeInteger(offset) || offset < 0) {
            throw new Error("offset must be a non-negative integer.");
          }
          const rows = await db
            .select({
              category: schema.feedback.category,
              createdAt: schema.feedback.createdAt,
              description: schema.feedback.description,
              id: schema.feedback.id,
              status: schema.feedback.status,
              submitterClerkId: schema.feedback.submitterClerkId,
              submitterUsername: schema.user.username,
              title: schema.feedback.title,
              updatedAt: schema.feedback.updatedAt,
              voteCount: sql<number>`(
                select count(*)::int from feedback_votes
                where feedback_id = ${schema.feedback.id}
              )`,
            })
            .from(schema.feedback)
            .leftJoin(
              schema.user,
              eq(schema.user.clerkId, schema.feedback.submitterClerkId),
            )
            .where(eq(schema.feedback.status, "pending"))
            .orderBy(desc(schema.feedback.createdAt), desc(schema.feedback.id))
            .limit(31)
            .offset(offset);
          return { hasNext: rows.length > 30, items: rows.slice(0, 30) };
        },
      );
    },

    async submit(input) {
      return await logger.operation(
        loggerMessages.database.feedback.submit,
        async () => {
          const normalized = normalizeFeedbackInput(input);
          return await db.transaction(async (tx) => {
            await tx
              .insert(schema.user)
              .values({ clerkId: normalized.submitterClerkId })
              .onConflictDoUpdate({
                set: { clerkId: normalized.submitterClerkId },
                target: schema.user.clerkId,
              });
            await tx.execute(sql`
              select id from users
              where clerk_id = ${normalized.submitterClerkId}
              for update
            `);

            const [active] = await tx
              .select({ total: count() })
              .from(schema.feedback)
              .where(
                and(
                  eq(
                    schema.feedback.submitterClerkId,
                    normalized.submitterClerkId,
                  ),
                  inArray(schema.feedback.status, activeStatuses),
                ),
              );
            if ((active?.total ?? 0) >= 60) {
              throw new FeedbackSubmissionLimitError();
            }

            const [created] = await tx
              .insert(schema.feedback)
              .values(normalized)
              .returning();
            if (!created) throw new Error("Failed to create feedback.");

            await tx.insert(schema.feedbackVotes).values({
              feedbackId: created.id,
              isPermanent: true,
              voterClerkId: normalized.submitterClerkId,
            });
            await tx.insert(schema.feedbackNotifications).values({
              feedbackId: created.id,
              type: "submitted",
            });
            return created;
          });
        },
        {
          attributes: {
            clerkIdHash: hashLogIdentifier(input.submitterClerkId),
          },
        },
      );
    },

    async updatePending(input) {
      await logger.operation(
        loggerMessages.database.feedback.updatePending,
        async () => {
          assertPositiveInteger(input.feedbackId, "feedbackId");
          const normalized = normalizeFeedbackDetails(input);
          const updated = await db
            .update(schema.feedback)
            .set({
              category: normalized.category ?? null,
              description: normalized.description,
              title: normalized.title,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(schema.feedback.id, input.feedbackId),
                eq(schema.feedback.status, "pending"),
              ),
            )
            .returning({ id: schema.feedback.id });
          if (updated.length === 0) throw new FeedbackStateError();
        },
      );
    },
  };
}

function normalizeFeedbackInput(input: SubmitFeedbackInput) {
  return {
    ...normalizeFeedbackDetails(input),
    submitterClerkId: normalizedClerkId(input.submitterClerkId),
  };
}

function normalizeFeedbackDetails(
  input: Pick<SubmitFeedbackInput, "category" | "description" | "title">,
) {
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title || title.length > 120) throw new Error("Invalid feedback title.");
  if (!description || description.length > 5000) {
    throw new Error("Invalid feedback description.");
  }
  if (
    input.category !== undefined &&
    !schema.feedbackCategories.includes(input.category)
  ) {
    throw new Error("Invalid feedback category.");
  }
  return {
    category: input.category,
    description,
    title,
  };
}

function normalizedClerkId(value: string) {
  const clerkId = value.trim();
  if (!clerkId) throw new Error("submitterClerkId is required.");
  return clerkId;
}

function assertPositiveInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
}
