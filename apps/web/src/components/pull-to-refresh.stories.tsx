import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";
import { PullToRefresh } from "./pull-to-refresh";

/**
 * Configures Storybook coverage for the pull to refresh examples.
 */
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
/**
 * Storybook story contract for the pull to refresh examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Defines the idle pull to refresh story.
 */
export const Idle: Story = {
  /**
   * Renders the pull to refresh story example.
   *
   * @param args - Current Storybook story arguments.
   * @returns The rendered story example.
   */
  render: (args) => <PullToRefresh {...args}>{args.children}</PullToRefresh>,
};

/**
 * Defines the refreshing pull to refresh story.
 */
export const Refreshing: Story = {
  args: { refreshing: true },
  render: Idle.render,
  /**
   * Exercises the pull to refresh story interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   */
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Pull area")).toBeVisible();
  },
};
