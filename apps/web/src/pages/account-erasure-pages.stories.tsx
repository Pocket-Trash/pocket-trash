import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { AccountErasureState } from "./account-erasure-pages";

/** Storybook metadata for account-erasure states. */
const meta = {
  args: {
    status: {
      requestId: "7c86e5d4-0bea-4f72-9584-5df2e32d6bb6",
      status: "processing",
    },
  },
  /**
   * Installs the authenticated story fixture.
   *
   * @returns The fixture cleanup callback.
   */
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
/** Account-erasure story shape. */
type Story = StoryObj<typeof meta>;

/** Processing account-erasure state. */
export const Processing: Story = {
  /**
   * Verifies the processing status and request identifier.
   *
   * @param root0 - Story interaction context.
   */
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Erasure in progress" }),
    ).toBeVisible();
    await expect(canvas.getByText(/7c86e5d4-0bea-4f72/)).toBeVisible();
  },
};

/** Account-erasure state that directs the user to support. */
export const NeedsSupport: Story = {
  args: {
    status: {
      requestId: "7c86e5d4-0bea-4f72-9584-5df2e32d6bb6",
      status: "needs_support",
    },
  },
  /**
   * Verifies the support status and contact action.
   *
   * @param root0 - Story interaction context.
   */
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Erasure needs support" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Contact support" }),
    ).toBeVisible();
  },
};
