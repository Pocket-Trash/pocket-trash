import type { CollectionItemStatusTrendItem } from "@package/services";
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
 * Renders exact status assignments with equivalent pie/table selection and inline items.
 * @param props - Authorized minimal items and URL-owned status selection.
 * @returns Responsive status chart, accessible table, and selected item cards.
 */
export function CollectionItemStatusTrends({
  items,
  onSelect,
  selected,
  publicView = false,
}: {
  /** Owner-authorized items, independent of the composition filters. */
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
  const values = collectionItemStatusSearches.map((status, index) => ({
    status,
    count: items.filter((item) => item.statuses.includes(status)).length,
    productTypeId: index + 1,
    productTypeName: t(labelKeys[status]),
  }));
  const assignments = values.reduce((sum, value) => sum + value.count, 0);
  const results = items.filter(
    (item) => selected && item.statuses.includes(selected),
  );
  const overlap = t("web.collectionItemStatusTrends.overlap");
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4">
      <h2 className="text-lg font-semibold" id={`${id}-title`}>
        {t("web.collectionItemStatusTrends.title")}
      </h2>
      <p className="text-sm text-muted-foreground" id={`${id}-overlap`}>
        {overlap}
      </p>
      {publicView ? (
        <p className="text-sm text-muted-foreground">
          {t("web.collectionItemStatusTrends.publicOnly")}
        </p>
      ) : null}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {assignments ? (
          <CatalogTrendsChart
            catalogProductsLabel={t(
              "web.collectionItemStatusTrends.assignments",
            )}
            chartLabel={t("web.collectionItemStatusTrends.chartLabel")}
            description={overlap}
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
            className="w-full table-fixed border-collapse break-words text-sm"
          >
            <caption className="p-3 text-left font-semibold">
              {t("web.collectionItemStatusTrends.tableLabel")}
            </caption>
            <thead className="border-y border-border bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2" scope="col">
                  {t("web.collectionItemStatusTrends.status")}
                </th>
                <th className="px-3 py-2 text-right" scope="col">
                  {t("web.collectionItemStatusTrends.assignments")}
                </th>
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
                      className="h-auto min-h-9 max-w-full whitespace-normal text-left"
                      onClick={() => onSelect(value.status)}
                      variant={
                        selected === value.status ? "secondary" : "ghost"
                      }
                    >
                      {value.productTypeName}
                    </Button>
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {value.count}
                  </td>
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
        </section>
      ) : null}
    </section>
  );
}
