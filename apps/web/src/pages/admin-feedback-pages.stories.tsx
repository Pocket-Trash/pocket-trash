import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, mocked, waitFor, within } from "storybook/test";
import {
  approveFeedback,
  listAdminActiveFeedback,
  listAdminAllActiveFeedback,
  listArchivedFeedback,
  listFeedbackMergeTargets,
  listPendingFeedback,
  updateAdminFeedback,
} from "@/lib/feedback";
import { mockStoryAuth, StoryProviders } from "../../.storybook/story-fixtures";
import {
  AdminActiveFeedbackPage,
  AdminAllActiveFeedbackPage,
  AdminFeedbackArchivePage,
  AdminFeedbackRequestsPage,
} from "./admin-feedback-pages";

const request = {
  category: "feature" as const,
  createdAt: new Date("2026-09-28T12:00:00Z"),
  description: "Let people save searches they use often.",
  id: 1000,
  status: "pending" as const,
  submitterUsername: "ada",
  title: "Saved searches",
  updatedAt: new Date("2026-09-28T12:00:00Z"),
  voteCount: 8,
};

const meta = {
  args: {
    initialPage: { hasNext: false, items: [request] },
    mergeTargets: [
      { id: 1001, status: "requested", title: "Existing request" },
    ],
  },
  beforeEach: () => {
    mockStoryAuth();
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
type Story = StoryObj<typeof meta>;

export const Requests: Story = {
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

export const Active: Story = {
  render: () => (
    <AdminActiveFeedbackPage
      initialPage={{
        hasNext: true,
        items: [{ ...request, status: "requested" }],
      }}
    />
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const breadcrumbs = within(
      within(canvas.getByRole("banner")).getByRole("navigation"),
    );
    await expect(breadcrumbs.getByText("Admin")).toBeVisible();
    await expect(breadcrumbs.getByText("Feedback")).toBeVisible();
    await expect(breadcrumbs.getByText("Planned")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Planned" }),
    ).toHaveAttribute("href", "/admin/feedback/planned");
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

export const AllActive: Story = {
  render: () => (
    <AdminAllActiveFeedbackPage
      initialPage={{ hasNext: true, items: [request] }}
    />
  ),
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

export const Archive: Story = {
  render: () => (
    <AdminFeedbackArchivePage
      archiveStatuses={["completed", "merged", "denied", "canceled"]}
      initialPage={{
        hasNext: false,
        items: [{ ...request, status: "completed" }],
      }}
    />
  ),
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

export const Empty: Story = {
  render: () => (
    <AdminActiveFeedbackPage initialPage={{ hasNext: false, items: [] }} />
  ),
};

export const RequestsWithoutMergeTarget: Story = {
  args: { mergeTargets: [] },
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
