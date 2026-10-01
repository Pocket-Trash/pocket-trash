import { createFileRoute, redirect } from "@tanstack/react-router";
import { isCatalogAdmin, listCatalogImageTrash } from "@/lib/catalog-api";
import { CatalogImageTrashPage } from "@/pages/catalog-image-trash-page";

/**
 * Defines the `/admin/trash/catalog-images` route and its data lifecycle.
 */
export const Route = createFileRoute("/admin/trash/catalog-images")({
  /**
   * Requires catalog administration access before entering the route.
   *
   * @throws When navigation must continue at another route.
   * @rejects When navigation must continue at another route.
   */
  beforeLoad: async () => {
    if (!(await isCatalogAdmin())) throw redirect({ to: "/" });
  },
  /**
   * Loads catalog images awaiting permanent deletion.
   *
   * @returns The route's loader data.
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
