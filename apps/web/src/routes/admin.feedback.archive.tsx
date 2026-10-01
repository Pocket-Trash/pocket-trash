import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  canManageFeedback,
  listArchivedFeedback,
  listFeedbackArchiveStatuses,
} from "@/lib/feedback";
import { AdminFeedbackArchivePage } from "@/pages/admin-feedback-pages";

/**
 * Defines the `/admin/feedback/archive` route and its data lifecycle.
 */
export const Route = createFileRoute("/admin/feedback/archive")({
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
   * Loads archived feedback and its available archive states.
   *
   * @returns The route's loader data.
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
