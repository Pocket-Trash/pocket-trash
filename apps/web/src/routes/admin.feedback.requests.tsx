import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageFeedback, loadAdminFeedbackSnapshot } from "@/lib/feedback";
import { AdminFeedbackRequestsPage } from "@/pages/admin-feedback-pages";

/**
 * Shows pending feedback and merge targets to feedback administrators.
 */
export const Route = createFileRoute("/admin/feedback/requests")({
  /**
   * Requires feedback administration access before entering the route.
   *
   * @rejects When authorization cannot be checked or the current user lacks feedback administration access.
   */
  beforeLoad: async () => {
    if (!(await canManageFeedback())) throw notFound();
  },
  /**
   * Loads pending feedback and eligible merge targets.
   *
   * @param input - Router loader cancellation context.
   * @returns The first pending-feedback page and eligible merge targets.
   * @rejects When pending feedback or merge targets cannot be loaded.
   */
  loader: async ({ abortController }) =>
    await loadAdminFeedbackSnapshot({
      data: "pending",
      signal: abortController.signal,
    }),
  component: AdminFeedbackRequestsRoute,
  /**
   * Builds document metadata for the admin feedback requests route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.feedback.admin.requests.title") }],
  }),
});

/**
 * Renders the admin feedback requests route content.
 *
 * @returns The rendered route UI.
 */
function AdminFeedbackRequestsRoute() {
  return <AdminFeedbackRequestsPage {...Route.useLoaderData()} />;
}
