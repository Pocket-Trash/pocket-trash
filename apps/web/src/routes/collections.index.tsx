import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getPublicCollectionOwners } from "@/lib/catalog-api";
import { parseCatalogFilterSearch } from "@/lib/catalog-filters";
import { useCatalogFilters } from "@/lib/use-catalog-filters";
import { PublicCollectionsPage } from "@/pages/catalog-pages";

/**
 * Defines the `/collections/` route and its data lifecycle.
 */
export const Route = createFileRoute("/collections/")({
  validateSearch: parseCatalogFilterSearch,
  /**
   * Loads users who expose public collections.
   *
   * @returns The route's loader data.
   */
  loader: () => getPublicCollectionOwners(),
  component: CollectionsRoute,
});

/**
 * Renders the collections route content.
 *
 * @returns The rendered route UI.
 */
function CollectionsRoute() {
  const navigate = useNavigate();
  const [filters, setFilters] = useCatalogFilters(
    Route.useSearch(),
    (search) => void navigate({ replace: true, search, to: "/collections" }),
  );
  return (
    <PublicCollectionsPage
      filters={filters}
      onFiltersChange={setFilters}
      owners={Route.useLoaderData()}
    />
  );
}
