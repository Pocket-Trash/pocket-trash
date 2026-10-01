import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSelfErasureStatus } from "@/lib/account-erasure";
import { AccountErasureStatusPage } from "@/pages/account-erasure-pages";

/**
 * Defines the `/account-erasure` route and its data lifecycle.
 */
export const Route = createFileRoute("/account-erasure")({
  /**
   * Loads the current account-erasure status and redirects completed or unavailable requests.
   *
   * @returns The route's loader data.
   * @throws When navigation must continue at another route.
   * @rejects When navigation must continue at another route.
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
