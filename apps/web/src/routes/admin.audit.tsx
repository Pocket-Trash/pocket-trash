import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  canReadAudit,
  getAdminAuditExport,
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
  loader: async ({ deps }) => {
    const [page, exportState] = await Promise.all([
      listAdminAuditEvents({ data: deps }),
      getAdminAuditExport(),
    ]);
    return { exportState, page };
  },
  validateSearch: parseAuditSearch,
});

function AdminAuditRoute() {
  const { exportState, page } = Route.useLoaderData();
  return (
    <AdminAuditPage
      exportState={exportState}
      page={page}
      search={Route.useSearch()}
    />
  );
}
