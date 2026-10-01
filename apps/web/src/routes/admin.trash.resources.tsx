import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageResources, listAdminResourceTrash } from "@/lib/resources";
import { AdminResourceTrashPage } from "@/pages/resource-trash-page";

/**
 * Defines the `/admin/trash/resources` route and its data lifecycle.
 */
export const Route = createFileRoute("/admin/trash/resources")({
  /**
   * Requires resource administration access before entering the route.
   *
   * @throws When the requested route data is unavailable or access is denied.
   * @rejects When the requested route data is unavailable or access is denied.
   */
  beforeLoad: async () => {
    if (!(await canManageResources())) throw notFound();
  },
  component: AdminResourceTrashRoute,
  /**
   * Builds document metadata for the admin trash resources route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.resources.trash.adminTitle") }],
  }),
  /**
   * Loads resources in the administrative trash.
   *
   * @returns The route's loader data.
   */
  loader: () => listAdminResourceTrash(),
});

/**
 * Renders the admin resource trash route content.
 *
 * @returns The rendered route UI.
 */
function AdminResourceTrashRoute() {
  return <AdminResourceTrashPage initialResources={Route.useLoaderData()} />;
}
