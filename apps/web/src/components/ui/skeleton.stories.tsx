import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { withThemePanels } from "../../../.storybook/theme-panels";
import { Skeleton } from "./skeleton";

/**
 * Configures Storybook coverage for the skeleton examples.
 */
const meta = {
  component: Skeleton,
  decorators: [withThemePanels],
  title: "UI/Skeleton",
} satisfies Meta<typeof Skeleton>;

export default meta;
/**
 * Storybook story contract for the skeleton examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Shows the skeleton line example.
 */
export const Line: Story = {
  args: { className: "h-4 w-48" },
};

/**
 * Shows the skeleton card example.
 */
export const Card: Story = {
  /**
   * Renders the skeleton card example.
   *
   * @returns The rendered story example.
   */
  render: () => (
    <div className="grid w-64 gap-3">
      <Skeleton className="aspect-4/3 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  ),
};
