import type {
  PublicActivityTrends,
  PublicCollectionItemTrends,
  PublicCollectionMakerProductTrends,
  PublicCollectionMaterialTrends,
  PublicMakerProductTrend,
  PublicMaterialTrend,
  PublicPartAccessoryTrends,
  PublicPenRefillTrends,
  PublicProductTypeTrend,
  PublicSliderTrends,
  PublicSpinnerTrends,
  SliderTrendMetricId,
  SpinnerTrendMetricId,
} from "@package/services";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { ActivityTrendsChart } from "@/components/activity-trends-chart";
import { AppShell } from "@/components/app-shell";
import { CatalogTrendsChart } from "@/components/catalog-trends-chart";
import { PenRefillTrendVisualization } from "@/components/pen-refill-trend-visualization";
import { SpinnerTrendVisualization } from "@/components/spinner-trend-visualization";
import { TrendVisualization } from "@/components/trend-visualization";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CatalogTrendsSearch } from "@/lib/catalog-filters";
import { filterCatalogTrends } from "@/lib/catalog-filters";
import { useLocale } from "@/providers/locale-provider";

/** Properties for the public catalog-product Trends page. */
export type TrendsPageProps = {
  /** Exact catalog and privacy-safe app-wide record creation activity. */
  activityTrends?: PublicActivityTrends;
  /** Exact approved public catalog-product material counts. */
  catalogMaterialTrends: PublicMaterialTrend[];
  /** Active privacy-safe material generation. */
  collectionMaterialTrends: PublicCollectionMaterialTrends | null;
  /** Active privacy-safe collection-item generation. */
  collectionTrends: PublicCollectionItemTrends | null;
  /** Active privacy-safe maker and product generation. */
  makerProductTrends?: PublicCollectionMakerProductTrends | null;
  /**
   * Updates stable Trends URL filters.
   *
   * @param search - Next normalized Trends search state.
   * @returns Completion after the parent accepts the state.
   */
  onSearchChange: (search: CatalogTrendsSearch) => void;
  /** Active privacy-safe Parts and Accessories generation. */
  partAccessoryTrends?: PublicPartAccessoryTrends | null;
  /** Exact compatible Pen and standalone Refill counts by refill format. */
  penRefillTrends?: PublicPenRefillTrends | null;
  /** Stable filters selected in URL search. */
  search?: CatalogTrendsSearch;
  /** Coverage-qualified Slider characteristics. */
  sliderTrends?: PublicSliderTrends | null;
  /** Coverage-qualified Spinner characteristics. */
  spinnerTrends?: PublicSpinnerTrends | null;
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
  activityTrends = { granularity: "month", range: "year", values: [] },
  catalogMaterialTrends,
  collectionMaterialTrends,
  collectionTrends,
  makerProductTrends = null,
  onSearchChange,
  partAccessoryTrends = null,
  penRefillTrends = null,
  search = {},
  sliderTrends = null,
  spinnerTrends = null,
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
    key: TranslationKey,
    values: Record<string, string | number> = {},
  ) => formatTranslation(key, values, locale);
  const spinnerMetricLabels: Record<SpinnerTrendMetricId, string> = {
    bearing: t("web.catalog.field.bearing"),
    bodyMaterial: t("web.trends.material"),
    buttonDiameter: t("web.catalog.field.buttonDiameter"),
    length: t("web.archive.spec.length"),
    maker: t("web.trends.maker"),
    spinDiameter: t("web.catalog.field.spinDiameter"),
    thickness: t("web.catalog.field.thickness"),
    thicknessWithButton: t("web.catalog.field.thicknessWithButton"),
    weight: t("web.archive.spec.weight"),
    width: t("web.catalog.field.width"),
  };
  const sliderMetricLabels: Record<SliderTrendMetricId, string> = {
    bodyMaterial: t("web.trends.sliderBodyMaterial"),
    length: t("web.archive.spec.length"),
    magnetLayout: t("web.slider.layout.label"),
    maker: t("web.trends.maker"),
    plateMaterial: t("web.trends.sliderPlateMaterial"),
    positionCount: t("web.slider.setup.clickCount"),
    thickness: t("web.catalog.field.thickness"),
    weight: t("web.archive.spec.weight"),
    width: t("web.catalog.field.width"),
  };
  const { makerId, materialId, materialSpecificId, productId, productTypeId } =
    search;
  const visibleTrends = filterCatalogTrends(trends, productTypeId);
  const visibleCollectionTrends = filterCatalogTrends(
    collectionTrends?.values ?? [],
    productTypeId,
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
  const visiblePartAccessoryTrends = filterCatalogTrends(
    partAccessoryTrends?.values ?? [],
    productTypeId,
  );
  const partAccessoryChartTrends =
    visiblePartAccessoryTrends.length > 8
      ? [
          ...visiblePartAccessoryTrends.slice(0, 8),
          {
            count: visiblePartAccessoryTrends
              .slice(8)
              .reduce((sum, trend) => sum + trend.count, 0),
            productTypeId: 0,
            productTypeName: t("web.trends.other"),
          },
        ]
      : visiblePartAccessoryTrends;
  const largestPartAccessoryCount = Math.max(
    ...partAccessoryChartTrends.map(({ count }) => count),
    1,
  );
  const visibleCollectorTrends = visibleCollectionTrends.map((trend) => ({
    count: trend.collectorCount,
    productTypeId: trend.productTypeId,
    productTypeName: trend.productTypeName,
  }));
  const collectorChartTrends =
    visibleCollectorTrends.length > 8
      ? [
          ...visibleCollectorTrends.slice(0, 8),
          {
            count: visibleCollectorTrends
              .slice(8)
              .reduce((sum, trend) => sum + trend.count, 0),
            productTypeId: 0,
            productTypeName: t("web.trends.other"),
          },
        ]
      : visibleCollectorTrends;
  const largestCollectorCount = Math.max(
    ...collectorChartTrends.map(({ count }) => count),
    1,
  );
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
  });
  const productTypeOptions = Array.from(
    new Map(
      [
        ...trends,
        ...(collectionTrends?.values ?? []),
        ...(partAccessoryTrends?.values ?? []),
      ].map((trend) => [trend.productTypeId, trend.productTypeName]),
    ),
  ).sort((left, right) => left[1].localeCompare(right[1], locale));
  const allMaterialValues = [
    ...catalogMaterialTrends,
    ...(collectionMaterialTrends?.itemValues ?? []),
  ];
  const materialOptions = Array.from(
    new Map(
      allMaterialValues.flatMap((value) =>
        value.materialId !== null && value.materialName !== null
          ? [[value.materialId, value.materialName] as const]
          : [],
      ),
    ),
  ).sort((left, right) => left[1].localeCompare(right[1], locale));
  const materialSpecificOptions = Array.from(
    new Map(
      allMaterialValues.flatMap((value) =>
        value.materialId === materialId &&
        value.materialSpecificId !== null &&
        value.materialSpecificName !== null
          ? [[value.materialSpecificId, value.materialSpecificName] as const]
          : [],
      ),
    ),
  ).sort((left, right) => left[1].localeCompare(right[1], locale));
  /**
   * Returns the current stable URL-filtered material rows.
   *
   * @param values - Material rows across all supported scopes.
   * @returns Rows matching the current URL filters.
   */
  const filterMaterials = (values: PublicMaterialTrend[]) =>
    values
      .filter(
        (value) =>
          value.productTypeId === (productTypeId ?? null) &&
          value.isSpecificBreakdown === Boolean(materialId) &&
          (materialSpecificId
            ? value.materialSpecificId === materialSpecificId
            : materialId
              ? value.materialId === materialId
              : value.materialSpecificId === null),
      )
      .sort((left, right) => right.count - left.count);
  /**
   * Resolves a general, specific, or Unspecified material label.
   *
   * @param value - Material row being rendered.
   * @returns Localized label for the active material scope.
   */
  const materialLabel = (value: PublicMaterialTrend) =>
    materialId
      ? (value.materialSpecificName ?? t("web.trends.generalMaterial"))
      : (value.materialName ?? t("web.trends.unspecifiedMaterial"));
  const visibleCatalogMaterials = filterMaterials(catalogMaterialTrends);
  const visibleCollectionMaterials = filterMaterials(
    collectionMaterialTrends?.itemValues ?? [],
  );
  const visibleCollectorMaterials = filterMaterials(
    collectionMaterialTrends?.collectorValues ?? [],
  );
  /**
   * Matches one maker or product result to the active overview filters.
   *
   * @param value - Privacy-safe maker or product result.
   * @returns Whether the row belongs to the selected product-type and material scope.
   */
  const matchesMakerProductScope = (value: PublicMakerProductTrend) =>
    value.productTypeId === (productTypeId ?? null) &&
    value.materialId === (materialId ?? null) &&
    value.materialSpecificId === (materialSpecificId ?? null);
  const scopedMakerValues = (makerProductTrends?.makerValues ?? []).filter(
    matchesMakerProductScope,
  );
  const scopedProductValues = (makerProductTrends?.productValues ?? []).filter(
    matchesMakerProductScope,
  );
  const visibleMakerValues = makerId
    ? scopedMakerValues.filter((value) => value.makerId === makerId)
    : scopedMakerValues;
  const visibleProductValues = scopedProductValues.filter(
    (value) =>
      (!makerId || value.makerId === makerId) &&
      (!productId || value.productId === productId),
  );
  const makerOptions = Array.from(
    new Map(
      scopedMakerValues.map(
        (value) => [value.makerId, value.makerName] as const,
      ),
    ),
  ).sort((left, right) => left[1].localeCompare(right[1], locale));
  const productOptions = Array.from(
    new Map(
      scopedProductValues
        .filter((value) => !makerId || value.makerId === makerId)
        .flatMap((value) =>
          value.productId !== null && value.productName !== null
            ? [[value.productId, value.productName] as const]
            : [],
        ),
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
              onSearchChange({
                ...search,
                makerId: undefined,
                ...(value === "all"
                  ? { productTypeId: undefined }
                  : { productTypeId: Number(value) }),
                productId: undefined,
              })
            }
            value={productTypeId?.toString() ?? "all"}
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
          <span className="text-sm font-semibold" id="trends-material-label">
            {t("web.trends.material")}
          </span>
          <Select
            onValueChange={(value) =>
              onSearchChange({
                ...search,
                makerId: undefined,
                materialId: value === "all" ? undefined : Number(value),
                materialSpecificId: undefined,
                productId: undefined,
              })
            }
            value={materialId?.toString() ?? "all"}
          >
            <SelectTrigger
              aria-labelledby="trends-material-label"
              className="min-w-52"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("web.trends.allMaterials")}
              </SelectItem>
              {materialOptions.map(([id, name]) => (
                <SelectItem key={id} value={id.toString()}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {materialId && materialSpecificOptions.length > 0 ? (
            <>
              <span
                className="text-sm font-semibold"
                id="trends-material-specific-label"
              >
                {t("web.trends.materialSpecific")}
              </span>
              <Select
                onValueChange={(value) =>
                  onSearchChange({
                    ...search,
                    makerId: undefined,
                    materialSpecificId:
                      value === "all" ? undefined : Number(value),
                    productId: undefined,
                  })
                }
                value={materialSpecificId?.toString() ?? "all"}
              >
                <SelectTrigger
                  aria-labelledby="trends-material-specific-label"
                  className="min-w-52"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("web.trends.allMaterialSpecifics")}
                  </SelectItem>
                  {materialSpecificOptions.map(([id, name]) => (
                    <SelectItem key={id} value={id.toString()}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : null}
          <span className="text-sm font-semibold" id="trends-maker-label">
            {t("web.trends.maker")}
          </span>
          <Select
            onValueChange={(value) =>
              onSearchChange({
                ...search,
                makerId: value === "all" ? undefined : Number(value),
                productId: undefined,
              })
            }
            value={makerId?.toString() ?? "all"}
          >
            <SelectTrigger
              aria-labelledby="trends-maker-label"
              className="min-w-52"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("web.trends.allMakers")}</SelectItem>
              {makerOptions.map(([id, name]) => (
                <SelectItem key={id} value={id.toString()}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm font-semibold" id="trends-product-label">
            {t("web.trends.product")}
          </span>
          <Select
            onValueChange={(value) =>
              onSearchChange({
                ...search,
                productId: value === "all" ? undefined : Number(value),
              })
            }
            value={productId?.toString() ?? "all"}
          >
            <SelectTrigger
              aria-labelledby="trends-product-label"
              className="min-w-52"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("web.trends.allProducts")}</SelectItem>
              {productOptions.map(([id, name]) => (
                <SelectItem key={id} value={id.toString()}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <section aria-labelledby="activity-trends-title" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold" id="activity-trends-title">
              {t("web.trends.activity")}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold" id="activity-range-label">
                {t("web.trends.activityRange")}
              </span>
              <Select
                onValueChange={(range) =>
                  onSearchChange({
                    ...search,
                    range: range as CatalogTrendsSearch["range"],
                  })
                }
                value={search.range ?? "year"}
              >
                <SelectTrigger
                  aria-labelledby="activity-range-label"
                  className="min-w-40"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">
                    {t("web.trends.rangeWeek")}
                  </SelectItem>
                  <SelectItem value="30-days">
                    {t("web.trends.range30Days")}
                  </SelectItem>
                  <SelectItem value="6-months">
                    {t("web.trends.range6Months")}
                  </SelectItem>
                  <SelectItem value="year">
                    {t("web.trends.rangeYear")}
                  </SelectItem>
                  <SelectItem value="all">
                    {t("web.trends.rangeAll")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <ActivityTrendsChart
            chartLabel={t("web.trends.activityChartLabel")}
            dateLabel={t("web.trends.activityDate")}
            locale={locale}
            series={[
              {
                name: t("web.trends.catalogRecordsAdded"),
                values: activityTrends.values.map((value) => ({
                  bucketStart: value.bucketStart,
                  count: value.catalogCount,
                })),
              },
              {
                name: t("web.trends.addedToPocketTrash"),
                values: activityTrends.values.map((value) => ({
                  bucketStart: value.bucketStart,
                  count: value.collectionCount,
                })),
              },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            {t("web.trends.activityPrivacy")}
          </p>
        </section>

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
              onProductTypeSelect={(nextProductTypeId) =>
                onSearchChange({
                  ...search,
                  makerId: undefined,
                  productId: undefined,
                  productTypeId: nextProductTypeId,
                })
              }
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

        {spinnerTrends && productTypeId === spinnerTrends.productTypeId ? (
          <section aria-labelledby="spinner-trends-title" className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold" id="spinner-trends-title">
                {t("web.trends.spinnerTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("web.trends.spinnerDescription")}
              </p>
            </div>
            {spinnerTrends.trends.map((trend) => {
              const label = spinnerMetricLabels[trend.metric];
              return (
                <section className="space-y-3" key={trend.metric}>
                  <div className="space-y-1">
                    <h3 className="font-semibold">{label}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t("web.trends.coverage", {
                        coverage: new Intl.NumberFormat(locale, {
                          maximumFractionDigits: 1,
                        }).format(trend.coveragePercent),
                      })}
                    </p>
                  </div>
                  <SpinnerTrendVisualization
                    approximateItemsLabel={t("web.trends.approximateItems")}
                    catalogProductsLabel={t("web.trends.catalogProducts")}
                    chartLabel={label}
                    detailsLabel={t("web.trends.exactValues")}
                    locale={locale}
                    otherLabel={t("web.trends.other")}
                    suppressedLabel={t("web.trends.suppressed")}
                    trend={trend}
                    valueLabel={t("web.trends.value")}
                  />
                  {trend.hasSuppressedCollectionValues ? (
                    <p className="text-xs text-muted-foreground" role="status">
                      {t("web.trends.spinnerSuppressed")}
                    </p>
                  ) : null}
                </section>
              );
            })}
            <p className="text-xs text-muted-foreground">
              {t("web.trends.spinnerPrivacy")}
            </p>
          </section>
        ) : null}

        {sliderTrends && productTypeId === sliderTrends.productTypeId ? (
          <section aria-labelledby="slider-trends-title" className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold" id="slider-trends-title">
                {t("web.trends.sliderTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("web.trends.sliderDescription")}
              </p>
            </div>
            {sliderTrends.trends.map((trend) => {
              const label = sliderMetricLabels[trend.metric];
              return (
                <section className="space-y-3" key={trend.metric}>
                  <div className="space-y-1">
                    <h3 className="font-semibold">{label}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t("web.trends.coverage", {
                        coverage: new Intl.NumberFormat(locale, {
                          maximumFractionDigits: 1,
                        }).format(trend.coveragePercent),
                      })}
                    </p>
                  </div>
                  <SpinnerTrendVisualization
                    approximateItemsLabel={t("web.trends.approximateItems")}
                    catalogProductsLabel={t("web.trends.catalogProducts")}
                    chartLabel={label}
                    detailsLabel={t("web.trends.exactValues")}
                    locale={locale}
                    otherLabel={t("web.trends.other")}
                    suppressedLabel={t("web.trends.suppressed")}
                    trend={trend}
                    valueLabel={t("web.trends.value")}
                  />
                  {trend.hasSuppressedCollectionValues ? (
                    <p className="text-xs text-muted-foreground" role="status">
                      {t("web.trends.sliderSuppressed")}
                    </p>
                  ) : null}
                </section>
              );
            })}
            <p className="text-xs text-muted-foreground">
              {t("web.trends.sliderPrivacy")}
            </p>
          </section>
        ) : null}

        {penRefillTrends &&
        penRefillTrends.values.length > 0 &&
        (productTypeId === penRefillTrends.penProductTypeId ||
          productTypeId === penRefillTrends.refillProductTypeId) ? (
          <section
            aria-labelledby="pen-refill-trends-title"
            className="space-y-4"
          >
            <div className="space-y-1">
              <h2
                className="text-lg font-semibold"
                id="pen-refill-trends-title"
              >
                {t("web.trends.penRefillTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("web.trends.penRefillDescription")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("web.trends.coverage", {
                  coverage: new Intl.NumberFormat(locale, {
                    maximumFractionDigits: 1,
                  }).format(penRefillTrends.penCoveragePercent),
                })}
              </p>
            </div>
            <PenRefillTrendVisualization
              chartLabel={t("web.trends.penRefillTitle")}
              compatiblePensLabel={t("web.pens.refill.compatiblePens")}
              detailsLabel={t("web.trends.exactValues")}
              formatLabel={t("web.trends.refillFormat")}
              otherLabel={t("web.trends.other")}
              standaloneRefillsLabel={t("web.trends.standaloneRefills")}
              trends={penRefillTrends}
            />
          </section>
        ) : null}

        <section
          aria-labelledby="catalog-material-trends-title"
          className="space-y-4"
        >
          <h2
            className="text-lg font-semibold"
            id="catalog-material-trends-title"
          >
            {t("web.trends.catalogMaterials")}
          </h2>
          {visibleCatalogMaterials.length === 0 ? (
            <p
              className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground"
              role="status"
            >
              {t("web.trends.materialsEmpty")}
            </p>
          ) : (
            <MaterialTrendVisualization
              ariaLabel={t("web.trends.catalogMaterialsChartLabel")}
              colorClass="bg-chart-1"
              columnLabel={t("web.trends.material")}
              countLabel={t("web.trends.catalogProducts")}
              getLabel={materialLabel}
              otherLabel={t("web.trends.other")}
              values={visibleCatalogMaterials}
              viewProductsLabel={t("web.trends.viewProducts")}
            />
          )}
        </section>

        <section
          aria-labelledby="collection-material-trends-title"
          className="space-y-4"
        >
          <div className="space-y-1">
            <h2
              className="text-lg font-semibold"
              id="collection-material-trends-title"
            >
              {t("web.trends.collectionMaterials")}
            </h2>
            {collectionMaterialTrends ? (
              <p className="text-xs text-muted-foreground">
                {t("web.trends.lastUpdated", {
                  date: dateFormatter.format(
                    collectionMaterialTrends.generatedAt,
                  ),
                })}
              </p>
            ) : null}
          </div>
          {collectionMaterialTrends?.stale ? (
            <p className="text-sm text-muted-foreground" role="status">
              {t("web.trends.materialsStale")}
            </p>
          ) : null}
          {!collectionMaterialTrends ? (
            <p
              className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground"
              role="alert"
            >
              {t("web.trends.materialsError")}
            </p>
          ) : visibleCollectionMaterials.length === 0 ? (
            <p
              className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground"
              role="status"
            >
              {t(
                collectionMaterialTrends.hasSuppressedValues
                  ? "web.trends.materialsSuppressedEmpty"
                  : "web.trends.materialsEmpty",
              )}
            </p>
          ) : (
            <>
              <MaterialTrendVisualization
                ariaLabel={t("web.trends.collectionMaterialsChartLabel")}
                colorClass="bg-chart-2"
                columnLabel={t("web.trends.material")}
                countLabel={t("web.trends.approximateItems")}
                getLabel={materialLabel}
                otherLabel={t("web.trends.other")}
                values={visibleCollectionMaterials}
                viewProductsLabel={t("web.trends.viewProducts")}
              />
              <h3 className="font-semibold">
                {t("web.trends.collectorMaterials")}
              </h3>
              <MaterialTrendVisualization
                ariaLabel={t("web.trends.collectorMaterialsChartLabel")}
                colorClass="bg-chart-3"
                columnLabel={t("web.trends.material")}
                countLabel={t("web.trends.approximateCollectors")}
                getLabel={materialLabel}
                otherLabel={t("web.trends.other")}
                values={visibleCollectorMaterials}
                viewProductsLabel={t("web.trends.viewProducts")}
              />
              <p className="text-xs text-muted-foreground">
                {t("web.trends.materialsPrivacy")}
              </p>
              {collectionMaterialTrends.hasSuppressedValues ? (
                <p className="text-xs text-muted-foreground" role="status">
                  {t("web.trends.materialsSuppressed")}
                </p>
              ) : null}
            </>
          )}
        </section>

        <section
          aria-labelledby="maker-product-trends-title"
          className="space-y-4"
        >
          <div className="space-y-1">
            <h2
              className="text-lg font-semibold"
              id="maker-product-trends-title"
            >
              {t("web.trends.makers")}
            </h2>
            {makerProductTrends ? (
              <p className="text-xs text-muted-foreground">
                {t("web.trends.lastUpdated", {
                  date: dateFormatter.format(makerProductTrends.generatedAt),
                })}
              </p>
            ) : null}
          </div>
          {makerProductTrends?.stale ? (
            <p className="text-sm text-muted-foreground" role="status">
              {t("web.trends.makerProductsStale")}
            </p>
          ) : null}
          {!makerProductTrends ? (
            <p
              className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground"
              role="alert"
            >
              {t("web.trends.makerProductsError")}
            </p>
          ) : (
            <>
              {visibleMakerValues.length > 0 ? (
                <MakerProductTrendVisualization
                  ariaLabel={t("web.trends.makersChartLabel")}
                  collectorLabel={t("web.trends.approximateCollectors")}
                  colorClass="bg-chart-4"
                  entityLabel={t("web.trends.maker")}
                  getLabel={(value) => value.makerName}
                  otherLabel={t("web.trends.other")}
                  itemLabel={t("web.trends.approximateItems")}
                  values={visibleMakerValues}
                  viewProductsLabel={t("web.trends.viewProducts")}
                />
              ) : (
                <p
                  className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground"
                  role="status"
                >
                  {t("web.trends.makerProductsEmpty")}
                </p>
              )}
              <h3 className="font-semibold">{t("web.trends.products")}</h3>
              {visibleProductValues.length > 0 ? (
                <MakerProductTrendVisualization
                  ariaLabel={t("web.trends.productsChartLabel")}
                  collectorLabel={t("web.trends.approximateCollectors")}
                  colorClass="bg-chart-3"
                  entityLabel={t("web.trends.product")}
                  getLabel={(value) =>
                    `${value.makerName} — ${value.productName ?? ""}`
                  }
                  otherLabel={t("web.trends.other")}
                  itemLabel={t("web.trends.approximateItems")}
                  values={visibleProductValues}
                  viewProductsLabel={t("web.trends.viewProducts")}
                />
              ) : (
                <p
                  className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground"
                  role="status"
                >
                  {t("web.trends.makerProductsEmpty")}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {t("web.trends.makerProductsPrivacy")}
              </p>
              {makerProductTrends.hasSuppressedValues ? (
                <p className="text-xs text-muted-foreground" role="status">
                  {t("web.trends.makerProductsSuppressed")}
                </p>
              ) : null}
            </>
          )}
        </section>

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
              <h3 className="font-semibold">{t("web.trends.collectors")}</h3>
              <ol
                aria-label={t("web.trends.collectorsChartLabel")}
                className="space-y-3 rounded-md border border-border bg-card p-4"
              >
                {collectorChartTrends.map((trend) => (
                  <li
                    className="grid grid-cols-[minmax(7rem,1fr)_minmax(5rem,4fr)_auto] items-center gap-3 text-sm"
                    key={trend.productTypeId}
                  >
                    <span className="truncate">{trend.productTypeName}</span>
                    <span aria-hidden="true" className="h-3 bg-muted">
                      <span
                        className="block h-full bg-chart-3"
                        style={{
                          width: `${(trend.count / largestCollectorCount) * 100}%`,
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
                    {t("web.trends.collectorsChartLabel")}
                  </caption>
                  <thead className="border-y border-border bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2" scope="col">
                        {t("web.trends.productType")}
                      </th>
                      <th className="px-3 py-2 text-right" scope="col">
                        {t("web.trends.approximateCollectors")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCollectorTrends.map((trend) => (
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

        <section
          aria-labelledby="part-accessory-trends-title"
          className="space-y-4"
        >
          <div className="space-y-1">
            <h2
              className="text-lg font-semibold"
              id="part-accessory-trends-title"
            >
              {t("web.trends.partsAndAccessories")}
            </h2>
            {partAccessoryTrends ? (
              <p className="text-xs text-muted-foreground">
                {t("web.trends.lastUpdated", {
                  date: dateFormatter.format(partAccessoryTrends.generatedAt),
                })}
              </p>
            ) : null}
          </div>
          {partAccessoryTrends?.stale ? (
            <p className="text-sm text-muted-foreground" role="status">
              {t("web.trends.partsAndAccessoriesStale")}
            </p>
          ) : null}
          {!partAccessoryTrends ? (
            <p
              className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground"
              role="alert"
            >
              {t("web.trends.partsAndAccessoriesError")}
            </p>
          ) : visiblePartAccessoryTrends.length === 0 ? (
            <p
              className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground"
              role="status"
            >
              {t(
                partAccessoryTrends.hasSuppressedValues
                  ? "web.trends.partsAndAccessoriesSuppressedEmpty"
                  : "web.trends.partsAndAccessoriesEmpty",
              )}
            </p>
          ) : (
            <>
              <ol
                aria-label={t("web.trends.partsAndAccessoriesChartLabel")}
                className="space-y-3 rounded-md border border-border bg-card p-4"
              >
                {partAccessoryChartTrends.map((trend) => (
                  <li
                    className="grid grid-cols-[minmax(7rem,1fr)_minmax(5rem,4fr)_auto] items-center gap-3 text-sm"
                    key={trend.productTypeId}
                  >
                    <span className="truncate">{trend.productTypeName}</span>
                    <span aria-hidden="true" className="h-3 bg-muted">
                      <span
                        className="block h-full bg-chart-3"
                        style={{
                          width: `${(trend.count / largestPartAccessoryCount) * 100}%`,
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
                    {t("web.trends.partsAndAccessoriesChartLabel")}
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
                    {visiblePartAccessoryTrends.map((trend) => (
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
                {t("web.trends.partsAndAccessoriesPrivacy")}
              </p>
              {partAccessoryTrends.hasSuppressedValues ? (
                <p className="text-xs text-muted-foreground" role="status">
                  {t("web.trends.partsAndAccessoriesSuppressed")}
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
 * Renders an accessible material bar chart and equivalent full table.
 *
 * @param props - Labels, values, and chart presentation.
 * @returns Material chart and table.
 */
function MaterialTrendVisualization(props: {
  /** Chart and table label. */
  ariaLabel: string;
  /** Bar color utility. */
  colorClass: string;
  /** Material-column label. */
  columnLabel: string;
  /** Count-column label. */
  countLabel: string;
  /**
   * Resolves the current general or specific material label.
   *
   * @param value - Material row being rendered.
   * @returns Localized row label.
   */
  getLabel: (value: PublicMaterialTrend) => string;
  /** Localized Other label. */
  otherLabel: string;
  /** Ordered material values. */
  values: PublicMaterialTrend[];
  /** Localized products-link label. */
  viewProductsLabel: string;
}) {
  const {
    ariaLabel,
    colorClass,
    columnLabel,
    countLabel,
    getLabel,
    otherLabel,
    values,
    viewProductsLabel,
  } = props;
  /**
   * Returns a stable key for one scoped material row.
   *
   * @param value - Material row being rendered.
   * @returns Stable React row key.
   */
  const rowKey = (value: PublicMaterialTrend) =>
    `${value.productTypeId ?? "all"}:${value.materialId ?? "unspecified"}:${value.materialSpecificId ?? "general"}:${value.isSpecificBreakdown}`;
  return (
    <TrendVisualization
      ariaLabel={ariaLabel}
      colorClass={colorClass}
      countLabel={countLabel}
      emptyState={null}
      labelColumn={columnLabel}
      otherLabel={otherLabel}
      values={values.map((value) => ({
        count: value.count,
        key: rowKey(value),
        label: getLabel(value),
        productsHref: value.materialSlug
          ? value.materialSpecificSlug
            ? `/materials/${value.materialSlug}/${value.materialSpecificSlug}`
            : `/materials/${value.materialSlug}`
          : undefined,
      }))}
      viewProductsLabel={viewProductsLabel}
    />
  );
}

/**
 * Renders collector-ranked maker or product results with an equivalent table.
 *
 * @param props - Localized labels, values, and bar presentation.
 * @returns Accessible collector chart and complete result table.
 */
function MakerProductTrendVisualization(props: {
  /** Chart and table label. */
  ariaLabel: string;
  /** Bar color utility. */
  colorClass: string;
  /** Localized collector-count label. */
  collectorLabel: string;
  /** First-column label. */
  entityLabel: string;
  /**
   * Resolves the visible entity label.
   *
   * @param value - Maker or product row being rendered.
   * @returns Localized or catalog-owned display label.
   */
  getLabel: (value: PublicMakerProductTrend) => string;
  /** Localized Other label. */
  otherLabel: string;
  /** Localized item-count label. */
  itemLabel: string;
  /** Collector-descending rows in the active filter scope. */
  values: PublicMakerProductTrend[];
  /** Localized products-link label. */
  viewProductsLabel: string;
}) {
  const {
    ariaLabel,
    collectorLabel,
    colorClass,
    entityLabel,
    getLabel,
    otherLabel,
    itemLabel,
    values,
    viewProductsLabel,
  } = props;
  const overflow = values.slice(8);
  const overflowSeed = overflow[0];
  const chartValues = overflowSeed
    ? [
        ...values.slice(0, 8),
        {
          ...overflowSeed,
          collectorCount: overflow.reduce(
            (sum, value) => sum + value.collectorCount,
            0,
          ),
          itemCount: overflow.reduce((sum, value) => sum + value.itemCount, 0),
          makerId: -1,
          makerName: otherLabel,
          productId: null,
          productName: null,
          productSlug: null,
        },
      ]
    : values;
  const largestCount = Math.max(
    ...chartValues.map(({ collectorCount }) => collectorCount),
    1,
  );
  /**
   * Builds a catalog destination that preserves representable chart filters.
   *
   * @param value - Maker or product row being linked.
   * @returns Product detail or filterable catalog URL.
   */
  const productsHref = (value: PublicMakerProductTrend) => {
    if (value.productSlug && value.productTypeSlug) {
      return `/products/${value.productTypeSlug}/${value.productSlug}`;
    }
    const query = new URLSearchParams({
      maker: value.makerId.toString(),
      view: "all",
    });
    if (value.materialId !== null)
      query.set("material", value.materialId.toString());
    if (value.productTypeSlug) query.set("type", value.productTypeSlug);
    return `/products?${query.toString()}`;
  };
  return (
    <>
      <ol
        aria-label={ariaLabel}
        className="space-y-3 rounded-md border border-border bg-card p-4"
      >
        {chartValues.map((value) => (
          <li
            className="grid grid-cols-[minmax(7rem,1fr)_minmax(5rem,4fr)_auto] items-center gap-3 text-sm"
            key={`${value.makerId}:${value.productId ?? "maker"}`}
          >
            <span className="truncate">
              {value.makerId === -1 ? otherLabel : getLabel(value)}
            </span>
            <span aria-hidden="true" className="h-3 bg-muted">
              <span
                className={`block h-full ${colorClass}`}
                style={{
                  width: `${(value.collectorCount / largestCount) * 100}%`,
                }}
              />
            </span>
            <span className="tabular-nums">{value.collectorCount}</span>
          </li>
        ))}
      </ol>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-sm">
          <caption className="bg-card p-3 text-left font-semibold">
            {ariaLabel}
          </caption>
          <thead className="border-y border-border bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2" scope="col">
                {entityLabel}
              </th>
              <th className="px-3 py-2 text-right" scope="col">
                {collectorLabel}
              </th>
              <th className="px-3 py-2 text-right" scope="col">
                {itemLabel}
              </th>
              <th className="px-3 py-2 text-right" scope="col">
                <span className="sr-only">{viewProductsLabel}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {values.map((value) => (
              <tr
                className="border-b border-border last:border-0"
                key={`${value.makerId}:${value.productId ?? "maker"}`}
              >
                <th className="px-3 py-2 text-left font-normal" scope="row">
                  {getLabel(value)}
                </th>
                <td className="px-3 py-2 text-right tabular-nums">
                  {value.collectorCount}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {value.itemCount}
                </td>
                <td className="px-3 py-2 text-right">
                  <a
                    className="font-medium underline underline-offset-4"
                    href={productsHref(value)}
                  >
                    {viewProductsLabel}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
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
