import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getUserCollection, getUserCollections } from "@/lib/catalog-api";
import { parseCatalogTrendsSearch } from "@/lib/catalog-filters";
import { UserTrendsPage } from "@/pages/user-trends-page";

/** Shows exact current-state collection Trends to the signed-in owner. */
export const Route = createFileRoute("/user/trends")({
  validateSearch: parseCatalogTrendsSearch,
  /**
   * Loads owner-scoped current items and collection summaries.
   *
   * @returns Owner-scoped items and exact collection count.
   */
  loader: async () => {
    const [items, collections] = await Promise.all([
      getUserCollection(),
      getUserCollections(),
    ]);
    return { collectionCount: collections.length, items };
  },
  component: UserTrendsRoute,
});

/**
 * Connects owner-scoped data and stable URL filter state to personal Trends.
 *
 * @returns Private personal Trends route content.
 */
function UserTrendsRoute() {
  const navigate = useNavigate();
  const { collectionCount, items } = Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <UserTrendsPage
      collectionCount={collectionCount}
      items={items}
      onSearchChange={(nextSearch) =>
        void navigate({ replace: true, search: nextSearch, to: "/user/trends" })
      }
      search={search}
    />
  );
}
