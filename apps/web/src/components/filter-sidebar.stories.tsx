import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";
import {
  mockStoryAuth,
  StoryProviders,
  storyActiveFilters,
  storyMatchModes,
  storyProducts,
} from "../../.storybook/story-fixtures";
import { withThemePanels } from "../../.storybook/theme-panels";
import { FilterSidebar } from "./filter-sidebar";

const meta = {
  args: {
    active: storyActiveFilters,
    matchModes: storyMatchModes,
    onClear: fn(),
    onMatchModeChange: fn(),
    onToggleFilter: fn(),
    products: storyProducts,
  },
  beforeEach: mockStoryAuth,
  component: FilterSidebar,
  decorators: [
    (Story) => (
      <StoryProviders>
        <aside className="w-72 bg-sidebar p-3">
          <Story />
        </aside>
      </StoryProviders>
    ),
  ],
  title: "Components/FilterSidebar",
} satisfies Meta<typeof FilterSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  decorators: [withThemePanels],
};

export const ToggleFilter: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /Titanium/i }));
    await expect(args.onToggleFilter).toHaveBeenCalled();
  },
};
