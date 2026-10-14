import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  getPublicCollectionItemTrends,
  getPublicCollectionMakerProductTrends,
  getPublicCollectionMaterialTrends,
  getUserActivityTrends,
  getUserCollection,
  getUserCollections,
} from "@/lib/catalog-api";
import { parseCatalogTrendsSearch } from "@/lib/catalog-filters";
import { UserTrendsPage } from "@/pages/user-trends-page";

/** Shows exact current-state collection Trends to the signed-in owner. */
export const Route = createFileRoute("/user/trends")({
  validateSearch: parseCatalogTrendsSearch,
  loaderDeps: ({ search }) => ({ range: search.range ?? "year" }),
  /**
   * Loads owner-scoped current items and collection summaries.
   *
   * @returns Owner-scoped items and exact collection count.
   */
  loader: async ({ deps }) => {
    const [
      items,
      collections,
      activityTrends,
      collectionItems,
      makerProducts,
      materials,
    ] = await Promise.all([
      getUserCollection(),
      getUserCollections(),
      getUserActivityTrends({ data: deps.range }),
      getPublicCollectionItemTrends(),
      getPublicCollectionMakerProductTrends(),
      getPublicCollectionMaterialTrends(),
    ]);
    return {
      activityTrends,
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
  const { activityTrends, collectionCount, communityTrends, items } =
    Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <UserTrendsPage
      activityTrends={activityTrends}
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
