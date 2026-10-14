import type { CompositionComparisonValue } from "@/lib/user-trends";

/**
 * Renders personal and privacy-safe community composition in one exact table.
 *
 * @param props - Localized labels and percentage rows.
 * @returns Accessible paired percentage comparison.
 */
export function CompositionComparison({
  ariaLabel,
  communityLabel,
  labelColumn,
  locale,
  personalLabel,
  suppressedLabel,
  values,
  viewProductsLabel,
}: {
  /** Accessible table label. */
  ariaLabel: string;
  /** Community percentage column label. */
  communityLabel: string;
  /** Category column label. */
  labelColumn: string;
  /** Active formatting locale. */
  locale: string;
  /** Personal percentage column label. */
  personalLabel: string;
  /** Privacy-suppressed value label. */
  suppressedLabel: string;
  /** Personal/community percentage rows. */
  values: CompositionComparisonValue[];
  /** Localized catalog action label. */
  viewProductsLabel: string;
}) {
  const formatPercentage = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    style: "percent",
  });

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{ariaLabel}</caption>
        <thead className="border-b border-border bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2" scope="col">
              {labelColumn}
            </th>
            <th className="min-w-36 px-3 py-2" scope="col">
              {personalLabel}
            </th>
            <th className="min-w-36 px-3 py-2" scope="col">
              {communityLabel}
            </th>
            <th className="px-3 py-2 text-right" scope="col">
              <span className="sr-only">{viewProductsLabel}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {values.map((value) => (
            <tr className="border-b border-border last:border-0" key={value.id}>
              <th className="px-3 py-2 text-left font-normal" scope="row">
                {value.label}
              </th>
              <td className="px-3 py-2">
                <PercentageBar
                  colorClass="bg-primary"
                  format={formatPercentage}
                  percentage={value.personalPercentage}
                />
              </td>
              <td className="px-3 py-2">
                {value.communityPercentage === null ? (
                  <span className="text-muted-foreground">
                    {suppressedLabel}
                  </span>
                ) : (
                  <PercentageBar
                    colorClass="bg-secondary-foreground"
                    format={formatPercentage}
                    percentage={value.communityPercentage}
                  />
                )}
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
  );
}

/**
 * Renders one exact percentage over a compact visual bar.
 *
 * @param props - Semantic color, formatter, and percentage.
 * @returns One visible and screen-readable percentage bar.
 */
function PercentageBar({
  colorClass,
  format,
  percentage,
}: {
  /** Bar color utility. */
  colorClass: string;
  /** Locale-aware percentage formatter. */
  format: Intl.NumberFormat;
  /** Percentage in the inclusive zero-to-100 range. */
  percentage: number;
}) {
  return (
    <div className="relative h-7 overflow-hidden bg-muted">
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 opacity-30 ${colorClass}`}
        style={{ width: `${percentage}%` }}
      />
      <span className="relative flex h-full items-center px-2 tabular-nums">
        <span className="bg-background px-1">
          {format.format(percentage / 100)}
        </span>
      </span>
    </div>
  );
}
