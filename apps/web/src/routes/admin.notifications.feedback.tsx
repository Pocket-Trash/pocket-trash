import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageFeedback, listFeedbackNotifications } from "@/lib/feedback";
import { AdminFeedbackNotificationsPage } from "@/pages/admin-feedback-notifications-page";

/**
 * Defines the `/admin/notifications/feedback` route and its data lifecycle.
 */
export const Route = createFileRoute("/admin/notifications/feedback")({
  /**
   * Requires feedback administration access before entering the route.
   *
   * @throws When the requested route data is unavailable or access is denied.
   * @rejects When the requested route data is unavailable or access is denied.
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
   * @returns The route's loader data.
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
