import { serve } from "@hono/node-server";
import { loggerMessages } from "@package/logger";
import { createApp } from "./app.js";
import { scraperEnv } from "./env.js";
import { createScraperLogger } from "./lib/logger.js";

/**
 * Process-wide scraper server logger.
 */
const logger = createScraperLogger({
  appEnv: scraperEnv.APP_ENV,
  axiomDataset: scraperEnv.AXIOM_DATASET,
  axiomEdgeDomain: scraperEnv.AXIOM_EDGE_DOMAIN,
  axiomToken: scraperEnv.AXIOM_TOKEN,
  deploymentId: scraperEnv.LOG_DEPLOYMENT_ID,
  deploymentTarget: scraperEnv.LOG_DEPLOYMENT_TARGET,
  loggerMode: scraperEnv.LOGGER,
  logLevel: scraperEnv.LOG_LEVEL,
  railwayEnvironmentName: scraperEnv.RAILWAY_ENVIRONMENT_NAME,
});

void main().catch(async (error) => {
  logger.fatal(loggerMessages.scraper.serverFailed, {
    attributes: {
      source: "server",
    },
    error,
  });
  await logger.flush();
  process.exitCode = 1;
});

/**
 * Starts the scraper HTTP server.
 */
async function main() {
  const app = createApp({ logger });
  const server = serve({
    fetch: app.fetch,
    port: scraperEnv.PORT,
  });

  logger.info(loggerMessages.scraper.serverListening, {
    attributes: {
      port: scraperEnv.PORT,
    },
  });

  process.once("SIGINT", () => {
    void shutdown({ server, signal: "SIGINT" });
  });
  process.once("SIGTERM", () => {
    void shutdown({ server, signal: "SIGTERM" });
  });
}

/**
 * Stops the HTTP server, then flushes pending logs.
 *
 * @param options - Runtime resources and the process signal requesting shutdown.
 */
async function shutdown({
  server,
  signal,
}: {
  /**
   * Node server returned by Hono's adapter.
   */
  server: unknown;
  /**
   * Process signal that initiated shutdown.
   */
  signal: string;
}) {
  logger.info(loggerMessages.scraper.serverStopping, {
    attributes: {
      signal,
    },
  });

  await closeServer(server);
  await logger.flush();
}

/**
 * Closes a server when it exposes Node's callback-style close contract.
 *
 * @param server - Potentially closable server instance.
 * @rejects When the server reports a shutdown error.
 */
async function closeServer(server: unknown) {
  if (!isClosableServer(server)) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

/**
 * Checks whether a value exposes Node's callback-style server close method.
 *
 * @param server - Candidate server value.
 * @returns Whether the value can be closed asynchronously.
 */
function isClosableServer(server: unknown): server is {
  /**
   * Closes the server and reports any shutdown error.
   *
   * @param callback - Receives an optional server shutdown error.
   */
  close: (callback: (error?: Error) => void) => void;
} {
  return (
    typeof server === "object" &&
    server !== null &&
    "close" in server &&
    typeof server.close === "function"
  );
}
