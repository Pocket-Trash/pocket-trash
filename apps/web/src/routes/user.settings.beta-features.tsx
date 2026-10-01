import { createFileRoute } from "@tanstack/react-router";
import { UserBetaFeaturesPage } from "@/pages/user-beta-features-page";

/**
 * Defines the `/user/settings/beta-features` route and its data lifecycle.
 */
export const Route = createFileRoute("/user/settings/beta-features")({
  component: UserBetaFeaturesPage,
});
