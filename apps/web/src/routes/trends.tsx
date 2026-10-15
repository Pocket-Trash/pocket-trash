import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  getPublicActivityTrends,
  getPublicCatalogMaterialTrends,
  getPublicCollectionItemTrends,
  getPublicCollectionLifecycleTrends,
  getPublicCollectionMakerProductTrends,
  getPublicCollectionMaterialTrends,
  getPublicPartAccessoryTrends,
  getPublicPenRefillTrends,
  getPublicSliderTrends,
  getPublicSpinnerTrends,
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
   * Reloads lifecycle history when its URL-backed range or filters change.
   *
   * @param context - Route dependency context.
   * @param context.search - Validated Trends URL state.
   * @returns Selected lifecycle range and dimensions.
   */
  loaderDeps: ({ search }) => ({
    makerId: search.makerId,
    materialId: search.materialId,
    productTypeId: search.productTypeId,
    range: search.range ?? "year",
  }),
  /**
   * Loads exact public catalog-product Trends.
   *
   * @param context - Route loader context.
   * @param context.deps - Validated lifecycle range and dimensions.
   * @returns Public catalog, lifecycle, and recorded-activity Trends.
   * @rejects When Trends cannot be loaded.
   */
  loader: async ({ deps }) => {
    const [
      catalogTrends,
      collectionTrends,
      lifecycleTrends,
      makerProductTrends,
      partAccessoryTrends,
      catalogMaterialTrends,
      collectionMaterialTrends,
      activityTrends,
      sliderTrends,
      penRefillTrends,
      spinnerTrends,
    ] = await Promise.all([
      listPublicProductTypeTrends(),
      getPublicCollectionItemTrends(),
      getPublicCollectionLifecycleTrends({ data: deps }),
      getPublicCollectionMakerProductTrends(),
      getPublicPartAccessoryTrends(),
      getPublicCatalogMaterialTrends(),
      getPublicCollectionMaterialTrends(),
      getPublicActivityTrends({ data: deps.range }),
      getPublicSliderTrends(),
      getPublicPenRefillTrends(),
      getPublicSpinnerTrends(),
    ]);
    return {
      activityTrends,
      catalogMaterialTrends,
      catalogTrends,
      collectionMaterialTrends,
      collectionTrends,
      lifecycleTrends,
      makerProductTrends,
      partAccessoryTrends,
      sliderTrends,
      penRefillTrends,
      spinnerTrends,
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
    lifecycleTrends,
    makerProductTrends,
    partAccessoryTrends,
    sliderTrends,
    penRefillTrends,
    spinnerTrends,
  } = Route.useLoaderData();
  return (
    <TrendsPage
      activityTrends={activityTrends}
      catalogMaterialTrends={catalogMaterialTrends}
      collectionMaterialTrends={collectionMaterialTrends}
      collectionTrends={collectionTrends}
      lifecycleTrends={lifecycleTrends}
      makerProductTrends={makerProductTrends}
      onSearchChange={(nextSearch) =>
        void navigate({
          replace: true,
          search: nextSearch,
          to: "/trends",
        })
      }
      partAccessoryTrends={partAccessoryTrends}
      penRefillTrends={penRefillTrends}
      search={search}
      sliderTrends={sliderTrends}
      spinnerTrends={spinnerTrends}
      trends={catalogTrends}
    />
  );
}
