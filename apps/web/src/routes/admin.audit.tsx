import { formatTranslation } from "@pocket-trash/localizations";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  canReadAudit,
  getAdminAuditExport,
  getAuditDeliveryFailures,
  listAdminAuditEvents,
  parseAuditSearch,
} from "@/lib/audit";
import { AdminAuditPage } from "@/pages/admin-audit-page";

/** Administrative audit-log route. */
const Route = createFileRoute("/admin/audit")({
  /**
   * Verifies that the actor may read the audit log.
   *
   * @rejects When the actor lacks audit access.
   */
  beforeLoad: async () => {
    if (!(await canReadAudit())) throw notFound();
  },
  component: AdminAuditRoute,
  /**
   * Defines audit-page metadata.
   *
   * @returns Audit-page metadata.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.admin.audit.title") }],
  }),
  /**
   * Selects validated search state as loader dependencies.
   *
   * @param context - Route dependency context.
   * @param context.search - Validated search state.
   * @returns Loader dependencies.
   */
  loaderDeps: ({ search }) => search,
  /**
   * Loads audit events and export state.
   *
   * @param context - Route loader context.
   * @param context.deps - Validated audit search filters.
   * @returns Audit page data.
   */
  loader: async ({ deps }) => {
    const [page, exportState, deliveryFailures] = await Promise.all([
      listAdminAuditEvents({ data: deps }),
      getAdminAuditExport(),
      getAuditDeliveryFailures(),
    ]);
    return { deliveryFailures, exportState, page };
  },
  validateSearch: parseAuditSearch,
});

export { Route };

/**
 * Connects route loader data to the audit page.
 *
 * @returns The configured admin audit page.
 */
function AdminAuditRoute() {
  const { deliveryFailures, exportState, page } = Route.useLoaderData();
  return (
    <AdminAuditPage
      deliveryFailures={deliveryFailures}
      exportState={exportState}
      page={page}
      search={Route.useSearch()}
    />
  );
}
