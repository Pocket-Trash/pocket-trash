import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { listMyFeedback } from "@/lib/feedback";
import { MyFeedbackPage } from "@/pages/feedback-pages";

/**
 * Shows feedback submitted by the current user.
 */
export const Route = createFileRoute("/feedback/my-requests")({
  /**
   * Loads the current user's first page of feedback requests.
   *
   * @returns The current user's first feedback page.
   * @rejects When the current user's feedback cannot be loaded.
   */
  loader: async () => await listMyFeedback({ data: { offset: 0, search: "" } }),
  component: MyFeedbackRoute,
  /**
   * Builds document metadata for the feedback my requests route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.feedback.myRequests.title") }],
  }),
});

/**
 * Renders the my feedback route content.
 *
 * @returns The rendered route UI.
 */
function MyFeedbackRoute() {
  return <MyFeedbackPage initialPage={Route.useLoaderData()} />;
}
