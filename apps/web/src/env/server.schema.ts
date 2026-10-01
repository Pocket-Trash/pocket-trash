import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/** Unvalidated process values used by the web server runtime. */
export type WebServerRuntimeEnv = {
  /** CDN folder containing static application assets. */
  ASSET_FOLDER_PREFIX?: string;
  /** Axiom dataset receiving server logs. */
  AXIOM_DATASET?: string;
  /** Optional Axiom edge-ingestion domain. */
  AXIOM_EDGE_DOMAIN?: string;
  /** Axiom ingestion token. */
  AXIOM_TOKEN?: string;
  /** Clerk backend secret key. */
  CLERK_SECRET_KEY?: string;
  /** PostgreSQL connection URL. */
  DATABASE_URL?: string;
  /** HMAC secret used to pseudonymize erasure subjects. */
  ERASURE_HMAC_SECRET?: string;
  /** Deployment-scoped Bunny image object prefix. */
  BUNNY_IMAGE_FOLDER_PREFIX?: string;
  /** Console log output mode. */
  LOGGER?: string;
  /** Deployment identifier attached to server logs. */
  LOG_DEPLOYMENT_ID?: string;
  /** Hosting target attached to server logs. */
  LOG_DEPLOYMENT_TARGET?: string;
  /** Minimum emitted server log level. */
  LOG_LEVEL?: string;
  /** Shared key accepted by the server log proxy. */
  LOG_PROXY_CLIENT_KEY?: string;
  /** Public Bunny CDN origin. */
  BUNNY_CDN_BASE_URL?: string;
  /** Bunny token-authentication key. */
  BUNNY_CDN_TOKEN_KEY?: string;
  /** Deployment-scoped Bunny resource object prefix. */
  BUNNY_RESOURCE_FOLDER_PREFIX?: string;
  /** Bunny storage-zone access key. */
  BUNNY_STORAGE_ACCESS_KEY?: string;
  /** Bunny storage API endpoint. */
  BUNNY_STORAGE_ENDPOINT?: string;
  /** Bunny storage-zone name. */
  BUNNY_STORAGE_ZONE_NAME?: string;
};

/**
 * Validates and normalizes process environment values for the web server.
 *
 * Empty strings are treated as missing values.
 *
 * @param runtimeEnv - Raw process environment values.
 * @returns Validated server configuration.
 * @throws When a required value is missing or any value has an invalid format.
 */
export function createWebServerEnv(runtimeEnv: WebServerRuntimeEnv) {
  return createEnv({
    emptyStringAsUndefined: true,
    isServer: true,
    runtimeEnvStrict: {
      ASSET_FOLDER_PREFIX: runtimeEnv.ASSET_FOLDER_PREFIX,
      AXIOM_DATASET: runtimeEnv.AXIOM_DATASET,
      AXIOM_EDGE_DOMAIN: runtimeEnv.AXIOM_EDGE_DOMAIN,
      AXIOM_TOKEN: runtimeEnv.AXIOM_TOKEN,
      CLERK_SECRET_KEY: runtimeEnv.CLERK_SECRET_KEY,
      DATABASE_URL: runtimeEnv.DATABASE_URL,
      ERASURE_HMAC_SECRET: runtimeEnv.ERASURE_HMAC_SECRET,
      BUNNY_IMAGE_FOLDER_PREFIX: runtimeEnv.BUNNY_IMAGE_FOLDER_PREFIX,
      LOGGER: runtimeEnv.LOGGER,
      LOG_DEPLOYMENT_ID: runtimeEnv.LOG_DEPLOYMENT_ID,
      LOG_DEPLOYMENT_TARGET: runtimeEnv.LOG_DEPLOYMENT_TARGET,
      LOG_LEVEL: runtimeEnv.LOG_LEVEL,
      LOG_PROXY_CLIENT_KEY: runtimeEnv.LOG_PROXY_CLIENT_KEY,
      BUNNY_CDN_BASE_URL: runtimeEnv.BUNNY_CDN_BASE_URL,
      BUNNY_CDN_TOKEN_KEY: runtimeEnv.BUNNY_CDN_TOKEN_KEY,
      BUNNY_RESOURCE_FOLDER_PREFIX: runtimeEnv.BUNNY_RESOURCE_FOLDER_PREFIX,
      BUNNY_STORAGE_ACCESS_KEY: runtimeEnv.BUNNY_STORAGE_ACCESS_KEY,
      BUNNY_STORAGE_ENDPOINT: runtimeEnv.BUNNY_STORAGE_ENDPOINT,
      BUNNY_STORAGE_ZONE_NAME: runtimeEnv.BUNNY_STORAGE_ZONE_NAME,
    },
    server: {
      ASSET_FOLDER_PREFIX: z.literal("assets").optional(),
      AXIOM_DATASET: z.string().min(1).optional(),
      AXIOM_EDGE_DOMAIN: z.string().min(1).optional(),
      AXIOM_TOKEN: z.string().min(1).optional(),
      CLERK_SECRET_KEY: z.string().min(1),
      DATABASE_URL: z.string().min(1).url(),
      ERASURE_HMAC_SECRET: z.string().min(32),
      BUNNY_IMAGE_FOLDER_PREFIX: z
        .string()
        .regex(/^images(?:\/(?:dev|preview(?:\/pr-[1-9]\d*)?))?$/u)
        .optional(),
      LOGGER: z.enum(["compact", "verbose"]).optional(),
      LOG_DEPLOYMENT_ID: z.string().min(1).optional(),
      LOG_DEPLOYMENT_TARGET: z.string().min(1).optional(),
      LOG_LEVEL: z
        .enum(["trace", "debug", "verbose", "info", "warn", "error", "fatal"])
        .optional(),
      LOG_PROXY_CLIENT_KEY: z.string().min(1).optional(),
      BUNNY_CDN_BASE_URL: z.string().url().optional(),
      BUNNY_CDN_TOKEN_KEY: z.string().min(1).optional(),
      BUNNY_RESOURCE_FOLDER_PREFIX: z
        .string()
        .regex(/^resources\/(?:dev|files|preview(?:\/pr-[1-9]\d*)?)$/u)
        .optional(),
      BUNNY_STORAGE_ACCESS_KEY: z.string().min(1).optional(),
      BUNNY_STORAGE_ENDPOINT: z.string().url().optional(),
      BUNNY_STORAGE_ZONE_NAME: z.string().min(1).optional(),
    },
  });
}
