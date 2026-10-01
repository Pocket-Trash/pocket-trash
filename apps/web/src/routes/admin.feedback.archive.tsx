import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  canManageFeedback,
  listArchivedFeedback,
  listFeedbackArchiveStatuses,
} from "@/lib/feedback";
import { AdminFeedbackArchivePage } from "@/pages/admin-feedback-pages";

/**
 * Shows archived feedback and status filters to feedback administrators.
 */
export const Route = createFileRoute("/admin/feedback/archive")({
  /**
   * Requires feedback administration access before entering the route.
   *
   * @rejects When the current user lacks feedback administration access.
   */
  beforeLoad: async () => {
    if (!(await canManageFeedback())) throw notFound();
  },
  /**
   * Loads archived feedback and its available archive states.
   *
   * @returns The first archived-feedback page and available archive states.
   * @rejects When archived feedback or archive states cannot be loaded.
   */
  loader: async () => {
    const [initialPage, archiveStatuses] = await Promise.all([
      listArchivedFeedback({ data: { offset: 0, statuses: [] } }),
      listFeedbackArchiveStatuses(),
    ]);
    return { archiveStatuses, initialPage };
  },
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
