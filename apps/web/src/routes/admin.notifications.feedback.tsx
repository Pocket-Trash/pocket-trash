import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageFeedback, listFeedbackNotifications } from "@/lib/feedback";
import { AdminFeedbackNotificationsPage } from "@/pages/admin-feedback-notifications-page";

/**
 * Shows feedback-delivery notifications to feedback administrators.
 */
export const Route = createFileRoute("/admin/notifications/feedback")({
  /**
   * Requires feedback administration access before entering the route.
   *
   * @rejects When authorization cannot be checked or the current user lacks feedback administration access.
   */
  beforeLoad: async () => {
    if (!(await canManageFeedback())) throw notFound();
  },
  component: AdminFeedbackNotificationsRoute,
  /**
   * Builds document metadata for the admin notifications feedback route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.feedback.notification.title") }],
  }),
  /**
   * Loads feedback notifications for administrators.
   *
   * @returns Feedback-delivery notifications.
   * @rejects When feedback notifications cannot be loaded.
   */
  loader: async () => await listFeedbackNotifications(),
});

/**
 * Renders the admin feedback notifications route content.
 *
 * @returns The rendered route UI.
 */
function AdminFeedbackNotificationsRoute() {
  return (
    <AdminFeedbackNotificationsPage
      initialNotifications={Route.useLoaderData()}
    />
  );
}
