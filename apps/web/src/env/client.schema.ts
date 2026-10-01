import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/** Unvalidated build-time values used to configure the web browser bundle. */
export type WebClientRuntimeEnv = {
  /** CDN folder containing static application assets. */
  VITE_ASSET_FOLDER_PREFIX?: string;
  /** Public CDN origin. */
  VITE_CDN_BASE_URL?: string;
  /** Clerk browser publishable key. */
  VITE_CLERK_PUBLISHABLE_KEY?: string;
  /** Application sign-in route. */
  VITE_CLERK_SIGN_IN_URL?: string;
  /** Application sign-up route. */
  VITE_CLERK_SIGN_UP_URL?: string;
  /** Deployment identifier attached to browser logs. */
  VITE_LOG_DEPLOYMENT_ID?: string;
  /** Hosting target attached to browser logs. */
  VITE_LOG_DEPLOYMENT_TARGET?: string;
  /** Shared key accepted by the server log proxy. */
  VITE_LOG_PROXY_CLIENT_KEY?: string;
  /** Public API origin used by browser requests. */
  VITE_API_URL?: string;
};

/**
 * Validates and normalizes build-time browser environment values.
 *
 * Empty strings are treated as missing values.
 *
 * @param runtimeEnv - Raw Vite environment values.
 * @returns Validated browser configuration.
 * @throws When a required value is missing or any value has an invalid format.
 */
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
      VITE_API_URL: z.string().url(),
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
      VITE_API_URL: runtimeEnv.VITE_API_URL,
    },
  });
}
