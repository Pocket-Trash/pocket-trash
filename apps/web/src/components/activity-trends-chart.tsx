import Highcharts from "highcharts/es-modules/masters/highcharts.src.js";
import "highcharts/es-modules/masters/modules/accessibility.src.js";
import { useCallback } from "react";

/** One recorded-activity chart point. */
type ActivityChartPoint = {
  /** Chronological points; null values render as intentional gaps. */
  bucketStart: Date;
  /** Exact or privacy-safe count; null renders as an intentional gap. */
  count: number | null;
};

/** One named recorded-activity series. */
export type ActivityChartSeries = {
  /** Localized metric label. */
  name: string;
  /** Chronological activity points. */
  values: ActivityChartPoint[];
};

/**
 * Renders recorded activity as a time series with a collapsed exact table.
 *
 * @param root0 - Localized chart labels, locale, and activity series.
 * @returns Accessible activity chart and equivalent table.
 */
export function ActivityTrendsChart({
  chartLabel,
  dateLabel,
  locale,
  series,
}: {
  /** Localized accessible chart label. */
  chartLabel: string;
  /** Localized table date-column label. */
  dateLabel: string;
  /** Active formatting locale. */
  locale: string;
  /** One or more activity series. */
  series: ActivityChartSeries[];
}) {
  const bucketStarts = Array.from(
    new Map(
      series.flatMap(({ values }) =>
        values.map(({ bucketStart }) => [bucketStart.getTime(), bucketStart]),
      ),
    ).values(),
  ).sort((left, right) => left.getTime() - right.getTime());
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  const valueBySeries = series.map(
    ({ values }) =>
      new Map(
        values.map((value) => [value.bucketStart.getTime(), value.count]),
      ),
  );

  const chartRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;

      const chart = Highcharts.chart(node, {
        accessibility: {
          description: chartLabel,
          screenReaderSection: {
            beforeChartFormat:
              "<div>{typeDescription}</div><div>{chartLongdesc}</div>",
          },
        },
        chart: {
          animation: false,
          height: 360,
          styledMode: true,
          type: "line",
        },
        series: series.map(({ name, values }) => ({
          data: values.map(({ bucketStart, count }) => [
            bucketStart.getTime(),
            count,
          ]),
          name,
          type: "line",
        })),
        title: { text: chartLabel },
        tooltip: { shared: true, xDateFormat: "%b %e, %Y" },
        xAxis: { type: "datetime" },
        yAxis: { allowDecimals: false, min: 0 },
      });

      return () => chart.destroy();
    },
    [chartLabel, series],
  );

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-card" ref={chartRef} />

      <details className="rounded-md border border-border bg-card">
        <summary className="cursor-pointer p-3 font-semibold">
          {chartLabel}
        </summary>
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{chartLabel}</caption>
            <thead className="border-b border-border bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2" scope="col">
                  {dateLabel}
                </th>
                {series.map(({ name }) => (
                  <th className="px-3 py-2 text-right" key={name} scope="col">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bucketStarts.map((bucketStart) => (
                <tr
                  className="border-b border-border last:border-0"
                  key={bucketStart.toISOString()}
                >
                  <th className="px-3 py-2 text-left font-normal" scope="row">
                    {dateFormatter.format(bucketStart)}
                  </th>
                  {valueBySeries.map((values, index) => (
                    <td
                      className="px-3 py-2 text-right tabular-nums"
                      key={series[index]?.name}
                    >
                      {values.get(bucketStart.getTime()) ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
