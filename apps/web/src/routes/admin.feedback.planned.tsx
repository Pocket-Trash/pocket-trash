import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageFeedback, listAdminActiveFeedback } from "@/lib/feedback";
import { AdminActiveFeedbackPage } from "@/pages/admin-feedback-pages";

/**
 * Defines the `/admin/feedback/planned` route and its data lifecycle.
 */
export const Route = createFileRoute("/admin/feedback/planned")({
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
   * Loads the first page of planned feedback.
   *
   * @returns The route's loader data.
   */
  loader: async () => await listAdminActiveFeedback({ data: { offset: 0 } }),
  component: AdminPlannedFeedbackRoute,
  /**
   * Builds document metadata for the admin feedback planned route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.feedback.admin.active.title") }],
  }),
});

/**
 * Renders the admin planned feedback route content.
 *
 * @returns The rendered route UI.
 */
function AdminPlannedFeedbackRoute() {
  return <AdminActiveFeedbackPage initialPage={Route.useLoaderData()} />;
}
