import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getUserCollection, getUserCollections } from "@/lib/catalog-api";
import { parseCatalogFilterSearch } from "@/lib/catalog-filters";
import { useCatalogFilters } from "@/lib/use-catalog-filters";
import { UserCollectionsPage } from "@/pages/catalog-pages";

/**
 * Defines the `/user/collections` route and its data lifecycle.
 */
export const Route = createFileRoute("/user/collections")({
  validateSearch: parseCatalogFilterSearch,
  /**
   * Loads the current user's collection items and collection choices.
   *
   * @returns The route's loader data.
   */
  loader: async () => {
    const [items, collections] = await Promise.all([
      getUserCollection(),
      getUserCollections(),
    ]);
    return { collections, items };
  },
  component: UserCollectionsRoute,
});

/**
 * Renders the user collections route content.
 *
 * @returns The rendered route UI.
 */
function UserCollectionsRoute() {
  const navigate = useNavigate();
  const [filters, setFilters] = useCatalogFilters(
    Route.useSearch(),
    (search) =>
      void navigate({ replace: true, search, to: "/user/collections" }),
  );
  return (
    <UserCollectionsPage
      collections={Route.useLoaderData().collections}
      filters={filters}
      items={Route.useLoaderData().items}
      onFiltersChange={setFilters}
    />
  );
}
