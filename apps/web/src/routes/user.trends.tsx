import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  getPublicCollectionItemTrends,
  getPublicCollectionMakerProductTrends,
  getPublicCollectionMaterialTrends,
  getUserActivityTrends,
  getUserCollection,
  getUserCollectionHistoryTrends,
  getUserCollections,
} from "@/lib/catalog-api";
import { parseCatalogTrendsSearch } from "@/lib/catalog-filters";
import { UserTrendsPage } from "@/pages/user-trends-page";

/** Shows exact current-state collection Trends to the signed-in owner. */
export const Route = createFileRoute("/user/trends")({
  validateSearch: parseCatalogTrendsSearch,
  /**
   * Reloads private activity when the URL-backed range changes.
   *
   * @param context - Route dependency context.
   * @param context.search - Validated Trends URL state.
   * @returns Selected activity range.
   */
  loaderDeps: ({ search }) => ({ range: search.range ?? "year" }),
  /**
   * Loads owner-scoped current items and collection summaries.
   *
   * @param root0 - Route loader context.
   * @param root0.deps - Validated activity range.
   * @returns Owner-scoped items and exact collection count.
   */
  loader: async ({ deps }) => {
    const [
      items,
      collections,
      activityTrends,
      collectionHistoryTrends,
      collectionItems,
      makerProducts,
      materials,
    ] = await Promise.all([
      getUserCollection(),
      getUserCollections(),
      getUserActivityTrends({ data: deps.range }),
      getUserCollectionHistoryTrends({ data: deps.range }),
      getPublicCollectionItemTrends(),
      getPublicCollectionMakerProductTrends(),
      getPublicCollectionMaterialTrends(),
    ]);
    return {
      activityTrends,
      collectionHistoryTrends,
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
  const {
    activityTrends,
    collectionCount,
    collectionHistoryTrends,
    communityTrends,
    items,
  } = Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <UserTrendsPage
      activityTrends={activityTrends}
      collectionCount={collectionCount}
      collectionHistoryTrends={collectionHistoryTrends}
      communityTrends={communityTrends}
      items={items}
      onSearchChange={(nextSearch) =>
        void navigate({ replace: true, search: nextSearch, to: "/user/trends" })
      }
      search={search}
    />
  );
}
