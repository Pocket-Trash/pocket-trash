import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  canManageFeedback,
  listFeedbackMergeTargets,
  listPendingFeedback,
} from "@/lib/feedback";
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
   * @returns The first pending-feedback page and eligible merge targets.
   * @rejects When pending feedback or merge targets cannot be loaded.
   */
  loader: async () => {
    const [initialPage, mergeTargets] = await Promise.all([
      listPendingFeedback({ data: { offset: 0 } }),
      listFeedbackMergeTargets(),
    ]);
    return { initialPage, mergeTargets };
  },
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
