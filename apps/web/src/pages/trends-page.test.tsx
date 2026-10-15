import type {
  PublicProductTypeTrend,
  PublicSpinnerTrends,
} from "@package/services";
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
   * Supplies deterministic localization copy to the page test.
   *
   * @param key - Localization key.
   * @param values - Named interpolation values.
   * @returns English copy or the unchanged key.
   */
  formatTranslation: (key: string, values: Record<string, string> = {}) => {
    return (
      {
        "web.trends.approximateCollectors": "Approximate collectors",
        "web.trends.approximateItems": "Approximate items",
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
        "web.trends.maker": "Maker",
        "web.trends.allMakers": "All makers",
        "web.trends.product": "Product",
        "web.trends.allProducts": "All products",
        "web.trends.makers": "Most collected makers",
        "web.trends.makersChartLabel": "Makers by collectors",
        "web.trends.products": "Most collected products",
        "web.trends.productsChartLabel": "Products by collectors",
        "web.trends.makerProductsEmpty": "No matching results.",
        "web.trends.makerProductsError": "Maker Trends are unavailable.",
        "web.trends.makerProductsPrivacy": "Maker values are privacy safe.",
        "web.trends.makerProductsStale": "Maker Trends may be stale.",
        "web.trends.makerProductsSuppressed": "Some maker results are hidden.",
        "web.trends.unspecifiedMaterial": "Unspecified",
        "web.trends.viewProducts": "View products",
        "web.trends.other": "Other",
        "web.trends.partsAndAccessories": "Parts and Accessories",
        "web.trends.partsAndAccessoriesChartLabel":
          "Currently owned Parts and Accessories by product type",
        "web.trends.coverage": `${values.coverage}% coverage`,
        "web.trends.exactValues": "Exact values",
        "web.trends.spinnerDescription": "Spinner details",
        "web.trends.spinnerPrivacy": "Collection counts are privacy safe.",
        "web.trends.spinnerSuppressed": "Some values are hidden.",
        "web.trends.spinnerTitle": "Spinner details",
        "web.trends.suppressed": "Suppressed",
        "web.trends.value": "Value",
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

/** Coverage-qualified Spinner Trends used by product-type drill-down tests. */
const spinnerTrends: PublicSpinnerTrends = {
  catalogProductCount: 10,
  productTypeId: 1000,
  trends: [
    {
      coveragePercent: 80,
      hasSuppressedCollectionValues: true,
      metric: "maker",
      unit: null,
      values: [
        {
          catalogCount: 8,
          collectionCount: null,
          key: "42",
          label: "Example Maker",
          numericValue: null,
        },
      ],
    },
  ],
};

describe("TrendsPage", () => {
  it("shows Spinner details only for the selected Spinner product type", () => {
    const selected = renderToStaticMarkup(
      <TrendsPage
        catalogMaterialTrends={[]}
        collectionMaterialTrends={null}
        collectionTrends={null}
        onSearchChange={vi.fn()}
        search={{ productTypeId: 1000 }}
        spinnerTrends={spinnerTrends}
        trends={trends}
      />,
    );
    const unselected = renderToStaticMarkup(
      <TrendsPage
        catalogMaterialTrends={[]}
        collectionMaterialTrends={null}
        collectionTrends={null}
        onSearchChange={vi.fn()}
        spinnerTrends={spinnerTrends}
        trends={trends}
      />,
    );

    expect(selected).toContain("80% coverage");
    expect(selected).toContain("Example Maker");
    expect(selected).toContain("Some values are hidden.");
    expect(selected).toContain("<summary");
    expect(selected).not.toContain("<details open");
    expect(unselected).not.toContain("Example Maker");
  });

  it("keeps stable maker filters, ranks products by collectors, and preserves all table rows", () => {
    const productValues = Array.from({ length: 10 }, (_, index) => ({
      collectorCount: (10 - index) * 5,
      itemCount: (12 - index) * 5,
      makerId: 2001,
      makerName: "Maker One",
      makerSlug: "maker-one",
      materialId: 42,
      materialSpecificId: null,
      productId: 3000 + index,
      productName: `Product ${index + 1}`,
      productSlug: `product-${index + 1}`,
      productTypeId: 1001,
      productTypeSlug: "slider",
    }));
    const firstProduct = productValues[0];
    if (!firstProduct) throw new Error("Product fixture is empty.");
    const html = renderToStaticMarkup(
      <TrendsPage
        catalogMaterialTrends={[]}
        collectionMaterialTrends={null}
        collectionTrends={null}
        makerProductTrends={{
          generatedAt: new Date("2026-10-14T00:00:00.000Z"),
          hasSuppressedValues: true,
          makerValues: [
            {
              ...firstProduct,
              productId: null,
              productName: null,
              productSlug: null,
            },
          ],
          productValues,
          stale: false,
        }}
        onSearchChange={vi.fn()}
        search={{ materialId: 42, productTypeId: 1001 }}
        trends={[{ count: 10, productTypeId: 1001, productTypeName: "Slider" }]}
      />,
    );
    const productChart = html.match(
      /<ol aria-label="Products by collectors"[\s\S]*?<\/ol>/,
    )?.[0];
    const productTable = html
      .match(/<table[\s\S]*?<\/table>/g)
      ?.find((table) => table.includes("Products by collectors"));

    expect(productChart?.match(/<li/g)).toHaveLength(9);
    expect(productChart).toContain("Other");
    expect(productChart).not.toContain("Product 10");
    expect(productTable).toContain("Product 10");
    expect(productTable?.match(/<tr/g)).toHaveLength(11);
    expect(html).toContain("Approximate collectors");
    expect(html).toContain("Approximate items");
    expect(html).toContain(
      'href="/products?maker=2001&amp;view=all&amp;material=42&amp;type=slider"',
    );
    expect(html).toContain('href="/products/slider/product-1"');
    expect(html).toContain("Some maker results are hidden.");
  });

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
    const table = html
      .match(/<table[\s\S]*?<\/table>/g)
      ?.find((candidate) =>
        candidate.includes("Catalog products by product type"),
      );

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
