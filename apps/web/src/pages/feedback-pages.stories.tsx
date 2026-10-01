import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, within } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import {
  CompletedFeedbackPage,
  FeedbackBoardPage,
  MyFeedbackPage,
} from "./feedback-pages";

const requested = {
  category: "feature" as const,
  completedAt: null,
  createdAt: new Date("2026-09-28T12:00:00Z"),
  description: "Let people save searches they use often.",
  hasPermanentVote: false,
  hasVoted: false,
  id: 1000,
  status: "requested" as const,
  title: "Saved searches",
  updatedAt: new Date("2026-09-28T12:00:00Z"),
  voteCount: 8,
};

const meta = {
  beforeEach: mockStoryAuth,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Components/FeedbackPages",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActiveBoard: Story = {
  render: () => (
    <FeedbackBoardPage
      initialItems={[
        { ...requested, id: 1002, status: "in_progress", title: "Mobile app" },
        { ...requested, id: 1001, status: "planned", title: "Public API" },
        requested,
      ]}
    />
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const opener = canvas.getByRole("button", {
      name: "View details for Saved searches",
    });
    await userEvent.click(opener);
    const dialog = within(canvasElement.ownerDocument.body).getByRole(
      "dialog",
      { name: "Request details" },
    );
    await expect(dialog).toBeVisible();
    await expect(within(dialog).getByText("Saved searches")).toBeVisible();
    await expect(
      within(dialog).getByText("Let people save searches they use often."),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Close" }),
    );
    await expect(dialog).not.toBeVisible();
    await expect(opener).toHaveFocus();
  },
};

export const PermanentVoteHidden: Story = {
  render: () => (
    <FeedbackBoardPage
      initialItems={[{ ...requested, hasPermanentVote: true, hasVoted: true }]}
    />
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.queryByText("Your submission vote is permanent."),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: "Remove vote" }),
    ).not.toBeInTheDocument();
  },
};

export const EmptyBoard: Story = {
  render: () => <FeedbackBoardPage initialItems={[]} />,
};

export const MyRequests: Story = {
  render: () => (
    <MyFeedbackPage
      initialPage={{
        hasNext: false,
        items: [
          {
            ...requested,
            hasPermanentVote: true,
            hasVoted: true,
            status: "completed",
          },
        ],
      }}
    />
  ),
};

export const Completed: Story = {
  render: () => (
    <CompletedFeedbackPage
      initialItems={[
        {
          ...requested,
          completedAt: new Date("2026-09-30T12:00:00Z"),
          status: "completed",
        },
      ]}
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Saved searches")).toBeVisible();
    await expect(canvas.queryByText("Upvote")).not.toBeInTheDocument();
    await expect(canvas.queryByText("Remove vote")).not.toBeInTheDocument();
  },
};
