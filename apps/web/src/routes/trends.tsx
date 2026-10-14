import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  getPublicCollectionItemTrends,
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
   * Loads exact public catalog-product Trends.
   *
   * @returns Public product-type Trends.
   * @rejects When Trends cannot be loaded.
   */
  loader: async () => {
    const [catalogTrends, collectionTrends, partAccessoryTrends] =
      await Promise.all([
        listPublicProductTypeTrends(),
        getPublicCollectionItemTrends(),
        getPublicPartAccessoryTrends(),
      ]);
    return { catalogTrends, collectionTrends, partAccessoryTrends };
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
  const { productTypeId } = Route.useSearch();
  const { catalogTrends, collectionTrends, partAccessoryTrends } =
    Route.useLoaderData();
  return (
    <TrendsPage
      collectionTrends={collectionTrends}
      onProductTypeChange={(nextProductTypeId) =>
        void navigate({
          replace: true,
          search: nextProductTypeId ? { productTypeId: nextProductTypeId } : {},
          to: "/trends",
        })
      }
      partAccessoryTrends={partAccessoryTrends}
      selectedProductTypeId={productTypeId}
      trends={catalogTrends}
    />
  );
}
