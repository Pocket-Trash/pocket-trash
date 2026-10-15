import type {
  PublicSpinnerTrend,
  PublicSpinnerTrendValue,
} from "@package/services";

/** One chart bucket derived from exact Spinner values. */
export type SpinnerTrendChartValue = {
  /** Exact catalog count in this bucket. */
  catalogCount: number;
  /** Sum of publishable rounded collection counts, or null when unavailable. */
  collectionCount: number | null;
  /** Stable chart bucket key. */
  key: string;
  /** Visible exact value, category, or numeric range. */
  label: string;
};

/** Exact Spinner trend value with a canonical measurement. */
type NumericSpinnerTrendValue = PublicSpinnerTrendValue & {
  /** Canonical measurement value. */
  numericValue: number;
};

/**
 * Renders one coverage-qualified Spinner distribution and collapsed exact table.
 *
 * @param props - Spinner metric and localized presentation labels.
 * @returns Accessible distribution chart with exact canonical values on demand.
 */
export function SpinnerTrendVisualization({
  approximateItemsLabel,
  catalogProductsLabel,
  chartLabel,
  detailsLabel,
  locale,
  otherLabel,
  suppressedLabel,
  trend,
  valueLabel,
}: {
  /** Privacy-safe collection series label. */
  approximateItemsLabel: string;
  /** Exact catalog series label. */
  catalogProductsLabel: string;
  /** Accessible chart and table name. */
  chartLabel: string;
  /** Label opening the exact-value table. */
  detailsLabel: string;
  /** Active number-format locale. */
  locale: string;
  /** Label for categorical values outside the largest eight. */
  otherLabel: string;
  /** Label for a privacy-suppressed collection value. */
  suppressedLabel: string;
  /** Coverage-qualified Spinner metric. */
  trend: PublicSpinnerTrend;
  /** Exact-value table column label. */
  valueLabel: string;
}) {
  const chartValues = spinnerTrendChartValues(trend, locale, otherLabel);
  const largestCount = Math.max(
    ...chartValues.flatMap(({ catalogCount, collectionCount }) => [
      catalogCount,
      collectionCount ?? 0,
    ]),
    1,
  );
  const numberFormatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 6,
  });
  /**
   * Formats one exact category or canonical measurement.
   *
   * @param value - Exact Spinner trend value.
   * @returns Localized display label.
   */
  const exactLabel = (value: PublicSpinnerTrendValue) =>
    value.numericValue === null
      ? value.label
      : `${numberFormatter.format(value.numericValue)} ${trend.unit}`;

  return (
    <div className="space-y-3">
      <div
        aria-label={chartLabel}
        className="space-y-3 rounded-md border border-border bg-card p-4"
      >
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="size-2 bg-chart-1" />
            {catalogProductsLabel}
          </span>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="size-2 bg-chart-2" />
            {approximateItemsLabel}
          </span>
        </div>
        <ol className="space-y-3">
          {chartValues.map((value) => (
            <li className="space-y-1 text-sm" key={value.key}>
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">{value.label}</span>
                <span className="tabular-nums">
                  {value.catalogCount} / {value.collectionCount ?? "—"}
                </span>
              </div>
              <div aria-hidden="true" className="grid gap-1">
                <span className="h-2 bg-muted">
                  <span
                    className="block h-full bg-chart-1"
                    style={{
                      width: `${(value.catalogCount / largestCount) * 100}%`,
                    }}
                  />
                </span>
                <span className="h-2 bg-muted">
                  <span
                    className="block h-full bg-chart-2"
                    style={{
                      width: `${((value.collectionCount ?? 0) / largestCount) * 100}%`,
                    }}
                  />
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <details className="rounded-md border border-border bg-card">
        <summary className="cursor-pointer p-3 font-semibold">
          {detailsLabel}
        </summary>
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{chartLabel}</caption>
            <thead className="border-b border-border bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2" scope="col">
                  {valueLabel}
                </th>
                <th className="px-3 py-2 text-right" scope="col">
                  {catalogProductsLabel}
                </th>
                <th className="px-3 py-2 text-right" scope="col">
                  {approximateItemsLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {trend.values.map((value) => (
                <tr
                  className="border-b border-border last:border-0"
                  key={value.key}
                >
                  <th className="px-3 py-2 text-left font-normal" scope="row">
                    {exactLabel(value)}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {value.catalogCount}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {value.collectionCount ?? suppressedLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/**
 * Produces at most eight readable buckets while retaining exact table values.
 *
 * @param trend - Exact Spinner metric values.
 * @param locale - Active number-format locale.
 * @param otherLabel - Localized categorical overflow label.
 * @returns Chart-ready exact categories or numeric ranges.
 */
export function spinnerTrendChartValues(
  trend: PublicSpinnerTrend,
  locale: string,
  otherLabel: string,
): SpinnerTrendChartValue[] {
  if (trend.unit === null) {
    const sorted = [...trend.values].sort(
      (left, right) =>
        right.catalogCount +
          (right.collectionCount ?? 0) -
          (left.catalogCount + (left.collectionCount ?? 0)) ||
        left.label.localeCompare(right.label, locale),
    );
    const overflow = sorted.slice(8);
    return overflow.length === 0
      ? sorted
      : [
          ...sorted.slice(0, 8),
          {
            catalogCount: overflow.reduce(
              (sum, value) => sum + value.catalogCount,
              0,
            ),
            collectionCount: sumCollectionCounts(overflow),
            key: "other",
            label: otherLabel,
          },
        ];
  }

  if (trend.values.length <= 8) {
    const formatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 6,
    });
    return trend.values.map((value) => ({
      ...value,
      label: `${formatter.format(value.numericValue ?? 0)} ${trend.unit}`,
    }));
  }

  const numericValues = trend.values.filter(hasNumericValue);
  const minimum = numericValues[0]?.numericValue ?? 0;
  const maximum = numericValues.at(-1)?.numericValue ?? minimum;
  const width = maximum === minimum ? 1 : (maximum - minimum) / 8;
  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  });
  const buckets = new Map<number, PublicSpinnerTrendValue[]>();
  for (const value of numericValues) {
    const index = Math.min(
      7,
      Math.floor((value.numericValue - minimum) / width),
    );
    buckets.set(index, [...(buckets.get(index) ?? []), value]);
  }
  return Array.from(buckets, ([index, values]) => {
    const start = minimum + index * width;
    const end = index === 7 ? maximum : minimum + (index + 1) * width;
    return {
      catalogCount: values.reduce((sum, value) => sum + value.catalogCount, 0),
      collectionCount: sumCollectionCounts(values),
      key: `${index}`,
      label: `${formatter.format(start)}–${formatter.format(end)} ${trend.unit}`,
    };
  });
}

/**
 * Narrows an exact Spinner value to a canonical measurement.
 *
 * @param value - Spinner trend value.
 * @returns Whether the value contains a canonical number.
 */
function hasNumericValue(
  value: PublicSpinnerTrendValue,
): value is NumericSpinnerTrendValue {
  return value.numericValue !== null;
}

/**
 * Sums only publishable collection counts without turning all-suppressed data into zero.
 *
 * @param values - Exact values included in one chart bucket.
 * @returns Summed rounded count, or null when every value is suppressed.
 */
function sumCollectionCounts(
  values: Array<Pick<PublicSpinnerTrendValue, "collectionCount">>,
) {
  const publishable = values.flatMap(({ collectionCount }) =>
    collectionCount === null ? [] : [collectionCount],
  );
  return publishable.length
    ? publishable.reduce((sum, count) => sum + count, 0)
    : null;
}
