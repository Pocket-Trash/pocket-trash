import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { SubmitFeedbackPage } from "@/pages/feedback-pages";

/**
 * Defines the `/feedback/new` route and its data lifecycle.
 */
export const Route = createFileRoute("/feedback/new")({
  component: SubmitFeedbackPage,
  /**
   * Builds document metadata for the feedback new route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.feedback.new.title") }],
  }),
});
