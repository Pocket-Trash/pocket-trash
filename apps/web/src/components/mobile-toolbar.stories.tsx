import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, within } from "storybook/test";
import {
  mockStoryAuth,
  StoryProviders,
  storyActiveFilters,
  storyMatchModes,
  storyProducts,
} from "../../.storybook/story-fixtures";
import { MobileToolbar } from "./mobile-toolbar";

/**
 * Shared controlled values and interaction spies for mobile-toolbar stories.
 */
const args = {
  active: storyActiveFilters,
  currency: "USD" as const,
  filterCount: 3,
  matchModes: storyMatchModes,
  onClearFilters: fn(),
  onCurrencyChange: fn(),
  onMatchModeChange: fn(),
  onQueryChange: fn(),
  onSortChange: fn(),
  onToggleFilter: fn(),
  onUnitsChange: fn(),
  onWeightChange: fn(),
  products: storyProducts,
  query: "",
  sort: "date_desc" as const,
  sortOptions: [
    { label: "Newest", value: "date_desc" as const },
    { label: "Oldest", value: "date_asc" as const },
    { label: "Price low", value: "price_asc" as const },
  ],
  units: "in" as const,
  weight: "g" as const,
};

/**
 * Configures Storybook coverage for the mobile toolbar examples.
 */
const meta = {
  args,
  beforeEach: mockStoryAuth,
  component: MobileToolbar,
  decorators: [
    (Story) => (
      <StoryProviders>
        <div className="min-h-[420px]">
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
  parameters: { viewport: { defaultViewport: "mobile1" } },
  title: "Components/MobileToolbar",
} satisfies Meta<typeof MobileToolbar>;

export default meta;
/**
 * Storybook story contract for the mobile toolbar examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Defines the default mobile toolbar story.
 */
export const Default: Story = {};

/**
 * Defines the search open mobile toolbar story.
 */
export const SearchOpen: Story = {
  /**
   * Exercises the mobile toolbar story interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Search" }));
    await expect(
      canvas.getByRole("searchbox", {
        name: "Search pens by title, specs, or description",
      }),
    ).toBeVisible();
  },
};

/**
 * Defines the sort sheet mobile toolbar story.
 */
export const SortSheet: Story = {
  /**
   * Exercises the mobile toolbar story interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.args - Current Storybook story arguments.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.canvasElement - Rendered Storybook canvas element.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Sort" }));
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("button", {
        name: "Oldest",
      }),
    );
    await expect(args.onSortChange).toHaveBeenCalledWith("date_asc");
  },
};
