import type { ReactNode } from "react";

/** Minimum shape rendered by the shared Trends chart and table. */
export type TrendVisualizationValue = {
  /** Exact or privacy-safe displayed count. */
  count: number;
  /** Stable row key. */
  key: string | number;
  /** Visible bucket label. */
  label: string;
  /** Optional catalog destination. */
  productsHref?: string;
};

/**
 * Renders a top-eight-plus-Other bar chart and equivalent complete table.
 *
 * @param props - Values and localized presentation labels.
 * @returns Accessible Trends visualization.
 */
export function TrendVisualization({
  ariaLabel,
  colorClass,
  countLabel,
  emptyState,
  labelColumn,
  otherLabel,
  values,
  viewProductsLabel,
}: {
  /** Chart and table accessible label. */
  ariaLabel: string;
  /** Bar color utility. */
  colorClass: string;
  /** Count column heading. */
  countLabel: string;
  /** State rendered when no buckets match. */
  emptyState: ReactNode;
  /** First-column heading. */
  labelColumn: string;
  /** Localized label for aggregated chart overflow. */
  otherLabel: string;
  /** Count-descending complete values. */
  values: TrendVisualizationValue[];
  /** Localized action label. */
  viewProductsLabel: string;
}) {
  if (values.length === 0) return emptyState;
  const overflow = values.slice(8);
  const chartValues = overflow.length
    ? [
        ...values.slice(0, 8),
        {
          count: overflow.reduce((sum, value) => sum + value.count, 0),
          key: "other",
          label: otherLabel,
        },
      ]
    : values;
  const largestCount = Math.max(...chartValues.map(({ count }) => count), 1);

  return (
    <>
      <ol
        aria-label={ariaLabel}
        className="space-y-3 rounded-md border border-border bg-card p-4"
      >
        {chartValues.map((value) => (
          <li
            className="grid grid-cols-[minmax(7rem,1fr)_minmax(5rem,4fr)_auto] items-center gap-3 text-sm"
            key={value.key}
          >
            <span className="truncate">{value.label}</span>
            <span aria-hidden="true" className="h-3 bg-muted">
              <span
                className={`block h-full ${colorClass}`}
                style={{ width: `${(value.count / largestCount) * 100}%` }}
              />
            </span>
            <span className="tabular-nums">{value.count}</span>
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
                {labelColumn}
              </th>
              <th className="px-3 py-2 text-right" scope="col">
                {countLabel}
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
                key={value.key}
              >
                <th className="px-3 py-2 text-left font-normal" scope="row">
                  {value.label}
                </th>
                <td className="px-3 py-2 text-right tabular-nums">
                  {value.count}
                </td>
                <td className="px-3 py-2 text-right">
                  {value.productsHref ? (
                    <a
                      className="font-medium underline underline-offset-4"
                      href={value.productsHref}
                    >
                      {viewProductsLabel}
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
