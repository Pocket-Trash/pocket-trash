import type { Database, FeedbackCategory } from "@package/database";
import { schema } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import {
  and,
  count,
  desc,
  eq,
  inArray,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { hashLogIdentifier } from "../../logging.js";

const activeStatuses: (typeof schema.feedbackStatuses)[number][] = [
  "pending",
  "requested",
  "planned",
  "in_progress",
];
const hiddenFromSubmitterStatuses: (typeof schema.feedbackStatuses)[number][] =
  ["merged", "denied", "canceled"];
const publicStatuses: (typeof schema.feedbackStatuses)[number][] = [
  "requested",
  "planned",
  "in_progress",
];

export type FeedbackListItem = Omit<
  typeof schema.feedback.$inferSelect,
  "submitterClerkId"
> & {
  hasPermanentVote: boolean;
  hasVoted: boolean;
  voteCount: number;
};

export type FeedbackPage = {
  hasNext: boolean;
  items: FeedbackListItem[];
};

export type ListMyFeedbackOptions = {
  offset?: number;
  search?: string;
};

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
  findDuplicates(
    viewerClerkId: string,
    title: string,
  ): Promise<FeedbackListItem[]>;
  hasMine(submitterClerkId: string): Promise<boolean>;
  listActive(
    viewerClerkId: string,
    search?: string,
  ): Promise<FeedbackListItem[]>;
  listMine(
    submitterClerkId: string,
    options?: ListMyFeedbackOptions,
  ): Promise<FeedbackPage>;
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
  toggleVote(feedbackId: number, voterClerkId: string): Promise<boolean>;
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

    async findDuplicates(viewerClerkId, title) {
      return await logger.operation(
        loggerMessages.database.feedback.findDuplicates,
        async () => {
          const viewer = normalizedClerkId(viewerClerkId);
          const words = duplicateWords(title);
          if (words.length === 0) return [];
          const matches = words.map(feedbackContainsWord);
          const relevance = sql<number>`${sql.join(
            matches.map(
              (match) => sql<number>`case when ${match} then 1 else 0 end`,
            ),
            sql` + `,
          )}`;
          return await db
            .select(feedbackListColumns(viewer))
            .from(schema.feedback)
            .where(
              and(
                inArray(schema.feedback.status, publicStatuses),
                or(...matches),
              ),
            )
            .orderBy(
              desc(relevance),
              desc(feedbackVoteCount()),
              desc(schema.feedback.updatedAt),
              desc(schema.feedback.id),
            )
            .limit(5);
        },
        { attributes: { clerkIdHash: hashLogIdentifier(viewerClerkId) } },
      );
    },

    async hasMine(submitterClerkId) {
      return await logger.operation(
        loggerMessages.database.feedback.hasMine,
        async () => {
          const clerkId = normalizedClerkId(submitterClerkId);
          const rows = await db
            .select({ id: schema.feedback.id })
            .from(schema.feedback)
            .where(
              and(
                eq(schema.feedback.submitterClerkId, clerkId),
                notInArray(schema.feedback.status, hiddenFromSubmitterStatuses),
              ),
            )
            .limit(1);
          return rows.length > 0;
        },
        { attributes: { clerkIdHash: hashLogIdentifier(submitterClerkId) } },
      );
    },

    async listActive(viewerClerkId, search) {
      return await logger.operation(
        loggerMessages.database.feedback.listActive,
        async () => {
          const viewer = normalizedClerkId(viewerClerkId);
          const terms = normalizedSearch(search);
          return await db
            .select(feedbackListColumns(viewer))
            .from(schema.feedback)
            .where(
              and(
                inArray(schema.feedback.status, publicStatuses),
                terms.length > 0
                  ? and(...terms.map(feedbackContains))
                  : undefined,
              ),
            )
            .orderBy(
              sql`case ${schema.feedback.status}
                when 'in_progress' then 0
                when 'planned' then 1
                else 2
              end`,
              desc(feedbackVoteCount()),
              desc(schema.feedback.updatedAt),
              desc(schema.feedback.id),
            )
            .limit(40);
        },
        { attributes: { clerkIdHash: hashLogIdentifier(viewerClerkId) } },
      );
    },

    async listMine(submitterClerkId, options = {}) {
      return await logger.operation(
        loggerMessages.database.feedback.listMine,
        async () => {
          const clerkId = normalizedClerkId(submitterClerkId);
          const offset = normalizedOffset(options.offset);
          const terms = normalizedSearch(options.search);
          const rows = await db
            .select(feedbackListColumns(clerkId))
            .from(schema.feedback)
            .where(
              and(
                eq(schema.feedback.submitterClerkId, clerkId),
                notInArray(schema.feedback.status, hiddenFromSubmitterStatuses),
                terms.length > 0
                  ? and(...terms.map(feedbackContains))
                  : undefined,
              ),
            )
            .orderBy(desc(schema.feedback.updatedAt), desc(schema.feedback.id))
            .limit(31)
            .offset(offset);
          return { hasNext: rows.length > 30, items: rows.slice(0, 30) };
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

    async toggleVote(feedbackId, voterClerkId) {
      return await logger.operation(
        loggerMessages.database.feedback.toggleVote,
        async () => {
          assertPositiveInteger(feedbackId, "feedbackId");
          const voter = normalizedClerkId(voterClerkId);
          return await db.transaction(async (tx) => {
            const feedback = await tx
              .select({ id: schema.feedback.id })
              .from(schema.feedback)
              .where(
                and(
                  eq(schema.feedback.id, feedbackId),
                  inArray(schema.feedback.status, publicStatuses),
                ),
              )
              .limit(1);
            if (feedback.length === 0) throw new FeedbackStateError();

            const [existing] = await tx
              .select({ isPermanent: schema.feedbackVotes.isPermanent })
              .from(schema.feedbackVotes)
              .where(
                and(
                  eq(schema.feedbackVotes.feedbackId, feedbackId),
                  eq(schema.feedbackVotes.voterClerkId, voter),
                ),
              );
            if (existing?.isPermanent) return true;
            if (existing) {
              await tx
                .delete(schema.feedbackVotes)
                .where(
                  and(
                    eq(schema.feedbackVotes.feedbackId, feedbackId),
                    eq(schema.feedbackVotes.voterClerkId, voter),
                  ),
                );
              return false;
            }

            await tx
              .insert(schema.feedbackVotes)
              .values({ feedbackId, voterClerkId: voter })
              .onConflictDoNothing();
            return true;
          });
        },
        { attributes: { clerkIdHash: hashLogIdentifier(voterClerkId) } },
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

function feedbackListColumns(viewerClerkId: string) {
  return {
    category: schema.feedback.category,
    createdAt: schema.feedback.createdAt,
    description: schema.feedback.description,
    hasPermanentVote: sql<boolean>`exists (
      select 1 from feedback_votes
      where feedback_id = ${schema.feedback.id}
        and voter_clerk_id = ${viewerClerkId}
        and is_permanent = true
    )`,
    hasVoted: sql<boolean>`exists (
      select 1 from feedback_votes
      where feedback_id = ${schema.feedback.id}
        and voter_clerk_id = ${viewerClerkId}
    )`,
    id: schema.feedback.id,
    status: schema.feedback.status,
    title: schema.feedback.title,
    updatedAt: schema.feedback.updatedAt,
    voteCount: feedbackVoteCount(),
  };
}

function feedbackVoteCount() {
  return sql<number>`(
    select count(*)::int from feedback_votes
    where feedback_id = ${schema.feedback.id}
  )`;
}

function feedbackContains(value: string) {
  return sql<boolean>`(
    strpos(lower(${schema.feedback.title}), lower(${value})) > 0
    or strpos(lower(${schema.feedback.description}), lower(${value})) > 0
  )`;
}

function feedbackContainsWord(value: string) {
  return sql<boolean>`${value} = any(regexp_split_to_array(
    lower(${schema.feedback.title} || ' ' || ${schema.feedback.description}),
    '[^[:alnum:]]+'
  ))`;
}

function duplicateWords(value: string) {
  const title = value.trim();
  if (!title || title.length > 120) throw new Error("Invalid feedback title.");
  return [...new Set(title.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];
}

function normalizedOffset(value: number | undefined) {
  const offset = value ?? 0;
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error("offset must be a non-negative integer.");
  }
  return offset;
}

function normalizedSearch(value: string | undefined) {
  const search = value?.trim() ?? "";
  if (search.length > 120) throw new Error("Invalid feedback search.");
  return search.split(/\s+/).filter(Boolean);
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
