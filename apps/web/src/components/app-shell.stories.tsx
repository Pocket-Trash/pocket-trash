import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect } from "storybook/test";
import {
  mockStoryAuth,
  StoryProviders,
  storyActiveFilters,
  storyMatchModes,
  storyProducts,
} from "../../.storybook/story-fixtures";
import { AppShell } from "./app-shell";
import { FilterSidebar } from "./filter-sidebar";

const meta = {
  beforeEach: mockStoryAuth,
  component: AppShell,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Components/AppShell",
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="grid gap-4 p-6 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          Archive content
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          More content
        </div>
      </div>
    ),
    meta: "8 items",
    sidebarContent: (
      <FilterSidebar
        active={storyActiveFilters}
        matchModes={storyMatchModes}
        onClear={() => undefined}
        onMatchModeChange={() => undefined}
        onToggleFilter={() => undefined}
        products={storyProducts}
      />
    ),
    title: "Pocket Trash",
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Pocket Trash" }),
    ).toBeVisible();
  },
};

export const SidebarCollapsed: Story = {
  args: { ...Default.args, defaultSidebarOpen: false },
};
