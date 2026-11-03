import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, mocked, waitFor, within } from "storybook/test";
import {
  getCurrentUserSettingsState,
  patchCurrentUserSettings,
} from "@/lib/user-settings";
import {
  mockStoryRole,
  StoryProviders,
  storySettings,
} from "../../.storybook/story-fixtures";
import { UserSettingsPage } from "./user-settings-page";

/** Configures signed-in settings-page stories. */
const meta = {
  component: UserSettingsPage,
  decorators: [
    (Story) => (
      <StoryProviders initialSettingsState={null}>
        <div className="w-[min(52rem,100vw)]">
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
  title: "Components/UserSettingsPage",
} satisfies Meta<typeof UserSettingsPage>;

export default meta;
/** Settings-page story contract. */
type Story = StoryObj<typeof meta>;

/** Private profile settings in the default light theme. */
export const Private: Story = {
  /** Installs private account settings before rendering. */
  beforeEach: () => {
    mockStoryRole("user");
    mocked(getCurrentUserSettingsState).mockResolvedValue({
      ...storySettings,
      settings: { ...storySettings.settings, isProfilePublic: false },
    });
    mocked(patchCurrentUserSettings).mockResolvedValue({
      ...storySettings.settings,
      isProfilePublic: true,
    });
  },
  /**
   * Verifies private Trends disabling and the profile visibility interaction.
   *
   * @param context - Story interaction context.
   * @param context.canvasElement - Rendered story root.
   * @param context.userEvent - Story interaction driver.
   */
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const visibility = await canvas.findByRole("switch", { name: "Public" });
    await waitFor(() => expect(visibility).not.toBeDisabled());
    await expect(canvas.getByText("Profile visibility")).toBeVisible();
    await expect(canvas.getByText("Publish Trends")).toBeVisible();
    const publish = canvas.getByRole("button", { name: "Public" });
    await expect(publish).toBeDisabled();
    await userEvent.click(visibility);
    await waitFor(() => expect(publish).not.toBeDisabled());
    await expect(patchCurrentUserSettings).toHaveBeenCalledWith({
      data: { isProfilePublic: true },
      signal: expect.any(AbortSignal),
    });
  },
};

/** Public profile settings in the dark theme. */
export const PublicDark: Story = {
  ...Private,
  globals: { theme: "dark" },
  /** Installs public account settings before rendering. */
  beforeEach: () => {
    mockStoryRole("user");
    mocked(getCurrentUserSettingsState).mockResolvedValue({
      ...storySettings,
      settings: {
        ...storySettings.settings,
        isProfilePublic: true,
        publishTrends: true,
      },
    });
    mocked(patchCurrentUserSettings).mockResolvedValue({
      ...storySettings.settings,
      isProfilePublic: true,
      publishTrends: true,
    });
  },
  /**
   * Verifies public profiles allow the stored Trends preference to change.
   *
   * @param context - Story interaction context.
   * @param context.canvasElement - Rendered story root.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Public" })).not.toBeDisabled(),
    );
  },
};

/** Private profile settings at a narrow mobile viewport. */
export const PrivateMobile: Story = {
  ...Private,
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
