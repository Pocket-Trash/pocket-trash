import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { listPublicProductTypeTrends } from "@/lib/catalog-api";
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
  loader: () => listPublicProductTypeTrends(),
  pendingComponent: TrendsPendingPage,
  /**
   * Normalizes the optional stable product-type URL filter.
   *
   * @param search - Untrusted URL search parameters.
   * @returns A positive integer product-type filter or empty search state.
   */
  validateSearch: (search: Record<string, unknown>) => {
    const productTypeId = Number(search.productTypeId);
    return Number.isSafeInteger(productTypeId) && productTypeId > 0
      ? { productTypeId }
      : {};
  },
});

/**
 * Connects Trends route data and URL filter state to the page.
 *
 * @returns The rendered public Trends route.
 */
function TrendsRoute() {
  const navigate = useNavigate();
  const { productTypeId } = Route.useSearch();
  return (
    <TrendsPage
      onProductTypeChange={(nextProductTypeId) =>
        void navigate({
          replace: true,
          search: nextProductTypeId ? { productTypeId: nextProductTypeId } : {},
          to: "/trends",
        })
      }
      selectedProductTypeId={productTypeId}
      trends={Route.useLoaderData()}
    />
  );
}
