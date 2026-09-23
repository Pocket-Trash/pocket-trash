import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { UserPageShell } from "./user-page-shell";

const meta = {
  args: {
    children: (
      <div className="rounded-lg border border-border bg-card p-6">
        Account content
      </div>
    ),
    title: "Account",
  },
  beforeEach: mockStoryAuth,
  component: UserPageShell,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Components/UserPageShell",
} satisfies Meta<typeof UserPageShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText("Account", { selector: "[aria-current='page']" }),
    ).toBeVisible();
  },
};
