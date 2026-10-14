import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { withThemePanels } from "../../../.storybook/theme-panels";
import { AuthPageSkeleton } from "./auth-page-skeleton";

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
