import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { listCatalogProducts } from "@/lib/catalog-api";
import { parseCatalogFilterSearch } from "@/lib/catalog-filters";
import { useCatalogFilters } from "@/lib/use-catalog-filters";
import { ProductsPage } from "@/pages/catalog-pages";

/**
 * Defines the `/products/` route and its data lifecycle.
 */
export const Route = createFileRoute("/products/")({
  validateSearch: parseCatalogFilterSearch,
  /**
   * Loads the catalog product directory.
   *
   * @returns The route's loader data.
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
