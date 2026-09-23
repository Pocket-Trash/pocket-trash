import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export type WebServerRuntimeEnv = {
  ASSET_FOLDER_PREFIX?: string;
  AXIOM_DATASET?: string;
  AXIOM_EDGE_DOMAIN?: string;
  AXIOM_TOKEN?: string;
  CLERK_SECRET_KEY?: string;
  DATABASE_URL?: string;
  BUNNY_IMAGE_FOLDER_PREFIX?: string;
  LOGGER?: string;
  LOG_DEPLOYMENT_ID?: string;
  LOG_DEPLOYMENT_TARGET?: string;
  LOG_LEVEL?: string;
  LOG_PROXY_CLIENT_KEY?: string;
  BUNNY_CDN_BASE_URL?: string;
  BUNNY_CDN_TOKEN_KEY?: string;
  BUNNY_RESOURCE_FOLDER_PREFIX?: string;
  BUNNY_STORAGE_ACCESS_KEY?: string;
  BUNNY_STORAGE_ENDPOINT?: string;
  BUNNY_STORAGE_ZONE_NAME?: string;
};

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
