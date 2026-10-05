import type { AuditEventPage } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, within } from "storybook/test";
import { mockStoryRole, StoryProviders } from "../../.storybook/story-fixtures";
import { AdminAuditPage } from "./admin-audit-page";

/** Populated audit page data shared by the stories. */
const page = {
  coverageStartAt: new Date("2026-09-01T12:00:00Z"),
  coveredDomains: ["collection", "product"],
  items: [
    {
      action: "feature_flags.user_override.set",
      actorRole: "admin",
      actorUserId: 42,
      actorUsername: "ada",
      afterState: { name: "New name", visibility: "public" },
      authorizationType: "permission",
      beforeState: { name: "Old name", visibility: "private" },
      correlationId: null,
      id: 1001,
      metadata: null,
      occurredAt: new Date("2026-09-29T12:00:00Z"),
      ownerUserId: 84,
      permission: "products.manage",
      reason: "Correcting the listing",
      recordedAt: new Date("2026-09-29T12:00:01Z"),
      requestId: "request-123",
      targetId: "product-123",
      targetType: "feature_flags.user_override",
    },
  ],
  nextCursor: {
    id: 1001,
    recordedAt: new Date("2026-09-29T12:00:01Z"),
  },
} satisfies AuditEventPage;

/** Admin audit page Storybook configuration. */
const meta = {
  /**
   * Configures the administrator role for each story.
   *
   * @returns Nothing.
   */
  beforeEach: () => mockStoryRole("admin"),
  component: AdminAuditPage,
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Components/AdminAuditPage",
} satisfies Meta<typeof AdminAuditPage>;

export default meta;
/** A story for the admin audit page. */
type Story = StoryObj<typeof meta>;

/** Populated audit log with filtering and event details. */
const Populated: Story = {
  args: {
    deliveryFailures: [
      {
        action: "user.banned",
        attempts: 5,
        correlationId: null,
        errorCode: "audit_delivery_failed",
        requestId: "request-456",
        targetId: "1042",
      },
    ],
    exportState: { activeExport: null, canDelete: false, canExport: false },
    page,
    search: {},
  },
  /**
   * Verifies populated audit-log interactions.
   *
   * @param context - Story interaction context.
   * @returns Completion after the interaction checks.
   */
  play: async (context) => {
    const { canvas, userEvent } = context;
    await expect(canvas.getByRole("link", { name: "Audit log" })).toBeVisible();
    await expect(canvas.getByLabelText("Actor ID")).toBeVisible();
    await expect(
      canvas.getByText("feature_flags.user_override.set"),
    ).toBeVisible();
    await expect(canvas.getByText("user.banned")).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Older events" }),
    ).toBeVisible();

    const eventTable = canvas
      .getAllByRole("table")
      .find((table) =>
        within(table).queryByRole("columnheader", { name: "Action" }),
      );
    const columns = eventTable?.querySelectorAll("col") ?? [];
    await expect(columns).toHaveLength(7);
    await expect(columns[1]?.getBoundingClientRect().width).toBe(
      columns[2]?.getBoundingClientRect().width,
    );
    await expect(columns[1]?.getBoundingClientRect().width).toBeGreaterThan(
      columns[3]?.getBoundingClientRect().width ?? 0,
    );
    await expect(
      eventTable?.getBoundingClientRect().width ?? 0,
    ).toBeGreaterThanOrEqual(
      eventTable?.parentElement?.getBoundingClientRect().width ?? 0,
    );
    const eventRow = canvas
      .getByText("feature_flags.user_override.set")
      .closest("tr");
    await expect(eventRow).not.toBeNull();
    if (!eventRow) return;
    const eventCells = within(eventRow).getAllByRole("cell");
    await expect(eventCells[1]?.scrollWidth).toBeLessThanOrEqual(
      eventCells[1]?.clientWidth ?? 0,
    );
    await expect(eventCells[2]?.scrollWidth).toBeLessThanOrEqual(
      eventCells[2]?.clientWidth ?? 0,
    );

    const detailsElement = canvas.getByRole("group", { name: "Details" });
    const details = within(detailsElement);
    await userEvent.click(details.getByText("Details"));
    await expect(details.getByText(/Old name/)).toBeVisible();
    await expect(details.getByText(/New name/)).toBeVisible();
    await expect(detailsElement).toHaveClass("overflow-x-auto");
    await expect(
      detailsElement.parentElement?.scrollWidth ?? 0,
    ).toBeLessThanOrEqual(detailsElement.parentElement?.clientWidth ?? 0);
    const detailsSummary = details.getByText("Details");
    detailsSummary.focus();
    await expect(detailsSummary).toHaveFocus();
  },
};

/** Empty filtered audit-log state. */
const Empty: Story = {
  args: {
    exportState: { activeExport: null, canDelete: false, canExport: false },
    page: { ...page, items: [], nextCursor: null },
    search: { action: "missing.action" },
  },
  /**
   * Verifies the empty state.
   *
   * @param context - Story interaction context.
   * @returns Completion after the interaction checks.
   */
  play: async (context) => {
    const { canvas } = context;
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "No audit events match these filters.",
    );
  },
};

/** Audit-log state with a new export available. */
const ExportAvailable: Story = {
  args: {
    exportState: { activeExport: null, canDelete: false, canExport: true },
    page,
    search: {},
  },
  /**
   * Verifies the new-export controls.
   *
   * @param context - Story interaction context.
   * @returns Completion after the interaction checks.
   */
  play: async (context) => {
    const { canvas } = context;
    await expect(canvas.getByLabelText("Reason")).toBeRequired();
    await expect(canvas.getByRole("button", { name: "Export" })).toBeVisible();
  },
};

/** Audit-log state with a completed export ready to repeat. */
const ExportReady: Story = {
  args: {
    exportState: {
      activeExport: {
        completedAt: new Date("2026-09-30T12:05:00Z"),
        createdAt: new Date("2026-09-30T12:00:00Z"),
        cutoffAt: new Date("2026-08-01T12:00:00Z"),
        eventCount: 125,
        highWaterEventId: 1000,
        highWaterRecordedAt: new Date("2026-07-31T15:30:00Z"),
        id: "f58c6cac-f41f-4a32-9f4b-08cb32ff7270",
        reason: "Incident review",
        sha256: "a".repeat(64),
      },
      canDelete: true,
      canExport: true,
    },
    page,
    search: {},
  },
  /**
   * Verifies completed export details.
   *
   * @param context - Story interaction context.
   * @returns Completion after the interaction checks.
   */
  play: async (context) => {
    const { canvas } = context;
    await expect(
      canvas.getByText(/Oldest 125 events recorded before/),
    ).toBeVisible();
    await expect(canvas.getByText(/Incident review/)).toBeVisible();
    await expect(canvas.getByText(/a{64}/)).toBeVisible();
    await expect(
      canvas.getByLabelText("I confirm I have downloaded these logs."),
    ).toBeRequired();
    await expect(
      canvas.getByRole("button", { name: "Delete exported logs" }),
    ).toBeVisible();
  },
};

export { Empty, ExportAvailable, ExportReady, Populated };
