import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, mocked, waitFor, within } from "storybook/test";
import {
  listFeedbackNotifications,
  markFeedbackNotificationRead,
} from "@/lib/feedback";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { AdminFeedbackNotificationsPage } from "./admin-feedback-notifications-page";
import { AdminIndexPage } from "./admin-index-page";

const unread = {
  createdAt: new Date("2026-09-29T12:00:00Z"),
  feedbackId: 1000,
  id: 1001,
  readAt: null,
  readByUsername: null,
  submitterUsername: "ada",
  title: "Saved searches",
  type: "submitted" as const,
};
const completed = {
  ...unread,
  id: 1002,
  readAt: new Date("2026-09-29T12:05:00Z"),
  type: "completed" as const,
};

const meta = {
  beforeEach: () => {
    mockStoryAuth();
    mocked(markFeedbackNotificationRead).mockResolvedValue(undefined);
    mocked(listFeedbackNotifications).mockResolvedValue([
      { ...unread, readAt: new Date("2026-09-29T12:05:00Z") },
      completed,
    ]);
  },
  component: AdminIndexPage,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Components/AdminPages",
} satisfies Meta<typeof AdminIndexPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Hub: Story = {
  play: async ({ canvas }) => {
    for (const [name, href] of [
      ["Requests", "/admin/feedback/requests"],
      ["Planned", "/admin/feedback/planned"],
      ["Archive", "/admin/feedback/archive"],
      ["Feedback notifications", "/admin/notifications/feedback"],
      ["Resource notifications", "/admin/notifications/resources"],
      ["Resource trash", "/admin/resources/trash"],
      ["Catalog image trash", "/admin/catalog-images/trash"],
      ["Feature flags", "/admin/settings/feature-flags"],
    ] as const) {
      await expect(canvas.getByRole("link", { name })).toHaveAttribute(
        "href",
        href,
      );
    }
  },
};

export const FeedbackNotifications: Story = {
  render: () => (
    <AdminFeedbackNotificationsPage
      initialNotifications={[unread, completed]}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    const breadcrumbs = within(
      within(canvas.getByRole("banner")).getByRole("navigation"),
    );
    await expect(breadcrumbs.getByText("Admin")).toBeVisible();
    await expect(breadcrumbs.getByText("Notifications")).toBeVisible();
    await expect(breadcrumbs.getByText("Feedback notifications")).toBeVisible();
    await expect(canvas.getByText("Submitted")).toBeVisible();
    await expect(canvas.getByText("Completed")).toBeVisible();
    await expect(canvas.getAllByText("Saved searches")).toHaveLength(2);

    const [accept] = canvas.getAllByRole("button", { name: "Accept" });
    if (!accept) throw new Error("Accept action is missing.");
    await userEvent.click(accept);
    await waitFor(() =>
      expect(mocked(markFeedbackNotificationRead)).toHaveBeenCalledWith({
        data: { notificationId: unread.id },
      }),
    );
    await waitFor(() => expect(accept).toBeDisabled());
  },
};

export const EmptyNotifications: Story = {
  render: () => <AdminFeedbackNotificationsPage initialNotifications={[]} />,
};
