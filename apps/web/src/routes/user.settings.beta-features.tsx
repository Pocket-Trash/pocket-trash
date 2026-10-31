import { createFileRoute } from "@tanstack/react-router";
import { loadUserBetaFeatureFlagSettings } from "@/lib/feature-flags";
import { UserBetaFeaturesPage } from "@/pages/user-beta-features-page";

/**
 * Shows beta-feature settings for the current user.
 */
export const Route = createFileRoute("/user/settings/beta-features")({
  /**
   * Loads canonical opt-ins for the current authenticated route request.
   * @param context - Current Router loader cancellation lifetime.
   * @returns Current user-specific beta flags.
   * @rejects When the server cannot authorize or load the current account.
   */
  loader: ({ abortController }) =>
    loadUserBetaFeatureFlagSettings({ signal: abortController.signal }),
  component: BetaFeaturesRoute,
});

/**
 * Supplies canonical route data to the account-scoped opt-in controls.
 * @returns Current user's beta-feature settings.
 */
function BetaFeaturesRoute() {
  const { actorId, flags } = Route.useLoaderData();
  return <UserBetaFeaturesPage actorId={actorId} initialFlags={flags} />;
}
