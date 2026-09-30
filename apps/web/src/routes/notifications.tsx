import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageFeedback } from "@/lib/feedback";
import { canManageResources } from "@/lib/resources";
import { AdminNotificationsIndexPage } from "@/pages/admin-notifications-index-page";

export const Route = createFileRoute("/notifications")({
  beforeLoad: async () => {
    const [mayManageFeedback, mayManageResources] = await Promise.all([
      canManageFeedback(),
      canManageResources(),
    ]);
    if (!mayManageFeedback && !mayManageResources) throw notFound();
  },
  component: AdminNotificationsIndexPage,
  head: () => ({
    meta: [{ title: formatTranslation("web.admin.notifications.title") }],
  }),
});
