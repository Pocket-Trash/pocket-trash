import type {
  AuditJsonObject,
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
import { type Actor, hasPermission } from "../../authorization.js";
import { hashLogIdentifier } from "../../logging.js";
import { feedbackAudit, writeFeedbackAudit } from "../audit/feedback.js";
import type { AuditService } from "../audit/index.js";

/** Feedback states processed by active-list, limit, and synchronization flows. */
const activeStatuses: (typeof schema.feedbackStatuses)[number][] = [
  "pending",
  "requested",
  "planned",
  "in_progress",
];
/** Terminal states excluded from a submitter's personal feedback list. */
const hiddenFromSubmitterStatuses: (typeof schema.feedbackStatuses)[number][] =
  ["merged", "denied", "canceled"];
/** States in which administrators may still edit feedback details. */
const editableStatuses: (typeof schema.feedbackStatuses)[number][] = [
  "pending",
  "requested",
  "planned",
  "in_progress",
  "completed",
];
/** States visible in public discovery and voting views. */
const publicStatuses: (typeof schema.feedbackStatuses)[number][] = [
  "requested",
  "planned",
  "in_progress",
];
/** Feedback statuses eligible for manual Linear synchronization. */
const syncableStatuses: (typeof schema.feedbackStatuses)[number][] = [
  ...activeStatuses,
  "completed",
  "canceled",
];
/** Non-active states accepted by administrative archive filters. */
export const adminFeedbackArchiveStatuses = schema.feedbackStatuses.filter(
  (status) => !activeStatuses.includes(status),
);

/** Feedback item shown in authenticated public lists. */
export type FeedbackListItem = Omit<
  typeof schema.feedback.$inferSelect,
  "linearClientUuid" | "linearUpdatedAt" | "submitterClerkId"
> & {
  /**
   * Whether the current vote is the submitter's non-removable vote.
   */
  hasPermanentVote: boolean;
  /**
   * Whether the current viewer has voted for this feedback.
   */
  hasVoted: boolean;
  /**
   * Total votes, including the submitter's permanent vote.
   */
  voteCount: number;
};

/**
 * Paginated feedback items and whether another page exists.
 */
export type FeedbackPage = {
  /**
   * Whether another page is available after these items.
   */
  hasNext: boolean;
  /**
   * Feedback items ordered by most recent update, then identifier.
   */
  items: FeedbackListItem[];
};

/** Feedback item shown in admin lists. */
export type AdminFeedbackItem = {
  /**
   * Feedback category, or `null` when uncategorized.
   */
  category: FeedbackCategory | null;
  /**
   * Created timestamp.
   */
  createdAt: Date;
  /**
   * Feedback description supplied by the submitter.
   */
  description: string;
  /**
   * Database identifier.
   */
  id: number;
  /** Linked Linear entity identifier, or `null` before planning is reserved. */
  linearClientUuid: string | null;
  /**
   * Current feedback workflow status.
   */
  status: FeedbackStatus;
  /**
   * Submitter username, or `null` when the identity is unavailable.
   */
  submitterUsername: string | null;
  /**
   * Feedback title.
   */
  title: string;
  /**
   * Updated timestamp.
   */
  updatedAt: Date;
  /**
   * Total votes, including the submitter's permanent vote.
   */
  voteCount: number;
};

/**
 * Paginated administrative feedback results.
 */
export type AdminFeedbackPage = {
  /**
   * Whether another administrative page is available.
   */
  hasNext: boolean;
  /**
   * Administrative feedback items in the requested order.
   */
  items: AdminFeedbackItem[];
};

/**
 * Feedback field available for administrative sorting.
 */
export type AdminFeedbackSortField =
  | "category"
  | "status"
  | "submitted"
  | "submitter"
  | "title"
  | "updated"
  | "votes";

/**
 * One ordered administrative feedback sort criterion.
 */
export type AdminFeedbackSort = {
  /**
   * Ascending or descending order.
   */
  direction: "asc" | "desc";
  /**
   * Feedback field used for this sort criterion.
   */
  field: AdminFeedbackSortField;
};

/**
 * Pagination, search, status, and sorting filters for the admin list.
 */
export type ListAdminFeedbackOptions = {
  /**
   * Zero-based pagination offset.
   */
  offset?: number;
  /**
   * Optional case-insensitive text search.
   */
  search?: string;
  /**
   * Ordered sort criteria applied before pagination.
   */
  sort?: AdminFeedbackSort[];
  /**
   * Workflow statuses included in the results.
   */
  statuses?: FeedbackStatus[];
};

/**
 * Minimal active-feedback record shown as a merge destination.
 */
export type FeedbackMergeTarget = Pick<
  AdminFeedbackItem,
  "id" | "status" | "title"
>;

/**
 * Feedback lifecycle notification shown in the administrative inbox.
 */
export type FeedbackNotificationItem = {
  /**
   * Created timestamp.
   */
  createdAt: Date;
  /**
   * Feedback identifier.
   */
  feedbackId: number;
  /**
   * Database identifier.
   */
  id: number;
  /**
   * Read timestamp, or `null` while unread.
   */
  readAt: Date | null;
  /**
   * Reader username, or `null` while unread or when the identity is unavailable.
   */
  readByUsername: string | null;
  /**
   * Submitter username, or `null` when the identity is unavailable.
   */
  submitterUsername: string | null;
  /**
   * Feedback title shown in the notification.
   */
  title: string;
  /**
   * Feedback lifecycle event that created the notification.
   */
  type: (typeof schema.feedbackNotificationTypes)[number];
};

/**
 * Pagination and search filters for a submitter's requests.
 */
export type ListMyFeedbackOptions = {
  /**
   * Zero-based pagination offset.
   */
  offset?: number;
  /**
   * Optional case-insensitive text search.
   */
  search?: string;
};

/**
 * New feedback request and submitter identity.
 */
export type SubmitFeedbackInput = {
  /**
   * Optional category selected by the submitter.
   */
  category?: FeedbackCategory;
  /**
   * Feedback description supplied by the submitter.
   */
  description: string;
  /**
   * Submitter Clerk user identifier.
   */
  submitterClerkId: string;
  /**
   * Feedback title used for display and duplicate detection.
   */
  title: string;
};

/** Actor and editable fields for an administrative feedback update. */
export type UpdateAdminFeedbackInput = {
  /** Authorized staff actor. */
  actor: Actor;
  /** Updated feedback category. */
  category?: FeedbackCategory;
  /** Updated feedback description. */
  description: string;
  /** Feedback identifier. */
  feedbackId: number;
  /** Updated feedback title. */
  title: string;
};

/** Submitter-editable fields for a pending feedback request. */
export type UpdatePendingFeedbackInput = Omit<
  UpdateAdminFeedbackInput,
  "actor"
>;

/** Authorized input for an administrative feedback decision. */
export type FeedbackAdminActionInput = {
  /** Authorized staff actor. */
  actor: Actor;
  /** Feedback identifier. */
  feedbackId: number;
};

/** Authorized input for merging one pending request into another. */
export type MergePendingFeedbackInput = FeedbackAdminActionInput & {
  /** Destination feedback identifier. */
  targetId: number;
};

/** Reserved feedback data used to create a Linear entity. */
export type FeedbackPlanReservation = Pick<
  AdminFeedbackItem,
  "category" | "description" | "id" | "title"
> & {
  /** Reserved Linear client identifier. */
  linearClientUuid: string;
};

/** Linear lifecycle event normalized for feedback synchronization. */
export type LinearFeedbackSyncInput = {
  /** Linear event action. */
  action: "create" | "remove" | "sync" | "update";
  /** Whether the Linear entity is archived. */
  archived?: boolean;
  /** Linear entity kind. */
  entityType: "issue" | "project";
  /** Linear entity identifier. */
  entityUuid: string;
  /** Time the lifecycle change occurred. */
  occurredAt: Date;
  /** Linear workflow or project status type. */
  stateType?: string;
};

/** Result of synchronizing a Linear lifecycle event. */
export type LinearFeedbackSyncResult = "ignored" | "not_found" | "updated";

/** Feedback persistence and lifecycle operations. */
export type FeedbackService = {
  /**
   * Approves a feedback request for planning.
   *
   * @param input - Authorized feedback decision.
   * @returns Completion after the request becomes eligible for planning.
   * @rejects When authorization, validation, state, persistence, audit, or operation logging fails.
   */
  approve(input: FeedbackAdminActionInput): Promise<void>;
  /**
   * Finalizes a Linear planning reservation by marking feedback planned.
   *
   * @param feedbackId - Feedback identifier.
   * @param linearClientUuid - Linked Linear entity identifier.
   * @returns Completion after the feedback is marked planned.
   * @rejects When validation, state, persistence, or operation logging fails.
   */
  completeLinearPlan(
    feedbackId: number,
    linearClientUuid: string,
  ): Promise<void>;
  /**
   * Denies a pending or requested feedback item.
   *
   * @param input - Authorized feedback decision.
   * @returns Completion after denial and its audit event commit.
   * @rejects When authorization, validation, state, persistence, audit, or operation logging fails.
   */
  deny(input: FeedbackAdminActionInput): Promise<void>;
  /**
   * Finds active feedback with similar title terms.
   *
   * @param viewerClerkId - Requesting Clerk user identifier.
   * @param title - Proposed feedback title.
   * @returns Up to five possible duplicate requests.
   * @rejects When validation, persistence, or operation logging fails.
   */
  findDuplicates(
    viewerClerkId: string,
    title: string,
  ): Promise<FeedbackListItem[]>;
  /**
   * Finds the Linear entity linked to eligible feedback.
   *
   * @param feedbackId - Feedback identifier.
   * @returns The linked Linear identifier, when eligible.
   * @rejects When validation, persistence, or operation logging fails.
   */
  getLinearSyncTarget(feedbackId: number): Promise<string | undefined>;
  /**
   * Checks whether a submitter has visible feedback.
   *
   * @param submitterClerkId - Submitter's Clerk identifier.
   * @returns Whether visible feedback exists.
   * @rejects When validation, persistence, or operation logging fails.
   */
  hasMine(submitterClerkId: string): Promise<boolean>;
  /**
   * Lists active feedback visible to a user.
   *
   * @param viewerClerkId - Requesting Clerk user identifier.
   * @param search - Optional search text.
   * @returns Active feedback matching the search.
   * @rejects When validation, persistence, or operation logging fails.
   */
  listActive(
    viewerClerkId: string,
    search?: string,
  ): Promise<FeedbackListItem[]>;
  /**
   * Lists active feedback for administration.
   *
   * @param options - Search, sorting, and pagination options.
   * @returns The matching active feedback page.
   * @rejects When filters, persistence, or operation logging fails.
   */
  listAdminActive(
    options?: ListAdminFeedbackOptions,
  ): Promise<AdminFeedbackPage>;
  /**
   * Lists archived feedback for administration.
   *
   * @param options - Search, sorting, and pagination options.
   * @returns The matching archived feedback page.
   * @rejects When filters, persistence, or operation logging fails.
   */
  listArchive(options?: ListAdminFeedbackOptions): Promise<AdminFeedbackPage>;
  /**
   * Lists completed feedback for public discovery.
   *
   * @param viewerClerkId - Requesting Clerk user identifier.
   * @param search - Optional search text.
   * @returns Completed feedback ordered by completion date.
   * @rejects When validation, persistence, or operation logging fails.
   */
  listCompleted(
    viewerClerkId: string,
    search?: string,
  ): Promise<FeedbackListItem[]>;
  /**
   * Lists active feedback eligible as merge destinations.
   *
   * @returns Eligible merge targets ordered for selection.
   * @rejects When persistence or operation logging fails.
   */
  listMergeTargets(): Promise<FeedbackMergeTarget[]>;
  /**
   * Lists feedback submitted by one Clerk user.
   *
   * @param submitterClerkId - Submitter clerk identifier.
   * @param options - Pagination and search filters.
   * @returns Paginated feedback visible to the submitter.
   * @rejects When validation, persistence, or operation logging fails.
   */
  listMine(
    submitterClerkId: string,
    options?: ListMyFeedbackOptions,
  ): Promise<FeedbackPage>;
  /**
   * Lists recorded feedback lifecycle notifications.
   *
   * @returns Notifications ordered newest first.
   * @rejects When persistence or operation logging fails.
   */
  listNotifications(): Promise<FeedbackNotificationItem[]>;
  /**
   * Lists pending feedback for administrative review.
   *
   * @param options - Pagination, search, status, and sort filters.
   * @returns Paginated pending feedback.
   * @rejects When filters, persistence, or operation logging fails.
   */
  listPending(
    options?: ListAdminFeedbackOptions | number,
  ): Promise<AdminFeedbackPage>;
  /**
   * Marks an unread feedback notification as read by a Clerk user.
   *
   * @param notificationId - Notification identifier.
   * @param actorClerkId - Actor Clerk identifier.
   * @returns Completion after the notification is marked read.
   * @rejects When validation, persistence, or operation logging fails.
   */
  markNotificationRead(
    notificationId: number,
    actorClerkId: string,
  ): Promise<void>;
  /**
   * Merges a pending request into active feedback.
   *
   * @param input - Authorized source and destination identifiers.
   * @returns Completion of the transactional merge.
   * @rejects When authorization, validation, state, persistence, audit, or operation logging fails.
   */
  mergePending(input: MergePendingFeedbackInput): Promise<void>;
  /**
   * Reserves an idempotent Linear planning operation.
   *
   * @param feedbackId - Feedback identifier.
   * @param linearClientUuid - Linear client UUID.
   * @returns Existing or newly created planning reservation.
   * @rejects When validation, state, persistence, or operation logging fails.
   */
  reserveLinearPlan(
    feedbackId: number,
    linearClientUuid: string,
  ): Promise<FeedbackPlanReservation>;
  /**
   * Creates a pending feedback request and permanent submitter vote.
   *
   * @param input - Feedback fields and submitter identity.
   * @returns Created feedback request.
   * @rejects When validation, submission limits, persistence, or operation logging fails.
   */
  submit(
    input: SubmitFeedbackInput,
  ): Promise<typeof schema.feedback.$inferSelect>;
  /**
   * Applies one Linear lifecycle event transactionally.
   *
   * @param input - Normalized Linear lifecycle event.
   * @returns Whether the event was ignored, unmatched, or applied.
   * @rejects When validation, persistence, or operation logging fails.
   */
  syncLinearStatus(
    input: LinearFeedbackSyncInput,
  ): Promise<LinearFeedbackSyncResult>;
  /**
   * Adds or removes the actor's feedback vote.
   *
   * @param feedbackId - Feedback identifier.
   * @param voterClerkId - Voter clerk identifier.
   * @returns Whether the actor has a vote after the operation.
   * @rejects When validation, state, persistence, or operation logging fails.
   */
  toggleVote(feedbackId: number, voterClerkId: string): Promise<boolean>;
  /**
   * Edits administratively editable feedback fields.
   *
   * @param input - Authorized editable feedback fields.
   * @returns Completion after the field update and audit event commit.
   * @rejects When authorization, validation, state, persistence, audit, or operation logging fails.
   */
  updateAdmin(input: UpdateAdminFeedbackInput): Promise<void>;
  /**
   * Updates a submitter-owned pending feedback request.
   *
   * @param input - Feedback identifier and submitter-editable fields.
   * @returns Completion after the pending request is stored.
   * @rejects When validation, state, persistence, or operation logging fails.
   */
  updatePending(input: UpdatePendingFeedbackInput): Promise<void>;
};

/** Rejects submission after a user reaches the active-feedback limit. */
export class FeedbackSubmissionLimitError extends Error {}
/** Rejects a feedback operation when its row or current state is ineligible. */
export class FeedbackStateError extends Error {}
/** Rejects denial when a reserved Linear plan requires manual recovery. */
export class FeedbackPlanRecoveryRequiredError extends Error {}

/**
 * Creates the feedback data service.
 *
 * @param db - Application database.
 * @param logger - Application logger.
 * @param audit - Shared audit service.
 * @returns The configured feedback service.
 */
export function createFeedbackService(
  db: Database,
  logger: Logger,
  audit: AuditService,
): FeedbackService {
  return {
    /**
     * Approves categorized feedback and records the staff decision.
     *
     * @param input - Authorized feedback decision.
     * @returns Completion after the mutation and audit event commit.
     * @rejects When authorization, validation, state, persistence, audit, or operation logging fails.
     */
    async approve(input) {
      await logger.operation(
        loggerMessages.database.feedback.approve,
        async () => {
          assertFeedbackAdmin(input.actor);
          assertPositiveInteger(input.feedbackId, "feedbackId");
          await db.transaction(async (tx) => {
            const actorUser = await ensureFeedbackAuditUser(
              tx,
              input.actor.clerkId,
            );
            const current = await loadFeedbackAuditState(tx, input.feedbackId);
            if (current.status !== "pending" || current.category === null) {
              throw new FeedbackStateError();
            }
            const updated = await tx
              .update(schema.feedback)
              .set({ status: "requested", updatedAt: new Date() })
              .where(
                and(
                  eq(schema.feedback.id, input.feedbackId),
                  eq(schema.feedback.status, "pending"),
                  sql`${schema.feedback.category} is not null`,
                ),
              )
              .returning({ id: schema.feedback.id });
            if (updated.length === 0) throw new FeedbackStateError();
            await writeFeedbackAudit(audit, tx, {
              actor: input.actor,
              actorUser,
              after: feedbackAuditState(current, { status: "requested" }),
              before: feedbackAuditState(current),
              definition: feedbackAudit.approved,
              ownerUserId: current.ownerUserId,
              targetId: input.feedbackId,
            });
          });
        },
      );
    },

    /**
     * Finalizes a Linear planning reservation by marking feedback planned.
     *
     * @param feedbackId - Feedback identifier.
     * @param linearClientUuid - Linear client UUID.
     * @rejects When validation, state, persistence, or operation logging fails.
     */
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

    /**
     * Denies pending or requested feedback.
     *
     * @param input - Authorized feedback decision.
     * @returns Completion after denial and its audit event commit.
     * @rejects When authorization, validation, state, persistence, audit, or operation logging fails.
     */
    async deny(input) {
      await logger.operation(
        loggerMessages.database.feedback.deny,
        async () => {
          assertFeedbackAdmin(input.actor);
          assertPositiveInteger(input.feedbackId, "feedbackId");
          await db.transaction(async (tx) => {
            const actorUser = await ensureFeedbackAuditUser(
              tx,
              input.actor.clerkId,
            );
            const current = await loadFeedbackAuditState(tx, input.feedbackId);
            if (
              current.status === "requested" &&
              current.linearClientUuid !== null
            ) {
              throw new FeedbackPlanRecoveryRequiredError();
            }
            if (
              current.status !== "pending" &&
              current.status !== "requested"
            ) {
              throw new FeedbackStateError();
            }
            const updated = await tx
              .update(schema.feedback)
              .set({ status: "denied", updatedAt: new Date() })
              .where(
                and(
                  eq(schema.feedback.id, input.feedbackId),
                  inArray(schema.feedback.status, ["pending", "requested"]),
                  isNull(schema.feedback.linearClientUuid),
                ),
              )
              .returning({ id: schema.feedback.id });
            if (updated.length === 0) throw new FeedbackStateError();
            await writeFeedbackAudit(audit, tx, {
              actor: input.actor,
              actorUser,
              after: feedbackAuditState(current, { status: "denied" }),
              before: feedbackAuditState(current),
              definition: feedbackAudit.denied,
              ownerUserId: current.ownerUserId,
              targetId: input.feedbackId,
            });
          });
        },
      );
    },

    /**
     * Finds active feedback with similar title terms.
     *
     * @param viewerClerkId - Requesting Clerk user identifier.
     * @param title - Proposed feedback title.
     * @returns Up to five possible duplicate requests.
     * @rejects When validation, persistence, or operation logging fails.
     */
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

    /**
     * Finds the Linear entity linked to eligible feedback.
     *
     * @param feedbackId - Feedback identifier.
     * @returns The linked Linear identifier, when eligible.
     * @rejects When validation, persistence, or operation logging fails.
     */
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

    /**
     * Checks whether a submitter has visible feedback.
     *
     * @param submitterClerkId - Submitter's Clerk identifier.
     * @returns Whether visible feedback exists.
     * @rejects When validation, persistence, or operation logging fails.
     */
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

    /**
     * Lists active feedback for public discovery.
     *
     * @param viewerClerkId - Requesting Clerk user identifier.
     * @param search - Optional search text.
     * @returns Active feedback grouped by lifecycle status.
     * @rejects When validation, persistence, or operation logging fails.
     */
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

    /**
     * Lists active feedback for administration.
     *
     * @param options - Pagination, search, status, and sort filters.
     * @returns Paginated active feedback.
     * @rejects When filters, persistence, or operation logging fails.
     */
    async listAdminActive(options = {}) {
      return await logger.operation(
        loggerMessages.database.feedback.listAdminActive,
        async () => await listAdminFeedback(db, "active", options),
      );
    },

    /**
     * Lists archived feedback for administration.
     *
     * @param options - Pagination, search, status, and sort filters.
     * @returns Paginated archived feedback.
     * @rejects When filters, persistence, or operation logging fails.
     */
    async listArchive(options = {}) {
      return await logger.operation(
        loggerMessages.database.feedback.listArchive,
        async () => await listAdminFeedback(db, "archive", options),
      );
    },

    /**
     * Lists completed feedback for public discovery.
     *
     * @param viewerClerkId - Requesting Clerk user identifier.
     * @param search - Optional search text.
     * @returns Completed feedback ordered by completion date.
     * @rejects When validation, persistence, or operation logging fails.
     */
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

    /**
     * Lists active feedback eligible as merge destinations.
     *
     * @returns Eligible merge targets ordered for selection.
     * @rejects When persistence or operation logging fails.
     */
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

    /**
     * Lists feedback submitted by one Clerk user.
     *
     * @param submitterClerkId - Submitter clerk identifier.
     * @param options - Pagination and search filters.
     * @returns Paginated feedback visible to the submitter.
     * @rejects When validation, persistence, or operation logging fails.
     */
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

    /**
     * Lists recorded feedback lifecycle notifications.
     *
     * @returns Notifications ordered newest first.
     * @rejects When persistence or operation logging fails.
     */
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

    /**
     * Lists pending feedback for administrative review.
     *
     * @param options - Pagination, search, status, and sort filters.
     * @returns Paginated pending feedback.
     * @rejects When filters, persistence, or operation logging fails.
     */
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

    /**
     * Marks an unread feedback notification as read by a Clerk user.
     *
     * @param notificationId - Notification identifier.
     * @param actorClerkId - Actor Clerk identifier.
     * @rejects When validation, persistence, or operation logging fails.
     */
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

    /**
     * Reserves an idempotent Linear planning operation.
     *
     * @param feedbackId - Feedback identifier.
     * @param linearClientUuid - Linear client uuid.
     * @returns Existing or newly created planning reservation.
     * @rejects When validation, state, persistence, or operation logging fails.
     */
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

    /**
     * Merges a pending feedback request into another request.
     *
     * @param input - Authorized source and destination identifiers.
     * @returns Completion after the merge and audit event commit.
     * @rejects When authorization, validation, state, persistence, audit, or operation logging fails.
     */
    async mergePending(input) {
      await logger.operation(
        loggerMessages.database.feedback.mergePending,
        async () => {
          assertFeedbackAdmin(input.actor);
          assertPositiveInteger(input.feedbackId, "feedbackId");
          assertPositiveInteger(input.targetId, "targetId");
          if (input.feedbackId === input.targetId)
            throw new FeedbackStateError();
          await db.transaction(async (tx) => {
            const actorUser = await ensureFeedbackAuditUser(
              tx,
              input.actor.clerkId,
            );
            const source = await loadFeedbackAuditState(tx, input.feedbackId);
            const [target] = await tx
              .select({ status: schema.feedback.status })
              .from(schema.feedback)
              .where(eq(schema.feedback.id, input.targetId))
              .for("update");
            if (
              source.status !== "pending" ||
              !target ||
              !publicStatuses.includes(target.status)
            ) {
              throw new FeedbackStateError();
            }

            await tx
              .insert(schema.feedbackVotes)
              .values({
                feedbackId: input.targetId,
                isPermanent: false,
                voterClerkId: source.submitterClerkId,
              })
              .onConflictDoNothing();
            const updated = await tx
              .update(schema.feedback)
              .set({ status: "merged", updatedAt: new Date() })
              .where(
                and(
                  eq(schema.feedback.id, input.feedbackId),
                  eq(schema.feedback.status, "pending"),
                ),
              )
              .returning({ id: schema.feedback.id });
            if (updated.length === 0) throw new FeedbackStateError();
            await writeFeedbackAudit(audit, tx, {
              actor: input.actor,
              actorUser,
              after: feedbackAuditState(source, {
                mergedIntoFeedbackId: input.targetId,
                status: "merged",
              }),
              before: feedbackAuditState(source),
              definition: feedbackAudit.merged,
              ownerUserId: source.ownerUserId,
              targetId: input.feedbackId,
            });
          });
        },
      );
    },

    /**
     * Submits feedback and its permanent initial vote.
     *
     * @param input - New feedback details.
     * @returns The created feedback record.
     * @rejects When validation, submission limits, persistence, or operation logging fails.
     */
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

    /**
     * Applies one Linear lifecycle event transactionally.
     *
     * @param input - Normalized Linear lifecycle event.
     * @returns Whether the event was ignored, unmatched, or applied.
     * @rejects When validation, persistence, or operation logging fails.
     */
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

    /**
     * Adds or removes the actor's feedback vote.
     *
     * @param feedbackId - Feedback identifier.
     * @param voterClerkId - Voter clerk identifier.
     * @returns Whether the actor has a vote after the operation.
     * @rejects When validation, state, persistence, or operation logging fails.
     */
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

    /**
     * Updates editable feedback and records the staff mutation.
     *
     * @param input - Authorized editable feedback fields.
     * @returns Completion after the mutation and audit event commit.
     * @rejects When authorization, validation, state, persistence, audit, or operation logging fails.
     */
    async updateAdmin(input) {
      await logger.operation(
        loggerMessages.database.feedback.updateAdmin,
        async () => {
          assertFeedbackAdmin(input.actor);
          await db.transaction(async (tx) => {
            const actorUser = await ensureFeedbackAuditUser(
              tx,
              input.actor.clerkId,
            );
            const current = await loadFeedbackAuditState(tx, input.feedbackId);
            if (!editableStatuses.includes(current.status)) {
              throw new FeedbackStateError();
            }
            const normalized = normalizeFeedbackDetails(input);
            const updated = await tx
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
                  inArray(schema.feedback.status, editableStatuses),
                ),
              )
              .returning({ id: schema.feedback.id });
            if (updated.length === 0) throw new FeedbackStateError();
            await writeFeedbackAudit(audit, tx, {
              actor: input.actor,
              actorUser,
              after: feedbackAuditState(current, {
                ...normalized,
                category: normalized.category ?? null,
              }),
              before: feedbackAuditState(current),
              definition: feedbackAudit.updated,
              ownerUserId: current.ownerUserId,
              targetId: input.feedbackId,
            });
          });
        },
      );
    },

    /**
     * Updates a submitter-owned pending feedback request.
     *
     * @param input - Feedback identifier and submitter-editable fields.
     * @rejects When validation, state, persistence, or operation logging fails.
     */
    async updatePending(input) {
      await logger.operation(
        loggerMessages.database.feedback.updatePending,
        async () => await updateAdminFeedback(db, input, ["pending"]),
      );
    },
  };
}

/** Feedback data and owner identity required by an audit event. */
type FeedbackAuditState = {
  /** Current feedback category. */
  category: FeedbackCategory | null;
  /** Current feedback description. */
  description: string;
  /** Reserved Linear identifier, when planning has started. */
  linearClientUuid: string | null;
  /** Internal submitter identifier used for erasure redaction. */
  ownerUserId: number;
  /** Current feedback lifecycle state. */
  status: FeedbackStatus;
  /** Submitter's Clerk identifier used to transfer a merge vote. */
  submitterClerkId: string;
  /** Current feedback title. */
  title: string;
};

/**
 * Rejects feedback administration by an actor without its permission.
 *
 * @param actor - Actor requesting an administrative mutation.
 * @throws When the actor lacks feedback management permission.
 */
function assertFeedbackAdmin(actor: Actor): void {
  if (!hasPermission(actor, "feedback.manage")) {
    throw new Error("Feedback does not exist.");
  }
}

/**
 * Locks and loads feedback state and its submitter identity.
 *
 * @param transaction - Caller-owned source transaction.
 * @param feedbackId - Feedback identifier.
 * @returns Current feedback state and internal owner identifier.
 * @rejects When persistence fails or the feedback or submitter identity is missing.
 */
async function loadFeedbackAuditState(
  transaction: Parameters<AuditService["write"]>[0],
  feedbackId: number,
): Promise<FeedbackAuditState> {
  const [feedback] = await transaction
    .select({
      category: schema.feedback.category,
      description: schema.feedback.description,
      linearClientUuid: schema.feedback.linearClientUuid,
      status: schema.feedback.status,
      submitterClerkId: schema.feedback.submitterClerkId,
      title: schema.feedback.title,
    })
    .from(schema.feedback)
    .where(eq(schema.feedback.id, feedbackId))
    .limit(1)
    .for("update");
  if (!feedback) throw new FeedbackStateError();
  const owner = await ensureFeedbackAuditUser(
    transaction,
    feedback.submitterClerkId,
  );
  return { ...feedback, ownerUserId: owner.id };
}

/**
 * Ensures an audit-linked user in the caller's source transaction.
 *
 * @param transaction - Caller-owned source transaction.
 * @param clerkId - Clerk identifier to retain only through the user link.
 * @returns Internal user identity used by audit persistence.
 * @rejects When the identity cannot be persisted.
 */
async function ensureFeedbackAuditUser(
  transaction: Parameters<AuditService["write"]>[0],
  clerkId: string,
) {
  const [user] = await transaction
    .insert(schema.user)
    .values({ clerkId })
    .onConflictDoUpdate({ set: { clerkId }, target: schema.user.clerkId })
    .returning({ id: schema.user.id, username: schema.user.username });
  if (!user) throw new FeedbackStateError();
  return user;
}

/**
 * Serializes allowlisted feedback state with optional changed fields.
 *
 * @param current - Current feedback state.
 * @param overrides - Fields changed by the audited operation.
 * @returns Allowlisted state suitable for audit persistence.
 */
function feedbackAuditState(
  current: FeedbackAuditState,
  overrides: AuditJsonObject = {},
): AuditJsonObject {
  return {
    category: current.category,
    description: current.description,
    status: current.status,
    title: current.title,
    ...overrides,
  };
}

/**
 * Updates editable feedback without recording an administrative event.
 *
 * @param db - Application database.
 * @param input - Submitter-owned editable feedback fields.
 * @param statuses - Lifecycle states eligible for the update.
 * @returns Completion after feedback is updated.
 * @rejects When input, feedback state, or persistence is invalid.
 */
async function updateAdminFeedback(
  db: Database,
  input: UpdatePendingFeedbackInput,
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

/**
 * Lists an admin feedback page for a lifecycle scope.
 *
 * @param db - Database connection.
 * @param scope - Feedback lifecycle scope.
 * @param options - Search, sorting, and pagination options.
 * @returns The matching feedback page.
 * @rejects When filters or persistence fail.
 */
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

/**
 * Returns the common admin feedback column selection.
 *
 * @returns Columns selected by admin feedback queries.
 */
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

/**
 * Validates and normalizes admin feedback sorting.
 *
 * @param value - Requested sorting rules.
 * @param max - Maximum number of sorting rules.
 * @param allowed - Fields allowed for the query.
 * @returns Validated sorting rules.
 * @throws When a sorting rule is invalid.
 */
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

/**
 * Validates requested archive statuses.
 *
 * @param value - Requested archive statuses.
 * @returns The validated archive statuses.
 * @throws {Error} When a status is duplicated or not archived.
 */
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

/**
 * Validates requested active statuses.
 *
 * @param value - Requested active statuses.
 * @returns The validated active statuses.
 * @throws {Error} When a status is duplicated or not active.
 */
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

/**
 * Builds a database ordering expression for an admin sort.
 *
 * @param sort - Admin feedback sort.
 * @returns The Drizzle ordering expression.
 */
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

/**
 * Normalizes submitted feedback input.
 *
 * @param input - Submitted feedback input.
 * @returns Normalized feedback fields and submitter identifier.
 */
function normalizeFeedbackInput(input: SubmitFeedbackInput) {
  return {
    ...normalizeFeedbackDetails(input),
    submitterClerkId: normalizedClerkId(input.submitterClerkId),
  };
}

/**
 * Validates and normalizes editable feedback details.
 *
 * @param input - Feedback fields to normalize.
 * @returns Normalized feedback fields.
 * @throws {Error} When a feedback field is invalid.
 */
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

/**
 * Builds the shared public feedback selection.
 *
 * @param viewerClerkId - Requesting Clerk user identifier.
 * @returns Drizzle selection columns for feedback lists.
 */
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

/**
 * Maps a Linear lifecycle event to a feedback status.
 *
 * @param input - Normalized Linear lifecycle event.
 * @returns The mapped feedback status, or undefined when ignored.
 */
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

/**
 * Builds the aggregate feedback vote-count expression.
 *
 * @returns SQL expression counting feedback votes.
 */
function feedbackVoteCount() {
  return sql<number>`(
    select count(*)::int from feedback_votes
    where feedback_id = ${schema.feedback.id}
  )`;
}

/**
 * Builds a case-insensitive feedback-text match condition.
 *
 * @param value - Search text matched against feedback title and description.
 * @returns SQL condition matching feedback text.
 */
function feedbackContains(value: string) {
  return sql<boolean>`(
    strpos(lower(${schema.feedback.title}), lower(${value})) > 0
    or strpos(lower(${schema.feedback.description}), lower(${value})) > 0
  )`;
}

/**
 * Builds a whole-word feedback-text match condition.
 *
 * @param value - Lowercase word matched against tokenized feedback text.
 * @returns SQL condition matching a whole word.
 */
function feedbackContainsWord(value: string) {
  return sql<boolean>`${value} = any(regexp_split_to_array(
    lower(${schema.feedback.title} || ' ' || ${schema.feedback.description}),
    '[^[:alnum:]]+'
  ))`;
}

/**
 * Splits normalized duplicate-search text into unique words.
 *
 * @param value - Feedback title used to derive duplicate-search words.
 * @returns Unique normalized search words.
 * @throws When the trimmed title is empty or exceeds 120 characters.
 */
function duplicateWords(value: string) {
  const title = value.trim();
  if (!title || title.length > 120) throw new Error("Invalid feedback title.");
  return [...new Set(title.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];
}

/**
 * Normalizes an optional pagination offset.
 *
 * @param value - Optional requested pagination offset.
 * @returns Nonnegative offset, defaulting to zero.
 * @throws When the offset is negative or not a safe integer.
 */
function normalizedOffset(value: number | undefined) {
  const offset = value ?? 0;
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error("offset must be a non-negative integer.");
  }
  return offset;
}

/**
 * Trims an optional feedback search term.
 *
 * @param value - Optional feedback search text.
 * @returns Nonempty trimmed search words.
 * @throws When the search exceeds 120 characters.
 */
function normalizedSearch(value: string | undefined) {
  const search = value?.trim() ?? "";
  if (search.length > 120) throw new Error("Invalid feedback search.");
  return search.split(/\s+/).filter(Boolean);
}

/**
 * Trims and validates a Clerk user identifier.
 *
 * @param value - Submitter Clerk user identifier.
 * @returns Trimmed Clerk user identifier.
 * @throws When the identifier is blank.
 */
function normalizedClerkId(value: string) {
  const clerkId = value.trim();
  if (!clerkId) throw new Error("submitterClerkId is required.");
  return clerkId;
}

/**
 * Requires a positive integer.
 *
 * @param value - Candidate identifier or count.
 * @param name - Field name included in the validation error.
 * @throws When the value is not a positive safe integer.
 */
function assertPositiveInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

/**
 * Validates a UUID.
 *
 * @param value - Candidate Linear client UUID.
 * @throws When the value is not a supported UUID.
 */
function assertUuid(value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new Error("linearClientUuid must be a UUID.");
  }
}
