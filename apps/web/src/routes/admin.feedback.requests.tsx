import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  canManageFeedback,
  listFeedbackMergeTargets,
  listPendingFeedback,
} from "@/lib/feedback";
import { AdminFeedbackRequestsPage } from "@/pages/admin-feedback-pages";

/**
 * Defines the `/admin/feedback/requests` route and its data lifecycle.
 */
export const Route = createFileRoute("/admin/feedback/requests")({
  /**
   * Requires feedback administration access before entering the route.
   *
   * @throws When the requested route data is unavailable or access is denied.
   * @rejects When the requested route data is unavailable or access is denied.
   */
  beforeLoad: async () => {
    if (!(await canManageFeedback())) throw notFound();
  },
  /**
   * Loads pending feedback and eligible merge targets.
   *
   * @returns The route's loader data.
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
