import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, mocked, waitFor, within } from "storybook/test";
import {
  listFeedbackNotifications,
  markFeedbackNotificationRead,
} from "@/lib/feedback";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import { AdminFeedbackNotificationsPage } from "./admin-feedback-notifications-page";
import { AdminIndexPage } from "./admin-index-page";
import { AdminNotificationsIndexPage } from "./admin-notifications-index-page";
import { AdminTrashIndexPage } from "./admin-trash-index-page";

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
    const main = within(
      canvas.getByRole("region", {
        name: "Manage Pocket Trash administration.",
      }),
    );
    await expect(main.getByRole("link", { name: "Feedback" })).toHaveAttribute(
      "href",
      "/admin/feedback",
    );
    await expect(
      main.getByRole("link", { name: "Notifications" }),
    ).toHaveAttribute("href", "/notifications");
    const sidebar = within(
      canvas.getByRole("navigation", { name: "Admin Panel" }),
    );
    for (const [name, href] of [
      ["Feedback", "/admin/feedback"],
      ["Notifications", "/notifications"],
      ["Feature flags", "/admin/settings/feature-flags"],
      ["Trash", "/admin/trash"],
    ] as const) {
      await expect(sidebar.getByRole("link", { name })).toHaveAttribute(
        "href",
        href,
      );
    }
    for (const name of ["All active", "Requests", "Planned", "Archive"]) {
      await expect(
        sidebar.queryByRole("link", { name }),
      ).not.toBeInTheDocument();
    }
  },
};

export const NotificationsHub: Story = {
  render: () => <AdminNotificationsIndexPage />,
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("link", { name: "Feedback notifications" }),
    ).toHaveAttribute("href", "/admin/notifications/feedback");
    await expect(
      canvas.getByRole("link", { name: "Resource notifications" }),
    ).toHaveAttribute("href", "/admin/notifications/resources");
  },
};

export const TrashHub: Story = {
  render: () => <AdminTrashIndexPage />,
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("link", { name: "Resource trash" }),
    ).toHaveAttribute("href", "/admin/trash/resources");
    await expect(
      canvas.getByRole("link", { name: "Catalog image trash" }),
    ).toHaveAttribute("href", "/admin/trash/catalog-images");
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
