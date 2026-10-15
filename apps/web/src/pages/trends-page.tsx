import type {
  PublicCollectionItemTrends,
  PublicProductTypeTrend,
} from "@package/services";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { AppShell } from "@/components/app-shell";
import { CatalogTrendsChart } from "@/components/catalog-trends-chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { filterCatalogTrends } from "@/lib/catalog-filters";
import { useLocale } from "@/providers/locale-provider";

/** Trends keys supplied by the stacked localization change. */
type TrendsTranslationKey =
  | TranslationKey
  | "web.trends.approximateItems"
  | "web.trends.collectionItems"
  | "web.trends.collectionItemsChartLabel"
  | "web.trends.collectionItemsEmpty"
  | "web.trends.collectionItemsError"
  | "web.trends.collectionItemsPrivacy"
  | "web.trends.collectionItemsStale"
  | "web.trends.collectionItemsSuppressed"
  | "web.trends.collectionItemsSuppressedEmpty"
  | "web.trends.lastUpdated";

/** Properties for the public catalog-product Trends page. */
export type TrendsPageProps = {
  /** Active privacy-safe collection-item generation. */
  collectionTrends: PublicCollectionItemTrends | null;
  /**
   * Updates the stable product-type URL filter.
   *
   * @param productTypeId - Selected product-type ID, or undefined for all types.
   */
  onProductTypeChange: (productTypeId?: number) => void;
  /** Stable product-type identifier selected by the URL filter. */
  selectedProductTypeId?: number;
  /** Exact public catalog-product counts in descending order. */
  trends: PublicProductTypeTrend[];
};

/**
 * Renders public catalog-product Trends with a chart and equivalent table.
 *
 * @param props - Trends data, selected filter, and URL-state callback.
 * @returns The accessible public Trends page.
 */
export function TrendsPage({
  collectionTrends,
  onProductTypeChange,
  selectedProductTypeId,
  trends,
}: TrendsPageProps) {
  const { locale } = useLocale();
  /**
   * Formats Trends copy for the active locale.
   *
   * @param key - Trends translation key.
   * @param values - Named interpolation values.
   * @returns Localized Trends copy.
   */
  const t = (
    key: TrendsTranslationKey,
    values: Record<string, string | number> = {},
  ) => formatTranslation(key as TranslationKey, values, locale);
  const visibleTrends = filterCatalogTrends(trends, selectedProductTypeId);
  const visibleCollectionTrends = filterCatalogTrends(
    collectionTrends?.values ?? [],
    selectedProductTypeId,
  );
  const collectionChartTrends =
    visibleCollectionTrends.length > 8
      ? [
          ...visibleCollectionTrends.slice(0, 8),
          {
            count: visibleCollectionTrends
              .slice(8)
              .reduce((sum, trend) => sum + trend.count, 0),
            productTypeId: 0,
            productTypeName: t("web.trends.other"),
          },
        ]
      : visibleCollectionTrends;
  const largestCollectionCount = Math.max(
    ...collectionChartTrends.map(({ count }) => count),
    1,
  );
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
  });
  const productTypeOptions = Array.from(
    new Map(
      [...trends, ...(collectionTrends?.values ?? [])].map((trend) => [
        trend.productTypeId,
        trend.productTypeName,
      ]),
    ),
  ).sort((left, right) => left[1].localeCompare(right[1], locale));
  return (
    <AppShell title={t("web.trends.title")}>
      <main className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="text-sm font-semibold"
            id="trends-product-type-label"
          >
            {t("web.trends.productType")}
          </span>
          <Select
            onValueChange={(value) =>
              onProductTypeChange(value === "all" ? undefined : Number(value))
            }
            value={selectedProductTypeId?.toString() ?? "all"}
          >
            <SelectTrigger
              aria-labelledby="trends-product-type-label"
              className="min-w-52"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("web.trends.allProductTypes")}
              </SelectItem>
              {productTypeOptions.map(([productTypeId, productTypeName]) => (
                <SelectItem
                  key={productTypeId}
                  value={productTypeId.toString()}
                >
                  {productTypeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <h2 className="text-lg font-semibold">
          {t("web.trends.catalogProducts")}
        </h2>
        {visibleTrends.length === 0 ? (
          <p
            className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground"
            role="status"
          >
            {t("web.trends.empty")}
          </p>
        ) : (
          <>
            <CatalogTrendsChart
              catalogProductsLabel={t("web.trends.catalogProducts")}
              chartLabel={t("web.trends.chartLabel")}
              otherLabel={t("web.trends.other")}
              trends={visibleTrends}
            />

            <details className="rounded-md border border-border bg-card">
              <summary className="cursor-pointer p-3 font-semibold">
                {t("web.trends.chartLabel")}
              </summary>
              <div className="overflow-x-auto border-t border-border">
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">
                    {t("web.trends.chartLabel")}
                  </caption>
                  <thead className="border-b border-border bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2" scope="col">
                        {t("web.trends.productType")}
                      </th>
                      <th className="px-3 py-2 text-right" scope="col">
                        {t("web.trends.catalogProducts")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTrends.map((trend) => (
                      <tr
                        className="border-b border-border last:border-0"
                        key={trend.productTypeId}
                      >
                        <th
                          className="px-3 py-2 text-left font-normal"
                          scope="row"
                        >
                          {trend.productTypeName}
                        </th>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {trend.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}

        <section
          aria-labelledby="collection-item-trends-title"
          className="space-y-4"
        >
          <div className="space-y-1">
            <h2
              className="text-lg font-semibold"
              id="collection-item-trends-title"
            >
              {t("web.trends.collectionItems")}
            </h2>
            {collectionTrends ? (
              <p className="text-xs text-muted-foreground">
                {t("web.trends.lastUpdated", {
                  date: dateFormatter.format(collectionTrends.generatedAt),
                })}
              </p>
            ) : null}
          </div>
          {collectionTrends?.stale ? (
            <p className="text-sm text-muted-foreground" role="status">
              {t("web.trends.collectionItemsStale")}
            </p>
          ) : null}
          {!collectionTrends ? (
            <p
              className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground"
              role="alert"
            >
              {t("web.trends.collectionItemsError")}
            </p>
          ) : visibleCollectionTrends.length === 0 ? (
            <p
              className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground"
              role="status"
            >
              {t(
                collectionTrends.hasSuppressedValues
                  ? "web.trends.collectionItemsSuppressedEmpty"
                  : "web.trends.collectionItemsEmpty",
              )}
            </p>
          ) : (
            <>
              <ol
                aria-label={t("web.trends.collectionItemsChartLabel")}
                className="space-y-3 rounded-md border border-border bg-card p-4"
              >
                {collectionChartTrends.map((trend) => (
                  <li
                    className="grid grid-cols-[minmax(7rem,1fr)_minmax(5rem,4fr)_auto] items-center gap-3 text-sm"
                    key={trend.productTypeId}
                  >
                    <span className="truncate">{trend.productTypeName}</span>
                    <span aria-hidden="true" className="h-3 bg-muted">
                      <span
                        className="block h-full bg-chart-2"
                        style={{
                          width: `${(trend.count / largestCollectionCount) * 100}%`,
                        }}
                      />
                    </span>
                    <span className="tabular-nums">{trend.count}</span>
                  </li>
                ))}
              </ol>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full border-collapse text-sm">
                  <caption className="bg-card p-3 text-left font-semibold">
                    {t("web.trends.collectionItemsChartLabel")}
                  </caption>
                  <thead className="border-y border-border bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2" scope="col">
                        {t("web.trends.productType")}
                      </th>
                      <th className="px-3 py-2 text-right" scope="col">
                        {t("web.trends.approximateItems")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCollectionTrends.map((trend) => (
                      <tr
                        className="border-b border-border last:border-0"
                        key={trend.productTypeId}
                      >
                        <th
                          className="px-3 py-2 text-left font-normal"
                          scope="row"
                        >
                          {trend.productTypeName}
                        </th>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {trend.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("web.trends.collectionItemsPrivacy")}
              </p>
              {collectionTrends.hasSuppressedValues ? (
                <p className="text-xs text-muted-foreground" role="status">
                  {t("web.trends.collectionItemsSuppressed")}
                </p>
              ) : null}
            </>
          )}
        </section>
      </main>
    </AppShell>
  );
}

/**
 * Renders localized loading state for the Trends route.
 *
 * @returns The public Trends loading page.
 */
export function TrendsPendingPage() {
  const { locale } = useLocale();
  /**
   * Formats Trends copy for the active locale.
   *
   * @param key - Trends translation key.
   * @returns Localized Trends copy.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  return (
    <AppShell title={t("web.trends.title")}>
      <main className="p-4 md:p-6">
        <p role="status">{t("web.trends.loading")}</p>
      </main>
    </AppShell>
  );
}
