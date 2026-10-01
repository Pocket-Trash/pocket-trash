import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { withThemePanels } from "../../../.storybook/theme-panels";
import { Badge } from "./badge";

/**
 * Configures Storybook coverage for the badge examples.
 */
const meta = {
  component: Badge,
  decorators: [withThemePanels],
  title: "UI/Badge",
} satisfies Meta<typeof Badge>;

export default meta;
/**
 * Storybook story contract for the badge examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Shows the badge default example.
 */
export const Default: Story = {
  args: { children: "Default" },
};

/**
 * Shows the badge secondary example.
 */
export const Secondary: Story = {
  args: { children: "Secondary", variant: "secondary" },
};

/**
 * Shows the badge destructive example.
 */
export const Destructive: Story = {
  args: { children: "Destructive", variant: "destructive" },
};

/**
 * Shows the badge outline example.
 */
export const Outline: Story = {
  args: { children: "Outline", variant: "outline" },
};

/**
 * Shows the badge matrix example.
 */
export const Matrix: Story = {
  /**
   * Renders the badge matrix example.
   *
   * @returns The rendered story example.
   */
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};
