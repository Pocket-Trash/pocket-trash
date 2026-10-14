import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/** Chart properties used by the Highcharts mock. */
type TestChartProps = {
  /** Declarative Highcharts children. */
  children: ReactNode;
};
/** Line-series properties used by the Highcharts mock. */
type TestLineSeriesProps = {
  /** Timestamp and nullable count pairs. */
  data: Array<[number, number | null]>;
  /** Visible series name. */
  name: string;
};

vi.mock("@highcharts/react", () => ({
  /**
   * Renders declarative chart children for the test.
   *
   * @param root0 - Chart children.
   * @returns Stable chart test container.
   */
  Chart: ({ children }: TestChartProps) => <div>{children}</div>,
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
vi.mock("@highcharts/react/options", () => ({
  /**
   * Omits horizontal-axis configuration from static output.
   *
   * @returns No rendered content.
   */
  XAxis: () => null,
  /**
   * Omits vertical-axis configuration from static output.
   *
   * @returns No rendered content.
   */
  YAxis: () => null,
}));
vi.mock("@highcharts/react/series/Line", () => ({
  /**
   * Exposes line points without running Highcharts in JSDOM.
   *
   * @param root0 - Line-series name and data.
   * @returns Stable series test marker.
   */
  LineSeries: ({ data, name }: TestLineSeriesProps) => (
    <div data-points={JSON.stringify(data)} data-series={name} />
  ),
}));

import { ActivityTrendsChart } from "./activity-trends-chart";

describe("ActivityTrendsChart", () => {
  it("keeps suppressed collection points as chart and table gaps", () => {
    const first = new Date("2026-10-01T00:00:00.000Z");
    const second = new Date("2026-11-01T00:00:00.000Z");
    const html = renderToStaticMarkup(
      <ActivityTrendsChart
        chartLabel="Records added over time"
        dateLabel="Period starting"
        locale="en-US"
        series={[
          {
            name: "Added to Pocket Trash",
            values: [
              { bucketStart: first, count: 10 },
              { bucketStart: second, count: null },
            ],
          },
        ]}
      />,
    );

    expect(html).toContain(`[${second.getTime()},null]`);
    expect(html).toContain("Oct 1, 2026");
    expect(html).toContain("Nov 1, 2026");
    expect(html).toContain("—");
  });
});
