import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { PageFooter } from "./page-footer";

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
type Story = StoryObj<typeof meta>;

export const Default: Story = {
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

export const Dark: Story = {
  globals: { theme: "dark" },
};

export const Narrow: Story = {
  globals: { viewport: "mobile1" },
};
