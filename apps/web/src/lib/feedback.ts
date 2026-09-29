import type {
  AdminFeedbackSortField,
  ListAdminFeedbackOptions,
} from "@package/services";
import { createServerFn } from "@tanstack/react-start";
import {
  type FeedbackCategory,
  feedbackCategories,
} from "@/lib/feedback-shared";
import {
  getResourceViewer,
  requireResourceAdmin,
  requireResourceUploader,
} from "@/lib/resources";
import { localizedServerError } from "@/lib/server-errors";

export const isFeedbackAdmin = createServerFn().handler(async () => {
  return (await getResourceViewer()).isAdmin;
});

export const submitFeedback = createServerFn({ method: "POST" })
  .validator(parseFeedbackInput)
  .handler(async ({ data }) => {
    const submitterClerkId = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    const { FeedbackSubmissionLimitError } = await import("@package/services");
    try {
      const feedback = await s.db.feedback.submit({
        ...data,
        submitterClerkId,
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
    const viewerClerkId = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.findDuplicates(viewerClerkId, data.title);
  });

export const hasMyFeedback = createServerFn({ method: "GET" }).handler(
  async () => {
    const submitterClerkId = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.hasMine(submitterClerkId);
  },
);

export const listActiveFeedback = createServerFn({ method: "GET" })
  .validator(parseFeedbackListInput)
  .handler(async ({ data }) => {
    const viewerClerkId = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.listActive(viewerClerkId, data.search);
  });

export const listMyFeedback = createServerFn({ method: "GET" })
  .validator(parseFeedbackListInput)
  .handler(async ({ data }) => {
    const submitterClerkId = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.listMine(submitterClerkId, data);
  });

export const listPendingFeedback = createServerFn({ method: "GET" })
  .validator((input) => parseAdminFeedbackListInput(input, "pending"))
  .handler(async ({ data }) => {
    await requireResourceAdmin();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.listPending(data);
  });

export const listAdminActiveFeedback = createServerFn({ method: "GET" })
  .validator((input) => parseAdminFeedbackListInput(input, "active"))
  .handler(async ({ data }) => {
    await requireResourceAdmin();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.listAdminActive(data);
  });

export const listArchivedFeedback = createServerFn({ method: "GET" })
  .validator((input) => parseAdminFeedbackListInput(input, "archive"))
  .handler(async ({ data }) => {
    await requireResourceAdmin();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.listArchive(data);
  });

export const listFeedbackArchiveStatuses = createServerFn({
  method: "GET",
}).handler(async () => {
  await requireResourceAdmin();
  const { adminFeedbackArchiveStatuses } = await import("@package/services");
  return adminFeedbackArchiveStatuses;
});

export const listFeedbackMergeTargets = createServerFn({
  method: "GET",
}).handler(async () => {
  await requireResourceAdmin();
  const { s } = await import("@/lib/services");
  return await s.db.feedback.listMergeTargets();
});

export const updateAdminFeedback = createServerFn({ method: "POST" })
  .validator(parseAdminFeedbackInput)
  .handler(async ({ data }) => {
    await requireResourceAdmin();
    const { s } = await import("@/lib/services");
    await s.db.feedback.updateAdmin(data);
  });

export const mergePendingFeedback = createServerFn({ method: "POST" })
  .validator(parseMergeFeedbackInput)
  .handler(async ({ data }) => {
    await requireResourceAdmin();
    const { s } = await import("@/lib/services");
    await s.db.feedback.mergePending(data.feedbackId, data.targetId);
  });

export const approveFeedback = createServerFn({ method: "POST" })
  .validator(parseFeedbackId)
  .handler(async ({ data }) => {
    await requireResourceAdmin();
    const { s } = await import("@/lib/services");
    await s.db.feedback.approve(data.feedbackId);
  });

export const denyFeedback = createServerFn({ method: "POST" })
  .validator(parseFeedbackId)
  .handler(async ({ data }) => {
    await requireResourceAdmin();
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

export const toggleFeedbackVote = createServerFn({ method: "POST" })
  .validator(parseFeedbackId)
  .handler(async ({ data }) => {
    const voterClerkId = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.toggleVote(data.feedbackId, voterClerkId);
  });

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
