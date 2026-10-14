import type { PublicProductTypeTrend } from "@package/services";
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
      onProductTypeChange={setProductTypeId}
      selectedProductTypeId={productTypeId}
      trends={trends}
    />
  );
}

/** Populated public Trends with keyboard filter coverage. */
export const Populated: Story = {
  /** Default component properties replaced by the controlled story renderer. */
  args: { onProductTypeChange: fn(), trends },
  /**
   * Renders the controlled populated fixture.
   *
   * @returns A populated Trends fixture.
   */
  render: () => <TrendsFixture />,
  /**
   * Filters Trends using only the keyboard and verifies the equivalent table.
   *
   * @param context - Story interaction context.
   * @param context.canvasElement - Rendered story canvas.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await expect(
      canvas.getByRole("table", {
        name: "Catalog products by product type",
      }),
    ).toBeVisible();

    canvas.getByRole("combobox", { name: "Product type" }).focus();
    await userEvent.keyboard("{Enter}{ArrowDown}{Enter}");

    await expect(page.queryByRole("listbox")).toBeNull();
    await expect(canvas.getAllByRole("row")).toHaveLength(2);
    await expect(
      canvas.getByRole("rowheader", { name: "Spinner" }),
    ).toBeVisible();
  },
};

/** Localized empty state for a catalog without eligible products. */
export const Empty: Story = {
  /** Empty Trends component properties. */
  args: { onProductTypeChange: fn(), trends: [] },
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
