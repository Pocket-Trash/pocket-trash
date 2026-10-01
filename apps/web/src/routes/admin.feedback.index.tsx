import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageFeedback, listAdminAllActiveFeedback } from "@/lib/feedback";
import { AdminAllActiveFeedbackPage } from "@/pages/admin-feedback-pages";

/**
 * Shows all active feedback to feedback administrators.
 */
export const Route = createFileRoute("/admin/feedback/")({
  /**
   * Requires feedback administration access before entering the route.
   *
   * @rejects When the current user lacks feedback administration access.
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
   * @returns The first page of active feedback.
   * @rejects When active feedback cannot be loaded.
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
