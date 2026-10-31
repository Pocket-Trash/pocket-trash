import { formatTranslation } from "@pocket-trash/localizations";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, mocked, within } from "storybook/test";
import { findDuplicateFeedback } from "@/lib/feedback";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import {
  CompletedFeedbackPage,
  FeedbackBoardPage,
  MyFeedbackPage,
  SubmitFeedbackPage,
} from "./feedback-pages";

/** Requested feedback fixture used by page stories. */
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

/** Storybook metadata for user-facing feedback pages. */
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
/** Feedback-page story shape. */
type Story = StoryObj<typeof meta>;

/** Active feedback board with representative request states. */
export const ActiveBoard: Story = {
  /**
   * Renders the active feedback board fixture.
   *
   * @returns The populated feedback board.
   */
  render: () => (
    <FeedbackBoardPage
      initialItems={[
        { ...requested, id: 1002, status: "in_progress", title: "Mobile app" },
        { ...requested, id: 1001, status: "planned", title: "Public API" },
        requested,
      ]}
    />
  ),
  /**
   * Verifies the request details dialog and focus restoration.
   *
   * @param root0 - Story interaction context.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const main = canvas.getByRole("main");
    const parentWidth = main.parentElement?.getBoundingClientRect().width ?? 0;
    await expect(parentWidth).toBeGreaterThan(0);
    await expect(main).toHaveClass("lg:max-w-[75%]");
    await expect(main.getBoundingClientRect().width).toBeCloseTo(
      parentWidth * 0.75,
      0,
    );
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

/** Feedback whose permanent submitter vote cannot be removed. */
export const PermanentVoteHidden: Story = {
  /**
   * Renders a request with a permanent vote.
   *
   * @returns The permanent-vote board fixture.
   */
  render: () => (
    <FeedbackBoardPage
      initialItems={[{ ...requested, hasPermanentVote: true, hasVoted: true }]}
    />
  ),
  /**
   * Verifies permanent-vote controls remain hidden.
   *
   * @param root0 - Story interaction context.
   */
  play: async ({ canvas }) => {
    await expect(
      canvas.queryByText("Your submission vote is permanent."),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: "Remove vote" }),
    ).not.toBeInTheDocument();
  },
};

/** Empty active feedback board. */
export const EmptyBoard: Story = {
  /**
   * Renders an empty feedback board.
   *
   * @returns The empty feedback board fixture.
   */
  render: () => <FeedbackBoardPage initialItems={[]} />,
};

/** Submitter feedback history story. */
export const MyRequests: Story = {
  /**
   * Renders the submitter feedback history.
   *
   * @returns The submitter feedback page story.
   */
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

/** Completed feedback page story. */
export const Completed: Story = {
  /**
   * Renders the completed feedback story.
   *
   * @returns The completed feedback page story.
   */
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
  /**
   * Verifies completed feedback omits voting actions.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Saved searches")).toBeVisible();
    await expect(canvas.queryByText("Upvote")).not.toBeInTheDocument();
    await expect(canvas.queryByText("Remove vote")).not.toBeInTheDocument();
  },
};

/** Duplicate-aware submission keeps the draft available for explicit confirmation. */
export const SubmissionDuplicates: Story = {
  /** Configures a deterministic duplicate suggestion. */
  beforeEach: () => {
    mocked(findDuplicateFeedback).mockResolvedValue([requested]);
  },
  /** Renders the existing feedback submission flow.
   * @returns Duplicate-aware submission form. */
  render: () => <SubmitFeedbackPage />,
  /** Checks draft retention and accessible duplicate suggestions.
   * @param context - Story interaction context. */
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText("Title"), "Saved searches");
    await userEvent.type(
      canvas.getByLabelText("Description"),
      "Keep useful searches.",
    );
    await userEvent.selectOptions(
      canvas.getByLabelText(
        formatTranslation("web.feedback.new.categoryLabel"),
      ),
      "feature",
    );
    await userEvent.click(
      canvas.getByRole("button", {
        name: formatTranslation("web.feedback.new.submit"),
      }),
    );
    await expect(
      await canvas.findByRole("heading", { name: "Saved searches" }),
    ).toBeVisible();
    await expect(canvas.getByLabelText("Title")).toHaveValue("Saved searches");
    await expect(
      canvas.getByRole("button", {
        name: formatTranslation("web.feedback.duplicates.submitAnyway"),
      }),
    ).toBeEnabled();
  },
};
