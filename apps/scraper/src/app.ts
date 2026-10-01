import { type Logger, loggerMessages } from "@package/logger";
import { Hono } from "hono";

/**
 * Optional dependencies for the scraper health-check application.
 */
export type CreateAppOptions = {
  /**
   * Logger that receives health-check events.
   */
  logger?: Logger;
};

/**
 * Creates the scraper HTTP application with its health endpoint.
 *
 * @param options - Optional application dependencies.
 * @returns The configured Hono application.
 */
export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono();

  app.get("/health", (context) => {
    options.logger?.info(loggerMessages.scraper.healthChecked, {
      attributes: {
        route: "/health",
      },
    });

    return context.json({
      app: "scraper",
      ok: true,
    });
  });

  return app;
}

/**
 * Default scraper HTTP application used by the runtime entry point.
 */
const app = createApp();

export default app;
