import { createFileRoute } from "@tanstack/react-router";
import { handleAuditExportRequest } from "@/lib/audit";

/** Server-only route for audit-export downloads. */
const Route = createFileRoute("/admin/audit/export")({
  server: {
    handlers: {
      /**
       * Handles an audit-export form submission.
       *
       * @param context - Route request context.
       * @param context.request - Incoming form request.
       * @returns The streamed export response.
       */
      POST: async ({ request }) => await handleAuditExportRequest(request),
    },
  },
});

export { Route };
