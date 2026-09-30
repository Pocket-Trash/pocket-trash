import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute } from "@tanstack/react-router";
import { AdminTrashIndexPage } from "@/pages/admin-trash-index-page";

export const Route = createFileRoute("/admin/trash/")({
  component: AdminTrashIndexPage,
  head: () => ({
    meta: [{ title: formatTranslation("web.admin.trash.title") }],
  }),
});
