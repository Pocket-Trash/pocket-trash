import type { Register } from "@tanstack/react-router";
import {
  createStartHandler,
  defaultStreamHandler,
  type RequestHandler,
} from "@tanstack/react-start/server";
import { serverEnv } from "@/env/server";
import { handleLogIngestionRequest } from "@/lib/log-ingestion";
import { s } from "@/lib/services";

/** Default TanStack Start request handler. */
const fetch = createStartHandler(defaultStreamHandler);

/** Server request entry point used by the deployment runtime. */
type ServerEntry = {
  /** Handles an incoming application request. */
  fetch: RequestHandler<Register>;
};

/**
 * Wraps the application handler with the client-log ingestion endpoint.
 *
 * @param entry - Default application request handler.
 * @returns Server entry that intercepts log ingestion before route dispatch.
 */
function createServerEntry(entry: ServerEntry): ServerEntry {
  return {
    /**
     * Dispatches client-log requests or delegates to TanStack Start.
     *
     * @param args - Request and TanStack server context arguments.
     * @returns Response from log ingestion or the application handler.
     * @rejects When log ingestion or application request handling fails.
     */
    async fetch(...args) {
      const [request] = args;

      if (
        request.method === "POST" &&
        new URL(request.url).pathname === "/api/v0/logs"
      ) {
        return await handleLogIngestionRequest({
          clientLogKey: serverEnv.LOG_PROXY_CLIENT_KEY,
          logger: s.logger,
          request,
        });
      }

      return await entry.fetch(...args);
    },
  };
}

export default createServerEntry({ fetch });
