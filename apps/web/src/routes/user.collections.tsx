import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getUserCollection } from "@/lib/catalog-api";
import { parseCatalogFilterSearch } from "@/lib/catalog-filters";
import { useCatalogFilters } from "@/lib/use-catalog-filters";
import { UserCollectionPage } from "@/pages/catalog-pages";

export const Route = createFileRoute("/user/collections")({
  validateSearch: parseCatalogFilterSearch,
  loader: () => getUserCollection(),
  component: UserCollectionsRoute,
});

function UserCollectionsRoute() {
  const navigate = useNavigate();
  const [filters, setFilters] = useCatalogFilters(
    Route.useSearch(),
    (search) =>
      void navigate({ replace: true, search, to: "/user/collections" }),
  );
  return (
    <UserCollectionPage
      filters={filters}
      items={Route.useLoaderData()}
      onFiltersChange={setFilters}
    />
  );
}
