import type { FeatureFlagListItem } from "@package/services";
import { formatTranslation } from "@pocket-trash/localizations";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, mocked, waitFor } from "storybook/test";
import { updateAdminFeatureFlag } from "@/lib/feature-flags";
import { mockStoryRole, StoryProviders } from "../../.storybook/story-fixtures";
import { AdminFeatureFlagsPage } from "./admin-feature-flags-page";

/** Canonical administrator-owned feature flag. */
const flag: FeatureFlagListItem = {
  audience: "admin",
  archivedAt: null,
  createdAt: new Date("2026-10-01"),
  updatedAt: new Date("2026-10-01"),
  defaultEnabled: false,
  description: "Administrator tools",
  name: "Admin feature",
  slug: "admin-feature",
};
/** Feature-flag authoring setup with authorized route fixtures. */
const meta = {
  component: AdminFeatureFlagsPage,
  /** Configures the active administrator and isolated failed update. */
  beforeEach: () => {
    mockStoryRole("admin");
    mocked(updateAdminFeatureFlag).mockRejectedValue(
      new Error("Save unavailable"),
    );
  },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  title: "Components/AdminFeatureFlagsPage",
} satisfies Meta<typeof AdminFeatureFlagsPage>;
export default meta;
/** Feature-flag administration story contract. */
type Story = StoryObj<typeof meta>;
/** Empty canonical list and blank create form. */
export const Empty: Story = { args: { initialFlags: [] } };
/** All existing audience variants with active and archived flags. */
export const Audiences: Story = {
  args: {
    initialFlags: [
      flag,
      {
        ...flag,
        audience: "global",
        name: "Global feature",
        slug: "global-feature",
        defaultEnabled: true,
      },
      {
        ...flag,
        audience: "user",
        name: "Beta feature",
        slug: "beta-feature",
        archivedAt: new Date("2026-10-02"),
      },
    ],
  },
};
/** Prior-account loader data remains hidden. */
export const StaleAccount: Story = {
  args: { actorId: "prior_account", initialFlags: [flag] },
};
/** Failed edits retain the real form's draft and stable identity. */
export const FailedEdit: Story = {
  args: { initialFlags: [flag] },
  /**
   * Exercises authoring failure without changing the audience or slug contract.
   * @param context - Current story interaction context.
   * @returns Completion after draft and error feedback are verified.
   */
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Edit admin-feature" }),
    );
    const name = canvas.getByRole("textbox", {
      name: formatTranslation(
        "web.admin.featureFlags.displayName",
        {},
        "en-US",
      ),
    });
    await expect(name).toHaveValue("Admin feature");
    await userEvent.clear(name);
    await userEvent.type(name, "Updated admin feature");
    await userEvent.click(
      canvas.getByRole("button", {
        name: formatTranslation("web.action.saveFlag", {}, "en-US"),
      }),
    );
    await waitFor(() => expect(updateAdminFeatureFlag).toHaveBeenCalled());
    await expect(canvas.getByText("Save unavailable")).toBeVisible();
    await expect(name).toHaveValue("Updated admin feature");
    await expect(canvas.getByDisplayValue("admin-feature")).toBeDisabled();
  },
};
