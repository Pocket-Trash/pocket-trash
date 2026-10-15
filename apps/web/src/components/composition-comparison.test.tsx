import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CompositionComparison } from "./composition-comparison";

describe("CompositionComparison", () => {
  it("labels personal, community, zero, and suppressed percentages", () => {
    const html = renderToStaticMarkup(
      <CompositionComparison
        ariaLabel="Product type composition"
        communityLabel="Community %"
        labelColumn="Product type"
        locale="en-US"
        personalLabel="Personal %"
        suppressedLabel="Suppressed"
        values={[
          {
            communityPercentage: 62.5,
            count: 3,
            id: 1,
            label: "Slider",
            personalPercentage: 100,
          },
          {
            communityPercentage: 37.5,
            count: 5,
            id: 2,
            label: "Pen",
            personalPercentage: 0,
          },
          {
            communityPercentage: null,
            count: 1,
            id: 3,
            label: "Spinner",
            personalPercentage: 0,
          },
        ]}
        viewProductsLabel="View products"
      />,
    );

    expect(html).toContain("Personal %");
    expect(html).toContain("Community %");
    expect(html).toContain("100.0%");
    expect(html).toContain("62.5%");
    expect(html).toContain("0.0%");
    expect(html).toContain("Suppressed");
    expect(html).not.toContain("15");
  });
});
