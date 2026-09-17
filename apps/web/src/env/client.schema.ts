import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export type WebClientRuntimeEnv = {
  VITE_ASSET_FOLDER_PREFIX?: string;
  VITE_CDN_BASE_URL?: string;
  VITE_CLERK_PUBLISHABLE_KEY?: string;
  VITE_CLERK_SIGN_IN_URL?: string;
  VITE_CLERK_SIGN_UP_URL?: string;
  VITE_LOG_DEPLOYMENT_ID?: string;
  VITE_LOG_DEPLOYMENT_TARGET?: string;
  VITE_LOG_PROXY_CLIENT_KEY?: string;
  VITE_RESOURCE_API_BASE_URL?: string;
};

export function createWebClientEnv(runtimeEnv: WebClientRuntimeEnv) {
  return createEnv({
    client: {
      VITE_ASSET_FOLDER_PREFIX: z.literal("assets").optional(),
      VITE_CDN_BASE_URL: z.string().url().optional(),
      VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1),
      VITE_CLERK_SIGN_IN_URL: z.string().min(1),
      VITE_CLERK_SIGN_UP_URL: z.string().min(1),
      VITE_LOG_DEPLOYMENT_ID: z.string().min(1).optional(),
      VITE_LOG_DEPLOYMENT_TARGET: z.string().min(1).optional(),
      VITE_LOG_PROXY_CLIENT_KEY: z.string().min(1).optional(),
      VITE_RESOURCE_API_BASE_URL: z.string().url(),
    },
    clientPrefix: "VITE_",
    emptyStringAsUndefined: true,
    runtimeEnvStrict: {
      VITE_ASSET_FOLDER_PREFIX: runtimeEnv.VITE_ASSET_FOLDER_PREFIX,
      VITE_CDN_BASE_URL: runtimeEnv.VITE_CDN_BASE_URL,
      VITE_CLERK_PUBLISHABLE_KEY: runtimeEnv.VITE_CLERK_PUBLISHABLE_KEY,
      VITE_CLERK_SIGN_IN_URL: runtimeEnv.VITE_CLERK_SIGN_IN_URL,
      VITE_CLERK_SIGN_UP_URL: runtimeEnv.VITE_CLERK_SIGN_UP_URL,
      VITE_LOG_DEPLOYMENT_ID: runtimeEnv.VITE_LOG_DEPLOYMENT_ID,
      VITE_LOG_DEPLOYMENT_TARGET: runtimeEnv.VITE_LOG_DEPLOYMENT_TARGET,
      VITE_LOG_PROXY_CLIENT_KEY: runtimeEnv.VITE_LOG_PROXY_CLIENT_KEY,
      VITE_RESOURCE_API_BASE_URL: runtimeEnv.VITE_RESOURCE_API_BASE_URL,
    },
  });
}
