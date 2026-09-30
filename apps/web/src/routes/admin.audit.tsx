import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  canReadAudit,
  listAdminAuditEvents,
  parseAuditSearch,
} from "@/lib/audit";
import { AdminAuditPage } from "@/pages/admin-audit-page";

export const Route = createFileRoute("/admin/audit")({
  beforeLoad: async () => {
    if (!(await canReadAudit())) throw notFound();
  },
  component: AdminAuditRoute,
  head: () => ({
    meta: [{ title: formatTranslation("web.admin.audit.title") }],
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listAdminAuditEvents({ data: deps }),
  validateSearch: parseAuditSearch,
});

function AdminAuditRoute() {
  return (
    <AdminAuditPage page={Route.useLoaderData()} search={Route.useSearch()} />
  );
}
