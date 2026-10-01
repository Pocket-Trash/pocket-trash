import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { listCatalogProducts } from "@/lib/catalog-api";
import { parseCatalogFilterSearch } from "@/lib/catalog-filters";
import { useCatalogFilters } from "@/lib/use-catalog-filters";
import { ProductsPage } from "@/pages/catalog-pages";

/**
 * Shows the filterable catalog product directory.
 */
export const Route = createFileRoute("/products/")({
  validateSearch: parseCatalogFilterSearch,
  /**
   * Loads the catalog product directory.
   *
   * @returns Catalog products available to the directory.
   * @rejects When catalog products cannot be loaded.
   */
  loader: () => listCatalogProducts(),
  component: ProductsRoute,
});

/**
 * Renders the products route content.
 *
 * @returns The rendered route UI.
 */
function ProductsRoute() {
  const navigate = useNavigate();
  const [filters, setFilters] = useCatalogFilters(
    Route.useSearch(),
    (search) => void navigate({ replace: true, search, to: "/products" }),
  );
  return (
    <ProductsPage
      filters={filters}
      onFiltersChange={setFilters}
      products={Route.useLoaderData()}
    />
  );
}
