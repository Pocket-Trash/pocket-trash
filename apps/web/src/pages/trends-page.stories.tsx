import type {
  PublicCollectionItemTrends,
  PublicPartAccessoryTrends,
  PublicProductTypeTrend,
} from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
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
    collectorCount: trend.count * 5,
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
  const [productTypeId, setProductTypeId] = useState<number>();
  return (
    <TrendsPage
      collectionTrends={collectionTrends}
      onProductTypeChange={setProductTypeId}
      selectedProductTypeId={productTypeId}
      trends={trends}
    />
  );
}

/** Populated public Trends with keyboard filter coverage. */
export const Populated: Story = {
  /** Default component properties replaced by the controlled story renderer. */
  args: { collectionTrends, onProductTypeChange: fn(), trends },
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

    await expect(canvas.getAllByRole("table")).toHaveLength(2);
    await expect(canvas.getAllByRole("row")).toHaveLength(4);
    await expect(
      canvas.getAllByRole("rowheader", { name: "Spinner" }),
    ).toHaveLength(2);
  },
};

/** Public Trends with enabled Parts and Accessories. */
export const PartsAndAccessories: Story = {
  args: {
    collectionTrends,
    onProductTypeChange: fn(),
    partAccessoryTrends,
    trends,
  },
};

/** Localized empty state for a catalog without eligible products. */
export const Empty: Story = {
  /** Empty Trends component properties. */
  args: { collectionTrends: null, onProductTypeChange: fn(), trends: [] },
  /**
   * Verifies the localized empty status.
   *
   * @param context - Story interaction context.
   * @param context.canvasElement - Rendered story canvas.
   */
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "No catalog products are available for these filters.",
    );
  },
};

/** Stale generation with every source category suppressed. */
export const Suppressed: Story = {
  args: {
    collectionTrends: {
      generatedAt: new Date("2026-10-01T00:00:00.000Z"),
      hasSuppressedValues: true,
      stale: true,
      values: [],
    },
    onProductTypeChange: fn(),
    trends,
  },
};
