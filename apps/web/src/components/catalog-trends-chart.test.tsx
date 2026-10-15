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
vi.mock("highcharts/es-modules/masters/modules/drilldown.src.js", () => ({}));

import { CatalogTrendsChart } from "./catalog-trends-chart";

describe("CatalogTrendsChart", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("keeps the largest eight slices and drills Other into the remaining categories", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(() =>
      root.render(
        <CatalogTrendsChart
          catalogProductsLabel="Catalog products"
          chartLabel="Catalog products by product type"
          onProductTypeSelect={vi.fn()}
          otherLabel="Other"
          trends={Array.from({ length: 10 }, (_, index) => ({
            count: 10 - index,
            productTypeId: index + 1,
            productTypeName: `Type ${index + 1}`,
          }))}
        />,
      ),
    );

    expect(chartMock).toHaveBeenCalledOnce();
    expect(chartMock.mock.calls[0]?.[1]).toMatchObject({
      drilldown: {
        series: [
          {
            data: [
              ["Type 9", 2],
              ["Type 10", 1],
            ],
            id: "other-product-types",
            type: "pie",
          },
        ],
      },
      series: [
        {
          data: [
            { name: "Type 1", y: 10 },
            { name: "Type 2", y: 9 },
            { name: "Type 3", y: 8 },
            { name: "Type 4", y: 7 },
            { name: "Type 5", y: 6 },
            { name: "Type 6", y: 5 },
            { name: "Type 7", y: 4 },
            { name: "Type 8", y: 3 },
            { drilldown: "other-product-types", name: "Other", y: 3 },
          ],
          type: "pie",
        },
      ],
    });
  });

  it("selects a product type when its slice is clicked", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    const onProductTypeSelect = vi.fn();

    await act(() =>
      root.render(
        <CatalogTrendsChart
          catalogProductsLabel="Catalog products"
          chartLabel="Catalog products by product type"
          onProductTypeSelect={onProductTypeSelect}
          otherLabel="Other"
          trends={[
            {
              count: 137,
              productTypeId: 1,
              productTypeName: "Pen",
            },
          ]}
        />,
      ),
    );

    const options = chartMock.mock.calls[0]?.[1];
    const point = options?.series?.[0]?.data?.[0];
    point?.events?.click?.call(point);

    expect(onProductTypeSelect).toHaveBeenCalledWith(1);
  });
});
