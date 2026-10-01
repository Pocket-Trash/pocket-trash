import type {
  Database,
  FeedbackCategory,
  FeedbackStatus,
} from "@package/database";
import { schema } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  notInArray,
  or,
  type SQL,
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
const editableStatuses: (typeof schema.feedbackStatuses)[number][] = [
  "pending",
  "requested",
  "planned",
  "in_progress",
  "completed",
];
const publicStatuses: (typeof schema.feedbackStatuses)[number][] = [
  "requested",
  "planned",
  "in_progress",
];
const syncableStatuses: (typeof schema.feedbackStatuses)[number][] = [
  ...activeStatuses,
  "completed",
  "canceled",
];
export const adminFeedbackArchiveStatuses = schema.feedbackStatuses.filter(
  (status) => !activeStatuses.includes(status),
);

export type FeedbackListItem = Omit<
  typeof schema.feedback.$inferSelect,
  "linearClientUuid" | "linearUpdatedAt" | "submitterClerkId"
> & {
  hasPermanentVote: boolean;
  hasVoted: boolean;
  voteCount: number;
};

export type FeedbackPage = {
  hasNext: boolean;
  items: FeedbackListItem[];
};

export type AdminFeedbackItem = {
  category: FeedbackCategory | null;
  createdAt: Date;
  description: string;
  id: number;
  linearClientUuid: string | null;
  status: FeedbackStatus;
  submitterUsername: string | null;
  title: string;
  updatedAt: Date;
  voteCount: number;
};

export type AdminFeedbackPage = {
  hasNext: boolean;
  items: AdminFeedbackItem[];
};

export type AdminFeedbackSortField =
  | "category"
  | "status"
  | "submitted"
  | "submitter"
  | "title"
  | "updated"
  | "votes";

export type AdminFeedbackSort = {
  direction: "asc" | "desc";
  field: AdminFeedbackSortField;
};

export type ListAdminFeedbackOptions = {
  offset?: number;
  search?: string;
  sort?: AdminFeedbackSort[];
  statuses?: FeedbackStatus[];
};

export type FeedbackMergeTarget = Pick<
  AdminFeedbackItem,
  "id" | "status" | "title"
>;

export type FeedbackNotificationItem = {
  createdAt: Date;
  feedbackId: number;
  id: number;
  readAt: Date | null;
  readByUsername: string | null;
  submitterUsername: string | null;
  title: string;
  type: (typeof schema.feedbackNotificationTypes)[number];
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

export type UpdateAdminFeedbackInput = {
  category?: FeedbackCategory;
  description: string;
  feedbackId: number;
  title: string;
};

export type UpdatePendingFeedbackInput = UpdateAdminFeedbackInput;

export type FeedbackPlanReservation = Pick<
  AdminFeedbackItem,
  "category" | "description" | "id" | "title"
> & { linearClientUuid: string };

export type LinearFeedbackSyncInput = {
  action: "create" | "remove" | "sync" | "update";
  archived?: boolean;
  entityType: "issue" | "project";
  entityUuid: string;
  occurredAt: Date;
  stateType?: string;
};

export type LinearFeedbackSyncResult = "ignored" | "not_found" | "updated";

export type FeedbackService = {
  approve(feedbackId: number): Promise<void>;
  completeLinearPlan(
    feedbackId: number,
    linearClientUuid: string,
  ): Promise<void>;
  deny(feedbackId: number): Promise<void>;
  findDuplicates(
    viewerClerkId: string,
    title: string,
  ): Promise<FeedbackListItem[]>;
  getLinearSyncTarget(feedbackId: number): Promise<string | undefined>;
  hasMine(submitterClerkId: string): Promise<boolean>;
  listActive(
    viewerClerkId: string,
    search?: string,
  ): Promise<FeedbackListItem[]>;
  listAdminActive(
    options?: ListAdminFeedbackOptions,
  ): Promise<AdminFeedbackPage>;
  listArchive(options?: ListAdminFeedbackOptions): Promise<AdminFeedbackPage>;
  listCompleted(
    viewerClerkId: string,
    search?: string,
  ): Promise<FeedbackListItem[]>;
  listMergeTargets(): Promise<FeedbackMergeTarget[]>;
  listMine(
    submitterClerkId: string,
    options?: ListMyFeedbackOptions,
  ): Promise<FeedbackPage>;
  listNotifications(): Promise<FeedbackNotificationItem[]>;
  listPending(
    options?: ListAdminFeedbackOptions | number,
  ): Promise<AdminFeedbackPage>;
  markNotificationRead(
    notificationId: number,
    actorClerkId: string,
  ): Promise<void>;
  mergePending(feedbackId: number, targetId: number): Promise<void>;
  reserveLinearPlan(
    feedbackId: number,
    linearClientUuid: string,
  ): Promise<FeedbackPlanReservation>;
  submit(
    input: SubmitFeedbackInput,
  ): Promise<typeof schema.feedback.$inferSelect>;
  syncLinearStatus(
    input: LinearFeedbackSyncInput,
  ): Promise<LinearFeedbackSyncResult>;
  toggleVote(feedbackId: number, voterClerkId: string): Promise<boolean>;
  updateAdmin(input: UpdateAdminFeedbackInput): Promise<void>;
  updatePending(input: UpdatePendingFeedbackInput): Promise<void>;
};

export class FeedbackSubmissionLimitError extends Error {}
export class FeedbackStateError extends Error {}
export class FeedbackPlanRecoveryRequiredError extends Error {}

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

    async completeLinearPlan(feedbackId, linearClientUuid) {
      await logger.operation(
        loggerMessages.database.feedback.completeLinearPlan,
        async () => {
          assertPositiveInteger(feedbackId, "feedbackId");
          assertUuid(linearClientUuid);
          const updated = await db
            .update(schema.feedback)
            .set({ status: "planned", updatedAt: new Date() })
            .where(
              and(
                eq(schema.feedback.id, feedbackId),
                eq(schema.feedback.status, "requested"),
                eq(schema.feedback.linearClientUuid, linearClientUuid),
              ),
            )
            .returning({ id: schema.feedback.id });
          if (updated.length > 0) return;

          const [existing] = await db
            .select({
              linearClientUuid: schema.feedback.linearClientUuid,
              status: schema.feedback.status,
            })
            .from(schema.feedback)
            .where(eq(schema.feedback.id, feedbackId))
            .limit(1);
          if (
            existing?.status === "planned" &&
            existing.linearClientUuid === linearClientUuid
          ) {
            return;
          }
          throw new FeedbackStateError();
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
                inArray(schema.feedback.status, ["pending", "requested"]),
                isNull(schema.feedback.linearClientUuid),
              ),
            )
            .returning({ id: schema.feedback.id });
          if (updated.length > 0) return;

          const [feedback] = await db
            .select({
              linearClientUuid: schema.feedback.linearClientUuid,
              status: schema.feedback.status,
            })
            .from(schema.feedback)
            .where(eq(schema.feedback.id, feedbackId))
            .limit(1);
          if (
            feedback?.status === "requested" &&
            feedback.linearClientUuid !== null
          ) {
            throw new FeedbackPlanRecoveryRequiredError();
          }
          throw new FeedbackStateError();
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

    async getLinearSyncTarget(feedbackId) {
      return await logger.operation(
        loggerMessages.database.feedback.getLinearSyncTarget,
        async () => {
          assertPositiveInteger(feedbackId, "feedbackId");
          const [target] = await db
            .select({ linearClientUuid: schema.feedback.linearClientUuid })
            .from(schema.feedback)
            .where(
              and(
                eq(schema.feedback.id, feedbackId),
                inArray(schema.feedback.status, syncableStatuses),
              ),
            );
          return target?.linearClientUuid ?? undefined;
        },
        { attributes: { feedbackId } },
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

    async listAdminActive(options = {}) {
      return await logger.operation(
        loggerMessages.database.feedback.listAdminActive,
        async () => await listAdminFeedback(db, "active", options),
      );
    },

    async listArchive(options = {}) {
      return await logger.operation(
        loggerMessages.database.feedback.listArchive,
        async () => await listAdminFeedback(db, "archive", options),
      );
    },

    async listCompleted(viewerClerkId, search) {
      return await logger.operation(
        loggerMessages.database.feedback.listCompleted,
        async () => {
          const viewer = normalizedClerkId(viewerClerkId);
          const terms = normalizedSearch(search);
          return await db
            .select(feedbackListColumns(viewer))
            .from(schema.feedback)
            .where(
              and(
                eq(schema.feedback.status, "completed"),
                terms.length > 0
                  ? and(...terms.map(feedbackContains))
                  : undefined,
              ),
            )
            .orderBy(
              desc(schema.feedback.completedAt),
              desc(schema.feedback.id),
            )
            .limit(40);
        },
        { attributes: { clerkIdHash: hashLogIdentifier(viewerClerkId) } },
      );
    },

    async listMergeTargets() {
      return await logger.operation(
        loggerMessages.database.feedback.listMergeTargets,
        async () =>
          await db
            .select({
              id: schema.feedback.id,
              status: schema.feedback.status,
              title: schema.feedback.title,
            })
            .from(schema.feedback)
            .where(inArray(schema.feedback.status, publicStatuses))
            .orderBy(asc(schema.feedback.title), asc(schema.feedback.id)),
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

    async listNotifications() {
      return await logger.operation(
        loggerMessages.database.feedback.listNotifications,
        async () => {
          const result = await db.execute<FeedbackNotificationItem>(sql`
            select
              feedback_notifications.id,
              feedback_notifications.type,
              feedback_notifications.feedback_id as "feedbackId",
              feedback.title,
              submitter.username as "submitterUsername",
              feedback_notifications.created_at as "createdAt",
              feedback_notifications.read_at as "readAt",
              reader.username as "readByUsername"
            from feedback_notifications
            inner join feedback
              on feedback.id = feedback_notifications.feedback_id
            left join users submitter
              on submitter.clerk_id = feedback.submitter_clerk_id
            left join users reader
              on reader.clerk_id = feedback_notifications.read_by_clerk_id
            order by feedback_notifications.created_at desc,
              feedback_notifications.id desc
          `);
          return result.rows;
        },
      );
    },

    async listPending(options = {}) {
      return await logger.operation(
        loggerMessages.database.feedback.listPending,
        async () =>
          await listAdminFeedback(
            db,
            "pending",
            typeof options === "number" ? { offset: options } : options,
          ),
      );
    },

    async markNotificationRead(notificationId, actorClerkId) {
      await logger.operation(
        loggerMessages.database.feedback.markNotificationRead,
        async () => {
          assertPositiveInteger(notificationId, "notificationId");
          const actor = actorClerkId.trim();
          if (!actor) throw new Error("actorClerkId is required.");
          await db.execute(sql`
            update feedback_notifications
            set read_at = now(), read_by_clerk_id = ${actor}
            where id = ${notificationId} and read_at is null
          `);
        },
        {
          attributes: {
            actorClerkIdHash: hashLogIdentifier(actorClerkId),
            notificationId,
          },
        },
      );
    },

    async reserveLinearPlan(feedbackId, linearClientUuid) {
      return await logger.operation(
        loggerMessages.database.feedback.reserveLinearPlan,
        async () => {
          assertPositiveInteger(feedbackId, "feedbackId");
          assertUuid(linearClientUuid);
          const [reserved] = await db
            .update(schema.feedback)
            .set({
              linearClientUuid: sql`coalesce(${schema.feedback.linearClientUuid}, ${linearClientUuid})`,
            })
            .where(
              and(
                eq(schema.feedback.id, feedbackId),
                eq(schema.feedback.status, "requested"),
              ),
            )
            .returning({
              category: schema.feedback.category,
              description: schema.feedback.description,
              id: schema.feedback.id,
              linearClientUuid: schema.feedback.linearClientUuid,
              title: schema.feedback.title,
            });
          if (!reserved?.linearClientUuid) throw new FeedbackStateError();
          return {
            ...reserved,
            linearClientUuid: reserved.linearClientUuid,
          };
        },
      );
    },

    async mergePending(feedbackId, targetId) {
      await logger.operation(
        loggerMessages.database.feedback.mergePending,
        async () => {
          assertPositiveInteger(feedbackId, "feedbackId");
          assertPositiveInteger(targetId, "targetId");
          if (feedbackId === targetId) throw new FeedbackStateError();

          await db.transaction(async (tx) => {
            const [source] = await tx
              .select({
                status: schema.feedback.status,
                submitterClerkId: schema.feedback.submitterClerkId,
              })
              .from(schema.feedback)
              .where(eq(schema.feedback.id, feedbackId))
              .for("update");
            const [target] = await tx
              .select({ status: schema.feedback.status })
              .from(schema.feedback)
              .where(eq(schema.feedback.id, targetId))
              .for("update");
            if (
              source?.status !== "pending" ||
              !target ||
              !publicStatuses.includes(target.status)
            ) {
              throw new FeedbackStateError();
            }

            await tx
              .insert(schema.feedbackVotes)
              .values({
                feedbackId: targetId,
                isPermanent: false,
                voterClerkId: source.submitterClerkId,
              })
              .onConflictDoNothing();
            const updated = await tx
              .update(schema.feedback)
              .set({ status: "merged", updatedAt: new Date() })
              .where(
                and(
                  eq(schema.feedback.id, feedbackId),
                  eq(schema.feedback.status, "pending"),
                ),
              )
              .returning({ id: schema.feedback.id });
            if (updated.length === 0) throw new FeedbackStateError();
          });
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

    async syncLinearStatus(input) {
      return await logger.operation(
        loggerMessages.database.feedback.syncLinearStatus,
        async () => {
          assertUuid(input.entityUuid);
          if (Number.isNaN(input.occurredAt.getTime())) {
            throw new Error("occurredAt must be a valid date.");
          }
          const status = linearFeedbackStatus(input);

          return await db.transaction(async (tx) => {
            const [current] = await tx
              .select({
                id: schema.feedback.id,
                linearUpdatedAt: schema.feedback.linearUpdatedAt,
                status: schema.feedback.status,
              })
              .from(schema.feedback)
              .where(eq(schema.feedback.linearClientUuid, input.entityUuid))
              .for("update");
            if (!current) return "not_found";
            if (
              current.linearUpdatedAt &&
              current.linearUpdatedAt >= input.occurredAt
            ) {
              return "ignored";
            }

            if (!status || current.status === status) {
              await tx
                .update(schema.feedback)
                .set({ linearUpdatedAt: input.occurredAt })
                .where(eq(schema.feedback.id, current.id));
              return "ignored";
            }

            await tx
              .update(schema.feedback)
              .set({
                completedAt: status === "completed" ? input.occurredAt : null,
                linearUpdatedAt: input.occurredAt,
                status,
                updatedAt: input.occurredAt,
              })
              .where(eq(schema.feedback.id, current.id));
            if (status === "completed") {
              await tx.insert(schema.feedbackNotifications).values({
                feedbackId: current.id,
                type: "completed",
              });
            }
            return "updated";
          });
        },
        {
          attributes: {
            linearEntityUuidHash: hashLogIdentifier(input.entityUuid),
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

    async updateAdmin(input) {
      await logger.operation(
        loggerMessages.database.feedback.updateAdmin,
        async () => await updateAdminFeedback(db, input),
      );
    },

    async updatePending(input) {
      await logger.operation(
        loggerMessages.database.feedback.updatePending,
        async () => await updateAdminFeedback(db, input, ["pending"]),
      );
    },
  };
}

async function updateAdminFeedback(
  db: Database,
  input: UpdateAdminFeedbackInput,
  statuses = editableStatuses,
) {
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
        inArray(schema.feedback.status, statuses),
      ),
    )
    .returning({ id: schema.feedback.id });
  if (updated.length === 0) throw new FeedbackStateError();
}

async function listAdminFeedback(
  db: Database,
  scope: "active" | "archive" | "pending",
  options: ListAdminFeedbackOptions,
): Promise<AdminFeedbackPage> {
  const offset = normalizedOffset(options.offset);
  const terms = normalizedSearch(options.search);
  const allowedSorts =
    scope === "pending"
      ? (["category", "submitted", "submitter", "title"] as const)
      : scope === "active"
        ? ([
            "category",
            "status",
            "submitter",
            "title",
            "updated",
            "votes",
          ] as const)
        : (["category", "status", "submitter", "title"] as const);
  const sorts = normalizedAdminSort(
    options.sort,
    scope === "pending" ? 1 : 2,
    allowedSorts,
  );
  const statuses =
    scope === "archive"
      ? normalizedArchiveStatuses(options.statuses)
      : scope === "active"
        ? normalizedActiveStatuses(options.statuses)
        : [];
  const statusCondition =
    scope === "pending"
      ? eq(schema.feedback.status, "pending")
      : scope === "active"
        ? inArray(schema.feedback.status, statuses)
        : statuses.length > 0
          ? inArray(schema.feedback.status, statuses)
          : notInArray(schema.feedback.status, activeStatuses);
  const orderBy = sorts.map(adminSortExpression);
  if (scope === "pending" && orderBy.length === 0) {
    orderBy.push(desc(schema.feedback.createdAt));
  }
  if (scope === "archive" && orderBy.length === 0) {
    orderBy.push(desc(schema.feedback.updatedAt));
  }
  if (scope === "active" && !sorts.some(({ field }) => field === "votes")) {
    orderBy.push(desc(feedbackVoteCount()));
  }
  orderBy.push(desc(schema.feedback.id));

  const rows = await db
    .select(adminFeedbackColumns())
    .from(schema.feedback)
    .leftJoin(
      schema.user,
      eq(schema.user.clerkId, schema.feedback.submitterClerkId),
    )
    .where(
      and(
        statusCondition,
        terms.length > 0 ? and(...terms.map(feedbackContains)) : undefined,
      ),
    )
    .orderBy(...orderBy)
    .limit(31)
    .offset(offset);
  return { hasNext: rows.length > 30, items: rows.slice(0, 30) };
}

function adminFeedbackColumns() {
  return {
    category: schema.feedback.category,
    createdAt: schema.feedback.createdAt,
    description: schema.feedback.description,
    id: schema.feedback.id,
    linearClientUuid: schema.feedback.linearClientUuid,
    status: schema.feedback.status,
    submitterUsername: schema.user.username,
    title: schema.feedback.title,
    updatedAt: sql<Date>`coalesce(${schema.feedback.updatedAt}, ${schema.feedback.createdAt})`,
    voteCount: feedbackVoteCount(),
  };
}

function normalizedAdminSort(
  value: AdminFeedbackSort[] | undefined,
  max: number,
  allowed: readonly AdminFeedbackSortField[],
) {
  const sorts = value ?? [];
  if (sorts.length > max) throw new Error(`At most ${max} sorts are allowed.`);
  const seen = new Set<AdminFeedbackSortField>();
  for (const sort of sorts) {
    if (
      !allowed.includes(sort.field) ||
      (sort.direction !== "asc" && sort.direction !== "desc") ||
      seen.has(sort.field)
    ) {
      throw new Error("Invalid feedback sort.");
    }
    seen.add(sort.field);
  }
  return sorts;
}

function normalizedArchiveStatuses(value: FeedbackStatus[] | undefined) {
  const statuses = value ?? [];
  if (
    new Set(statuses).size !== statuses.length ||
    statuses.some((status) => !adminFeedbackArchiveStatuses.includes(status))
  ) {
    throw new Error("Invalid feedback archive status.");
  }
  return statuses;
}

function normalizedActiveStatuses(value: FeedbackStatus[] | undefined) {
  const statuses = value?.length ? value : activeStatuses;
  if (
    new Set(statuses).size !== statuses.length ||
    statuses.some((status) => !activeStatuses.includes(status))
  ) {
    throw new Error("Invalid active feedback status.");
  }
  return statuses;
}

function adminSortExpression(sort: AdminFeedbackSort): SQL {
  const direction = sort.direction === "asc" ? asc : desc;
  if (sort.field === "category") return direction(schema.feedback.category);
  if (sort.field === "status") return direction(schema.feedback.status);
  if (sort.field === "submitted") return direction(schema.feedback.createdAt);
  if (sort.field === "submitter") {
    return direction(
      sql<string>`coalesce(${schema.user.username}, ${schema.feedback.submitterClerkId})`,
    );
  }
  if (sort.field === "title") return direction(schema.feedback.title);
  if (sort.field === "updated") {
    return direction(
      sql<Date>`coalesce(${schema.feedback.updatedAt}, ${schema.feedback.createdAt})`,
    );
  }
  return direction(feedbackVoteCount());
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
    completedAt: schema.feedback.completedAt,
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

function linearFeedbackStatus(
  input: LinearFeedbackSyncInput,
): FeedbackStatus | undefined {
  if (input.action === "create") return;
  if (input.action === "remove" || input.archived) return "canceled";
  if (input.entityType === "issue") {
    if (input.stateType === "started") return "in_progress";
    if (input.stateType === "completed") return "completed";
    if (input.stateType === "canceled") return "canceled";
    if (input.stateType === "backlog" || input.stateType === "unstarted") {
      return "requested";
    }
    return;
  }
  if (input.stateType === "planned") return "planned";
  if (input.stateType === "started") return "in_progress";
  if (input.stateType === "completed") return "completed";
  if (input.stateType === "canceled") return "canceled";
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

function assertUuid(value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new Error("linearClientUuid must be a UUID.");
  }
}
