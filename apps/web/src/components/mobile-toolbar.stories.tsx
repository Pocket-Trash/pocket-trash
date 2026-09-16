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
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SearchOpen: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Search" }));
    await expect(
      canvas.getByRole("searchbox", {
        name: "Search pens by title, specs, or description",
      }),
    ).toBeVisible();
  },
};

export const SortSheet: Story = {
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
