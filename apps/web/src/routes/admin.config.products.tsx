import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  canManageProductConfiguration,
  listCatalogProductTypes,
} from "@/lib/catalog-api";
import { AdminProductConfigPage } from "@/pages/admin-config-pages";

/** Provides permission-gated product-type configuration. */
export const Route = createFileRoute("/admin/config/products")({
  /**
   * Requires product-management permission before entering the route.
   *
   * @rejects When authorization cannot be checked or the requester lacks access.
   */
  beforeLoad: async () => {
    if (!(await canManageProductConfiguration())) throw notFound();
  },
  component: AdminProductConfigRoute,
  /**
   * Builds localized document metadata.
   *
   * @returns Localized document metadata.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.navigation.products") }],
  }),
  /**
   * Loads product types for the configuration table.
   *
   * @returns Product types ordered by name.
   * @rejects When authorization, service loading, or persistence fails.
   */
  loader: () => listCatalogProductTypes(),
});

/**
 * Renders the product-type configuration route.
 *
 * @returns The loaded product-type configuration page.
 */
function AdminProductConfigRoute() {
  return <AdminProductConfigPage productTypes={Route.useLoaderData()} />;
}
