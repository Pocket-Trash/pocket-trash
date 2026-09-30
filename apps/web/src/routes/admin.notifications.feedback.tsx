import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageFeedback, listFeedbackNotifications } from "@/lib/feedback";
import { AdminFeedbackNotificationsPage } from "@/pages/admin-feedback-notifications-page";

export const Route = createFileRoute("/admin/notifications/feedback")({
  beforeLoad: async () => {
    if (!(await canManageFeedback())) throw notFound();
  },
  component: AdminFeedbackNotificationsRoute,
  head: () => ({
    meta: [{ title: formatTranslation("web.feedback.notification.title") }],
  }),
  loader: async () => await listFeedbackNotifications(),
});

function AdminFeedbackNotificationsRoute() {
  return (
    <AdminFeedbackNotificationsPage
      initialNotifications={Route.useLoaderData()}
    />
  );
}
