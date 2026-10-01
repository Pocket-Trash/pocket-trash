import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSelfErasureStatus } from "@/lib/account-erasure";
import { AccountErasureStatusPage } from "@/pages/account-erasure-pages";

/**
 * Shows the current user's account-erasure status.
 */
export const Route = createFileRoute("/account-erasure")({
  /**
   * Loads the current erasure status and redirects signed-out or unavailable requests.
   *
   * @returns The current erasure status.
   * @rejects When erasure status cannot be loaded or navigation redirects to the applicable account page.
   */
  loader: async () => {
    const status = await getSelfErasureStatus();
    if (status === "signed_out") throw redirect({ to: "/account-erased" });
    if (!status) throw redirect({ to: "/user/account" });
    return status;
  },
  component: AccountErasureRoute,
  /**
   * Builds document metadata for the account erasure route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.erasure.status.title") }],
  }),
});

/**
 * Renders the account erasure route content.
 *
 * @returns The rendered route UI.
 */
function AccountErasureRoute() {
  return <AccountErasureStatusPage initialStatus={Route.useLoaderData()} />;
}
