import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageMaterials, getAdminMaterial } from "@/lib/catalog-api";
import { AdminMaterialFormPage } from "@/pages/admin-material-pages";

/** Permission-gated material editing route. */
export const Route = createFileRoute("/admin/materials/$materialId/edit")({
  /**
   * Requires product-management permission.
   *
   * @returns Completion after authorization succeeds.
   * @rejects When authorization fails or the actor lacks permission.
   */
  beforeLoad: async () => {
    if (!(await canManageMaterials())) throw notFound();
  },
  component: AdminMaterialEditRoute,
  /**
   * Builds localized document metadata.
   *
   * @returns Localized document metadata.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.materials.admin.editTitle") }],
  }),
  /**
   * Loads the requested material or returns a not-found response.
   *
   * @param root0 - Route loader context.
   * @param root0.params - Dynamic route parameters.
   * @returns The requested administrator material.
   * @rejects When the identifier is invalid, the material is absent, or loading fails.
   */
  loader: async ({ params }) => {
    const materialId = Number(params.materialId);
    if (!Number.isSafeInteger(materialId) || materialId <= 0) throw notFound();
    const material = await getAdminMaterial({ data: { materialId } });
    if (!material) throw notFound();
    return material;
  },
});

/**
 * Renders the material editor with loader data.
 *
 * @returns The material editor.
 */
function AdminMaterialEditRoute() {
  return <AdminMaterialFormPage initialMaterial={Route.useLoaderData()} />;
}
