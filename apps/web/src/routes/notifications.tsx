import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageFeedback } from "@/lib/feedback";
import { canManageResources } from "@/lib/resources";
import { AdminNotificationsIndexPage } from "@/pages/admin-notifications-index-page";

/**
 * Shows notification areas available to the current administrator.
 */
export const Route = createFileRoute("/notifications")({
  /**
   * Requires feedback or resource administration access before entering the route.
   *
   * @rejects When authorization cannot be checked or the current user lacks both feedback and resource administration access.
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
