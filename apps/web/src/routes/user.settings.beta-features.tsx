import { createFileRoute } from "@tanstack/react-router";
import { UserBetaFeaturesPage } from "@/pages/user-beta-features-page";

/**
 * Shows beta-feature settings for the current user.
 */
export const Route = createFileRoute("/user/settings/beta-features")({
  component: UserBetaFeaturesPage,
});
