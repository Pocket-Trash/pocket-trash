import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  getPublicCollectionItemTrends,
  getPublicCollectionMakerProductTrends,
  getPublicCollectionMaterialTrends,
  getUserCollection,
  getUserCollections,
} from "@/lib/catalog-api";
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
    const [items, collections, collectionItems, makerProducts, materials] =
      await Promise.all([
        getUserCollection(),
        getUserCollections(),
        getPublicCollectionItemTrends(),
        getPublicCollectionMakerProductTrends(),
        getPublicCollectionMaterialTrends(),
      ]);
    return {
      collectionCount: collections.length,
      communityTrends: { collectionItems, makerProducts, materials },
      items,
    };
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
  const { collectionCount, communityTrends, items } = Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <UserTrendsPage
      collectionCount={collectionCount}
      communityTrends={communityTrends}
      items={items}
      onSearchChange={(nextSearch) =>
        void navigate({ replace: true, search: nextSearch, to: "/user/trends" })
      }
      search={search}
    />
  );
}
