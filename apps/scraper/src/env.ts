import { createScraperEnv } from "./env.schema.js";

/**
 * Reads supported scraper environment variables from the current process.
 *
 * @returns An unvalidated runtime-environment snapshot.
 */
export function readProcessScraperRuntimeEnv() {
  return {
    APP_ENV: process.env.APP_ENV,
    AXIOM_DATASET: process.env.AXIOM_DATASET,
    AXIOM_EDGE_DOMAIN: process.env.AXIOM_EDGE_DOMAIN,
    AXIOM_TOKEN: process.env.AXIOM_TOKEN,
    BUNNY_STORAGE_ACCESS_KEY: process.env.BUNNY_STORAGE_ACCESS_KEY,
    BUNNY_STORAGE_ENDPOINT: process.env.BUNNY_STORAGE_ENDPOINT,
    BUNNY_STORAGE_ZONE_NAME: process.env.BUNNY_STORAGE_ZONE_NAME,
    DATABASE_URL: process.env.DATABASE_URL,
    BUNNY_CDN_BASE_URL: process.env.BUNNY_CDN_BASE_URL,
    BUNNY_IMAGE_FOLDER_PREFIX: process.env.BUNNY_IMAGE_FOLDER_PREFIX,
    IMAGE_STORAGE_PROVIDER: process.env.IMAGE_STORAGE_PROVIDER,
    GRIMSMO_PROXY_URL: process.env.GRIMSMO_PROXY_URL,
    LOGGER: process.env.LOGGER,
    LOG_DEPLOYMENT_ID: process.env.LOG_DEPLOYMENT_ID,
    LOG_DEPLOYMENT_TARGET: process.env.LOG_DEPLOYMENT_TARGET,
    LOG_LEVEL: process.env.LOG_LEVEL,
    PORT: process.env.PORT,
    RAILWAY_ENVIRONMENT_NAME: process.env.RAILWAY_ENVIRONMENT_NAME,
    REDIS: process.env.REDIS,
    REDIS_URL: process.env.REDIS_URL,

    SCRAPER_DRY_RUN: process.env.SCRAPER_DRY_RUN,

    SCRAPER_IMAGE_BATCH_SIZE: process.env.SCRAPER_IMAGE_BATCH_SIZE,
    SCRAPER_ITEM_BATCH_SIZE: process.env.SCRAPER_ITEM_BATCH_SIZE,

    SCRAPER_QUEUE_CONCURRENCY: process.env.SCRAPER_QUEUE_CONCURRENCY,
    SCRAPER_CRON_ENABLED: process.env.SCRAPER_CRON_ENABLED,
  };
}

/**
 * Validated environment for the scraper HTTP server.
 */
export const scraperEnv = createScraperEnv(readProcessScraperRuntimeEnv());
