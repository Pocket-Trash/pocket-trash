import type {
  AdminFeedbackSortField,
  ListAdminFeedbackOptions,
} from "@package/services";
import { hasPermission } from "@package/services/authorization";
import { createServerFn } from "@tanstack/react-start";
import { requirePermission } from "@/lib/authorization";
import {
  type FeedbackCategory,
  feedbackCategories,
} from "@/lib/feedback-shared";
import type { LinearPlanningOptions } from "@/lib/linear";
import { getResourceViewer, requireResourceUploader } from "@/lib/resources";
import { localizedServerError } from "@/lib/server-errors";

/** Reports whether the current actor may administer feedback.
 *
 * @returns Whether the actor has feedback management permission.
 * @rejects When authentication or actor resolution fails.
 */
export const canManageFeedback = createServerFn().handler(async () => {
  return hasPermission(await getResourceViewer(), "feedback.manage");
});

/** Submits feedback or returns a localized submission failure.
 *
 * @returns The new feedback ID or a localized failure key.
 * @rejects When validation, authentication, or service loading fails.
 */
export const submitFeedback = createServerFn({ method: "POST" })
  .validator(parseFeedbackInput)
  .handler(async ({ data }) => {
    const submitter = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    const { FeedbackSubmissionLimitError } = await import("@package/services");
    try {
      const feedback = await s.db.feedback.submit({
        ...data,
        submitterClerkId: submitter.clerkId,
      });
      return { feedbackId: feedback.id, ok: true as const };
    } catch (error) {
      return {
        error:
          error instanceof FeedbackSubmissionLimitError
            ? ("web.feedback.new.limit" as const)
            : ("web.feedback.new.failure" as const),
        ok: false as const,
      };
    }
  });

/** Finds feedback titles resembling a proposed submission.
 *
 * @returns Potential duplicate feedback visible to the current user.
 * @rejects When validation, authentication, or lookup fails.
 */
export const findDuplicateFeedback = createServerFn({ method: "POST" })
  .validator(parseFeedbackTitleInput)
  .handler(async ({ data }) => {
    const viewer = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.findDuplicates(viewer.clerkId, data.title);
  });

/** Reports whether the current user has visible submitted feedback.
 *
 * @returns Whether the current user owns feedback that is not merged, denied, or canceled.
 * @rejects When authentication or lookup fails.
 */
export const hasMyFeedback = createServerFn({ method: "GET" }).handler(
  async () => {
    const submitter = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.hasMine(submitter.clerkId);
  },
);

/** Lists searchable active feedback visible to the current user.
 *
 * @returns Active feedback matching the search text.
 * @rejects When validation, authentication, or lookup fails.
 */
export const listActiveFeedback = createServerFn({ method: "GET" })
  .validator(parseFeedbackListInput)
  .handler(async ({ data }) => {
    const viewer = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.listActive(viewer.clerkId, data.search);
  });

/** Lists completed feedback for the public completed page.
 *
 * @returns Completed feedback matching the search text.
 * @rejects When validation, authentication, or lookup fails.
 */
export const listCompletedFeedback = createServerFn({ method: "GET" })
  .validator(parseFeedbackListInput)
  .handler(async ({ data }) => {
    const viewer = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.listCompleted(viewer.clerkId, data.search);
  });

/** Lists the current user's feedback with search and pagination.
 *
 * @returns The current user's matching feedback page.
 * @rejects When validation, authentication, or lookup fails.
 */
export const listMyFeedback = createServerFn({ method: "GET" })
  .validator(parseFeedbackListInput)
  .handler(async ({ data }) => {
    const submitter = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.listMine(submitter.clerkId, data);
  });

/** Lists pending feedback for an authorized administrator.
 *
 * @returns A filtered and sorted page of pending feedback.
 * @rejects When validation, authorization, or lookup fails.
 */
export const listPendingFeedback = createServerFn({ method: "GET" })
  .validator((input) => parseAdminFeedbackListInput(input, "pending"))
  .handler(async ({ data }) => {
    await requireFeedbackAdmin();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.listPending(data);
  });

/** Lists requested, planned, and in-progress feedback for administrators.
 *
 * @returns A filtered and sorted page of administrator-active feedback.
 * @rejects When validation, authorization, or lookup fails.
 */
export const listAdminActiveFeedback = createServerFn({ method: "GET" })
  .validator((input) => parseAdminFeedbackListInput(input, "active"))
  .handler(async ({ data }) => {
    await requireFeedbackAdmin();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.listAdminActive({
      ...data,
      statuses: ["requested", "planned", "in_progress"],
    });
  });

/** Lists all active feedback statuses for administrators.
 *
 * @returns A filtered and sorted page of all active feedback.
 * @rejects When validation, authorization, or lookup fails.
 */
export const listAdminAllActiveFeedback = createServerFn({ method: "GET" })
  .validator((input) => parseAdminFeedbackListInput(input, "active"))
  .handler(async ({ data }) => {
    await requireFeedbackAdmin();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.listAdminActive(data);
  });

/** Lists filtered archived feedback for administrators.
 *
 * @returns A filtered and sorted page of archived feedback.
 * @rejects When validation, authorization, or lookup fails.
 */
export const listArchivedFeedback = createServerFn({ method: "GET" })
  .validator((input) => parseAdminFeedbackListInput(input, "archive"))
  .handler(async ({ data }) => {
    await requireFeedbackAdmin();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.listArchive(data);
  });

/** Lists statuses accepted by the administrator feedback archive.
 *
 * @returns Available archived feedback statuses.
 * @rejects When authorization or service loading fails.
 */
export const listFeedbackArchiveStatuses = createServerFn({
  method: "GET",
}).handler(async () => {
  await requireFeedbackAdmin();
  const { adminFeedbackArchiveStatuses } = await import("@package/services");
  return adminFeedbackArchiveStatuses;
});

/** Lists active feedback eligible to receive a pending merge.
 *
 * @returns Eligible merge target summaries.
 * @rejects When authorization or lookup fails.
 */
export const listFeedbackMergeTargets = createServerFn({
  method: "GET",
}).handler(async () => {
  await requireFeedbackAdmin();
  const { s } = await import("@/lib/services");
  return await s.db.feedback.listMergeTargets();
});

/** Lists feedback notifications for an authorized administrator.
 *
 * @returns Feedback notifications visible to the administrator.
 * @rejects When authorization or lookup fails.
 */
export const listFeedbackNotifications = createServerFn({
  method: "GET",
}).handler(async () => {
  await requireFeedbackAdmin();
  const { s } = await import("@/lib/services");
  return await s.db.feedback.listNotifications();
});

/** Marks one feedback notification read for the current administrator.
 *
 * @rejects When validation, authorization, or persistence fails.
 */
export const markFeedbackNotificationRead = createServerFn({ method: "POST" })
  .validator(parseNotificationId)
  .handler(async ({ data }) => {
    const actor = await requireFeedbackAdmin();
    const { s } = await import("@/lib/services");
    await s.db.feedback.markNotificationRead(
      data.notificationId,
      actor.clerkId,
    );
  });

/** Updates editable feedback as an authorized administrator.
 *
 * @rejects When validation, authorization, or persistence fails.
 */
export const updateAdminFeedback = createServerFn({ method: "POST" })
  .validator(parseAdminFeedbackInput)
  .handler(async ({ data }) => {
    const actor = await requireFeedbackAdmin();
    const { s } = await import("@/lib/services");
    await s.db.feedback.updateAdmin({ ...data, actor });
  });

/** Merges pending feedback into an active request.
 *
 * @rejects When validation, authorization, or persistence fails.
 */
export const mergePendingFeedback = createServerFn({ method: "POST" })
  .validator(parseMergeFeedbackInput)
  .handler(async ({ data }) => {
    const actor = await requireFeedbackAdmin();
    const { s } = await import("@/lib/services");
    await s.db.feedback.mergePending({ ...data, actor });
  });

/** Approves categorized feedback for planning.
 *
 * @rejects When validation, authorization, or persistence fails.
 */
export const approveFeedback = createServerFn({ method: "POST" })
  .validator(parseFeedbackId)
  .handler(async ({ data }) => {
    const actor = await requireFeedbackAdmin();
    const { s } = await import("@/lib/services");
    await s.db.feedback.approve({ ...data, actor });
  });

/** Denies eligible feedback or reports required plan recovery.
 *
 * @returns Success or a localized plan-recovery failure.
 * @rejects When validation, authorization, or an unrelated persistence failure occurs.
 */
export const denyFeedback = createServerFn({ method: "POST" })
  .validator(parseFeedbackId)
  .handler(async ({ data }) => {
    const actor = await requireFeedbackAdmin();
    const { s } = await import("@/lib/services");
    const { FeedbackPlanRecoveryRequiredError } = await import(
      "@package/services"
    );
    try {
      await s.db.feedback.deny({ ...data, actor });
      return { ok: true as const };
    } catch (error) {
      if (error instanceof FeedbackPlanRecoveryRequiredError) {
        return {
          error: "web.feedback.admin.requests.planRecoveryRequired" as const,
          ok: false as const,
        };
      }
      throw error;
    }
  });

/** Loads Linear planning choices or a connection-required result.
 *
 * @returns Planning labels and viewer name, or a localized connection failure.
 * @rejects When feedback authorization fails.
 */
export const getLinearPlanOptions = createServerFn({ method: "GET" }).handler(
  async () => {
    const actor = await requireFeedbackAdmin();
    try {
      const token = await getLinearToken(actor.clerkId);
      const { getLinearPlanningOptions } = await import("@/lib/linear");
      const options = await getLinearPlanningOptions(token);
      return {
        labels: options.labels,
        ok: true as const,
        viewerName: options.viewer.name,
      };
    } catch {
      return {
        error: "web.feedback.admin.plan.connectionRequired" as const,
        ok: false as const,
      };
    }
  },
);

/** Plans feedback as an idempotent Linear issue or project.
 *
 * @returns Success or a localized Linear planning failure.
 * @rejects When validation, authorization, or submitted label validation fails.
 */
export const planFeedback = createServerFn({ method: "POST" })
  .validator(parsePlanFeedbackInput)
  .handler(async ({ data }) => {
    const actor = await requireFeedbackAdmin();
    let token: string;
    let options: LinearPlanningOptions;
    try {
      token = await getLinearToken(actor.clerkId);
      const { getLinearPlanningOptions } = await import("@/lib/linear");
      options = await getLinearPlanningOptions(token);
    } catch {
      return {
        error: "web.feedback.admin.plan.connectionRequired" as const,
        ok: false as const,
      };
    }

    const labelIds = new Set(options.labels.map(({ id }) => id));
    if (data.labelIds.some((id) => !labelIds.has(id))) {
      throw invalidFeedbackRequest();
    }

    const { s } = await import("@/lib/services");
    try {
      const reservation = await s.db.feedback.reserveLinearPlan(
        data.feedbackId,
        data.clientUuid,
      );
      const { createLinearIssue, createLinearProject, linearEntityExists } =
        await import("@/lib/linear");
      const exists = await linearEntityExists(
        token,
        reservation.linearClientUuid,
      );
      if (!exists && data.kind === "issue") {
        await createLinearIssue(token, {
          assigneeId: data.assignToMe ? options.viewer.id : undefined,
          description: reservation.description,
          id: reservation.linearClientUuid,
          labelIds: data.labelIds,
          stateId: options.issueStateId,
          title: reservation.title,
        });
      } else if (!exists) {
        await createLinearProject(token, {
          description: reservation.description,
          id: reservation.linearClientUuid,
          leadId: data.leadProject ? options.viewer.id : undefined,
          name: reservation.title,
          statusId: options.projectStatusId,
        });
      }
      await s.db.feedback.completeLinearPlan(
        data.feedbackId,
        reservation.linearClientUuid,
      );
      return { ok: true as const };
    } catch {
      return {
        error: "web.feedback.admin.plan.failure" as const,
        ok: false as const,
      };
    }
  });

/** Synchronizes a linked feedback item with its current Linear status.
 *
 * @returns Success or a localized connection or synchronization failure.
 * @rejects When validation or feedback authorization fails.
 */
export const syncFeedbackStatus = createServerFn({ method: "POST" })
  .validator(parseFeedbackId)
  .handler(async ({ data }) => {
    const actor = await requireFeedbackAdmin();
    let token: string;
    try {
      token = await getLinearToken(actor.clerkId);
      const { getLinearPlanningOptions } = await import("@/lib/linear");
      await getLinearPlanningOptions(token);
    } catch {
      return {
        error: "web.feedback.admin.sync.connectionRequired" as const,
        ok: false as const,
      };
    }

    const { s } = await import("@/lib/services");
    try {
      const target = await s.db.feedback.getLinearSyncTarget(data.feedbackId);
      if (!target) throw new Error("Feedback is not linked to Linear.");
      const { getLinearFeedbackStatus } = await import("@/lib/linear");
      await s.db.feedback.syncLinearStatus(
        await getLinearFeedbackStatus(token, target),
      );
      return { ok: true as const };
    } catch {
      return {
        error: "web.feedback.admin.sync.failure" as const,
        ok: false as const,
      };
    }
  });

/** Toggles the current user's vote on a feedback item.
 *
 * @returns The feedback item's updated vote state.
 * @rejects When validation, authentication, or persistence fails.
 */
export const toggleFeedbackVote = createServerFn({ method: "POST" })
  .validator(parseFeedbackId)
  .handler(async ({ data }) => {
    const voter = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.toggleVote(data.feedbackId, voter.clerkId);
  });

/** Requires the current actor to administer feedback.
 *
 * @returns The authorized service actor.
 * @rejects When authentication fails or feedback permission is absent.
 */
async function requireFeedbackAdmin() {
  return await requirePermission("feedback.manage");
}

/** Returns a Linear OAuth token with write access for a Clerk user.
 *
 * @param clerkId - Clerk user ID whose OAuth grants are queried.
 * @returns The Linear access token.
 * @rejects When Clerk token lookup fails or no grant includes Linear write access.
 */
async function getLinearToken(clerkId: string) {
  const { clerkClient } = await import("@clerk/tanstack-react-start/server");
  const tokens = await clerkClient().users.getUserOauthAccessToken(
    clerkId,
    "linear",
  );
  const token = tokens.data.find(({ scopes }) => scopes?.includes("write"));
  if (!token) throw new Error("Linear write access is required.");
  return token.token;
}

/** Normalizes a feedback submission payload.
 *
 * @param input - Untrusted request payload.
 * @returns Validated category, description, and title fields.
 * @throws When the payload or any feedback field is invalid.
 */
export function parseFeedbackInput(input: unknown) {
  const value = parseRecord(input);
  const title = parseString(value.title, 120);
  const description = parseString(value.description, 5000);
  const category = parseCategory(value.category);
  return { category, description, title };
}

/** Normalizes public feedback search and pagination input.
 *
 * @param input - Untrusted request payload, or `undefined` for defaults.
 * @returns Search text and a non-negative offset.
 * @throws When the payload, search text, or offset is invalid.
 */
export function parseFeedbackListInput(input: unknown) {
  if (input === undefined) return { offset: 0, search: "" };
  const value = parseRecord(input);
  const search = value.search === undefined ? "" : parseSearch(value.search);
  const offset =
    value.offset === undefined ? 0 : parseOffsetValue(value.offset);
  return { offset, search };
}

/** Normalizes a proposed feedback title for duplicate lookup.
 *
 * @param input - Untrusted request payload.
 * @returns The validated title field.
 * @throws When the payload or title is invalid.
 */
export function parseFeedbackTitleInput(input: unknown) {
  return { title: parseString(parseRecord(input).title, 120) };
}

/** Parses editable feedback fields with a feedback identifier.
 *
 * @param input - Untrusted request payload.
 * @returns Validated feedback fields and identifier.
 * @throws When the payload, fields, or identifier is invalid.
 */
function parseAdminFeedbackInput(input: unknown) {
  return { ...parseFeedbackInput(input), ...parseFeedbackId(input) };
}

/** Normalizes administrator filters and scope-specific sorting.
 *
 * @param input - Untrusted request payload, or `undefined` for defaults.
 * @param scope - Administrator list whose filters are being parsed.
 * @returns Validated search, pagination, sort, and optional status filters.
 * @throws When the payload, filters, sorting, or archive status values are invalid; archive values reject active statuses but otherwise pass through.
 */
export function parseAdminFeedbackListInput(
  input: unknown,
  scope: "active" | "archive" | "pending",
) {
  if (input === undefined) return { offset: 0, search: "", sort: [] };
  const value = parseRecord(input);
  const base = parseFeedbackListInput(input);
  const allowed = adminSortFields[scope];
  const maxSorts = scope === "pending" ? 1 : 2;
  const sortInput = value.sort ?? [];
  if (!Array.isArray(sortInput) || sortInput.length > maxSorts) {
    throw invalidFeedbackRequest();
  }
  const sort = sortInput.map((item) => {
    const entry = parseRecord(item);
    if (
      !allowed.some((field) => field === entry.field) ||
      (entry.direction !== "asc" && entry.direction !== "desc")
    ) {
      throw invalidFeedbackRequest();
    }
    return {
      direction: entry.direction as "asc" | "desc",
      field: entry.field as AdminFeedbackSortField,
    };
  });
  if (new Set(sort.map(({ field }) => field)).size !== sort.length) {
    throw invalidFeedbackRequest();
  }
  if (scope !== "archive") return { ...base, sort };
  const statusInput = value.statuses ?? [];
  if (!Array.isArray(statusInput)) throw invalidFeedbackRequest();
  const statuses = statusInput.map((status) => {
    if (typeof status !== "string" || activeFeedbackStatuses.includes(status)) {
      throw invalidFeedbackRequest();
    }
    return status as NonNullable<ListAdminFeedbackOptions["statuses"]>[number];
  });
  return { ...base, sort, statuses };
}

/** Sort fields allowed by each administrator feedback view. */
const adminSortFields = {
  active: ["title", "status", "category", "votes", "submitter", "updated"],
  archive: ["title", "status", "category", "submitter"],
  pending: ["title", "category", "submitter", "submitted"],
} as const satisfies Record<string, readonly AdminFeedbackSortField[]>;

/** Statuses excluded from feedback archive filtering. */
const activeFeedbackStatuses: readonly string[] = [
  "pending",
  "requested",
  "planned",
  "in_progress",
];
/** Canonical UUID shape accepted for Linear client and label IDs. */
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Parses positive source and target IDs for a feedback merge.
 *
 * @param input - Untrusted request payload.
 * @returns The validated feedback and target identifiers.
 * @throws When either identifier is not a positive safe integer.
 */
function parseMergeFeedbackInput(input: unknown) {
  const value = parseRecord(input);
  const targetId = value.targetId;
  if (!Number.isSafeInteger(targetId) || Number(targetId) <= 0) {
    throw invalidFeedbackRequest();
  }
  return { ...parseFeedbackId(input), targetId: Number(targetId) };
}

/** Parses a positive feedback identifier.
 *
 * @param input - Untrusted request payload.
 * @returns The numeric feedback identifier.
 * @throws When the identifier is not a positive safe integer.
 */
function parseFeedbackId(input: unknown) {
  const feedbackId = parseRecord(input).feedbackId;
  if (!Number.isSafeInteger(feedbackId) || Number(feedbackId) <= 0) {
    throw invalidFeedbackRequest();
  }
  return { feedbackId: Number(feedbackId) };
}

/** Parses a positive feedback-notification identifier.
 *
 * @param input - Untrusted request payload.
 * @returns The numeric notification identifier.
 * @throws When the identifier is not a positive safe integer.
 */
function parseNotificationId(input: unknown) {
  const notificationId = parseRecord(input).notificationId;
  if (!Number.isSafeInteger(notificationId) || Number(notificationId) <= 0) {
    throw invalidFeedbackRequest();
  }
  return { notificationId: Number(notificationId) };
}

/** Validates an idempotent Linear planning request.
 *
 * @param input - Untrusted request payload.
 * @returns The validated planning kind, UUIDs, assignment choices, and feedback ID.
 * @throws When a field is malformed or more than 100 labels are supplied.
 */
export function parsePlanFeedbackInput(input: unknown) {
  const value = parseRecord(input);
  if (value.kind !== "issue" && value.kind !== "project") {
    throw invalidFeedbackRequest();
  }
  if (
    typeof value.clientUuid !== "string" ||
    !uuidPattern.test(value.clientUuid) ||
    typeof value.assignToMe !== "boolean" ||
    typeof value.leadProject !== "boolean" ||
    !Array.isArray(value.labelIds) ||
    value.labelIds.length > 100 ||
    value.labelIds.some((id) => typeof id !== "string" || !uuidPattern.test(id))
  ) {
    throw invalidFeedbackRequest();
  }
  return {
    ...parseFeedbackId(input),
    assignToMe: value.assignToMe,
    clientUuid: value.clientUuid,
    kind: value.kind,
    labelIds: value.labelIds as string[],
    leadProject: value.leadProject,
  };
}

/** Requires a non-null object request payload.
 *
 * @param input - Untrusted request payload.
 * @returns The payload as a string-keyed record.
 * @throws When the payload is not an object.
 */
function parseRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null) {
    throw invalidFeedbackRequest();
  }
  return input as Record<string, unknown>;
}

/** Normalizes a required string within a maximum length.
 *
 * @param value - Untrusted field value.
 * @param maxLength - Maximum accepted character count.
 * @returns The trimmed non-empty string.
 * @throws When the value is missing, empty, non-string, or too long.
 */
function parseString(value: unknown, maxLength: number) {
  if (typeof value !== "string") throw invalidFeedbackRequest();
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw invalidFeedbackRequest();
  }
  return normalized;
}

/** Parses a non-negative pagination offset.
 *
 * @param value - Untrusted offset value.
 * @returns The numeric offset.
 * @throws When the value is not a non-negative safe integer.
 */
function parseOffsetValue(value: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw invalidFeedbackRequest();
  }
  return Number(value);
}

/** Normalizes search text to at most 120 characters.
 *
 * @param value - Untrusted search value.
 * @returns Trimmed search text, including an empty string.
 * @throws When the value is not a string or exceeds the limit.
 */
function parseSearch(value: unknown) {
  if (typeof value !== "string") throw invalidFeedbackRequest();
  const search = value.trim();
  if (search.length > 120) throw invalidFeedbackRequest();
  return search;
}

/** Parses an optional feedback category.
 *
 * @param value - Untrusted category value.
 * @returns A supported category, or `undefined` for an empty value.
 * @throws When a non-empty category is unsupported.
 */
function parseCategory(value: unknown): FeedbackCategory | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (!feedbackCategories.includes(value as FeedbackCategory)) {
    throw invalidFeedbackRequest();
  }
  return value as FeedbackCategory;
}

/** Creates the localized generic feedback validation error.
 *
 * @returns The error used for invalid feedback requests.
 */
function invalidFeedbackRequest() {
  return localizedServerError("web.feedback.new.failure");
}
