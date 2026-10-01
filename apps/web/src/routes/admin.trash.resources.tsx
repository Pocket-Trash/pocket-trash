import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageResources, listAdminResourceTrash } from "@/lib/resources";
import { AdminResourceTrashPage } from "@/pages/resource-trash-page";

/**
 * Shows deleted resources to resource administrators.
 */
export const Route = createFileRoute("/admin/trash/resources")({
  /**
   * Requires resource administration access before entering the route.
   *
   * @rejects When authorization cannot be checked or the current user lacks resource administration access.
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
   * @returns Resources in the administrative trash.
   * @rejects When trashed resources cannot be loaded.
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
