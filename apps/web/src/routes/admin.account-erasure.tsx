import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { isErasureAdmin } from "@/lib/account-erasure";
import { AdminAccountErasurePage } from "@/pages/admin-account-erasure-page";

export const Route = createFileRoute("/admin/account-erasure")({
  beforeLoad: async () => {
    if (!(await isErasureAdmin())) throw notFound();
  },
  component: AdminAccountErasurePage,
  head: () => ({
    meta: [{ title: formatTranslation("web.erasure.admin.title") }],
  }),
});
