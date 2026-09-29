import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { PublicPlaceholderPage } from "./public-placeholder-page";

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
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Contact")).toBeVisible();
    await expect(canvas.getByText("Coming soon.")).toBeVisible();
  },
};

export const Narrow: Story = {
  globals: { viewport: "mobile1" },
};
