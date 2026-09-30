import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageResources, listResourceNotifications } from "@/lib/resources";
import { AdminResourceNotificationsPage } from "@/pages/admin-resource-notifications-page";

export const Route = createFileRoute("/admin/notifications/resources")({
  beforeLoad: async () => {
    if (!(await canManageResources())) throw notFound();
  },
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
