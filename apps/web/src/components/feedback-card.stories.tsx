import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, within } from "storybook/test";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { FeedbackCard } from "./feedback-card";

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
type Story = StoryObj<typeof meta>;

export const Pending: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Saved searches")).toBeVisible();
    await expect(canvas.getByText("Pending")).toBeVisible();
  },
};

export const Requested: Story = {
  args: {
    status: "requested",
    submitter: "trash-fan",
    voteCount: 8,
  },
};

export const Planned: Story = { args: { status: "planned" } };

export const InProgress: Story = { args: { status: "in_progress" } };

export const Completed: Story = { args: { status: "completed" } };
