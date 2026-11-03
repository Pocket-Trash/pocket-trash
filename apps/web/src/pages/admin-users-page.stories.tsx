import { formatTranslation } from "@pocket-trash/localizations";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, mocked, waitFor } from "storybook/test";
import {
  type AdminUserIdentity,
  getAdminUserAccess,
  searchAdminUsers,
  setAdminUserBanState,
} from "@/lib/user-bans";
import { mockStoryRole, StoryProviders } from "../../.storybook/story-fixtures";
import { AdminUsersPage } from "./admin-users-page";

/** Selected Clerk identity fixture. */
const user: AdminUserIdentity = {
  banned: false,
  clerkId: "target_user",
  email: "target@example.test",
  name: "Target user",
  username: "target",
};
/** User-access administration with isolated provider operations. */
const meta = {
  component: AdminUsersPage,
  /** Configures authorization, explicit search, and recoverable provider failure. */
  beforeEach: () => {
    mockStoryRole("admin");
    mocked(searchAdminUsers).mockResolvedValue([user]);
    mocked(getAdminUserAccess).mockResolvedValue({ user, banState: null });
    mocked(setAdminUserBanState).mockRejectedValue(
      new Error("Provider unavailable"),
    );
  },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  title: "Components/AdminUsersPage",
} satisfies Meta<typeof AdminUsersPage>;
export default meta;
/** User-access administration story contract. */
type Story = StoryObj<typeof meta>;
/** Initial explicit user search state. */
export const Search: Story = {};
/** Failed ban requests retain the selected identity and staff reason. */
export const FailedBan: Story = {
  /**
   * Exercises search, selection, and recoverable ban feedback.
   * @param context - Current story interaction context.
   * @returns Completion after private draft preservation is verified.
   */
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByRole("textbox", {
        name: formatTranslation(
          "web.admin.featureFlags.emailUsernameOrName",
          {},
          "en-US",
        ),
      }),
      "target",
    );
    await userEvent.click(
      canvas.getByRole("button", {
        name: formatTranslation("web.action.search", {}, "en-US"),
      }),
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: /Target user/ }),
    );
    const reason = await canvas.findByRole("textbox", {
      name: formatTranslation("web.admin.audit.reason", {}, "en-US"),
    });
    await userEvent.type(reason, "Staff review");
    await userEvent.click(
      canvas.getByRole("button", {
        name: formatTranslation("web.admin.users.ban", {}, "en-US"),
      }),
    );
    await waitFor(() => expect(setAdminUserBanState).toHaveBeenCalled());
    await expect(canvas.getByText("Provider unavailable")).toBeVisible();
    await expect(reason).toHaveValue("Staff review");
  },
};
