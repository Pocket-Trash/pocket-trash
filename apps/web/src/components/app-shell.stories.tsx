import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { AppShell } from "./app-shell";
import { Button } from "./ui/button";

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
    title: "Pocket Trash",
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Pocket Trash" }),
    ).toBeVisible();
  },
};

export const RouteHeader: Story = {
  args: {
    breadcrumbItems: [{ label: "Products", to: "/products" }],
    children: <div className="p-6">Product form</div>,
    headerActions: <Button>Add product</Button>,
    meta: "Draft",
    title: "Add product",
  },
};
