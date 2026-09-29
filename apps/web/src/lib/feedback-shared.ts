import type { FeedbackListItem, SubmitFeedbackInput } from "@package/services";
import type { TranslationKey } from "@pocket-trash/localizations";

export type FeedbackCategory = NonNullable<SubmitFeedbackInput["category"]>;
export type VisibleFeedbackStatus = Exclude<
  FeedbackListItem["status"],
  "canceled" | "denied" | "merged"
>;

export const feedbackCategories: FeedbackCategory[] = [
  "product_type",
  "feature",
  "improvement",
  "bug",
];

export function feedbackCategoryKey(
  category: FeedbackCategory,
): TranslationKey {
  if (category === "product_type") return "web.feedback.category.productType";
  return `web.feedback.category.${category}`;
}

export function feedbackStatus(status: VisibleFeedbackStatus): {
  icon: string;
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
  return { icon: "status-done.svg", key: "web.feedback.status.completed" };
}
