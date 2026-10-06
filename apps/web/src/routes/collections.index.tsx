import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  getPublicCollectionOwners,
  listCatalogTerminologyAliases,
} from "@/lib/catalog-api";
import { parseCatalogFilterSearch } from "@/lib/catalog-filters";
import { useCatalogFilters } from "@/lib/use-catalog-filters";
import { PublicCollectionsPage } from "@/pages/catalog-pages";

/**
 * Shows users who expose public collections.
 */
export const Route = createFileRoute("/collections/")({
  validateSearch: parseCatalogFilterSearch,
  /**
   * Loads users who expose public collections.
   *
   * @returns Users who expose public collections.
   * @rejects When public collection owners cannot be loaded.
   */
  loader: async () => {
    const [owners, aliases] = await Promise.all([
      getPublicCollectionOwners(),
      listCatalogTerminologyAliases(),
    ]);
    return { aliases, owners };
  },
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
      aliases={Route.useLoaderData().aliases}
      owners={Route.useLoaderData().owners}
    />
  );
}
