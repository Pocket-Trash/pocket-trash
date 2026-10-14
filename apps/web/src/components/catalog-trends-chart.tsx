import { Chart, Tooltip } from "@highcharts/react";
import { Accessibility } from "@highcharts/react/modules/Accessibility";
import { Drilldown } from "@highcharts/react/modules/Drilldown";
import { PieSeries } from "@highcharts/react/series/Pie";
import type { PublicProductTypeTrend } from "@package/services";

/** One overview slice with optional nested drilldown data. */
type CatalogPiePoint = {
  /** Drilldown series identifier for an interactive slice. */
  drilldown?: string;
  /** Visible product-type label. */
  name: string;
  /** Exact catalog-product count. */
  y: number;
};

/**
 * Renders a Highcharts pie with an Other slice that drills into overflow categories.
 *
 * @param root0 - Localized labels and exact catalog Trends.
 * @returns Accessible product-type composition chart.
 */
export function CatalogTrendsChart({
  catalogProductsLabel,
  chartLabel,
  otherLabel,
  trends,
}: {
  /** Localized metric name used by tooltips and assistive technology. */
  catalogProductsLabel: string;
  /** Localized chart title and accessible description. */
  chartLabel: string;
  /** Localized label for categories outside the largest eight. */
  otherLabel: string;
  /** Exact public catalog-product counts in descending order. */
  trends: PublicProductTypeTrend[];
}) {
  const overflow = trends.slice(8);
  const data: CatalogPiePoint[] = trends.slice(0, 8).map((trend) => ({
    name: trend.productTypeName,
    y: trend.count,
  }));

  if (overflow.length) {
    data.push({
      drilldown: "other-product-types",
      name: otherLabel,
      y: overflow.reduce((sum, trend) => sum + trend.count, 0),
    });
  }

  const seriesOptions = {
    dataLabels: {
      enabled: true,
      format: "{point.name}: {point.percentage:.1f}%",
    },
    showInLegend: true,
  } as const;

  return (
    <Chart
      animation={false}
      containerProps={{
        className: "rounded-md border border-border bg-card",
      }}
      height={440}
      styledMode
      title={chartLabel}
    >
      <Accessibility
        description={chartLabel}
        point={{ valueSuffix: ` ${catalogProductsLabel}` }}
        screenReaderSection={{
          beforeChartFormat:
            "<div>{typeDescription}</div><div>{chartLongdesc}</div>",
        }}
        series={{ describeSingleSeries: true }}
      />
      <Tooltip>
        {`{point.name}: <b>{point.y}</b> ${catalogProductsLabel}`}
      </Tooltip>
      <PieSeries
        data={data}
        name={catalogProductsLabel}
        options={seriesOptions}
      />
      {overflow.length ? (
        <Drilldown>
          <PieSeries
            data={overflow.map((trend) => [trend.productTypeName, trend.count])}
            id="other-product-types"
            name={otherLabel}
            options={seriesOptions}
          />
        </Drilldown>
      ) : null}
    </Chart>
  );
}
