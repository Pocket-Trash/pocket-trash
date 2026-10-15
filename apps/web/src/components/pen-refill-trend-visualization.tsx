import type {
  PublicPenRefillTrends,
  PublicPenRefillTrendValue,
} from "@package/services";

/** Chart-ready refill format with exact catalog counts. */
export type PenRefillTrendChartValue = PublicPenRefillTrendValue;

/**
 * Renders refill-format counts with a collapsed accessible table.
 *
 * @param props - Pens and Refills Trends plus localized labels.
 * @returns Refill-format distribution and exact-value table.
 */
export function PenRefillTrendVisualization({
  chartLabel,
  compatiblePensLabel,
  detailsLabel,
  formatLabel,
  otherLabel,
  standaloneRefillsLabel,
  trends,
}: {
  /** Accessible chart and table name. */
  chartLabel: string;
  /** Compatible Pen series label. */
  compatiblePensLabel: string;
  /** Label opening the exact-value table. */
  detailsLabel: string;
  /** Refill-format table column label. */
  formatLabel: string;
  /** Localized categorical overflow label. */
  otherLabel: string;
  /** Standalone Refill series label. */
  standaloneRefillsLabel: string;
  /** Exact Pens and Refills Trends. */
  trends: PublicPenRefillTrends;
}) {
  const chartValues = penRefillTrendChartValues(trends.values, otherLabel);
  const largestCount = Math.max(
    ...chartValues.flatMap(({ compatiblePenCount, standaloneRefillCount }) => [
      compatiblePenCount,
      standaloneRefillCount,
    ]),
    1,
  );

  return (
    <div className="space-y-3">
      <div
        aria-label={chartLabel}
        className="space-y-3 rounded-md border border-border bg-card p-4"
      >
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="size-2 bg-chart-4" />
            {compatiblePensLabel}
          </span>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="size-2 bg-chart-3" />
            {standaloneRefillsLabel}
          </span>
        </div>
        <ol className="space-y-3">
          {chartValues.map((value) => (
            <li className="space-y-1 text-sm" key={value.key}>
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">{value.label}</span>
                <span className="tabular-nums">
                  {value.compatiblePenCount} / {value.standaloneRefillCount}
                </span>
              </div>
              <div aria-hidden="true" className="grid gap-1">
                <span className="h-2 bg-muted">
                  <span
                    className="block h-full bg-chart-4"
                    style={{
                      width: `${(value.compatiblePenCount / largestCount) * 100}%`,
                    }}
                  />
                </span>
                <span className="h-2 bg-muted">
                  <span
                    className="block h-full bg-chart-3"
                    style={{
                      width: `${(value.standaloneRefillCount / largestCount) * 100}%`,
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
                  {formatLabel}
                </th>
                <th className="px-3 py-2 text-right" scope="col">
                  {compatiblePensLabel}
                </th>
                <th className="px-3 py-2 text-right" scope="col">
                  {standaloneRefillsLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {trends.values.map((value) => (
                <tr
                  className="border-b border-border last:border-0"
                  key={value.key}
                >
                  <th className="px-3 py-2 text-left font-normal" scope="row">
                    {value.label}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {value.compatiblePenCount}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {value.standaloneRefillCount}
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
 * Keeps the largest eight refill formats and combines chart-only overflow.
 *
 * @param values - Exact refill-format rows.
 * @param otherLabel - Localized overflow label.
 * @returns Chart-ready rows without altering the accessible table values.
 */
export function penRefillTrendChartValues(
  values: PublicPenRefillTrendValue[],
  otherLabel: string,
): PenRefillTrendChartValue[] {
  const sorted = [...values].sort(
    (left, right) =>
      right.compatiblePenCount +
        right.standaloneRefillCount -
        (left.compatiblePenCount + left.standaloneRefillCount) ||
      left.label.localeCompare(right.label),
  );
  const overflow = sorted.slice(8);
  return overflow.length === 0
    ? sorted
    : [
        ...sorted.slice(0, 8),
        {
          compatiblePenCount: overflow.reduce(
            (sum, value) => sum + value.compatiblePenCount,
            0,
          ),
          key: "other",
          label: otherLabel,
          standaloneRefillCount: overflow.reduce(
            (sum, value) => sum + value.standaloneRefillCount,
            0,
          ),
        },
      ];
}
