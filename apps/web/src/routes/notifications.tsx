import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageFeedback } from "@/lib/feedback";
import { canManageResources } from "@/lib/resources";
import { AdminNotificationsIndexPage } from "@/pages/admin-notifications-index-page";

/**
 * Defines the `/notifications` route and its data lifecycle.
 */
export const Route = createFileRoute("/notifications")({
  /**
   * Requires feedback or resource administration access before entering the route.
   *
   * @throws When the requested route data is unavailable or access is denied.
   * @rejects When the requested route data is unavailable or access is denied.
   */
  beforeLoad: async () => {
    const [mayManageFeedback, mayManageResources] = await Promise.all([
      canManageFeedback(),
      canManageResources(),
    ]);
    if (!mayManageFeedback && !mayManageResources) throw notFound();
  },
  component: AdminNotificationsIndexPage,
  /**
   * Builds document metadata for the notifications route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.admin.notifications.title") }],
  }),
});
