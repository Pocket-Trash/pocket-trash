import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { AccountErasureState } from "./account-erasure-pages";

const meta = {
  args: {
    status: {
      requestId: "7c86e5d4-0bea-4f72-9584-5df2e32d6bb6",
      status: "processing",
    },
  },
  beforeEach: () => mockStoryAuth(),
  component: AccountErasureState,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Pages/AccountErasure",
} satisfies Meta<typeof AccountErasureState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Processing: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Erasure in progress" }),
    ).toBeVisible();
    await expect(canvas.getByText(/7c86e5d4-0bea-4f72/)).toBeVisible();
  },
};

export const NeedsSupport: Story = {
  args: {
    status: {
      requestId: "7c86e5d4-0bea-4f72-9584-5df2e32d6bb6",
      status: "needs_support",
    },
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Erasure needs support" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Contact support" }),
    ).toBeVisible();
  },
};
