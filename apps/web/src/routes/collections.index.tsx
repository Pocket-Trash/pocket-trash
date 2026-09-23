import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getPublicCollectionOwners } from "@/lib/catalog-api";
import { parseCatalogFilterSearch } from "@/lib/catalog-filters";
import { useCatalogFilters } from "@/lib/use-catalog-filters";
import { PublicCollectionsPage } from "@/pages/catalog-pages";

export const Route = createFileRoute("/collections/")({
  validateSearch: parseCatalogFilterSearch,
  loader: () => getPublicCollectionOwners(),
  component: CollectionsRoute,
});

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
