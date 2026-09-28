import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { isFeedbackAdmin, listPendingFeedback } from "@/lib/feedback";
import { AdminFeedbackRequestsPage } from "@/pages/feedback-pages";

export const Route = createFileRoute("/admin/feedback/requests")({
  beforeLoad: async () => {
    if (!(await isFeedbackAdmin())) throw notFound();
  },
  loader: async () => await listPendingFeedback({ data: { offset: 0 } }),
  component: AdminFeedbackRequestsRoute,
  head: () => ({
    meta: [{ title: formatTranslation("web.feedback.admin.requests.title") }],
  }),
});

function AdminFeedbackRequestsRoute() {
  return <AdminFeedbackRequestsPage initialPage={Route.useLoaderData()} />;
}
