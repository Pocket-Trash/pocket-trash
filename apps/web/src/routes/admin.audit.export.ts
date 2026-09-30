import { createFileRoute } from "@tanstack/react-router";
import { handleAuditExportRequest } from "@/lib/audit";

export const Route = createFileRoute("/admin/audit/export")({
  server: {
    handlers: {
      POST: async ({ request }) => await handleAuditExportRequest(request),
    },
  },
});
