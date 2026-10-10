import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  listCatalogProducts,
  listCatalogProductTypes,
  listCatalogTerminologyAliases,
} from "@/lib/catalog-api";
import { parseCatalogProductsSearch } from "@/lib/catalog-filters";
import { useCatalogFilters } from "@/lib/use-catalog-filters";
import { ProductsPage } from "@/pages/catalog-pages";

/**
 * Shows the filterable catalog product directory.
 */
export const Route = createFileRoute("/products/")({
  validateSearch: parseCatalogProductsSearch,
  /**
   * Loads the catalog product directory.
   *
   * @returns Catalog products available to the directory.
   * @rejects When catalog products cannot be loaded.
   */
  loader: async () => {
    const [products, productTypes, aliases] = await Promise.all([
      listCatalogProducts(),
      listCatalogProductTypes(),
      listCatalogTerminologyAliases(),
    ]);
    return { aliases, products, productTypes };
  },
  component: ProductsRoute,
});

/**
 * Renders the products route content.
 *
 * @returns The rendered route UI.
 */
function ProductsRoute() {
  const navigate = useNavigate();
  const { view, ...catalogSearch } = Route.useSearch();
  const [filters, setFilters] = useCatalogFilters(
    catalogSearch,
    (search) =>
      void navigate({
        replace: true,
        search: { ...search, view: "all" },
        to: "/products",
      }),
  );
  return (
    <ProductsPage
      filters={filters}
      onFiltersChange={setFilters}
      aliases={Route.useLoaderData().aliases}
      productTypes={Route.useLoaderData().productTypes}
      products={Route.useLoaderData().products}
      view={view === "all" ? "products" : "directory"}
    />
  );
}
