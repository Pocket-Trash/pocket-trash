import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageFeedback, listAdminAllActiveFeedback } from "@/lib/feedback";
import { AdminAllActiveFeedbackPage } from "@/pages/admin-feedback-pages";

/**
 * Defines the `/admin/feedback/` route and its data lifecycle.
 */
export const Route = createFileRoute("/admin/feedback/")({
  /**
   * Requires feedback administration access before entering the route.
   *
   * @throws When the requested route data is unavailable or access is denied.
   * @rejects When the requested route data is unavailable or access is denied.
   */
  beforeLoad: async () => {
    if (!(await canManageFeedback())) throw notFound();
  },
  component: AdminAllActiveFeedbackRoute,
  /**
   * Builds document metadata for the admin feedback route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [
      {
        title: formatTranslation("web.feedback.admin.navigation.allActive"),
      },
    ],
  }),
  /**
   * Loads the first page of active feedback for administrators.
   *
   * @returns The route's loader data.
   */
  loader: async () => await listAdminAllActiveFeedback({ data: { offset: 0 } }),
});

/**
 * Renders the admin all active feedback route content.
 *
 * @returns The rendered route UI.
 */
function AdminAllActiveFeedbackRoute() {
  return <AdminAllActiveFeedbackPage initialPage={Route.useLoaderData()} />;
}
