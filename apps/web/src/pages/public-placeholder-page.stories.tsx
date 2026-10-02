import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { PublicPlaceholderPage } from "./public-placeholder-page";

/** Storybook metadata for public placeholder pages. */
const meta = {
  args: { titleKey: "web.navigation.contact" },
  beforeEach: mockStoryAuth,
  component: PublicPlaceholderPage,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Components/PublicPlaceholderPage",
} satisfies Meta<typeof PublicPlaceholderPage>;

export default meta;
/** Public placeholder story shape. */
type Story = StoryObj<typeof meta>;

/** Default contact-page placeholder. */
export const Default: Story = {
  /**
   * Verifies the localized title and placeholder copy.
   *
   * @param root0 - Story interaction context.
   */
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Contact")).toBeVisible();
    await expect(canvas.getByText("Coming soon.")).toBeVisible();
  },
};

/** Public placeholder at the mobile viewport. */
export const Narrow: Story = {
  globals: { viewport: "mobile1" },
};
