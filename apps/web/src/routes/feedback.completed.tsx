import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { listCompletedFeedback } from "@/lib/feedback";
import { CompletedFeedbackPage } from "@/pages/feedback-pages";

/** Shows completed feedback to authenticated users. */
export const Route = createFileRoute("/feedback/completed")({
  /**
   * Loads the first page of completed feedback.
   *
   * @returns The first page of completed feedback.
   * @rejects When completed feedback cannot be loaded.
   */
  loader: async () =>
    await listCompletedFeedback({ data: { offset: 0, search: "" } }),
  component: CompletedFeedbackRoute,
  /**
   * Builds completed feedback document metadata.
   *
   * @returns Completed feedback document metadata.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.feedback.status.completed") }],
  }),
});

/**
 * Renders the completed feedback route.
 *
 * @returns The completed feedback route page.
 */
function CompletedFeedbackRoute() {
  return <CompletedFeedbackPage initialItems={Route.useLoaderData()} />;
}
