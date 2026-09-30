import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { withThemePanels } from "../../../.storybook/theme-panels";
import { AuthPageSkeleton } from "./auth-page-skeleton";
import { ProductGridSkeleton } from "./product-grid-skeleton";

const meta = {
  decorators: [withThemePanels],
  title: "Components/Skeletons",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const AuthPage: Story = {
  render: () => <AuthPageSkeleton />,
};

export const ProductGrid: Story = {
  render: () => (
    <div className="grid w-[640px] grid-cols-2 gap-4">
      <ProductGridSkeleton count={4} />
    </div>
  ),
};
