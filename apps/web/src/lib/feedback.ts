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

export const canManageFeedback = createServerFn().handler(async () => {
  return hasPermission(await getResourceViewer(), "feedback.manage");
});

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

export const findDuplicateFeedback = createServerFn({ method: "POST" })
  .validator(parseFeedbackTitleInput)
  .handler(async ({ data }) => {
    const viewer = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.findDuplicates(viewer.clerkId, data.title);
  });

export const hasMyFeedback = createServerFn({ method: "GET" }).handler(
  async () => {
    const submitter = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.hasMine(submitter.clerkId);
  },
);

export const listActiveFeedback = createServerFn({ method: "GET" })
  .validator(parseFeedbackListInput)
  .handler(async ({ data }) => {
    const viewer = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.listActive(viewer.clerkId, data.search);
  });

/** Lists completed feedback for the public completed page. */
export const listCompletedFeedback = createServerFn({ method: "GET" })
  .validator(parseFeedbackListInput)
  .handler(async ({ data }) => {
    const viewer = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.listCompleted(viewer.clerkId, data.search);
  });

export const listMyFeedback = createServerFn({ method: "GET" })
  .validator(parseFeedbackListInput)
  .handler(async ({ data }) => {
    const submitter = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.listMine(submitter.clerkId, data);
  });

export const listPendingFeedback = createServerFn({ method: "GET" })
  .validator((input) => parseAdminFeedbackListInput(input, "pending"))
  .handler(async ({ data }) => {
    await requireFeedbackAdmin();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.listPending(data);
  });

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

export const listAdminAllActiveFeedback = createServerFn({ method: "GET" })
  .validator((input) => parseAdminFeedbackListInput(input, "active"))
  .handler(async ({ data }) => {
    await requireFeedbackAdmin();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.listAdminActive(data);
  });

export const listArchivedFeedback = createServerFn({ method: "GET" })
  .validator((input) => parseAdminFeedbackListInput(input, "archive"))
  .handler(async ({ data }) => {
    await requireFeedbackAdmin();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.listArchive(data);
  });

export const listFeedbackArchiveStatuses = createServerFn({
  method: "GET",
}).handler(async () => {
  await requireFeedbackAdmin();
  const { adminFeedbackArchiveStatuses } = await import("@package/services");
  return adminFeedbackArchiveStatuses;
});

export const listFeedbackMergeTargets = createServerFn({
  method: "GET",
}).handler(async () => {
  await requireFeedbackAdmin();
  const { s } = await import("@/lib/services");
  return await s.db.feedback.listMergeTargets();
});

export const listFeedbackNotifications = createServerFn({
  method: "GET",
}).handler(async () => {
  await requireFeedbackAdmin();
  const { s } = await import("@/lib/services");
  return await s.db.feedback.listNotifications();
});

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

export const updateAdminFeedback = createServerFn({ method: "POST" })
  .validator(parseAdminFeedbackInput)
  .handler(async ({ data }) => {
    await requireFeedbackAdmin();
    const { s } = await import("@/lib/services");
    await s.db.feedback.updateAdmin(data);
  });

export const mergePendingFeedback = createServerFn({ method: "POST" })
  .validator(parseMergeFeedbackInput)
  .handler(async ({ data }) => {
    await requireFeedbackAdmin();
    const { s } = await import("@/lib/services");
    await s.db.feedback.mergePending(data.feedbackId, data.targetId);
  });

export const approveFeedback = createServerFn({ method: "POST" })
  .validator(parseFeedbackId)
  .handler(async ({ data }) => {
    await requireFeedbackAdmin();
    const { s } = await import("@/lib/services");
    await s.db.feedback.approve(data.feedbackId);
  });

export const denyFeedback = createServerFn({ method: "POST" })
  .validator(parseFeedbackId)
  .handler(async ({ data }) => {
    await requireFeedbackAdmin();
    const { s } = await import("@/lib/services");
    const { FeedbackPlanRecoveryRequiredError } = await import(
      "@package/services"
    );
    try {
      await s.db.feedback.deny(data.feedbackId);
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

/** Synchronizes a linked feedback item with its current Linear status. */
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

export const toggleFeedbackVote = createServerFn({ method: "POST" })
  .validator(parseFeedbackId)
  .handler(async ({ data }) => {
    const voter = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.toggleVote(data.feedbackId, voter.clerkId);
  });

async function requireFeedbackAdmin() {
  return await requirePermission("feedback.manage");
}

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

export function parseFeedbackInput(input: unknown) {
  const value = parseRecord(input);
  const title = parseString(value.title, 120);
  const description = parseString(value.description, 5000);
  const category = parseCategory(value.category);
  return { category, description, title };
}

export function parseFeedbackListInput(input: unknown) {
  if (input === undefined) return { offset: 0, search: "" };
  const value = parseRecord(input);
  const search = value.search === undefined ? "" : parseSearch(value.search);
  const offset =
    value.offset === undefined ? 0 : parseOffsetValue(value.offset);
  return { offset, search };
}

export function parseFeedbackTitleInput(input: unknown) {
  return { title: parseString(parseRecord(input).title, 120) };
}

function parseAdminFeedbackInput(input: unknown) {
  return { ...parseFeedbackInput(input), ...parseFeedbackId(input) };
}

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

const adminSortFields = {
  active: ["title", "status", "category", "votes", "submitter", "updated"],
  archive: ["title", "status", "category", "submitter"],
  pending: ["title", "category", "submitter", "submitted"],
} as const satisfies Record<string, readonly AdminFeedbackSortField[]>;

const activeFeedbackStatuses: readonly string[] = [
  "pending",
  "requested",
  "planned",
  "in_progress",
];
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseMergeFeedbackInput(input: unknown) {
  const value = parseRecord(input);
  const targetId = value.targetId;
  if (!Number.isSafeInteger(targetId) || Number(targetId) <= 0) {
    throw invalidFeedbackRequest();
  }
  return { ...parseFeedbackId(input), targetId: Number(targetId) };
}

function parseFeedbackId(input: unknown) {
  const feedbackId = parseRecord(input).feedbackId;
  if (!Number.isSafeInteger(feedbackId) || Number(feedbackId) <= 0) {
    throw invalidFeedbackRequest();
  }
  return { feedbackId: Number(feedbackId) };
}

function parseNotificationId(input: unknown) {
  const notificationId = parseRecord(input).notificationId;
  if (!Number.isSafeInteger(notificationId) || Number(notificationId) <= 0) {
    throw invalidFeedbackRequest();
  }
  return { notificationId: Number(notificationId) };
}

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

function parseRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null) {
    throw invalidFeedbackRequest();
  }
  return input as Record<string, unknown>;
}

function parseString(value: unknown, maxLength: number) {
  if (typeof value !== "string") throw invalidFeedbackRequest();
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw invalidFeedbackRequest();
  }
  return normalized;
}

function parseOffsetValue(value: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw invalidFeedbackRequest();
  }
  return Number(value);
}

function parseSearch(value: unknown) {
  if (typeof value !== "string") throw invalidFeedbackRequest();
  const search = value.trim();
  if (search.length > 120) throw invalidFeedbackRequest();
  return search;
}

function parseCategory(value: unknown): FeedbackCategory | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (!feedbackCategories.includes(value as FeedbackCategory)) {
    throw invalidFeedbackRequest();
  }
  return value as FeedbackCategory;
}

function invalidFeedbackRequest() {
  return localizedServerError("web.feedback.new.failure");
}
