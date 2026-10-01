import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { PageFooter } from "./page-footer";

/**
 * Configures Storybook coverage for the page footer examples.
 */
const meta = {
  args: { year: 2026 },
  beforeEach: mockStoryAuth,
  component: PageFooter,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  title: "Components/PageFooter",
} satisfies Meta<typeof PageFooter>;

export default meta;
/**
 * Storybook story contract for the page footer examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Defines the default page footer story.
 */
export const Default: Story = {
  /**
   * Exercises the page footer story interaction and assertions.
   *
   * @param context - Storybook play context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @returns A promise that resolves after the interaction assertions pass.
   * @rejects {Error} If a user interaction or assertion fails.
   */
  play: async ({ canvas }) => {
    const links = canvas.getAllByRole("link");
    const home = links.find((link) => link.getAttribute("href") === "/");
    const x = links.find(
      (link) => link.getAttribute("href") === "https://x.com/pockettrashapp",
    );
    const discord = links.find(
      (link) => link.getAttribute("href") === "https://discord.gg/jQWqfnCX73",
    );

    await expect(home).toBeDefined();
    await expect(x).toHaveAttribute("target", "_blank");
    await expect(discord).toHaveAttribute("target", "_blank");
  },
};

/**
 * Defines the dark page footer story.
 */
export const Dark: Story = {
  globals: { theme: "dark" },
};

/**
 * Defines the narrow page footer story.
 */
export const Narrow: Story = {
  globals: { viewport: "mobile1" },
};
