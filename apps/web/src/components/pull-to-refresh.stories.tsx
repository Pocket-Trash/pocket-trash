import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";
import { PullToRefresh } from "./pull-to-refresh";

const meta = {
  args: {
    children: (
      <div className="min-h-40 w-80 rounded-md border border-border bg-card p-4">
        Pull area
      </div>
    ),
    onRefresh: fn(),
    refreshing: false,
  },
  component: PullToRefresh,
  title: "Components/PullToRefresh",
} satisfies Meta<typeof PullToRefresh>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  render: (args) => <PullToRefresh {...args}>{args.children}</PullToRefresh>,
};

export const Refreshing: Story = {
  args: { refreshing: true },
  render: Idle.render,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Pull area")).toBeVisible();
  },
};
