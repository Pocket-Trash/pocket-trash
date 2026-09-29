import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { listResourceNotifications } from "@/lib/resources";
import { AdminResourceNotificationsPage } from "@/pages/admin-resource-notifications-page";

export const Route = createFileRoute("/admin/notifications/resources")({
  component: ResourceNotificationsRoute,
  head: () => ({
    meta: [{ title: formatTranslation("web.resources.notification.title") }],
  }),
  loader: async () => await listResourceNotifications(),
});

function ResourceNotificationsRoute() {
  return (
    <AdminResourceNotificationsPage
      initialNotifications={Route.useLoaderData()}
    />
  );
}
