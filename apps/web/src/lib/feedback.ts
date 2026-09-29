import { FeedbackSubmissionLimitError } from "@package/services";
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

export const listMyFeedback = createServerFn({ method: "GET" }).handler(
  async () => {
    const submitterClerkId = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.listMine(submitterClerkId);
  },
);

export const listPendingFeedback = createServerFn({ method: "GET" })
  .validator(parseOffset)
  .handler(async ({ data }) => {
    await requireResourceAdmin();
    const { s } = await import("@/lib/services");
    return await s.db.feedback.listPending(data.offset);
  });

export const updatePendingFeedback = createServerFn({ method: "POST" })
  .validator(parsePendingFeedbackInput)
  .handler(async ({ data }) => {
    await requireResourceAdmin();
    const { s } = await import("@/lib/services");
    await s.db.feedback.updatePending(data);
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
    await s.db.feedback.deny(data.feedbackId);
  });

export function parseFeedbackInput(input: unknown) {
  const value = parseRecord(input);
  const title = parseString(value.title, 120);
  const description = parseString(value.description, 5000);
  const category = parseCategory(value.category);
  return { category, description, title };
}

function parsePendingFeedbackInput(input: unknown) {
  return { ...parseFeedbackInput(input), ...parseFeedbackId(input) };
}

function parseFeedbackId(input: unknown) {
  const feedbackId = parseRecord(input).feedbackId;
  if (!Number.isSafeInteger(feedbackId) || Number(feedbackId) <= 0) {
    throw invalidFeedbackRequest();
  }
  return { feedbackId: Number(feedbackId) };
}

function parseOffset(input: unknown) {
  if (input === undefined) return { offset: 0 };
  const offset = parseRecord(input).offset;
  if (!Number.isSafeInteger(offset) || Number(offset) < 0) {
    throw invalidFeedbackRequest();
  }
  return { offset: Number(offset) };
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
