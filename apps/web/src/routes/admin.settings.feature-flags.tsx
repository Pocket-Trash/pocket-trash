import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  canManageFeatureFlags,
  loadAdminFeatureFlagSettings,
} from "@/lib/feature-flags";
import { AdminFeatureFlagsPage } from "@/pages/admin-feature-flags-page";

/**
 * Provides feature-flag controls to authorized administrators.
 */
export const Route = createFileRoute("/admin/settings/feature-flags")({
  /**
   * Requires feature-flag administration access before entering the route.
   *
   * @rejects When authorization cannot be checked or the current user lacks feature-flag administration access.
   */
  beforeLoad: async () => {
    if (!(await canManageFeatureFlags())) {
      throw notFound();
    }
  },
  /**
   * Loads flags and their authorizing account in one guarded server request.
   * @param context - Current Router loader cancellation lifetime.
   * @returns Current administrator's canonical flag snapshot.
   * @rejects When authorization or flag loading fails.
   */
  loader: ({ abortController }) =>
    loadAdminFeatureFlagSettings({ signal: abortController.signal }),
  component: AdminFeatureFlagsRoute,
});

/**
 * Supplies the authorized loader snapshot to account-scoped controls.
 * @returns Current administrator's feature-flag settings.
 */
function AdminFeatureFlagsRoute() {
  const { actorId, flags } = Route.useLoaderData();
  return <AdminFeatureFlagsPage actorId={actorId} initialFlags={flags} />;
}
