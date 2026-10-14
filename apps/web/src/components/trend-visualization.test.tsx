import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TrendVisualization } from "./trend-visualization";

describe("TrendVisualization", () => {
  it("limits the chart to eight plus Other while preserving the full table", () => {
    const html = renderToStaticMarkup(
      <TrendVisualization
        ariaLabel="Items by maker"
        colorClass="bg-chart-1"
        countLabel="Items"
        emptyState={<p>Empty</p>}
        labelColumn="Maker"
        otherLabel="Other"
        values={Array.from({ length: 10 }, (_, index) => ({
          count: 10 - index,
          key: index,
          label: `Maker ${index + 1}`,
          productsHref: `/products?maker=${index + 1}`,
        }))}
        viewProductsLabel="View products"
      />,
    );

    expect(html.match(/<li/g)).toHaveLength(9);
    expect(html).toContain("Other");
    expect(html.match(/<tr/g)).toHaveLength(11);
    expect(html).toContain("Maker 10");
    expect(html).toContain('href="/products?maker=10"');
  });
});
