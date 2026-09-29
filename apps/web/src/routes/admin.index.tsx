import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { AdminIndexPage } from "@/pages/admin-index-page";

export const Route = createFileRoute("/admin/")({
  component: AdminIndexPage,
  head: () => ({
    meta: [{ title: formatTranslation("web.admin.hub.title") }],
  }),
});
