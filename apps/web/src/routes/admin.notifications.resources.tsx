import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageResources, listResourceNotifications } from "@/lib/resources";
import { AdminResourceNotificationsPage } from "@/pages/admin-resource-notifications-page";

/**
 * Shows resource notifications to resource administrators.
 */
export const Route = createFileRoute("/admin/notifications/resources")({
  /**
   * Requires resource administration access before entering the route.
   *
   * @rejects When authorization cannot be checked or the current user lacks resource administration access.
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
   * @returns Resource notifications.
   * @rejects When resource notifications cannot be loaded.
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
