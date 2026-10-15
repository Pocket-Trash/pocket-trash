import type { PublicPenRefillTrends } from "@package/services";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PenRefillTrendVisualization,
  penRefillTrendChartValues,
} from "./pen-refill-trend-visualization";

/** Ten refill formats used to verify readable chart overflow. */
const trends: PublicPenRefillTrends = {
  penCoveragePercent: 80,
  penProductTypeId: 1,
  refillProductTypeId: 2,
  values: Array.from({ length: 10 }, (_, index) => ({
    compatiblePenCount: 10 - index,
    key: String(index),
    label: `Format ${index + 1}`,
    standaloneRefillCount: index + 1,
  })),
};

describe("PenRefillTrendVisualization", () => {
  it("groups chart overflow while keeping every exact table row", () => {
    const chartValues = penRefillTrendChartValues(trends.values, "Other");
    const html = renderToStaticMarkup(
      <PenRefillTrendVisualization
        chartLabel="Pens and Refills by format"
        compatiblePensLabel="Compatible Pens"
        detailsLabel="Exact values"
        formatLabel="Refill format"
        otherLabel="Other"
        standaloneRefillsLabel="Standalone Refills"
        trends={trends}
      />,
    );

    expect(chartValues).toHaveLength(9);
    expect(chartValues.at(-1)).toMatchObject({ key: "other", label: "Other" });
    expect(html).toContain("Format 10");
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
  });
});
