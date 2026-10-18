import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { PublicUserPage } from "./public-user-page";

/** Storybook metadata for the initial public user profile. */
const meta = {
  args: { username: "collector" },
  beforeEach: mockStoryAuth,
  component: PublicUserPage,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Components/PublicUserPage",
} satisfies Meta<typeof PublicUserPage>;

export default meta;
/** Public user profile story shape. */
type Story = StoryObj<typeof meta>;

/** Initial intentionally empty profile. */
export const Default: Story = {
  /**
   * Verifies the username title and blank main region.
   *
   * @param context - Story interaction context.
   * @param context.canvas - Rendered story canvas.
   */
  play: async ({ canvas }) => {
    await expect(canvas.getByText("collector")).toBeVisible();
    await expect(canvas.getByRole("main")).toBeEmptyDOMElement();
  },
};
