import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  canManageFeedback,
  listArchivedFeedback,
  listFeedbackArchiveStatuses,
} from "@/lib/feedback";
import { AdminFeedbackArchivePage } from "@/pages/admin-feedback-pages";

export const Route = createFileRoute("/admin/feedback/archive")({
  beforeLoad: async () => {
    if (!(await canManageFeedback())) throw notFound();
  },
  loader: async () => {
    const [initialPage, archiveStatuses] = await Promise.all([
      listArchivedFeedback({ data: { offset: 0, statuses: [] } }),
      listFeedbackArchiveStatuses(),
    ]);
    return { archiveStatuses, initialPage };
  },
  component: AdminFeedbackArchiveRoute,
  head: () => ({
    meta: [{ title: formatTranslation("web.feedback.admin.archive.title") }],
  }),
});

function AdminFeedbackArchiveRoute() {
  return <AdminFeedbackArchivePage {...Route.useLoaderData()} />;
}
