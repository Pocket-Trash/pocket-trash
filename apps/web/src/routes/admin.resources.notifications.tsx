import { createFileRoute, notFound } from "@tanstack/react-router";
import { isResourceAdmin, listResourceNotifications } from "@/lib/resources";
import { AdminResourceNotificationsPage } from "@/pages/admin-resource-notifications-page";

export const Route = createFileRoute("/admin/resources/notifications")({
  beforeLoad: async () => {
    if (!(await isResourceAdmin())) throw notFound();
  },
  loader: async () => await listResourceNotifications(),
  component: ResourceNotificationsRoute,
});

function ResourceNotificationsRoute() {
  return (
    <AdminResourceNotificationsPage
      initialNotifications={Route.useLoaderData()}
    />
  );
}
