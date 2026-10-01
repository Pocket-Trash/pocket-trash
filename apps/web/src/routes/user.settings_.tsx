import { createFileRoute } from "@tanstack/react-router";
import { UserSettingsPage } from "@/pages/user-settings-page";

/**
 * Shows settings for the current user.
 */
export const Route = createFileRoute("/user/settings_")({
  component: UserSettingsPage,
});
