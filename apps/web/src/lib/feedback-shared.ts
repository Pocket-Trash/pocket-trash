import type { SubmitFeedbackInput } from "@package/services";
import type { TranslationKey } from "@pocket-trash/localizations";

export type FeedbackCategory = NonNullable<SubmitFeedbackInput["category"]>;

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
