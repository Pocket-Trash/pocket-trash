import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { listActiveFeedback } from "@/lib/feedback";
import { FeedbackBoardPage } from "@/pages/feedback-pages";

/**
 * Shows the active feedback board to authenticated users.
 */
export const Route = createFileRoute("/feedback/")({
  /**
   * Loads the first page of active feedback.
   *
   * @returns The first page of active feedback.
   * @rejects When active feedback cannot be loaded.
   */
  loader: async () =>
    await listActiveFeedback({ data: { offset: 0, search: "" } }),
  component: FeedbackBoardRoute,
  /**
   * Builds document metadata for the feedback route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.feedback.title") }],
  }),
});

/**
 * Renders the feedback board route content.
 *
 * @returns The rendered route UI.
 */
function FeedbackBoardRoute() {
  return <FeedbackBoardPage initialItems={Route.useLoaderData()} />;
}
