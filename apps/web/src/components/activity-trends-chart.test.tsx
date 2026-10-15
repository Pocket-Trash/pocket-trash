/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { chartMock, destroyMock } = vi.hoisted(() => ({
  chartMock: vi.fn(),
  destroyMock: vi.fn(),
}));

vi.mock("highcharts/es-modules/masters/highcharts.src.js", () => ({
  default: {
    chart: chartMock.mockReturnValue({ destroy: destroyMock }),
  },
}));
vi.mock(
  "highcharts/es-modules/masters/modules/accessibility.src.js",
  () => ({}),
);

import { ActivityTrendsChart } from "./activity-trends-chart";

describe("ActivityTrendsChart", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("keeps suppressed collection points as chart and table gaps", async () => {
    const first = new Date("2026-10-01T00:00:00.000Z");
    const second = new Date("2026-11-01T00:00:00.000Z");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(() =>
      root.render(
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
      ),
    );

    expect(chartMock.mock.calls[0]?.[1]).toMatchObject({
      series: [
        {
          data: [
            [first.getTime(), 10],
            [second.getTime(), null],
          ],
          name: "Added to Pocket Trash",
          type: "line",
        },
      ],
    });
    expect(container.textContent).toContain("Oct 1, 2026");
    expect(container.textContent).toContain("Nov 1, 2026");
    expect(container.textContent).toContain("—");
  });
});
