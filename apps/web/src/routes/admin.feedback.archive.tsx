import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageFeedback, loadAdminFeedbackSnapshot } from "@/lib/feedback";
import { AdminFeedbackArchivePage } from "@/pages/admin-feedback-pages";

/**
 * Shows archived feedback and status filters to feedback administrators.
 */
export const Route = createFileRoute("/admin/feedback/archive")({
  /**
   * Requires feedback administration access before entering the route.
   *
   * @rejects When authorization cannot be checked or the current user lacks feedback administration access.
   */
  beforeLoad: async () => {
    if (!(await canManageFeedback())) throw notFound();
  },
  /**
   * Loads archived feedback and its available archive states.
   *
   * @param input - Router loader cancellation context.
   * @returns The first archived-feedback page and available archive states.
   * @rejects When archived feedback or archive states cannot be loaded.
   */
  loader: async ({ abortController }) =>
    await loadAdminFeedbackSnapshot({
      data: "archive",
      signal: abortController.signal,
    }),
  component: AdminFeedbackArchiveRoute,
  /**
   * Builds document metadata for the admin feedback archive route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.feedback.admin.archive.title") }],
  }),
});

/**
 * Renders the admin feedback archive route content.
 *
 * @returns The rendered route UI.
 */
function AdminFeedbackArchiveRoute() {
  return <AdminFeedbackArchivePage {...Route.useLoaderData()} />;
}
