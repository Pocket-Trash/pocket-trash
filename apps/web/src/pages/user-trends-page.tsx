import type {
  UserActivityTrends,
  UserCollectionHistoryTrends,
  UserCollectionItem,
} from "@package/services";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { ActivityTrendsChart } from "@/components/activity-trends-chart";
import { AppShell } from "@/components/app-shell";
import { CompositionComparison } from "@/components/composition-comparison";
import { TrendVisualization } from "@/components/trend-visualization";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPageShell } from "@/components/user-page-shell";
import type { CatalogTrendsSearch } from "@/lib/catalog-filters";
import {
  type CommunityTrendsSource,
  compareComposition,
  summarizeCommunityTrends,
  summarizeUserTrends,
} from "@/lib/user-trends";
import { useLocale } from "@/providers/locale-provider";

/** Translation keys supplied by the companion localizations change. */
type UserTrendsTranslationKey =
  | TranslationKey
  | "web.userTrends.collectionCount"
  | "web.userTrends.collectionSize"
  | "web.userTrends.collectionHistory"
  | "web.userTrends.collectionHistoryChartLabel"
  | "web.userTrends.acquisitions"
  | "web.userTrends.departures"
  | "web.userTrends.exactAcquisitionDates"
  | "web.userTrends.imputedAcquisitionDates"
  | "web.userTrends.communityComparison"
  | "web.userTrends.communityPercentage"
  | "web.userTrends.communityStale"
  | "web.userTrends.communitySuppressed"
  | "web.userTrends.communitySuppressedNote"
  | "web.userTrends.communityUnavailable"
  | "web.userTrends.comparisonDescription"
  | "web.userTrends.description"
  | "web.userTrends.empty"
  | "web.userTrends.items"
  | "web.userTrends.personalPercentage"
  | "web.userTrends.privateNote"
  | "web.userTrends.title"
  | "web.trends.activity"
  | "web.trends.activityChartLabel"
  | "web.trends.activityDate"
  | "web.trends.activityRange"
  | "web.trends.addedToPocketTrash"
  | "web.trends.allMakers"
  | "web.trends.allMaterials"
  | "web.trends.allMaterialSpecifics"
  | "web.trends.allProducts"
  | "web.trends.collectionItemsChartLabel"
  | "web.trends.collectionMaterialsChartLabel"
  | "web.trends.generalMaterial"
  | "web.trends.lastUpdated"
  | "web.trends.maker"
  | "web.trends.makersChartLabel"
  | "web.trends.material"
  | "web.trends.materialSpecific"
  | "web.trends.product"
  | "web.trends.productsChartLabel"
  | "web.trends.range30Days"
  | "web.trends.range6Months"
  | "web.trends.rangeAll"
  | "web.trends.rangeWeek"
  | "web.trends.rangeYear"
  | "web.trends.unspecifiedMaterial"
  | "web.trends.viewProducts";

/**
 * Resolves one stable personal Trends filter option.
 *
 * @template Item - Source value used to derive the option.
 */
interface UserTrendOptionIdentifier<Item> {
  /**
   * Identifies one filter option source.
   *
   * @param item - Source value used to derive the option.
   * @returns Stable identifier and label.
   */
  (item: Item): readonly [number, string];
}

/**
 * Renders exact current-state Trends for the signed-in owner's collection.
 *
 * @param props - Owner-scoped items, collections, and URL filter state.
 * @returns Private, accessible personal Trends page.
 */
export function UserTrendsPage({
  activityTrends = { granularity: "month", range: "year", values: [] },
  collectionCount,
  collectionHistoryTrends = {
    exactDateCount: 0,
    granularity: "month",
    imputedDateCount: 0,
    range: "year",
    values: [],
  },
  communityTrends,
  items,
  onSearchChange,
  publicUsername,
  search,
}: {
  /** Exact owner-scoped collection-item creation activity. */
  activityTrends?: UserActivityTrends;
  /** Number of collections owned by the signed-in user. */
  collectionCount: number;
  /** Exact effective-date lifecycle history for this owner. */
  collectionHistoryTrends?: UserCollectionHistoryTrends;
  /** Active privacy-safe public generations, available only to the owner view. */
  communityTrends?: CommunityTrendsSource;
  /** Currently owned physical items visible only to their owner. */
  items: UserCollectionItem[];
  /**
   * Updates stable URL filter state.
   *
   * @param search - Next normalized URL filter state.
   * @returns Completion after the parent accepts the state.
   */
  onSearchChange: (search: CatalogTrendsSearch) => void;
  /** Public profile username, or omitted for the private owner view. */
  publicUsername?: string;
  /** Normalized URL filter state. */
  search: CatalogTrendsSearch;
}) {
  const { locale } = useLocale();
  /**
   * Formats private Trends copy for the active locale.
   *
   * @param key - Private Trends translation key.
   * @param values - Named interpolation values.
   * @returns Localized private Trends copy.
   */
  const t = (
    key: UserTrendsTranslationKey,
    values: Record<string, string | number> = {},
  ) => formatTranslation(key as TranslationKey, values, locale);
  const trends = summarizeUserTrends(items, collectionCount, search);
  const community = communityTrends
    ? summarizeCommunityTrends(communityTrends, search, {
        generalMaterial: t("web.trends.generalMaterial"),
        unspecifiedMaterial: t("web.trends.unspecifiedMaterial"),
      })
    : undefined;
  const productTypes = options(items, (item) => [
    item.productTypeId,
    item.productTypeName,
  ]);
  const materials = options(
    items.flatMap((item) => item.materials),
    (material) => [material.id, material.name],
  );
  const materialSpecifics = options(
    items.flatMap((item) =>
      item.materials.filter(
        (material) =>
          material.id === search.materialId && Boolean(material.specific),
      ),
    ),
    (material) => [material.specific?.id ?? 0, material.specific?.name ?? ""],
  );
  const makers = options(items, (item) => [item.makerId, item.makerName]);
  const products = options(
    items.filter((item) => !search.makerId || item.makerId === search.makerId),
    (item) => [item.productId, item.name],
  );
  const emptyState = (
    <p
      className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground"
      role="status"
    >
      {t("web.userTrends.empty")}
    </p>
  );
  const visualizations = [
    {
      colorClass: "bg-chart-1",
      id: "product-types",
      label: t("web.trends.productType"),
      title: t("web.trends.collectionItemsChartLabel"),
      values: trends.productTypes,
      community: community?.productTypes,
    },
    {
      colorClass: "bg-chart-2",
      id: "materials",
      label: t("web.trends.material"),
      title: t("web.trends.collectionMaterialsChartLabel"),
      values: trends.materials,
      community: community?.materials,
    },
    {
      colorClass: "bg-chart-3",
      id: "makers",
      label: t("web.trends.maker"),
      title: t("web.trends.makersChartLabel"),
      values: trends.makers,
      community: community?.makers,
    },
    {
      colorClass: "bg-chart-4",
      id: "products",
      label: t("web.trends.product"),
      title: t("web.trends.productsChartLabel"),
      values: trends.products,
      community: community?.products,
    },
  ];

  const publicContent = (
    <main className="space-y-6 p-4 md:p-6">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-card p-4">
          <dt className="text-sm text-muted-foreground">
            {t("web.userTrends.collectionSize")}
          </dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {trends.itemCount}
          </dd>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <dt className="text-sm text-muted-foreground">
            {t("web.userTrends.collectionCount")}
          </dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {trends.collectionCount}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <TrendFilter
          id="user-trends-product-type"
          label={t("web.trends.productType")}
          onChange={(value) =>
            onSearchChange({
              ...search,
              makerId: undefined,
              productId: undefined,
              productTypeId: value,
            })
          }
          options={productTypes}
          placeholder={t("web.trends.allProductTypes")}
          value={search.productTypeId}
        />
        <TrendFilter
          id="user-trends-material"
          label={t("web.trends.material")}
          onChange={(value) =>
            onSearchChange({
              ...search,
              makerId: undefined,
              materialId: value,
              materialSpecificId: undefined,
              productId: undefined,
            })
          }
          options={materials}
          placeholder={t("web.trends.allMaterials")}
          value={search.materialId}
        />
        {search.materialId && materialSpecifics.length ? (
          <TrendFilter
            id="user-trends-material-specific"
            label={t("web.trends.materialSpecific")}
            onChange={(value) =>
              onSearchChange({
                ...search,
                makerId: undefined,
                materialSpecificId: value,
                productId: undefined,
              })
            }
            options={materialSpecifics}
            placeholder={t("web.trends.allMaterialSpecifics")}
            value={search.materialSpecificId}
          />
        ) : null}
        <TrendFilter
          id="user-trends-maker"
          label={t("web.trends.maker")}
          onChange={(value) =>
            onSearchChange({
              ...search,
              makerId: value,
              productId: undefined,
            })
          }
          options={makers}
          placeholder={t("web.trends.allMakers")}
          value={search.makerId}
        />
        <TrendFilter
          id="user-trends-product"
          label={t("web.trends.product")}
          onChange={(value) => onSearchChange({ ...search, productId: value })}
          options={products}
          placeholder={t("web.trends.allProducts")}
          value={search.productId}
        />
      </div>

      {visualizations.map((visualization) => (
        <section
          aria-labelledby={`user-trends-${visualization.id}-title`}
          className="space-y-4"
          key={visualization.id}
        >
          <h2
            className="text-lg font-semibold"
            id={`user-trends-${visualization.id}-title`}
          >
            {visualization.title}
          </h2>
          <TrendVisualization
            ariaLabel={visualization.title}
            colorClass={visualization.colorClass}
            countLabel={t("web.userTrends.items")}
            emptyState={emptyState}
            labelColumn={visualization.label}
            otherLabel={t("web.trends.other")}
            values={visualization.values.map((value) => ({
              ...value,
              key: value.id,
            }))}
            viewProductsLabel={t("web.trends.viewProducts")}
          />
        </section>
      ))}
    </main>
  );

  return publicUsername ? (
    <AppShell
      meta={t("web.userTrends.description")}
      title={`${publicUsername} · ${t("web.userTrends.title")}`}
    >
      {publicContent}
    </AppShell>
  ) : (
    <UserPageShell
      meta={t("web.userTrends.description")}
      section="trends"
      title={t("web.userTrends.title")}
    >
      <main className="space-y-6 p-4 md:p-6">
        <p className="text-sm text-muted-foreground">
          {t("web.userTrends.privateNote")}
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border bg-card p-4">
            <dt className="text-sm text-muted-foreground">
              {t("web.userTrends.collectionSize")}
            </dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {trends.itemCount}
            </dd>
          </div>
          <div className="rounded-md border border-border bg-card p-4">
            <dt className="text-sm text-muted-foreground">
              {t("web.userTrends.collectionCount")}
            </dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {trends.collectionCount}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-3">
          <TrendFilter
            id="user-trends-product-type"
            label={t("web.trends.productType")}
            onChange={(value) =>
              onSearchChange({
                ...search,
                makerId: undefined,
                productId: undefined,
                productTypeId: value,
              })
            }
            options={productTypes}
            placeholder={t("web.trends.allProductTypes")}
            value={search.productTypeId}
          />
          <TrendFilter
            id="user-trends-material"
            label={t("web.trends.material")}
            onChange={(value) =>
              onSearchChange({
                ...search,
                makerId: undefined,
                materialId: value,
                materialSpecificId: undefined,
                productId: undefined,
              })
            }
            options={materials}
            placeholder={t("web.trends.allMaterials")}
            value={search.materialId}
          />
          {search.materialId && materialSpecifics.length ? (
            <TrendFilter
              id="user-trends-material-specific"
              label={t("web.trends.materialSpecific")}
              onChange={(value) =>
                onSearchChange({
                  ...search,
                  makerId: undefined,
                  materialSpecificId: value,
                  productId: undefined,
                })
              }
              options={materialSpecifics}
              placeholder={t("web.trends.allMaterialSpecifics")}
              value={search.materialSpecificId}
            />
          ) : null}
          <TrendFilter
            id="user-trends-maker"
            label={t("web.trends.maker")}
            onChange={(value) =>
              onSearchChange({
                ...search,
                makerId: value,
                productId: undefined,
              })
            }
            options={makers}
            placeholder={t("web.trends.allMakers")}
            value={search.makerId}
          />
          <TrendFilter
            id="user-trends-product"
            label={t("web.trends.product")}
            onChange={(value) =>
              onSearchChange({ ...search, productId: value })
            }
            options={products}
            placeholder={t("web.trends.allProducts")}
            value={search.productId}
          />
        </div>

        {community ? (
          <div className="space-y-1 rounded-md border border-border bg-card p-4">
            <h2 className="font-semibold">
              {t("web.userTrends.communityComparison")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("web.userTrends.comparisonDescription")}
            </p>
          </div>
        ) : null}

        <section
          aria-labelledby="user-collection-history-title"
          className="space-y-4"
        >
          <div className="space-y-1">
            <h2
              className="text-lg font-semibold"
              id="user-collection-history-title"
            >
              {t("web.userTrends.collectionHistory")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("web.userTrends.exactAcquisitionDates", {
                count: collectionHistoryTrends.exactDateCount,
              })}{" "}
              {t("web.userTrends.imputedAcquisitionDates", {
                count: collectionHistoryTrends.imputedDateCount,
              })}
            </p>
          </div>
          <ActivityTrendsChart
            chartLabel={t("web.userTrends.collectionHistoryChartLabel")}
            dateLabel={t("web.trends.activityDate")}
            locale={locale}
            series={[
              {
                name: t("web.userTrends.collectionSize"),
                values: collectionHistoryTrends.values.map((value) => ({
                  bucketStart: value.bucketStart,
                  count: value.collectionCount,
                })),
              },
              {
                name: t("web.userTrends.acquisitions"),
                values: collectionHistoryTrends.values.map((value) => ({
                  bucketStart: value.bucketStart,
                  count: value.acquisitionCount,
                })),
              },
              {
                name: t("web.userTrends.departures"),
                values: collectionHistoryTrends.values.map((value) => ({
                  bucketStart: value.bucketStart,
                  count: value.departureCount,
                })),
              },
            ]}
          />
        </section>

        <section
          aria-labelledby="user-activity-trends-title"
          className="space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              className="text-lg font-semibold"
              id="user-activity-trends-title"
            >
              {t("web.trends.activity")}
            </h2>
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
                aria-label={t("web.trends.activityRange")}
                className="w-44"
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
                <SelectItem value="all">{t("web.trends.rangeAll")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ActivityTrendsChart
            chartLabel={t("web.trends.activityChartLabel")}
            dateLabel={t("web.trends.activityDate")}
            locale={locale}
            series={[
              {
                name: t("web.trends.addedToPocketTrash"),
                values: activityTrends.values.map((value) => ({
                  bucketStart: value.bucketStart,
                  count: value.count,
                })),
              },
            ]}
          />
        </section>

        {visualizations.map((visualization) => {
          const comparison = visualization.community
            ? compareComposition(
                visualization.values,
                visualization.community.values,
                visualization.community.hasSuppressedValues,
              )
            : [];
          const personalVisualization = (
            <TrendVisualization
              ariaLabel={visualization.title}
              colorClass={visualization.colorClass}
              countLabel={t("web.userTrends.items")}
              emptyState={emptyState}
              labelColumn={visualization.label}
              otherLabel={t("web.trends.other")}
              values={visualization.values.map((value) => ({
                ...value,
                key: value.id,
              }))}
              viewProductsLabel={t("web.trends.viewProducts")}
            />
          );
          return (
            <section
              aria-labelledby={`user-trends-${visualization.id}-title`}
              className="space-y-4"
              key={visualization.id}
            >
              <h2
                className="text-lg font-semibold"
                id={`user-trends-${visualization.id}-title`}
              >
                {visualization.title}
              </h2>
              {visualization.community ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    {t("web.trends.lastUpdated", {
                      date: new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                      }).format(visualization.community.generatedAt),
                    })}
                  </p>
                  {visualization.community.stale ? (
                    <p className="text-sm text-muted-foreground" role="status">
                      {t("web.userTrends.communityStale")}
                    </p>
                  ) : null}
                  {comparison.length ? (
                    <CompositionComparison
                      ariaLabel={visualization.title}
                      communityLabel={t("web.userTrends.communityPercentage")}
                      labelColumn={visualization.label}
                      locale={locale}
                      personalLabel={t("web.userTrends.personalPercentage")}
                      suppressedLabel={t("web.userTrends.communitySuppressed")}
                      values={comparison}
                      viewProductsLabel={t("web.trends.viewProducts")}
                    />
                  ) : (
                    emptyState
                  )}
                  {visualization.community.hasSuppressedValues ? (
                    <p className="text-xs text-muted-foreground" role="status">
                      {t("web.userTrends.communitySuppressedNote")}
                    </p>
                  ) : null}
                </>
              ) : visualization.community === null ? (
                <>
                  <p
                    className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground"
                    role="alert"
                  >
                    {t("web.userTrends.communityUnavailable")}
                  </p>
                  {personalVisualization}
                </>
              ) : (
                personalVisualization
              )}
            </section>
          );
        })}
      </main>
    </UserPageShell>
  );
}

/**
 * Renders one stable URL-backed Trends filter.
 *
 * @param root0 - Filter labels, options, selection, and callback.
 * @returns Stable URL-backed select control.
 */
function TrendFilter({
  id,
  label,
  onChange,
  options: filterOptions,
  placeholder,
  value,
}: {
  /** Accessible label ID prefix. */
  id: string;
  /** Visible filter label. */
  label: string;
  /**
   * Receives the selected identifier, or undefined for all.
   *
   * @param value - Selected stable identifier, or undefined for all.
   * @returns Completion after the parent accepts the selection.
   */
  onChange: (value?: number) => void;
  /** Stable catalog options. */
  options: Array<readonly [number, string]>;
  /** Localized all-values option. */
  placeholder: string;
  /** Selected stable identifier. */
  value?: number;
}) {
  return (
    <>
      <span className="text-sm font-semibold" id={`${id}-label`}>
        {label}
      </span>
      <Select
        onValueChange={(nextValue) =>
          onChange(nextValue === "all" ? undefined : Number(nextValue))
        }
        value={value?.toString() ?? "all"}
      >
        <SelectTrigger aria-labelledby={`${id}-label`} className="min-w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{placeholder}</SelectItem>
          {filterOptions.map(([id, optionLabel]) => (
            <SelectItem key={id} value={id.toString()}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

/**
 * Returns de-duplicated label-sorted filter options.
 *
 * @template Item - Source value used to derive the options.
 * @param items - Owner-scoped items used to derive choices.
 * @param identify - Resolves one stable identifier and label.
 * @returns De-duplicated label-sorted filter options.
 */
function options<Item>(
  items: Item[],
  identify: UserTrendOptionIdentifier<Item>,
) {
  return [...new Map(items.map(identify)).entries()].sort((left, right) =>
    left[1].localeCompare(right[1]),
  );
}
