import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { isFeedbackAdmin, listAdminActiveFeedback } from "@/lib/feedback";
import { AdminActiveFeedbackPage } from "@/pages/admin-feedback-pages";

export const Route = createFileRoute("/admin/feedback/planned")({
  beforeLoad: async () => {
    if (!(await isFeedbackAdmin())) throw notFound();
  },
  loader: async () => await listAdminActiveFeedback({ data: { offset: 0 } }),
  component: AdminPlannedFeedbackRoute,
  head: () => ({
    meta: [{ title: formatTranslation("web.feedback.admin.active.title") }],
  }),
});

function AdminPlannedFeedbackRoute() {
  return <AdminActiveFeedbackPage initialPage={Route.useLoaderData()} />;
}
