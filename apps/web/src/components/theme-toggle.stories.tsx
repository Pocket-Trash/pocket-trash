import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { ThemeToggle } from "./theme-toggle";

/**
 * Configures Storybook coverage for the theme toggle examples.
 */
const meta = {
  beforeEach: mockStoryAuth,
  component: ThemeToggle,
  decorators: [
    (Story) => (
      <StoryProviders>
        <div className="bg-sidebar p-4">
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
  title: "Components/ThemeToggle",
} satisfies Meta<typeof ThemeToggle>;

export default meta;
/**
 * Storybook story contract for the theme toggle examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Defines the default theme toggle story.
 */
export const Default: Story = {
  /**
   * Exercises the theme toggle story interaction and assertions.
   *
   * @param context - Storybook play context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.userEvent - Storybook interaction driver.
   * @returns A promise that resolves after the interaction assertions pass.
   * @rejects {Error} If a user interaction or assertion fails.
   */
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Dark" }));
    await expect(canvas.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  },
};
