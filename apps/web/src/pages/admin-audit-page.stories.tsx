import type { AuditEventPage } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, within } from "storybook/test";
import { mockStoryRole, StoryProviders } from "../../.storybook/story-fixtures";
import { AdminAuditPage } from "./admin-audit-page";

const page = {
  coverageStartAt: new Date("2026-09-01T12:00:00Z"),
  coveredDomains: ["collection", "product"],
  items: [
    {
      action: "product.updated",
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
      targetType: "product.catalog",
    },
  ],
  nextCursor: {
    id: 1001,
    recordedAt: new Date("2026-09-29T12:00:01Z"),
  },
} satisfies AuditEventPage;

const meta = {
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
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  args: { page, search: {} },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole("link", { name: "Audit log" })).toBeVisible();
    await expect(canvas.getByLabelText("Actor ID")).toBeVisible();
    await expect(canvas.getByText("product.updated")).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Older events" }),
    ).toBeVisible();

    const details = within(canvas.getByRole("group", { name: "Details" }));
    await userEvent.click(details.getByText("Details"));
    await expect(details.getByText(/Old name/)).toBeVisible();
    await expect(details.getByText(/New name/)).toBeVisible();
  },
};

export const Empty: Story = {
  args: {
    page: { ...page, items: [], nextCursor: null },
    search: { action: "missing.action" },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "No audit events match these filters.",
    );
  },
};
