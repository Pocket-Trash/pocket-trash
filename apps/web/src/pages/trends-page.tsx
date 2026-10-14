import type { PublicProductTypeTrend } from "@package/services";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { AppShell } from "@/components/app-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { filterCatalogTrends } from "@/lib/catalog-filters";
import { useLocale } from "@/providers/locale-provider";

/** Properties for the public catalog-product Trends page. */
export type TrendsPageProps = {
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
  onProductTypeChange,
  selectedProductTypeId,
  trends,
}: TrendsPageProps) {
  const { locale } = useLocale();
  /**
   * Formats Trends copy for the active locale.
   *
   * @param key - Trends translation key.
   * @returns Localized Trends copy.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const visibleTrends = filterCatalogTrends(trends, selectedProductTypeId);
  const chartTrends =
    visibleTrends.length > 8
      ? [
          ...visibleTrends.slice(0, 8),
          {
            count: visibleTrends
              .slice(8)
              .reduce((sum, trend) => sum + trend.count, 0),
            productTypeId: 0,
            productTypeName: t("web.trends.other"),
          },
        ]
      : visibleTrends;
  const largestCount = Math.max(...chartTrends.map(({ count }) => count), 1);

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
              {trends.map((trend) => (
                <SelectItem
                  key={trend.productTypeId}
                  value={trend.productTypeId.toString()}
                >
                  {trend.productTypeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {visibleTrends.length === 0 ? (
          <p
            className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground"
            role="status"
          >
            {t("web.trends.empty")}
          </p>
        ) : (
          <>
            <ol
              aria-label={t("web.trends.chartLabel")}
              className="space-y-3 rounded-md border border-border bg-card p-4"
            >
              {chartTrends.map((trend) => (
                <li
                  className="grid grid-cols-[minmax(7rem,1fr)_minmax(5rem,4fr)_auto] items-center gap-3 text-sm"
                  key={trend.productTypeId}
                >
                  <span className="truncate">{trend.productTypeName}</span>
                  <span aria-hidden="true" className="h-3 bg-muted">
                    <span
                      className="block h-full bg-chart-1"
                      style={{
                        width: `${(trend.count / largestCount) * 100}%`,
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
                  {t("web.trends.chartLabel")}
                </caption>
                <thead className="border-y border-border bg-muted/50 text-left">
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
          </>
        )}
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
