import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { loadActiveFeedbackSnapshot } from "@/lib/feedback";
import { FeedbackBoardPage } from "@/pages/feedback-pages";

/**
 * Shows the active feedback board to authenticated users.
 */
export const Route = createFileRoute("/feedback/")({
  /**
   * Loads the first page of active feedback.
   *
   * @param input - Router loader cancellation context.
   * @returns The first page of active feedback.
   * @rejects When active feedback cannot be loaded.
   */
  loader: async ({ abortController }) =>
    await loadActiveFeedbackSnapshot({ signal: abortController.signal }),
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
  return <FeedbackBoardPage {...Route.useLoaderData()} />;
}
