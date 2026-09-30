import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { isResourceAdmin } from "@/lib/resources";
import { AdminNotificationsIndexPage } from "@/pages/admin-notifications-index-page";

export const Route = createFileRoute("/notifications")({
  beforeLoad: async () => {
    if (!(await isResourceAdmin())) throw notFound();
  },
  component: AdminNotificationsIndexPage,
  head: () => ({
    meta: [{ title: formatTranslation("web.admin.notifications.title") }],
  }),
});
