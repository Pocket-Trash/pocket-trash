import type {
  CollectionItemStatusTrendItem,
  PublicStatusProductTrendValue,
  PublicStatusTrendValue,
} from "@package/services";
import {
  type CollectionItemStatusSearch,
  collectionItemStatusSearches,
} from "@package/services/catalog-terminology";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useId } from "react";
import { CatalogTrendsChart } from "@/components/catalog-trends-chart";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/providers/locale-provider";

/** Status labels reuse metadata copy; unstatused describes current items without assignments. */
const labelKeys: Record<CollectionItemStatusSearch, TranslationKey> = {
  grail: "web.collectionItemMetadata.grail",
  favorite: "web.collectionItemMetadata.favorite",
  "want-to-sell": "web.collectionItemMetadata.wantToSell",
  "want-to-trade": "web.collectionItemMetadata.wantToTrade",
  sold: "web.collectionItemMetadata.sold",
  unstatused: "web.collectionItemStatusTrends.unstatused",
};

/**
 * Renders authorized status assignments with equivalent pie/table selection and inline items.
 * @param props - Scope-authorized items, optional anonymous totals, and URL-owned selection.
 * @returns Responsive chart, accessible table, and privacy-filtered item results.
 */
export function CollectionItemStatusTrends({
  items,
  onSelect,
  selected,
  publicView = false,
  totals,
  anonymousProducts = [],
}: {
  /** Authorized items, independent of composition filters. */
  items: CollectionItemStatusTrendItem[];
  /**
   * Updates the parent's URL selection.
   * @param status - Selected bucket, or undefined to clear it.
   */
  onSelect: (status: CollectionItemStatusSearch | undefined) => void;
  /** Selected URL bucket, including empty result buckets. */
  selected?: CollectionItemStatusSearch;
  /** Public surfaces never link departed items to owner editing. */
  publicView?: boolean;
  /** App-wide transformed totals; an empty list falls back to exact public counts. */
  totals?: PublicStatusTrendValue[];
  /** Independently thresholded catalog groups without owner or source-item identity. */
  anonymousProducts?: PublicStatusProductTrendValue[];
}) {
  const { locale } = useLocale();
  const id = useId();
  /**
   * Formats one status message for the active locale.
   * @param key - Semantic localization key.
   * @param values - Named interpolation values.
   * @returns Localized complete message.
   */
  const t = (
    key: TranslationKey,
    values: Record<string, string | number> = {},
  ) => formatTranslation(key, values, locale);
  const numbers = new Intl.NumberFormat(locale);
  const appWide = totals !== undefined;
  const values = collectionItemStatusSearches.map((status, index) => {
    const publicCount = items.filter((item) =>
      item.statuses.includes(status),
    ).length;
    const anonymous = totals?.find((value) => value.status === status);
    return {
      status,
      publicCount,
      approximate: Boolean(anonymous),
      count: anonymous
        ? Math.max(anonymous.approximateItemCount, publicCount)
        : publicCount,
      productTypeId: index + 1,
      productTypeName: t(labelKeys[status]),
    };
  });
  const assignments = values.reduce((sum, value) => sum + value.count, 0);
  const results = items.filter(
    (item) => selected && item.statuses.includes(selected),
  );
  const products = anonymousProducts.filter(
    (product) => product.status === selected,
  );
  const overlap = t("web.collectionItemStatusTrends.overlap");
  const privacy = t("web.collectionItemStatusTrends.privacy");
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4">
      <h2 className="text-lg font-semibold" id={`${id}-title`}>
        {t("web.collectionItemStatusTrends.title")}
      </h2>
      <p className="text-sm text-muted-foreground" id={`${id}-overlap`}>
        {overlap}
      </p>
      {appWide || publicView ? (
        <p className="text-sm text-muted-foreground">
          {appWide ? privacy : t("web.collectionItemStatusTrends.publicOnly")}
        </p>
      ) : null}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {assignments ? (
          <CatalogTrendsChart
            catalogProductsLabel={t(
              "web.collectionItemStatusTrends.assignments",
            )}
            chartLabel={t("web.collectionItemStatusTrends.chartLabel")}
            description={appWide ? `${overlap} ${privacy}` : overlap}
            onProductTypeSelect={(value) =>
              onSelect(collectionItemStatusSearches[value - 1])
            }
            otherLabel={t("web.collectionItemStatusTrends.unstatused")}
            trends={values.filter((value) => value.count > 0)}
          />
        ) : (
          <p role="status">{t("web.collectionItemStatusTrends.empty")}</p>
        )}
        <div className="min-w-0 rounded-md border border-border">
          <table
            aria-describedby={`${id}-overlap`}
            className={`w-full table-fixed border-collapse break-words ${appWide ? "text-xs sm:text-sm" : "text-sm"}`}
          >
            <caption className="p-3 text-left font-semibold">
              {t("web.collectionItemStatusTrends.tableLabel")}
            </caption>
            <thead className="border-y border-border bg-muted/50 text-left">
              <tr>
                <th className="w-1/2 px-2 py-2" scope="col">
                  {t("web.collectionItemStatusTrends.status")}
                </th>
                <th className="px-2 py-2 text-right" scope="col">
                  {appWide ? (
                    <>
                      <span aria-hidden="true">#</span>
                      <span className="sr-only">
                        {t("web.collectionItemStatusTrends.assignments")}
                      </span>
                    </>
                  ) : (
                    t("web.collectionItemStatusTrends.assignments")
                  )}
                </th>
                {appWide ? (
                  <th className="px-2 py-2 text-right" scope="col">
                    {t("web.collectionItemMetadata.public")}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {values.map((value) => (
                <tr
                  className="border-b border-border last:border-0"
                  key={value.status}
                >
                  <th className="p-2 text-left font-normal" scope="row">
                    <Button
                      aria-label={t("web.collectionItemStatusTrends.select", {
                        status: value.productTypeName,
                      })}
                      aria-pressed={selected === value.status}
                      className="h-auto min-h-9 max-w-full whitespace-normal px-2 text-left text-xs sm:text-sm"
                      onClick={() => onSelect(value.status)}
                      variant={
                        selected === value.status ? "secondary" : "ghost"
                      }
                    >
                      {value.productTypeName}
                    </Button>
                  </th>
                  <td
                    aria-label={
                      appWide
                        ? t(
                            value.approximate
                              ? "web.collectionItemStatusTrends.approximateCount"
                              : "web.collectionItemStatusTrends.exactPublicCount",
                            { count: numbers.format(value.count) },
                          )
                        : undefined
                    }
                    className="px-2 py-2 text-right tabular-nums"
                  >
                    {value.approximate ? "≈ " : ""}
                    {numbers.format(value.count)}
                  </td>
                  {appWide ? (
                    <td
                      aria-label={t(
                        "web.collectionItemStatusTrends.exactPublicCount",
                        { count: numbers.format(value.publicCount) },
                      )}
                      className="px-2 py-2 text-right tabular-nums"
                    >
                      {numbers.format(value.publicCount)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selected ? (
        <section
          aria-labelledby={`${id}-results`}
          className="space-y-3 border-t border-border pt-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold" id={`${id}-results`}>
              {t("web.collectionItemStatusTrends.results", {
                status: t(labelKeys[selected]),
              })}
            </h3>
            <Button onClick={() => onSelect(undefined)} variant="outline">
              {t("web.collectionItemStatusTrends.clearSelection")}
            </Button>
          </div>
          {appWide ? (
            <>
              <p>
                {t("web.collectionItemStatusTrends.exactPublicCount", {
                  count: numbers.format(results.length),
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("web.collectionItemStatusTrends.publicOnly")}
              </p>
            </>
          ) : null}
          {results.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {results.map((item) => (
                <li
                  className="rounded-md border border-border bg-card p-4"
                  key={item.collectionItemId}
                >
                  {publicView && !item.current ? (
                    <>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("web.collectionItemStatusTrends.soldNoPublicPage")}
                      </p>
                    </>
                  ) : (
                    <a
                      className="font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-ring"
                      href={
                        item.current
                          ? `/collections/${item.ownerUserId}/${item.collectionId}/${item.collectionItemId}`
                          : `/collections/edit/${item.collectionItemId}`
                      }
                    >
                      {item.name}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p role="status">{t("web.collectionItemStatusTrends.empty")}</p>
          )}
          {products.length ? (
            <section
              aria-labelledby={`${id}-anonymous`}
              className="space-y-3 border-t border-border pt-4"
            >
              <h4 className="font-semibold" id={`${id}-anonymous`}>
                {t("web.collectionItemStatusTrends.anonymousProducts")}
              </h4>
              <ul className="space-y-3">
                {products.map((product) => (
                  <li
                    className="space-y-2 rounded-md border border-border bg-card p-4"
                    key={product.productId}
                  >
                    <a
                      className="font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-ring"
                      href={`/products/${product.productTypeSlug}/${product.productSlug}`}
                    >
                      {product.productName}
                    </a>
                    <p className="text-sm">
                      {t(
                        "web.collectionItemStatusTrends.anonymousProductCount",
                        {
                          count: numbers.format(product.approximateItemCount),
                          product: product.productName,
                        },
                      )}
                    </p>
                    <dl className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <dt>{t("web.trends.collectors")}</dt>
                      <dd>
                        {numbers.format(product.contributorCountBand)}–
                        {numbers.format(product.contributorCountBand + 4)}
                      </dd>
                    </dl>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
