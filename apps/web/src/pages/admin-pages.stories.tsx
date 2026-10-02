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

/** Unread feedback notification shared by the stories. */
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
/** Completed feedback notification shared by the stories. */
const completed = {
  ...unread,
  id: 1002,
  readAt: new Date("2026-09-29T12:05:00Z"),
  type: "completed" as const,
};

/** Admin page Storybook configuration. */
const meta = {
  /** Configures administrator mocks before each story. */
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
/** A story for an admin page. */
type Story = StoryObj<typeof meta>;

/** Administrator hub navigation story. */
export const Hub: Story = {
  /**
   * Verifies administrator hub links.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after the interaction completes.
   */
  play: async ({ canvas, userEvent }) => {
    await expect(
      canvas.getByRole("heading", { name: "Admin Menu" }),
    ).toBeVisible();
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

    const toggle = canvas.getByRole("button", { name: "Toggle sidebar" });
    const trashLink = sidebar.getByRole("link", { name: "Trash" });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(canvas.getByRole("complementary")).toHaveAttribute(
      "data-state",
      "collapsed",
    );
    await expect(trashLink).toBeVisible();
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(trashLink).toBeVisible();
  },
};

/** Editor hub navigation story. */
export const EditorHub: Story = {
  /**
   * Configures the editor role for this story.
   *
   * @returns Nothing.
   */
  beforeEach: () => mockStoryRole("editor"),
  /**
   * Verifies editor-specific hub links.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after the interaction completes.
   */
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

/** Admin notifications hub story. */
export const NotificationsHub: Story = {
  /**
   * Renders the notifications hub.
   *
   * @returns The notifications hub page.
   */
  render: () => <AdminNotificationsIndexPage />,
  /**
   * Verifies notification navigation links.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after the interaction completes.
   */
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

/** Admin trash hub story. */
export const TrashHub: Story = {
  /**
   * Renders the trash hub.
   *
   * @returns The trash hub page.
   */
  render: () => <AdminTrashIndexPage />,
  /**
   * Verifies trash navigation links.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after the interaction completes.
   */
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

/** Disconnected admin settings story. */
export const Settings: Story = {
  /**
   * Renders admin settings.
   *
   * @returns The settings page.
   */
  render: () => <AdminSettingsPage />,
  /**
   * Verifies disconnected Linear controls.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after the interaction completes.
   */
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

/** Connected admin settings story. */
export const ConnectedSettings: Story = {
  /** Configures a connected Linear account for the story. */
  beforeEach: () => {
    /** Mock connected Linear account. */
    const linear = {
      /**
       * Returns the connected account identifier.
       *
       * @returns The connected account identifier.
       */
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
  /**
   * Renders connected admin settings.
   *
   * @returns The settings page.
   */
  render: () => <AdminSettingsPage />,
  /**
   * Verifies connected Linear controls.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after the interaction completes.
   */
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

/** Populated feedback notifications story. */
export const FeedbackNotifications: Story = {
  /**
   * Renders populated feedback notifications.
   *
   * @returns The feedback notifications page.
   */
  render: () => (
    <AdminFeedbackNotificationsPage
      initialNotifications={[unread, completed]}
    />
  ),
  /**
   * Exercises accepting a feedback notification.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after the interaction completes.
   * @rejects When the accept action is missing.
   */
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

/** Empty feedback notifications story. */
export const EmptyNotifications: Story = {
  /**
   * Renders an empty feedback notifications page.
   *
   * @returns The empty notifications page.
   */
  render: () => <AdminFeedbackNotificationsPage initialNotifications={[]} />,
};
