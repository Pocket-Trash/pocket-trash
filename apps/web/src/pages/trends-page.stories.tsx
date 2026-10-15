import type {
  PublicActivityTrends,
  PublicCollectionItemTrends,
  PublicCollectionLifecycleTrends,
  PublicCollectionMakerProductTrends,
  PublicCollectionMaterialTrends,
  PublicMaterialTrend,
  PublicPartAccessoryTrends,
  PublicPenRefillTrends,
  PublicProductTypeTrend,
  PublicSliderTrends,
  PublicSpinnerTrends,
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

/** Coverage-qualified Spinner distributions used by the drill-down story. */
const spinnerTrends: PublicSpinnerTrends = {
  catalogProductCount: 18,
  productTypeId: 1000,
  trends: [
    {
      coveragePercent: 100,
      hasSuppressedCollectionValues: false,
      metric: "maker",
      unit: null,
      values: [
        {
          catalogCount: 12,
          collectionCount: 25,
          key: "4000",
          label: "Machine Era",
          numericValue: null,
        },
        {
          catalogCount: 6,
          collectionCount: 10,
          key: "4001",
          label: "Lautie",
          numericValue: null,
        },
      ],
    },
    {
      coveragePercent: 72.2,
      hasSuppressedCollectionValues: true,
      metric: "weight",
      unit: "g",
      values: [
        {
          catalogCount: 4,
          collectionCount: null,
          key: "55",
          label: "55",
          numericValue: 55,
        },
      ],
    },
  ],
};

/** Coverage-qualified Slider distributions used by the drill-down story. */
const sliderTrends: PublicSliderTrends = {
  catalogProductCount: 12,
  productTypeId: 1001,
  trends: [
    {
      coveragePercent: 100,
      hasSuppressedCollectionValues: false,
      metric: "magnetLayout",
      unit: null,
      values: [
        {
          catalogCount: 8,
          collectionCount: 20,
          key: "3",
          label: "2×4",
          numericValue: null,
        },
        {
          catalogCount: 4,
          collectionCount: 10,
          key: "2",
          label: "2×3",
          numericValue: null,
        },
      ],
    },
    {
      coveragePercent: 75,
      hasSuppressedCollectionValues: true,
      metric: "plateMaterial",
      unit: null,
      values: [
        {
          catalogCount: 9,
          collectionCount: null,
          key: "3000",
          label: "Zirconium",
          numericValue: null,
        },
      ],
    },
  ],
};

/** Exact compatible Pen and standalone Refill counts by refill format. */
const penRefillTrends: PublicPenRefillTrends = {
  penCoveragePercent: 71.4,
  penProductTypeId: 1002,
  refillProductTypeId: 1003,
  values: [
    {
      compatiblePenCount: 12,
      key: "4000",
      label: "Pilot G2",
      standaloneRefillCount: 4,
    },
    {
      compatiblePenCount: 7,
      key: "4001",
      label: "Parker-style G2",
      standaloneRefillCount: 6,
    },
  ],
};

/** Recorded catalog and privacy-safe collection activity used by populated stories. */
const activityTrends: PublicActivityTrends = {
  granularity: "month",
  range: "year",
  values: [
    {
      bucketStart: new Date("2026-08-01T00:00:00.000Z"),
      catalogCount: 8,
      collectionCount: 15,
    },
    {
      bucketStart: new Date("2026-09-01T00:00:00.000Z"),
      catalogCount: 12,
      collectionCount: null,
    },
    {
      bucketStart: new Date("2026-10-01T00:00:00.000Z"),
      catalogCount: 7,
      collectionCount: 20,
    },
  ],
};

/** Privacy-safe ownership lifecycle used by populated stories. */
const lifecycleTrends: PublicCollectionLifecycleTrends = {
  generatedAt: new Date("2026-10-14T00:00:00.000Z"),
  granularity: "month",
  hasSuppressedValues: true,
  range: "year",
  stale: false,
  values: [
    {
      acquisitionCount: 15,
      bucketStart: new Date("2026-08-01T00:00:00.000Z"),
      departureCount: 5,
    },
    {
      acquisitionCount: null,
      bucketStart: new Date("2026-09-01T00:00:00.000Z"),
      departureCount: 10,
    },
  ],
};

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
      activityTrends={activityTrends}
      catalogMaterialTrends={[]}
      collectionMaterialTrends={null}
      collectionTrends={collectionTrends}
      lifecycleTrends={lifecycleTrends}
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
    activityTrends,
    catalogMaterialTrends: [],
    collectionMaterialTrends: null,
    collectionTrends,
    lifecycleTrends,
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

    await expect(canvas.getAllByRole("table")).toHaveLength(5);
    await expect(canvas.getAllByRole("row")).toHaveLength(13);
    await expect(
      canvas.getAllByRole("rowheader", { name: "Spinner" }),
    ).toHaveLength(3);
  },
};

/** Public Trends with enabled Parts and Accessories. */
export const PartsAndAccessories: Story = {
  args: {
    activityTrends,
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
    activityTrends,
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
    activityTrends,
    catalogMaterialTrends: [],
    collectionMaterialTrends: null,
    collectionTrends,
    makerProductTrends,
    onSearchChange: fn(),
    trends,
  },
};

/** Selected Spinner with coverage-qualified characteristic distributions. */
export const SpinnerDrillDown: Story = {
  args: {
    activityTrends,
    catalogMaterialTrends: [],
    collectionMaterialTrends: null,
    collectionTrends,
    onSearchChange: fn(),
    search: { productTypeId: 1000 },
    spinnerTrends,
    trends,
  },
  /**
   * Verifies selected Spinner characteristic distributions.
   *
   * @param context - Story interaction context.
   * @param context.canvasElement - Rendered story canvas.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Spinner details" }),
    ).toBeVisible();
    await expect(canvas.getAllByText("Machine Era")[0]).toBeVisible();
    await expect(canvas.getByText("72.2% coverage")).toBeVisible();
  },
};

/** Selected Slider with component-aware characteristic distributions. */
export const SliderDrillDown: Story = {
  args: {
    activityTrends,
    catalogMaterialTrends: [],
    collectionMaterialTrends: null,
    collectionTrends,
    onSearchChange: fn(),
    search: { productTypeId: 1001 },
    sliderTrends,
    trends,
  },
  /**
   * Verifies selected Slider characteristic distributions.
   *
   * @param context - Story interaction context.
   * @param context.canvasElement - Rendered story canvas.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Slider details" }),
    ).toBeVisible();
    await expect(canvas.getAllByText("2×4")[0]).toBeVisible();
    await expect(canvas.getByText("75% coverage")).toBeVisible();
  },
};

/** Selected Pen with exact refill-format compatibility Trends. */
export const PensAndRefills: Story = {
  args: {
    activityTrends,
    catalogMaterialTrends: [],
    collectionMaterialTrends: null,
    collectionTrends,
    onSearchChange: fn(),
    penRefillTrends,
    search: { productTypeId: 1002 },
    trends,
  },
  /**
   * Verifies the Pen refill-format chart and series labels.
   *
   * @param context - Story interaction context.
   * @param context.canvasElement - Rendered story canvas.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Pens and Refills" }),
    ).toBeVisible();
    await expect(canvas.getAllByText("Pilot G2")[0]).toBeVisible();
    await expect(canvas.getByText("71.4% coverage")).toBeVisible();
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
