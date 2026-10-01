import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { canEraseAccounts } from "@/lib/account-erasure";
import { AdminAccountErasurePage } from "@/pages/admin-account-erasure-page";

/**
 * Provides account-erasure operations to authorized administrators.
 */
export const Route = createFileRoute("/admin/account-erasure")({
  /**
   * Requires account-erasure administration access before entering the route.
   *
   * @rejects When the current user lacks account-erasure administration access.
   */
  beforeLoad: async () => {
    if (!(await canEraseAccounts())) throw notFound();
  },
  component: AdminAccountErasurePage,
  /**
   * Builds document metadata for the admin account erasure route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.erasure.admin.title") }],
  }),
});
