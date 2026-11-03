import type { PublicProductTypeTrend } from "@package/services";
import Highcharts from "highcharts/es-modules/masters/highcharts.src.js";
import "highcharts/es-modules/masters/modules/accessibility.src.js";
import "highcharts/es-modules/masters/modules/drilldown.src.js";
import { useCallback } from "react";

/** One overview slice with optional nested drilldown data. */
type CatalogPiePoint = {
  /** Drilldown series identifier for an interactive slice. */
  drilldown?: string;
  /** Selects this product type through the page's stable URL state. */
  events?: {
    /** Applies this slice's product-type filter. */
    click: () => void;
  };
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
  onProductTypeSelect,
  otherLabel,
  trends,
}: {
  /** Localized metric name used by tooltips and assistive technology. */
  catalogProductsLabel: string;
  /** Localized chart title and accessible description. */
  chartLabel: string;
  /**
   * Opens the material, maker, and product breakdowns for a product type.
   *
   * @param productTypeId - Stable selected product-type identifier.
   */
  onProductTypeSelect: (productTypeId: number) => void;
  /** Localized label for categories outside the largest eight. */
  otherLabel: string;
  /** Exact public catalog-product counts in descending order. */
  trends: PublicProductTypeTrend[];
}) {
  const chartRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;

      const overflow = trends.slice(8);
      const data: CatalogPiePoint[] = trends.slice(0, 8).map((trend) => ({
        events: {
          /**
           * Applies the selected product type to the Trends URL.
           *
           * @returns Nothing.
           */
          click: () => onProductTypeSelect(trend.productTypeId),
        },
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

      const chart = Highcharts.chart(node, {
        accessibility: {
          description: chartLabel,
          point: { valueSuffix: ` ${catalogProductsLabel}` },
          screenReaderSection: {
            beforeChartFormat:
              "<div>{typeDescription}</div><div>{chartLongdesc}</div>",
          },
          series: { describeSingleSeries: true },
        },
        chart: {
          animation: false,
          height: 440,
          styledMode: true,
          type: "pie",
        },
        drilldown: overflow.length
          ? {
              series: [
                {
                  data: overflow.map((trend) => [
                    trend.productTypeName,
                    trend.count,
                  ]),
                  id: "other-product-types",
                  name: otherLabel,
                  type: "pie",
                },
              ],
            }
          : undefined,
        plotOptions: {
          pie: {
            dataLabels: {
              enabled: true,
              format: "{point.name}: {point.percentage:.1f}%",
            },
            showInLegend: true,
          },
        },
        series: [{ data, name: catalogProductsLabel, type: "pie" }],
        title: { text: chartLabel },
        tooltip: {
          pointFormat: `{point.name}: <b>{point.y}</b> ${catalogProductsLabel}`,
        },
      });

      return () => chart.destroy();
    },
    [catalogProductsLabel, chartLabel, onProductTypeSelect, otherLabel, trends],
  );

  return (
    <div className="rounded-md border border-border bg-card" ref={chartRef} />
  );
}
