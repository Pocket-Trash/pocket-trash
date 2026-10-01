import { createFileRoute } from "@tanstack/react-router";
import { UserAccountPage } from "@/pages/user-account-page";

/**
 * Shows account management for the current user.
 */
export const Route = createFileRoute("/user/account")({
  component: UserAccountPage,
});
