import { createFileRoute } from "@tanstack/react-router";
import { UserSettingsPage } from "@/pages/user-settings-page";

/**
 * Defines the `/user/settings_` route and its data lifecycle.
 */
export const Route = createFileRoute("/user/settings_")({
  component: UserSettingsPage,
});
