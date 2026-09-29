import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { isFeedbackAdmin, listArchivedFeedback } from "@/lib/feedback";
import { AdminFeedbackArchivePage } from "@/pages/admin-feedback-pages";

export const Route = createFileRoute("/admin/feedback/archive")({
  beforeLoad: async () => {
    if (!(await isFeedbackAdmin())) throw notFound();
  },
  loader: async () =>
    await listArchivedFeedback({ data: { offset: 0, statuses: [] } }),
  component: AdminFeedbackArchiveRoute,
  head: () => ({
    meta: [{ title: formatTranslation("web.feedback.admin.archive.title") }],
  }),
});

function AdminFeedbackArchiveRoute() {
  return <AdminFeedbackArchivePage initialPage={Route.useLoaderData()} />;
}
