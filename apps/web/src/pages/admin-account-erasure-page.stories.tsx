import { formatTranslation } from "@pocket-trash/localizations";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, mocked, waitFor } from "storybook/test";
import {
  type AdminErasureStatusView,
  type ErasureTarget,
  findErasureTarget,
  requestAdminErasure,
  retryAdminErasure,
} from "@/lib/account-erasure";
import { mockStoryRole, StoryProviders } from "../../.storybook/story-fixtures";
import { AdminAccountErasurePage } from "./admin-account-erasure-page";

/** Verified disposable account fixture; no live privacy mutation is issued. */
const target: ErasureTarget = {
  clerkId: "story_target",
  email: "target@example.test",
  name: "Fixture account",
};
/** Current request needing administrator assistance. */
const receipt: AdminErasureStatusView = {
  requestId: "00000000-0000-4000-8000-000000000001",
  status: "needs_support",
  errorCode: "fixture_retry",
  targetClerkId: target.clerkId,
};
/** Administrator erasure controls with isolated lookup/request/retry boundaries. */
const meta = {
  component: AdminAccountErasurePage,
  /** Configures the administrator and terminal fixture outcomes. */
  beforeEach: () => {
    mockStoryRole("admin");
    mocked(findErasureTarget).mockResolvedValue(target);
    mocked(requestAdminErasure).mockResolvedValue(receipt);
    mocked(retryAdminErasure).mockResolvedValue({
      ...receipt,
      status: "completed",
      errorCode: null,
    });
  },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  title: "Components/AdminAccountErasurePage",
} satisfies Meta<typeof AdminAccountErasurePage>;
export default meta;
/** Administrator erasure story contract. */
type Story = StoryObj<typeof meta>;
/** Initial verified-email lookup. */
export const Lookup: Story = {};
/** Verified evidence, needs-support feedback, retry, and terminal completion. */
export const NeedsSupport: Story = {
  /**
   * Exercises request and retry against disposable in-memory fixtures.
   * @param context - Current story interaction context.
   * @returns Completion after terminal status is visible.
   */
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByRole("textbox", {
        name: formatTranslation("web.erasure.admin.emailLabel", {}, "en-US"),
      }),
      target.email,
    );
    await userEvent.click(
      canvas.getByRole("button", {
        name: formatTranslation("web.erasure.admin.findTarget", {}, "en-US"),
      }),
    );
    await userEvent.type(
      await canvas.findByRole("textbox", {
        name: formatTranslation(
          "web.erasure.admin.referenceLabel",
          {},
          "en-US",
        ),
      }),
      "privacy_request:123",
    );
    await userEvent.click(
      canvas.getByRole("button", {
        name: formatTranslation("web.erasure.admin.start", {}, "en-US"),
      }),
    );
    await waitFor(() =>
      expect(requestAdminErasure).toHaveBeenCalledWith({
        data: {
          email: target.email,
          targetClerkId: target.clerkId,
          verificationMethod: "authenticated_request",
          verificationReference: "privacy_request:123",
        },
      }),
    );
    await userEvent.click(
      await canvas.findByRole("button", {
        name: formatTranslation("web.erasure.admin.retry", {}, "en-US"),
      }),
    );
    await waitFor(() =>
      expect(retryAdminErasure).toHaveBeenCalledWith({
        data: { requestId: receipt.requestId },
      }),
    );
    await expect(
      canvas.getByText(
        formatTranslation(
          "web.erasure.admin.statusLabel",
          {
            status: formatTranslation(
              "web.erasure.status.completed",
              {},
              "en-US",
            ),
          },
          "en-US",
        ),
      ),
    ).toBeVisible();
  },
};
