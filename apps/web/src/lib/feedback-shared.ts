import type { FeedbackListItem, SubmitFeedbackInput } from "@package/services";
import type { TranslationKey } from "@pocket-trash/localizations";

/** Category accepted for a feedback submission. */
export type FeedbackCategory = NonNullable<SubmitFeedbackInput["category"]>;
/** Feedback status displayed outside administrator-only archive views. */
export type VisibleFeedbackStatus = Exclude<
  FeedbackListItem["status"],
  "canceled" | "denied" | "merged"
>;
/** Feedback lifecycle status rendered by shared UI. */
type FeedbackStatus = FeedbackListItem["status"];

/** Feedback categories in their shared display order. */
export const feedbackCategories: FeedbackCategory[] = [
  "product_type",
  "feature",
  "improvement",
  "bug",
];

/** Resolves the translation key for a feedback category.
 *
 * @param category - Feedback category to label.
 * @returns The category's localization key.
 */
export function feedbackCategoryKey(
  category: FeedbackCategory,
): TranslationKey {
  if (category === "product_type") return "web.feedback.category.productType";
  return `web.feedback.category.${category}`;
}

/**
 * Resolves display metadata for a feedback status.
 *
 * @param status - Feedback lifecycle status.
 * @returns The status icon and translation key.
 */
export function feedbackStatus(status: FeedbackStatus): {
  /** Status icon asset name. */
  icon: string;
  /** Localized status label key. */
  key: TranslationKey;
} {
  if (status === "pending") {
    return { icon: "status-backlog.svg", key: "web.feedback.status.pending" };
  }
  if (status === "requested") {
    return { icon: "status-todo.svg", key: "web.feedback.status.requested" };
  }
  if (status === "planned") {
    return { icon: "status-todo.svg", key: "web.feedback.status.planned" };
  }
  if (status === "in_progress") {
    return {
      icon: "status-in-progress.svg",
      key: "web.feedback.status.inProgress",
    };
  }
  if (status === "completed" || status === "merged") {
    return {
      icon: "status-done.svg",
      key: `web.feedback.status.${status}`,
    };
  }
  return {
    icon: "status-canceled.svg",
    key: `web.feedback.status.${status}`,
  };
}
