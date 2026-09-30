import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageFeedback, listAdminAllActiveFeedback } from "@/lib/feedback";
import { AdminAllActiveFeedbackPage } from "@/pages/admin-feedback-pages";

export const Route = createFileRoute("/admin/feedback/")({
  beforeLoad: async () => {
    if (!(await canManageFeedback())) throw notFound();
  },
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
