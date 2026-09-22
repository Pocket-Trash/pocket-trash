import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { ThemeToggle } from "./theme-toggle";

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
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Dark" }));
    await expect(canvas.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  },
};
