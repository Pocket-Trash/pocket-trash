import { useReverification, useUser } from "@clerk/tanstack-react-start";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, mocked, waitFor, within } from "storybook/test";
import {
  listFeedbackNotifications,
  markFeedbackNotificationRead,
} from "@/lib/feedback";
import { mockStoryRole, StoryProviders } from "../../.storybook/story-fixtures";
import { AdminFeedbackNotificationsPage } from "./admin-feedback-notifications-page";
import { AdminIndexPage } from "./admin-index-page";
import { AdminNotificationsIndexPage } from "./admin-notifications-index-page";
import { AdminSettingsPage } from "./admin-settings-page";
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
    mockStoryRole("admin");
    mocked(useReverification).mockImplementation((action) => action as never);
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
      canvas.getByRole("main", {
        name: "Manage Pocket Trash administration.",
      }),
    );
    await expect(main.getByRole("link", { name: "Feedback" })).toHaveAttribute(
      "href",
      "/admin/feedback",
    );
    await expect(main.getByRole("link", { name: "Audit log" })).toHaveAttribute(
      "href",
      "/admin/audit",
    );
    await expect(
      main.getByRole("link", { name: "Notifications" }),
    ).toHaveAttribute("href", "/notifications");
    const sidebar = within(
      canvas.getByRole("navigation", { name: "Admin Panel" }),
    );
    for (const [name, href] of [
      ["Feedback", "/admin/feedback"],
      ["Audit log", "/admin/audit"],
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

export const EditorHub: Story = {
  beforeEach: () => mockStoryRole("editor"),
  play: async ({ canvas }) => {
    const main = within(
      canvas.getByRole("main", {
        name: "Manage Pocket Trash administration.",
      }),
    );
    await expect(
      main.queryByRole("link", { name: "Feedback" }),
    ).not.toBeInTheDocument();
    await expect(
      main.getByRole("link", { name: "Notifications" }),
    ).toBeVisible();

    const sidebar = within(
      canvas.getByRole("navigation", { name: "Admin Panel" }),
    );
    await expect(
      sidebar.queryByRole("link", { name: "Feature flags" }),
    ).not.toBeInTheDocument();
    await expect(sidebar.getByRole("link", { name: "Trash" })).toBeVisible();
  },
};

export const NotificationsHub: Story = {
  render: () => <AdminNotificationsIndexPage />,
  play: async ({ canvas }) => {
    const sidebar = within(
      canvas.getByRole("navigation", { name: "Admin Panel" }),
    );
    await expect(
      sidebar.getByRole("link", { name: "Feedback notifications" }),
    ).toHaveAttribute("href", "/admin/notifications/feedback");
    await expect(
      sidebar.getByRole("link", { name: "Resource notifications" }),
    ).toHaveAttribute("href", "/admin/notifications/resources");
  },
};

export const TrashHub: Story = {
  render: () => <AdminTrashIndexPage />,
  play: async ({ canvas }) => {
    const sidebar = within(
      canvas.getByRole("navigation", { name: "Admin Panel" }),
    );
    await expect(
      sidebar.getByRole("link", { name: "Resource trash" }),
    ).toHaveAttribute("href", "/admin/trash/resources");
    await expect(
      sidebar.getByRole("link", { name: "Catalog image trash" }),
    ).toHaveAttribute("href", "/admin/trash/catalog-images");
  },
};

export const Settings: Story = {
  render: () => <AdminSettingsPage />,
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText("Admin settings")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Connect Linear" }),
    ).toBeVisible();
    await expect(
      canvasElement.querySelector("img")?.getAttribute("src"),
    ).toContain("linear-logo.svg");
  },
};

export const ConnectedSettings: Story = {
  beforeEach: () => {
    const linear = {
      accountIdentifier: () => "ada@example.com",
      approvedScopes: "read write",
      destroy: fn(async () => undefined),
      provider: "linear" as const,
      reauthorize: fn(async () => linear),
    };
    mocked(useUser).mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: {
        createExternalAccount: fn(),
        externalAccounts: [linear],
        reload: fn(async () => undefined),
      },
    } as unknown as ReturnType<typeof useUser>);
  },
  render: () => <AdminSettingsPage />,
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText("Connected as ada@example.com"),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Update connection" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Remove connection" }),
    ).toBeVisible();
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
