import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, mocked, waitFor, within } from "storybook/test";
import {
  approveFeedback,
  getLinearPlanOptions,
  listAdminActiveFeedback,
  listAdminAllActiveFeedback,
  listArchivedFeedback,
  listFeedbackMergeTargets,
  listPendingFeedback,
  planFeedback,
  syncFeedbackStatus,
  updateAdminFeedback,
} from "@/lib/feedback";
import { mockStoryRole, StoryProviders } from "../../.storybook/story-fixtures";
import {
  AdminActiveFeedbackPage,
  AdminAllActiveFeedbackPage,
  AdminFeedbackArchivePage,
  AdminFeedbackRequestsPage,
} from "./admin-feedback-pages";

/** Feedback request shared by the admin feedback stories. */
const request = {
  category: "feature" as const,
  createdAt: new Date("2026-09-28T12:00:00Z"),
  description: "Let people save searches they use often.",
  id: 1000,
  linearClientUuid: null,
  status: "pending" as const,
  submitterUsername: "ada",
  title: "Saved searches",
  updatedAt: new Date("2026-09-28T12:00:00Z"),
  voteCount: 8,
};

/** Admin feedback page Storybook configuration. */
const meta = {
  args: {
    initialPage: { hasNext: false, items: [request] },
    mergeTargets: [
      { id: 1001, status: "requested", title: "Existing request" },
    ],
  },
  /**
   * Configures admin feedback story mocks.
   *
   * @returns Nothing.
   */
  beforeEach: () => {
    mockStoryRole("admin");
    mocked(listPendingFeedback).mockResolvedValue({
      hasNext: true,
      items: [request],
    });
    mocked(listAdminActiveFeedback).mockResolvedValue({
      hasNext: true,
      items: [{ ...request, status: "requested" }],
    });
    mocked(listAdminAllActiveFeedback).mockResolvedValue({
      hasNext: true,
      items: [request],
    });
    mocked(listArchivedFeedback).mockResolvedValue({
      hasNext: false,
      items: [{ ...request, status: "completed" }],
    });
    mocked(listFeedbackMergeTargets).mockResolvedValue([]);
    mocked(updateAdminFeedback).mockResolvedValue(undefined);
    mocked(approveFeedback).mockResolvedValue(undefined);
    mocked(getLinearPlanOptions).mockResolvedValue({
      labels: [
        { id: "feature-label", name: "Feature" },
        { id: "customer-label", name: "Customer request" },
      ],
      ok: true,
      viewerName: "Ada",
    });
    mocked(planFeedback).mockResolvedValue({ ok: true });
    mocked(syncFeedbackStatus).mockResolvedValue({ ok: true });
  },
  component: AdminFeedbackRequestsPage,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Components/AdminFeedback",
} satisfies Meta<typeof AdminFeedbackRequestsPage>;

export default meta;
/** A story for an admin feedback page. */
type Story = StoryObj<typeof meta>;

/** Pending feedback management story. */
export const Requests: Story = {
  /**
   * Exercises pending feedback management and sorting.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after the interaction completes.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const breadcrumbs = within(
      within(canvas.getByRole("banner")).getByRole("navigation"),
    );
    await expect(breadcrumbs.getByText("Admin")).toBeVisible();
    await expect(breadcrumbs.getByText("Feedback")).toBeVisible();
    await expect(breadcrumbs.getByText("Requests")).toBeVisible();
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
      within(dialog).getByRole("button", { name: "Save & Approve" }),
    );
    await waitFor(() =>
      expect(mocked(updateAdminFeedback)).toHaveBeenCalledWith({
        data: {
          category: "feature",
          description: request.description,
          feedbackId: request.id,
          title: request.title,
        },
      }),
    );
    await expect(mocked(approveFeedback)).toHaveBeenCalledWith({
      data: { feedbackId: request.id },
    });
    await waitFor(() =>
      expect(mocked(listFeedbackMergeTargets)).toHaveBeenCalled(),
    );
    await expect(opener).toHaveFocus();
    await userEvent.click(
      canvas.getByRole("button", { name: "Sort Title ascending" }),
    );
    await waitFor(() =>
      expect(mocked(listPendingFeedback)).toHaveBeenCalledWith({
        data: {
          offset: 0,
          search: "",
          sort: [{ direction: "asc", field: "title" }],
        },
      }),
    );
  },
};

/** Planned feedback browsing story. */
export const Active: Story = {
  /**
   * Renders planned feedback.
   *
   * @returns The planned feedback page.
   */
  render: () => (
    <AdminActiveFeedbackPage
      initialPage={{
        hasNext: true,
        items: [{ ...request, status: "requested" }],
      }}
    />
  ),
  /**
   * Exercises planned feedback navigation and filtering.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after the interaction completes.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const breadcrumbs = within(
      within(canvas.getByRole("banner")).getByRole("navigation"),
    );
    await expect(breadcrumbs.getByText("Admin")).toBeVisible();
    await expect(breadcrumbs.getByText("Feedback")).toBeVisible();
    await expect(breadcrumbs.getByText("Planned")).toBeVisible();
    const sidebar = within(
      canvas.getByRole("navigation", { name: "Admin Panel" }),
    );
    for (const [name, href] of [
      ["All active", "/admin/feedback"],
      ["Requests", "/admin/feedback/requests"],
      ["Planned", "/admin/feedback/planned"],
      ["Archive", "/admin/feedback/archive"],
    ] as const) {
      await expect(sidebar.getByRole("link", { name })).toHaveAttribute(
        "href",
        href,
      );
    }
    const opener = canvas.getByRole("button", {
      name: "Manage Saved searches",
    });
    await userEvent.click(opener);
    const dialog = within(canvasElement.ownerDocument.body).getByRole(
      "dialog",
      { name: "Manage request" },
    );
    await expect(
      within(dialog).getByRole("button", { name: "Deny" }),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Close" }),
    );
    await expect(opener).toHaveFocus();
    const search = canvas.getByRole("searchbox", {
      name: "Search planned feedback",
    });
    await userEvent.type(search, "saved");
    await waitFor(() =>
      expect(mocked(listAdminActiveFeedback)).toHaveBeenCalledWith({
        data: { offset: 0, search: "saved", sort: [] },
      }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Clear search" }));
    await expect(search).toHaveValue("");
    await waitFor(() =>
      expect(mocked(listAdminActiveFeedback)).toHaveBeenCalledWith({
        data: { offset: 0, search: "", sort: [] },
      }),
    );
    await userEvent.type(search, "saved");
    await waitFor(() =>
      expect(mocked(listAdminActiveFeedback)).toHaveBeenCalledWith({
        data: { offset: 0, search: "saved", sort: [] },
      }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Sort Title ascending" }),
    );
    await waitFor(() =>
      expect(mocked(listAdminActiveFeedback)).toHaveBeenCalledWith({
        data: {
          offset: 0,
          search: "saved",
          sort: [{ direction: "asc", field: "title" }],
        },
      }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(mocked(listAdminActiveFeedback)).toHaveBeenCalledWith({
        data: {
          offset: 30,
          search: "saved",
          sort: [{ direction: "asc", field: "title" }],
        },
      }),
    );
  },
};

/** Linear planning interaction story. */
export const Planning: Story = {
  /**
   * Renders the planning story.
   *
   * @returns The planning story page.
   */
  render: () => (
    <AdminActiveFeedbackPage
      initialPage={{
        hasNext: false,
        items: [{ ...request, status: "requested" }],
      }}
    />
  ),
  /**
   * Exercises the Linear planning flow.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after the interaction completes.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Manage Saved searches" }),
    );
    const dialog = within(canvasElement.ownerDocument.body).getByRole(
      "dialog",
      { name: "Manage request" },
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Plan" }));
    await expect(
      within(canvasElement.ownerDocument.body).getByRole("dialog", {
        name: "Plan request",
      }),
    ).toBeVisible();
    await expect(
      within(dialog).getByRole("radio", { name: "Issue" }),
    ).toBeChecked();
    await expect(
      within(dialog).getByRole("checkbox", { name: "Feature" }),
    ).toBeChecked();
    await expect(
      within(dialog).getByRole("checkbox", { name: "Assign to me" }),
    ).not.toBeChecked();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create and plan" }),
    );
    await waitFor(() =>
      expect(mocked(planFeedback)).toHaveBeenCalledWith({
        data: {
          assignToMe: false,
          clientUuid: expect.any(String),
          feedbackId: request.id,
          kind: "issue",
          labelIds: ["feature-label"],
          leadProject: false,
        },
      }),
    );
  },
};

/** Manual feedback synchronization story. */
export const Synchronization: Story = {
  /**
   * Renders the synchronization story.
   *
   * @returns The synchronization story page.
   */
  render: () => (
    <AdminActiveFeedbackPage
      initialPage={{
        hasNext: false,
        items: [
          {
            ...request,
            linearClientUuid: "11111111-1111-4111-8111-111111111111",
            status: "planned",
          },
        ],
      }}
    />
  ),
  /**
   * Exercises the manual synchronization action.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after the interaction completes.
   */
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Sync" }));
    await waitFor(() =>
      expect(mocked(syncFeedbackStatus)).toHaveBeenCalledWith({
        data: { feedbackId: request.id },
      }),
    );
  },
};

/** All-active feedback browsing story. */
export const AllActive: Story = {
  /**
   * Renders all active feedback.
   *
   * @returns The all-active feedback page.
   */
  render: () => (
    <AdminAllActiveFeedbackPage
      initialPage={{ hasNext: true, items: [request] }}
    />
  ),
  /**
   * Exercises active feedback search.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after the interaction completes.
   */
  play: async ({ canvas, userEvent }) => {
    const breadcrumbs = within(
      within(canvas.getByRole("banner")).getByRole("navigation"),
    );
    await expect(breadcrumbs.getByText("Admin")).toBeVisible();
    await expect(breadcrumbs.getByText("Feedback")).toBeVisible();
    await expect(breadcrumbs.getByText("All active")).toBeVisible();
    const search = canvas.getByRole("searchbox", {
      name: "Search feedback",
    });
    await userEvent.type(search, "saved");
    await waitFor(() =>
      expect(mocked(listAdminAllActiveFeedback)).toHaveBeenCalledWith({
        data: { offset: 0, search: "saved", sort: [] },
      }),
    );
  },
};

/** Archived feedback management story. */
export const Archive: Story = {
  /**
   * Renders archived feedback.
   *
   * @returns The feedback archive page.
   */
  render: () => (
    <AdminFeedbackArchivePage
      archiveStatuses={["completed", "merged", "denied", "canceled"]}
      initialPage={{
        hasNext: false,
        items: [{ ...request, status: "completed" }],
      }}
    />
  ),
  /**
   * Exercises archived feedback filtering and editing.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after the interaction completes.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const breadcrumbs = within(
      within(canvas.getByRole("banner")).getByRole("navigation"),
    );
    await expect(breadcrumbs.getByText("Admin")).toBeVisible();
    await expect(breadcrumbs.getByText("Feedback")).toBeVisible();
    await expect(breadcrumbs.getByText("Archive")).toBeVisible();
    const opener = canvas.getByRole("button", {
      name: "Manage Saved searches",
    });
    await userEvent.click(opener);
    const dialog = within(canvasElement.ownerDocument.body).getByRole(
      "dialog",
      { name: "Manage request" },
    );
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
    await userEvent.selectOptions(
      canvas.getByRole("combobox", { name: "Status" }),
      "completed",
    );
    await waitFor(() =>
      expect(mocked(listArchivedFeedback)).toHaveBeenCalledWith({
        data: {
          offset: 0,
          search: "",
          sort: [],
          statuses: ["completed"],
        },
      }),
    );
  },
};

/** Empty planned feedback story. */
export const Empty: Story = {
  /**
   * Renders an empty planned feedback page.
   *
   * @returns The empty feedback page.
   */
  render: () => (
    <AdminActiveFeedbackPage initialPage={{ hasNext: false, items: [] }} />
  ),
};

/** Pending feedback story without available merge targets. */
export const RequestsWithoutMergeTarget: Story = {
  args: { mergeTargets: [] },
  /**
   * Verifies that merge controls are omitted without targets.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after the interaction completes.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Manage Saved searches" }),
    );
    const dialog = within(canvasElement.ownerDocument.body).getByRole(
      "dialog",
      { name: "Manage request" },
    );
    await expect(
      within(dialog).queryByRole("combobox"),
    ).not.toBeInTheDocument();
  },
};
