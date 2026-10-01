import { createFileRoute, redirect } from "@tanstack/react-router";
import { isCatalogAdmin, listCatalogImageTrash } from "@/lib/catalog-api";
import { CatalogImageTrashPage } from "@/pages/catalog-image-trash-page";

/**
 * Shows catalog images queued for permanent deletion.
 */
export const Route = createFileRoute("/admin/trash/catalog-images")({
  /**
   * Requires catalog administration access before entering the route.
   *
   * @rejects When authorization cannot be checked or the current user lacks catalog administration access.
   */
  beforeLoad: async () => {
    if (!(await isCatalogAdmin())) throw redirect({ to: "/" });
  },
  /**
   * Loads catalog images awaiting permanent deletion.
   *
   * @returns Catalog images queued for deletion.
   * @rejects When queued catalog images cannot be loaded.
   */
  loader: () => listCatalogImageTrash(),
  /**
   * Renders the admin trash catalog images route.
   *
   * @returns The rendered route UI.
   */
  component: () => (
    <CatalogImageTrashPage initialImages={Route.useLoaderData()} />
  ),
});
