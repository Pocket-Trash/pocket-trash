import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { withThemePanels } from "../../../.storybook/theme-panels";
import { Skeleton } from "./skeleton";

const meta = {
  component: Skeleton,
  decorators: [withThemePanels],
  title: "UI/Skeleton",
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Line: Story = {
  args: { className: "h-4 w-48" },
};

export const Card: Story = {
  render: () => (
    <div className="grid w-64 gap-3">
      <Skeleton className="aspect-4/3 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  ),
};
