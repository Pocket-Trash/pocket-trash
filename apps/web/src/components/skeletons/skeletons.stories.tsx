import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { withThemePanels } from "../../../.storybook/theme-panels";
import { AuthPageSkeleton } from "./auth-page-skeleton";
import { ProductGridSkeleton } from "./product-grid-skeleton";

/**
 * Configures Storybook coverage for the skeletons examples.
 */
const meta = {
  decorators: [withThemePanels],
  title: "Components/Skeletons",
} satisfies Meta;

export default meta;
/**
 * Storybook story contract for the skeletons examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Shows the skeletons auth page example.
 */
export const AuthPage: Story = {
  /**
   * Renders the skeletons auth page example.
   *
   * @returns The rendered story example.
   */
  render: () => <AuthPageSkeleton />,
};

/**
 * Shows the skeletons product grid example.
 */
export const ProductGrid: Story = {
  /**
   * Renders the skeletons product grid example.
   *
   * @returns The rendered story example.
   */
  render: () => (
    <div className="grid w-[640px] grid-cols-2 gap-4">
      <ProductGridSkeleton count={4} />
    </div>
  ),
};
