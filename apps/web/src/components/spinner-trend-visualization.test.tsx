import type { PublicSpinnerTrend } from "@package/services";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  SpinnerTrendVisualization,
  spinnerTrendChartValues,
} from "./spinner-trend-visualization";

/** Eleven exact widths used to verify readable chart buckets. */
const widthTrend: PublicSpinnerTrend = {
  coveragePercent: 78.6,
  hasSuppressedCollectionValues: true,
  metric: "width",
  unit: "mm",
  values: Array.from({ length: 11 }, (_, index) => ({
    catalogCount: 1,
    collectionCount: index < 5 ? null : 5,
    key: String(index + 40),
    label: String(index + 40),
    numericValue: index + 40,
  })),
};

describe("SpinnerTrendVisualization", () => {
  it("buckets numeric charts while keeping exact canonical table values", () => {
    const chartValues = spinnerTrendChartValues(widthTrend, "en-US", "Other");
    const html = renderToStaticMarkup(
      <SpinnerTrendVisualization
        approximateItemsLabel="Approximate items"
        catalogProductsLabel="Catalog products"
        chartLabel="Spinner width distribution"
        detailsLabel="Exact values"
        locale="en-US"
        otherLabel="Other"
        suppressedLabel="Suppressed"
        trend={widthTrend}
        valueLabel="Width"
      />,
    );

    expect(chartValues.length).toBeLessThanOrEqual(8);
    expect(chartValues[0]?.label).toContain("mm");
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
    expect(html).toContain(">40 mm</th>");
    expect(html).toContain(">50 mm</th>");
    expect(html).toContain("Suppressed");
  });

  it("keeps eight categories and groups only categorical overflow", () => {
    const trend: PublicSpinnerTrend = {
      ...widthTrend,
      metric: "bearing",
      unit: null,
      values: Array.from({ length: 10 }, (_, index) => ({
        catalogCount: 10 - index,
        collectionCount: null,
        key: `bearing-${index}`,
        label: `Bearing ${index}`,
        numericValue: null,
      })),
    };

    const values = spinnerTrendChartValues(trend, "en-US", "Other");

    expect(values).toHaveLength(9);
    expect(values.at(-1)).toMatchObject({ key: "other", label: "Other" });
  });
});
