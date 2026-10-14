import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/** Object-form point used by the Highcharts mock. */
type TestNamedPoint = {
  /** Visible point name. */
  name?: string;
};
/** Supported point inputs used by the Highcharts mock. */
type TestPoint = number | [string, number] | TestNamedPoint;
/** Chart properties used by the Highcharts mock. */
type TestChartProps = {
  /** Declarative Highcharts children. */
  children: ReactNode;
  /** Accessible chart title. */
  title: string;
};
/** Drilldown properties used by the Highcharts mock. */
type TestDrilldownProps = {
  /** Nested drilldown series. */
  children: ReactNode;
};
/** Pie properties used by the Highcharts mock. */
type TestPieSeriesProps = {
  /** Numeric, tuple, or object-form points. */
  data?: TestPoint[];
  /** Optional drilldown series identifier. */
  id?: string;
};

vi.mock("@highcharts/react", () => ({
  /**
   * Renders declarative chart children for the test.
   *
   * @param root0 - Chart title and children.
   * @returns Stable chart test container.
   */
  Chart: ({ children, title }: TestChartProps) => (
    <div aria-label={title}>{children}</div>
  ),
  /**
   * Omits tooltip configuration from static output.
   *
   * @returns No rendered content.
   */
  Tooltip: () => null,
}));

vi.mock("@highcharts/react/modules/Accessibility", () => ({
  /**
   * Omits accessibility configuration from static output.
   *
   * @returns No rendered content.
   */
  Accessibility: () => null,
}));

vi.mock("@highcharts/react/modules/Drilldown", () => ({
  /**
   * Marks the nested drilldown series.
   *
   * @param root0 - Nested series content.
   * @returns Stable drilldown test container.
   */
  Drilldown: ({ children }: TestDrilldownProps) => (
    <div data-drilldown>{children}</div>
  ),
}));

vi.mock("@highcharts/react/series/Pie", () => ({
  /**
   * Exposes pie point names without running Highcharts in JSDOM.
   *
   * @param root0 - Pie series identifier and data.
   * @returns Stable series test marker.
   */
  PieSeries: ({ data = [], id }: TestPieSeriesProps) => (
    <div
      data-names={data.map((point) => pointName(point)).join("|")}
      data-series={id ?? "overview"}
    />
  ),
}));

import { CatalogTrendsChart } from "./catalog-trends-chart";

describe("CatalogTrendsChart", () => {
  it("keeps the largest eight slices and drills Other into the remaining categories", () => {
    const html = renderToStaticMarkup(
      <CatalogTrendsChart
        catalogProductsLabel="Catalog products"
        chartLabel="Catalog products by product type"
        otherLabel="Other"
        trends={Array.from({ length: 10 }, (_, index) => ({
          count: 10 - index,
          productTypeId: index + 1,
          productTypeName: `Type ${index + 1}`,
        }))}
      />,
    );

    expect(html).toContain(
      'data-names="Type 1|Type 2|Type 3|Type 4|Type 5|Type 6|Type 7|Type 8|Other"',
    );
    expect(html).toContain(
      'data-names="Type 9|Type 10" data-series="other-product-types"',
    );
  });
});

/**
 * Reads a Highcharts point's visible name.
 *
 * @param point - Numeric, tuple, or object-form point.
 * @returns Visible point name when present.
 */
function pointName(point: TestPoint) {
  if (Array.isArray(point)) return point[0];
  if (typeof point === "object") return point.name ?? "";
  return String(point);
}
