import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSelfErasureStatus } from "@/lib/account-erasure";
import { AccountErasureStatusPage } from "@/pages/account-erasure-pages";

export const Route = createFileRoute("/account-erasure")({
  loader: async () => {
    const status = await getSelfErasureStatus().catch(() => {
      throw redirect({ to: "/account-erased" });
    });
    if (!status) throw redirect({ to: "/user/account" });
    return status;
  },
  component: AccountErasureRoute,
  head: () => ({
    meta: [{ title: formatTranslation("web.erasure.status.title") }],
  }),
});

function AccountErasureRoute() {
  return <AccountErasureStatusPage initialStatus={Route.useLoaderData()} />;
}
