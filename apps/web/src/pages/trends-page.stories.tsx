import type {
  PublicCollectionItemTrends,
  PublicCollectionMakerProductTrends,
  PublicCollectionMaterialTrends,
  PublicMaterialTrend,
  PublicPartAccessoryTrends,
  PublicProductTypeTrend,
} from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { CatalogTrendsSearch } from "@/lib/catalog-filters";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { TrendsPage } from "./trends-page";

/** Public product-type Trends used by the page stories. */
const trends: PublicProductTypeTrend[] = [
  {
    count: 18,
    productTypeId: 1000,
    productTypeName: "Spinner",
  },
  {
    count: 12,
    productTypeId: 1001,
    productTypeName: "Slider",
  },
  {
    count: 7,
    productTypeId: 1002,
    productTypeName: "Pen",
  },
];

/** Privacy-safe collection Trends used by populated stories. */
const collectionTrends: PublicCollectionItemTrends = {
  generatedAt: new Date("2026-10-14T00:00:00.000Z"),
  hasSuppressedValues: true,
  stale: false,
  values: trends.map((trend) => ({
    ...trend,
    collectorCount: Math.ceil(trend.count / 2) * 5,
    count: trend.count * 5,
  })),
};

/** Enabled Parts and Accessories Trends used by the public chart story. */
const partAccessoryTrends: PublicPartAccessoryTrends = {
  generatedAt: new Date("2026-10-14T00:00:00.000Z"),
  hasSuppressedValues: false,
  stale: false,
  values: [
    {
      count: 15,
      productTypeId: 2000,
      productTypeName: "Slider Plate",
    },
    {
      count: 5,
      productTypeId: 2001,
      productTypeName: "Spinner Button",
    },
  ],
};

/** Exact and filtered material rows used by the drill-down story. */
const catalogMaterialTrends: PublicMaterialTrend[] = [
  {
    count: 14,
    isSpecificBreakdown: false,
    materialId: 3000,
    materialName: "Titanium",
    materialSlug: "titanium",
    materialSpecificId: null,
    materialSpecificName: null,
    materialSpecificSlug: null,
    productTypeId: null,
  },
  {
    count: 9,
    isSpecificBreakdown: true,
    materialId: 3000,
    materialName: "Titanium",
    materialSlug: "titanium",
    materialSpecificId: 3001,
    materialSpecificName: "6Al-4V",
    materialSpecificSlug: "6al-4v",
    productTypeId: null,
  },
];

/** Privacy-safe material rows used by the drill-down story. */
const collectionMaterialTrends: PublicCollectionMaterialTrends = {
  collectorValues: catalogMaterialTrends.map((value) => ({
    ...value,
    count: 5,
  })),
  generatedAt: new Date("2026-10-14T00:00:00.000Z"),
  hasSuppressedValues: true,
  itemValues: catalogMaterialTrends.map((value) => ({
    ...value,
    count: 15,
  })),
  stale: false,
};

/** Privacy-safe maker and product rows used by the drill-down story. */
const makerProductTrends: PublicCollectionMakerProductTrends = {
  generatedAt: new Date("2026-10-14T00:00:00.000Z"),
  hasSuppressedValues: true,
  makerValues: [
    {
      collectorCount: 20,
      itemCount: 30,
      makerId: 4000,
      makerName: "Machine Era",
      makerSlug: "machine-era",
      materialId: null,
      materialSpecificId: null,
      productId: null,
      productName: null,
      productSlug: null,
      productTypeId: null,
      productTypeSlug: null,
    },
  ],
  productValues: [
    {
      collectorCount: 15,
      itemCount: 20,
      makerId: 4000,
      makerName: "Machine Era",
      makerSlug: "machine-era",
      materialId: null,
      materialSpecificId: null,
      productId: 5000,
      productName: "Original",
      productSlug: "original",
      productTypeId: null,
      productTypeSlug: "pen",
    },
  ],
  stale: false,
};

/** Trends page Storybook configuration. */
const meta = {
  beforeEach: mockStoryAuth,
  component: TrendsPage,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Pages/Trends",
} satisfies Meta<typeof TrendsPage>;

export default meta;
/** Trends page story contract. */
type Story = StoryObj<typeof meta>;

/**
 * Renders controlled Trends URL-filter state for interaction coverage.
 *
 * @returns A populated Trends page with a controlled product-type filter.
 */
function TrendsFixture() {
  const [search, setSearch] = useState<CatalogTrendsSearch>({});
  return (
    <TrendsPage
      catalogMaterialTrends={[]}
      collectionMaterialTrends={null}
      collectionTrends={collectionTrends}
      onSearchChange={setSearch}
      search={search}
      trends={trends}
    />
  );
}

/** Populated public Trends with keyboard filter coverage. */
export const Populated: Story = {
  /** Default component properties replaced by the controlled story renderer. */
  args: {
    catalogMaterialTrends: [],
    collectionMaterialTrends: null,
    collectionTrends,
    onSearchChange: fn(),
    trends,
  },
  /**
   * Renders the controlled populated fixture.
   *
   * @returns A populated Trends fixture.
   */
  render: () => <TrendsFixture />,
  /**
   * Opens the equivalent table, then filters Trends using only the keyboard.
   *
   * @param context - Story interaction context.
   * @param context.canvasElement - Rendered story canvas.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tableDisclosure = canvas.getByText(
      "Catalog products by product type",
      { selector: "summary" },
    );
    await userEvent.click(tableDisclosure);
    await expect(
      canvas.getByRole("table", {
        name: "Catalog products by product type",
      }),
    ).toBeVisible();

    const productTypeFilter = canvas.getByRole("combobox", {
      name: "Product type",
    });
    productTypeFilter.focus();
    await userEvent.keyboard("{Enter}{End}{Enter}");
    await expect(productTypeFilter).not.toHaveTextContent("all");
    await userEvent.keyboard("{Escape}");

    await expect(canvas.getAllByRole("table")).toHaveLength(3);
    await expect(canvas.getAllByRole("row")).toHaveLength(6);
    await expect(
      canvas.getAllByRole("rowheader", { name: "Spinner" }),
    ).toHaveLength(3);
  },
};

/** Public Trends with enabled Parts and Accessories. */
export const PartsAndAccessories: Story = {
  args: {
    catalogMaterialTrends: [],
    collectionMaterialTrends: null,
    collectionTrends,
    onSearchChange: fn(),
    partAccessoryTrends,
    trends,
  },
};

/** Material-specific public and privacy-safe Trends. */
export const MaterialDrillDown: Story = {
  args: {
    catalogMaterialTrends,
    collectionMaterialTrends,
    collectionTrends,
    onSearchChange: fn(),
    search: { materialId: 3000 },
    trends,
  },
};

/** Collector-ranked maker and product drill-downs. */
export const MakerProductDrillDown: Story = {
  args: {
    catalogMaterialTrends: [],
    collectionMaterialTrends: null,
    collectionTrends,
    makerProductTrends,
    onSearchChange: fn(),
    trends,
  },
};

/** Localized empty state for a catalog without eligible products. */
export const Empty: Story = {
  /** Empty Trends component properties. */
  args: {
    catalogMaterialTrends: [],
    collectionMaterialTrends: null,
    collectionTrends: null,
    onSearchChange: fn(),
    trends: [],
  },
  /**
   * Verifies the localized empty status.
   *
   * @param context - Story interaction context.
   * @param context.canvasElement - Rendered story canvas.
   */
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        "No catalog products are available for these filters.",
      ),
    ).toBeVisible();
  },
};

/** Stale generation with every source category suppressed. */
export const Suppressed: Story = {
  args: {
    catalogMaterialTrends: [],
    collectionMaterialTrends: null,
    collectionTrends: {
      generatedAt: new Date("2026-10-01T00:00:00.000Z"),
      hasSuppressedValues: true,
      stale: true,
      values: [],
    },
    onSearchChange: fn(),
    trends,
  },
};
