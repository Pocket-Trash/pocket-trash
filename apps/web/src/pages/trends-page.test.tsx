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
        "web.trends.approximateCollectors": "Approximate collectors",
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
        "web.trends.collectors": "Collectors",
        "web.trends.collectorsChartLabel": "Collectors by product type",
        "web.trends.catalogMaterials": "Catalog products by material",
        "web.trends.catalogMaterialsChartLabel":
          "Catalog products by material chart",
        "web.trends.collectionMaterials": "Currently owned items by material",
        "web.trends.collectionMaterialsChartLabel":
          "Currently owned items by material chart",
        "web.trends.collectorMaterials": "Collectors by material",
        "web.trends.collectorMaterialsChartLabel":
          "Collectors by material chart",
        "web.trends.generalMaterial": "General",
        "web.trends.material": "Material",
        "web.trends.materialsPrivacy": "Material values are privacy safe.",
        "web.trends.unspecifiedMaterial": "Unspecified",
        "web.trends.viewProducts": "View products",
        "web.trends.other": "Other",
        "web.trends.partsAndAccessories": "Parts and Accessories",
        "web.trends.partsAndAccessoriesChartLabel":
          "Currently owned Parts and Accessories by product type",
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
        catalogMaterialTrends={[]}
        collectionMaterialTrends={null}
        collectionTrends={{
          generatedAt: new Date("2026-10-14T00:00:00.000Z"),
          hasSuppressedValues: true,
          stale: false,
          values: trends.map((trend) => ({
            ...trend,
            collectorCount: Math.ceil(trend.count / 2) * 5,
            count: trend.count * 5,
          })),
        }}
        onSearchChange={vi.fn()}
        partAccessoryTrends={{
          generatedAt: new Date("2026-10-14T00:00:00.000Z"),
          hasSuppressedValues: false,
          stale: false,
          values: [
            {
              count: 5,
              productTypeId: 2000,
              productTypeName: "Slider Plate",
            },
          ],
        }}
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
    expect(html).toContain("Collectors by product type");
    expect(html).toContain("Approximate collectors");
    expect(html).toContain("Some product types are hidden");
    expect(html).toContain("Parts and Accessories");
    expect(html).toContain("Slider Plate");
  });

  it("distinguishes unavailable, suppressed, and empty collection states", () => {
    const unavailable = renderToStaticMarkup(
      <TrendsPage
        catalogMaterialTrends={[]}
        collectionMaterialTrends={null}
        collectionTrends={null}
        onSearchChange={vi.fn()}
        trends={[]}
      />,
    );
    const suppressed = renderToStaticMarkup(
      <TrendsPage
        catalogMaterialTrends={[]}
        collectionMaterialTrends={null}
        collectionTrends={{
          generatedAt: new Date("2026-10-14T00:00:00.000Z"),
          hasSuppressedValues: true,
          stale: false,
          values: [],
        }}
        onSearchChange={vi.fn()}
        trends={[]}
      />,
    );
    const empty = renderToStaticMarkup(
      <TrendsPage
        catalogMaterialTrends={[]}
        collectionMaterialTrends={null}
        collectionTrends={{
          generatedAt: new Date("2026-10-14T00:00:00.000Z"),
          hasSuppressedValues: false,
          stale: false,
          values: [],
        }}
        onSearchChange={vi.fn()}
        trends={[]}
      />,
    );

    expect(unavailable).toContain("unavailable right now");
    expect(suppressed).toContain("hidden until the privacy threshold is met");
    expect(empty).toContain("No collection items are available yet");
  });

  it("shows exact and privacy-safe multi-material counts without percentages", () => {
    const material = {
      isSpecificBreakdown: true,
      materialId: 3000,
      materialName: "Titanium",
      materialSlug: "titanium",
      materialSpecificId: 3001,
      materialSpecificName: "6Al-4V",
      materialSpecificSlug: "6al-4v",
      productTypeId: null,
    };
    const html = renderToStaticMarkup(
      <TrendsPage
        catalogMaterialTrends={[{ ...material, count: 2 }]}
        collectionMaterialTrends={{
          collectorValues: [{ ...material, count: 5 }],
          generatedAt: new Date("2026-10-14T00:00:00.000Z"),
          hasSuppressedValues: false,
          itemValues: [{ ...material, count: 10 }],
          stale: false,
        }}
        collectionTrends={null}
        onSearchChange={vi.fn()}
        search={{ materialId: 3000 }}
        trends={[]}
      />,
    );

    expect(html).toContain("Catalog products by material chart");
    expect(html).toContain("Currently owned items by material chart");
    expect(html).toContain("Collectors by material chart");
    expect(html).toContain("6Al-4V");
    expect(html).toContain("/materials/titanium/6al-4v");
  });
});
