import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  getPublicActivityTrends,
  getPublicCatalogMaterialTrends,
  getPublicCollectionItemTrends,
  getPublicCollectionMakerProductTrends,
  getPublicCollectionMaterialTrends,
  getPublicPartAccessoryTrends,
  listPublicProductTypeTrends,
} from "@/lib/catalog-api";
import { parseCatalogTrendsSearch } from "@/lib/catalog-filters";
import { TrendsPage, TrendsPendingPage } from "@/pages/trends-page";

/** Shows anonymous public catalog-product Trends. */
export const Route = createFileRoute("/trends")({
  component: TrendsRoute,
  /**
   * Builds document metadata for the Trends route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.trends.title") }],
  }),
  /**
   * Reloads recorded activity when the URL-backed range changes.
   *
   * @param context - Route dependency context.
   * @param context.search - Validated Trends URL state.
   * @returns Selected activity range.
   */
  loaderDeps: ({ search }) => ({ range: search.range ?? "year" }),
  /**
   * Loads exact public catalog-product Trends.
   *
   * @param context - Route loader context.
   * @param context.deps - Validated activity range.
   * @returns Public product-type and recorded-activity Trends.
   * @rejects When Trends cannot be loaded.
   */
  loader: async ({ deps }) => {
    const [
      catalogTrends,
      collectionTrends,
      makerProductTrends,
      partAccessoryTrends,
      catalogMaterialTrends,
      collectionMaterialTrends,
      activityTrends,
    ] = await Promise.all([
      listPublicProductTypeTrends(),
      getPublicCollectionItemTrends(),
      getPublicCollectionMakerProductTrends(),
      getPublicPartAccessoryTrends(),
      getPublicCatalogMaterialTrends(),
      getPublicCollectionMaterialTrends(),
      getPublicActivityTrends({ data: deps.range }),
    ]);
    return {
      activityTrends,
      catalogMaterialTrends,
      catalogTrends,
      collectionMaterialTrends,
      collectionTrends,
      makerProductTrends,
      partAccessoryTrends,
    };
  },
  pendingComponent: TrendsPendingPage,
  /**
   * Normalizes the optional stable product-type URL filter.
   *
   * @param search - Untrusted URL search parameters.
   * @returns A positive integer product-type filter or empty search state.
   */
  validateSearch: parseCatalogTrendsSearch,
});

/**
 * Connects Trends route data and URL filter state to the page.
 *
 * @returns The rendered public Trends route.
 */
function TrendsRoute() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const {
    activityTrends,
    catalogMaterialTrends,
    catalogTrends,
    collectionMaterialTrends,
    collectionTrends,
    makerProductTrends,
    partAccessoryTrends,
  } = Route.useLoaderData();
  return (
    <TrendsPage
      activityTrends={activityTrends}
      catalogMaterialTrends={catalogMaterialTrends}
      collectionMaterialTrends={collectionMaterialTrends}
      collectionTrends={collectionTrends}
      makerProductTrends={makerProductTrends}
      onSearchChange={(nextSearch) =>
        void navigate({
          replace: true,
          search: nextSearch,
          to: "/trends",
        })
      }
      partAccessoryTrends={partAccessoryTrends}
      search={search}
      trends={catalogTrends}
    />
  );
}
