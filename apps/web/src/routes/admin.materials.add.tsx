import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canManageMaterials } from "@/lib/catalog-api";
import { AdminMaterialFormPage } from "@/pages/admin-material-pages";

/** Permission-gated material creation route. */
export const Route = createFileRoute("/admin/materials/add")({
  /**
   * Requires product-management permission.
   *
   * @returns Completion after authorization succeeds.
   * @rejects When authorization fails or the actor lacks permission.
   */
  beforeLoad: async () => {
    if (!(await canManageMaterials())) throw notFound();
  },
  component: AdminMaterialFormPage,
  /**
   * Builds localized document metadata.
   *
   * @returns Localized document metadata.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.materials.admin.addTitle") }],
  }),
});
