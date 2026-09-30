import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { listAdminAllActiveFeedback } from "@/lib/feedback";
import { AdminAllActiveFeedbackPage } from "@/pages/admin-feedback-pages";

export const Route = createFileRoute("/admin/feedback/")({
  component: AdminAllActiveFeedbackRoute,
  head: () => ({
    meta: [
      {
        title: formatTranslation("web.feedback.admin.navigation.allActive"),
      },
    ],
  }),
  loader: async () => await listAdminAllActiveFeedback({ data: { offset: 0 } }),
});

function AdminAllActiveFeedbackRoute() {
  return <AdminAllActiveFeedbackPage initialPage={Route.useLoaderData()} />;
}
