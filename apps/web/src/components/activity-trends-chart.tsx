import { Chart, Tooltip } from "@highcharts/react";
import { Accessibility } from "@highcharts/react/modules/Accessibility";
import { XAxis, YAxis } from "@highcharts/react/options";
import { LineSeries } from "@highcharts/react/series/Line";

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

  return (
    <div className="space-y-3">
      <Chart
        animation={false}
        containerProps={{
          className: "rounded-md border border-border bg-card",
        }}
        height={360}
        styledMode
        title={chartLabel}
      >
        <Accessibility
          description={chartLabel}
          screenReaderSection={{
            beforeChartFormat:
              "<div>{typeDescription}</div><div>{chartLongdesc}</div>",
          }}
        />
        <XAxis type="datetime" />
        <YAxis allowDecimals={false} min={0} />
        <Tooltip shared xDateFormat="%b %e, %Y" />
        {series.map(({ name, values }) => (
          <LineSeries
            data={values.map(({ bucketStart, count }) => [
              bucketStart.getTime(),
              count,
            ])}
            key={name}
            name={name}
            options={{ connectNulls: false }}
          />
        ))}
      </Chart>

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
