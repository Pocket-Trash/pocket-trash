import {
  createAxiomTransport,
  createConsoleTransport,
  createLogger,
  loggerValues,
  normalizeConsoleTransportMode,
  normalizeLogLevel,
} from "@package/logger";
import { createServices } from "@package/services";
import type { ApiBindings } from "../app.js";
/**
 * Creates the API logger with Axiom and console transports from worker bindings.
 *
 * @param env - Cloudflare environment and logging configuration.
 * @returns Configured API logger.
 */
export function createApiLogger(env: ApiBindings) {
  const environment = env.APP_ENV ?? "unknown";
  const hasAxiom = Boolean(env.AXIOM_TOKEN && env.AXIOM_DATASET);
  const transports = [
    ...(hasAxiom
      ? [
          createAxiomTransport({
            dataset: env.AXIOM_DATASET as string,
            edgeDomain: env.AXIOM_EDGE_DOMAIN,
            token: env.AXIOM_TOKEN as string,
          }),
        ]
      : []),
    ...(environment === "development" || !hasAxiom
      ? [
          createConsoleTransport({
            mode: normalizeConsoleTransportMode(env.LOGGER),
          }),
        ]
      : []),
  ];

  return createLogger({
    app: loggerValues.apps.api,
    deploymentId: env.LOG_DEPLOYMENT_ID ?? environment,
    deploymentTarget: env.LOG_DEPLOYMENT_TARGET ?? "cloudflare-worker",
    environment,
    level: normalizeLogLevel(env.LOG_LEVEL),
    transports,
  });
}

/**
 * Creates a request-local API service registry from Cloudflare bindings.
 * Database and logging are always configured; Bunny-backed storage is opt-in
 * for handlers that use it.
 *
 * @param bindings - Cloudflare environment bindings.
 * @param options - Optional service capabilities to configure.
 * @returns Configured service registry and shared logger.
 * @throws When required service configuration is invalid.
 */
export function createApiServices(
  bindings: ApiBindings,
  options: {
    /** Whether Bunny-backed storage services are configured. */
    storage?: boolean;
  } = {},
) {
  const logger = createApiLogger(bindings);
  const services = createServices();
  services.configure({
    db: { databaseUrl: bindings.DATABASE_URL as string },
    logger,
    ...(options.storage
      ? {
          storage: {
            accessKey: bindings.BUNNY_STORAGE_ACCESS_KEY,
            apiKey: bindings.BUNNY_API_KEY,
            cdnBaseUrl: bindings.BUNNY_CDN_BASE_URL,
            endpoint: bindings.BUNNY_STORAGE_ENDPOINT,
            folderPrefix: bindings.BUNNY_RESOURCE_FOLDER_PREFIX,
            imageFolderPrefix: bindings.BUNNY_IMAGE_FOLDER_PREFIX,
            pullZoneId: bindings.BUNNY_PULL_ZONE_ID,
            tokenKey: bindings.BUNNY_CDN_TOKEN_KEY,
            zoneName: bindings.BUNNY_STORAGE_ZONE_NAME,
          },
        }
      : {}),
  });
  return { logger, services };
}
