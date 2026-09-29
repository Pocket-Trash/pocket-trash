import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, within } from "storybook/test";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import {
  AdminActiveFeedbackPage,
  AdminFeedbackArchivePage,
  AdminFeedbackRequestsPage,
} from "./admin-feedback-pages";

const request = {
  category: "feature" as const,
  createdAt: new Date("2026-09-28T12:00:00Z"),
  description: "Let people save searches they use often.",
  hasReservedPlan: false,
  id: 1000,
  status: "pending" as const,
  submitterUsername: "ada",
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
  title: "Pages/AdminFeedback",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Requests: Story = {
  render: () => (
    <AdminFeedbackRequestsPage
      initialPage={{ hasNext: false, items: [request] }}
      mergeTargets={[
        { id: 1001, status: "requested", title: "Existing request" },
      ]}
    />
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const opener = canvas.getByRole("button", {
      name: "Manage Saved searches",
    });
    await userEvent.click(opener);
    const dialog = within(canvasElement.ownerDocument.body).getByRole(
      "dialog",
      { name: "Manage request" },
    );
    await expect(dialog).toBeVisible();
    await expect(within(dialog).getByText(request.description)).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: "Edit" }));
    await expect(within(dialog).getByLabelText("Title")).toHaveValue(
      request.title,
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Close" }),
    );
    await expect(opener).toHaveFocus();
  },
};

export const Active: Story = {
  render: () => (
    <AdminActiveFeedbackPage
      initialPage={{
        hasNext: false,
        items: [{ ...request, status: "requested" }],
      }}
    />
  ),
};

export const Archive: Story = {
  render: () => (
    <AdminFeedbackArchivePage
      initialPage={{
        hasNext: false,
        items: [{ ...request, status: "completed" }],
      }}
    />
  ),
};
