import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageMaterials, listAdminMaterials } from "@/lib/catalog-api";
import { AdminMaterialsPage } from "@/pages/admin-material-pages";

/** Permission-gated material administration route. */
export const Route = createFileRoute("/admin/materials/")({
  /**
   * Requires product-management permission.
   *
   * @returns Completion after authorization succeeds.
   * @rejects When authorization fails or the actor lacks permission.
   */
  beforeLoad: async () => {
    if (!(await canManageMaterials())) throw notFound();
  },
  component: AdminMaterialsRoute,
  /**
   * Builds localized document metadata.
   *
   * @returns Localized document metadata.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.materials.admin.title") }],
  }),
  /**
   * Loads all administrator-managed materials.
   *
   * @returns Administrator material summaries.
   * @rejects When authorization or loading fails.
   */
  loader: async () => await listAdminMaterials(),
});

/**
 * Renders the material administration list.
 *
 * @returns The material administration list.
 */
function AdminMaterialsRoute() {
  return <AdminMaterialsPage materials={Route.useLoaderData()} />;
}
