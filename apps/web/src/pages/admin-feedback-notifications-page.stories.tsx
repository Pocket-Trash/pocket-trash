import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, mocked, waitFor } from "storybook/test";
import { markFeedbackNotificationRead } from "@/lib/feedback";
import { mockStoryRole, StoryProviders } from "../../.storybook/story-fixtures";
import { AdminFeedbackNotificationsPage } from "./admin-feedback-notifications-page";

/** Representative unread feedback notification. */
const notification = {
  id: 1,
  feedbackId: 1000,
  type: "submitted" as const,
  title: "Saved searches",
  submitterUsername: "ada",
  createdAt: new Date("2026-09-28T12:00:00Z"),
  readAt: null,
  readByUsername: null,
};
/** Feedback notification states and their existing acceptance command. */
const meta = {
  component: AdminFeedbackNotificationsPage,
  args: { initialNotifications: [notification] },
  /** Supplies current administrator identity and a guarded notification write. */
  beforeEach: () => {
    mockStoryRole("admin");
    mocked(markFeedbackNotificationRead).mockResolvedValue(undefined);
  },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Components/AdminFeedbackNotifications",
} satisfies Meta<typeof AdminFeedbackNotificationsPage>;
export default meta;
/** Feedback notification story. */
type Story = StoryObj<typeof meta>;
/** Unread notification can be acknowledged through its existing action. */
export const Unread: Story = {
  /** Checks the persisted acknowledgement payload.
   * @param context - Story interaction context. */
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Accept" }));
    await waitFor(() =>
      expect(mocked(markFeedbackNotificationRead)).toHaveBeenCalledWith({
        data: { notificationId: notification.id },
      }),
    );
  },
};
/** Already-read notification cannot be acknowledged again. */
export const Read: Story = {
  args: {
    initialNotifications: [
      {
        ...notification,
        readAt: new Date("2026-09-29T12:00:00Z"),
        readByUsername: "admin",
      },
    ],
  },
  /** Checks the canonical read-state eligibility.
   * @param context - Story interaction context. */
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Accept" })).toBeDisabled();
  },
};
/** Empty notification inbox. */
export const Empty: Story = { args: { initialNotifications: [] } };
