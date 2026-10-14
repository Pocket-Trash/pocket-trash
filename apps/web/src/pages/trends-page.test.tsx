import type { PublicProductTypeTrend } from "@package/services";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TrendsPage } from "./trends-page";

vi.mock("@/components/catalog-trends-chart", () => ({
  /**
   * Exposes the chart's top-level and drilldown data to server-rendered tests.
   *
   * @param props - Chart labels and exact catalog Trends.
   * @returns Stable chart test marker.
   */
  CatalogTrendsChart: ({
    otherLabel,
    trends: chartTrends,
  }: {
    /** Localized Other label. */
    otherLabel: string;
    /** Exact product-type Trends. */
    trends: PublicProductTypeTrend[];
  }) => (
    <div data-chart="pie-drilldown">
      {chartTrends.slice(0, 8).map(({ productTypeName }) => productTypeName)}
      {chartTrends.length > 8 ? otherLabel : null}
    </div>
  ),
}));

vi.mock("@pocket-trash/localizations", () => ({
  /**
   * Supplies pending localization copy to the stacked application test.
   *
   * @param key - Localization key.
   * @returns English copy or the unchanged key.
   */
  formatTranslation: (key: string) => {
    return (
      {
        "web.trends.chartLabel": "Catalog products by product type",
        "web.trends.collectionItemsChartLabel":
          "Currently owned items by product type",
        "web.trends.collectionItemsEmpty":
          "No collection items are available yet.",
        "web.trends.collectionItemsError":
          "Collection-item Trends are unavailable right now.",
        "web.trends.collectionItemsSuppressed":
          "Some product types are hidden because they do not meet the privacy threshold.",
        "web.trends.collectionItemsSuppressedEmpty":
          "Collection-item Trends are hidden until the privacy threshold is met.",
        "web.trends.other": "Other",
      }[key] ?? key
    );
  },
}));

vi.mock("@/components/app-shell", () => ({
  /**
   * Renders a minimal application shell for Trends page tests.
   *
   * @param props - Shell title and nested content.
   * @returns A simplified shell exposing its title.
   */
  AppShell: ({
    children,
    title,
  }: {
    /** Nested page content. */
    children: React.ReactNode;
    /** Page title. */
    title: string;
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Returns the fixed English locale.
   *
   * @returns Locale state consumed by the Trends page.
   */
  useLocale: () => ({ locale: "en-US" }),
}));

/** Ten descending product-type Trends used to exercise chart truncation. */
const trends: PublicProductTypeTrend[] = Array.from(
  { length: 10 },
  (_, index) => ({
    count: 10 - index,
    productTypeId: 1000 + index,
    productTypeName: `Type ${index + 1}`,
  }),
);

describe("TrendsPage", () => {
  it("charts the eight largest types plus Other while preserving the exact collapsed table", () => {
    const html = renderToStaticMarkup(
      <TrendsPage
        collectionTrends={{
          generatedAt: new Date("2026-10-14T00:00:00.000Z"),
          hasSuppressedValues: true,
          stale: false,
          values: trends.map((trend) => ({
            ...trend,
            collectorCount: trend.count * 5,
            count: trend.count * 5,
          })),
        }}
        onProductTypeChange={vi.fn()}
        trends={trends}
      />,
    );
    const chart = html.match(
      /<div data-chart="pie-drilldown"[\s\S]*?<\/div>/,
    )?.[0];
    const details = html.match(/<details[\s\S]*?<\/details>/)?.[0];
    const table = html.match(/<table[\s\S]*?<\/table>/)?.[0];

    expect(chart).toContain('data-chart="pie-drilldown"');
    expect(chart).toContain("Other");
    expect(chart).not.toContain("Type 10");
    expect(details).not.toContain(" open");
    expect(table).toContain(
      '<caption class="sr-only">Catalog products by product type</caption>',
    );
    expect(table?.match(/<th(?: |>)/g)).toHaveLength(12);
    expect(table?.match(/<tr/g)).toHaveLength(11);
    expect(table).toContain("Type 10");
    expect(table).toContain(">1</td>");
    expect(html).toContain("Currently owned items by product type");
    expect(html).toContain("Some product types are hidden");
  });

  it("distinguishes unavailable, suppressed, and empty collection states", () => {
    const unavailable = renderToStaticMarkup(
      <TrendsPage
        collectionTrends={null}
        onProductTypeChange={vi.fn()}
        trends={[]}
      />,
    );
    const suppressed = renderToStaticMarkup(
      <TrendsPage
        collectionTrends={{
          generatedAt: new Date("2026-10-14T00:00:00.000Z"),
          hasSuppressedValues: true,
          stale: false,
          values: [],
        }}
        onProductTypeChange={vi.fn()}
        trends={[]}
      />,
    );
    const empty = renderToStaticMarkup(
      <TrendsPage
        collectionTrends={{
          generatedAt: new Date("2026-10-14T00:00:00.000Z"),
          hasSuppressedValues: false,
          stale: false,
          values: [],
        }}
        onProductTypeChange={vi.fn()}
        trends={[]}
      />,
    );

    expect(unavailable).toContain("unavailable right now");
    expect(suppressed).toContain("hidden until the privacy threshold is met");
    expect(empty).toContain("No collection items are available yet");
  });
});
