import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageFeedback, listAdminActiveFeedback } from "@/lib/feedback";
import { AdminActiveFeedbackPage } from "@/pages/admin-feedback-pages";

/**
 * Shows planned feedback to feedback administrators.
 */
export const Route = createFileRoute("/admin/feedback/planned")({
  /**
   * Requires feedback administration access before entering the route.
   *
   * @rejects When the current user lacks feedback administration access.
   */
  beforeLoad: async () => {
    if (!(await canManageFeedback())) throw notFound();
  },
  /**
   * Loads the first page of planned feedback.
   *
   * @returns The first page of planned feedback.
   * @rejects When planned feedback cannot be loaded.
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
