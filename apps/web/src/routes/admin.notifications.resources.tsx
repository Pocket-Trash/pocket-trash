import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageResources, listResourceNotifications } from "@/lib/resources";
import { AdminResourceNotificationsPage } from "@/pages/admin-resource-notifications-page";

/**
 * Defines the `/admin/notifications/resources` route and its data lifecycle.
 */
export const Route = createFileRoute("/admin/notifications/resources")({
  /**
   * Requires resource administration access before entering the route.
   *
   * @throws When the requested route data is unavailable or access is denied.
   * @rejects When the requested route data is unavailable or access is denied.
   */
  beforeLoad: async () => {
    if (!(await canManageResources())) throw notFound();
  },
  component: ResourceNotificationsRoute,
  /**
   * Builds document metadata for the admin notifications resources route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.resources.notification.title") }],
  }),
  /**
   * Loads resource notifications for administrators.
   *
   * @returns The route's loader data.
   */
  loader: async () => await listResourceNotifications(),
});

/**
 * Renders the resource notifications route content.
 *
 * @returns The rendered route UI.
 */
function ResourceNotificationsRoute() {
  return (
    <AdminResourceNotificationsPage
      initialNotifications={Route.useLoaderData()}
    />
  );
}
