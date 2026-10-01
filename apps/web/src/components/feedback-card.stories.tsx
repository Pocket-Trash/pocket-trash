import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, within } from "storybook/test";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { FeedbackCard } from "./feedback-card";

/**
 * Configures Storybook coverage for the feedback card examples.
 */
const meta = {
  args: {
    category: "feature",
    createdAt: "2026-09-28T12:00:00Z",
    description: "Let people save searches they use often.",
    status: "pending",
    title: "Saved searches",
    voteCount: 1,
  },
  component: FeedbackCard,
  decorators: [
    (Story) => (
      <StoryProviders>
        <div className="w-[32rem] max-w-full">
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
  title: "Components/FeedbackCard",
} satisfies Meta<typeof FeedbackCard>;

export default meta;
/**
 * Storybook story contract for the feedback card examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Defines the pending feedback card story.
 */
export const Pending: Story = {
  /**
   * Exercises the feedback card story interaction and assertions.
   *
   * @param context - Storybook play context.
   * @param context.canvasElement - Rendered Storybook canvas element.
   * @returns A promise that resolves after the interaction assertions pass.
   * @rejects {Error} If a user interaction or assertion fails.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Saved searches")).toBeVisible();
    await expect(canvas.getByText("Pending")).toBeVisible();
  },
};

/**
 * Defines the requested feedback card story.
 */
export const Requested: Story = {
  args: {
    status: "requested",
    submitter: "trash-fan",
    voteCount: 8,
  },
};

/**
 * Defines the planned feedback card story.
 */
export const Planned: Story = { args: { status: "planned" } };

/**
 * Defines the in progress feedback card story.
 */
export const InProgress: Story = { args: { status: "in_progress" } };

/**
 * Defines the completed feedback card story.
 */
export const Completed: Story = { args: { status: "completed" } };
