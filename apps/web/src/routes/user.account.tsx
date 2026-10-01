import { createFileRoute } from "@tanstack/react-router";
import { UserAccountPage } from "@/pages/user-account-page";

/**
 * Defines the `/user/account` route and its data lifecycle.
 */
export const Route = createFileRoute("/user/account")({
  component: UserAccountPage,
});
