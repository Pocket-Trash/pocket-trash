import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  canManageFeedback,
  listFeedbackMergeTargets,
  listPendingFeedback,
} from "@/lib/feedback";
import { AdminFeedbackRequestsPage } from "@/pages/admin-feedback-pages";

export const Route = createFileRoute("/admin/feedback/requests")({
  beforeLoad: async () => {
    if (!(await canManageFeedback())) throw notFound();
  },
  loader: async () => {
    const [initialPage, mergeTargets] = await Promise.all([
      listPendingFeedback({ data: { offset: 0 } }),
      listFeedbackMergeTargets(),
    ]);
    return { initialPage, mergeTargets };
  },
  component: AdminFeedbackRequestsRoute,
  head: () => ({
    meta: [{ title: formatTranslation("web.feedback.admin.requests.title") }],
  }),
});

function AdminFeedbackRequestsRoute() {
  return <AdminFeedbackRequestsPage {...Route.useLoaderData()} />;
}
