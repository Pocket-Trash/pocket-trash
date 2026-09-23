import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { createWebClientEnv } from "./src/env/client.schema";
import { createWebServerEnv } from "./src/env/server.schema";

type MutableEnv = Record<string, string | undefined>;

function envValue(env: MutableEnv, key: string) {
  const value = env[key];

  return value === "" ? undefined : value;
}

export function applyWebClientEnvAliases(env: MutableEnv = process.env) {
  const assetFolderPrefix = envValue(env, "ASSET_FOLDER_PREFIX");
  const cdnBaseUrl = envValue(env, "BUNNY_CDN_BASE_URL");
  const logDeploymentId = envValue(env, "LOG_DEPLOYMENT_ID");
  const logDeploymentTarget = envValue(env, "LOG_DEPLOYMENT_TARGET");
  const logProxyClientKey = envValue(env, "LOG_PROXY_CLIENT_KEY");
  const resourceApiBaseUrl = envValue(env, "API_URL");

  if (
    envValue(env, "VITE_ASSET_FOLDER_PREFIX") === undefined &&
    assetFolderPrefix !== undefined
  ) {
    env.VITE_ASSET_FOLDER_PREFIX = assetFolderPrefix;
  }

  if (
    envValue(env, "VITE_CDN_BASE_URL") === undefined &&
    cdnBaseUrl !== undefined
  ) {
    env.VITE_CDN_BASE_URL = cdnBaseUrl;
  }

  if (
    envValue(env, "VITE_LOG_DEPLOYMENT_ID") === undefined &&
    logDeploymentId !== undefined
  ) {
    env.VITE_LOG_DEPLOYMENT_ID = logDeploymentId;
  }

  if (
    envValue(env, "VITE_LOG_DEPLOYMENT_TARGET") === undefined &&
    logDeploymentTarget !== undefined
  ) {
    env.VITE_LOG_DEPLOYMENT_TARGET = logDeploymentTarget;
  }

  if (
    envValue(env, "VITE_LOG_PROXY_CLIENT_KEY") === undefined &&
    logProxyClientKey !== undefined
  ) {
    env.VITE_LOG_PROXY_CLIENT_KEY = logProxyClientKey;
  }

  if (
    envValue(env, "VITE_API_URL") === undefined &&
    resourceApiBaseUrl !== undefined
  ) {
    env.VITE_API_URL = resourceApiBaseUrl;
  }
}

export default defineConfig(async ({ mode }) => {
  const isTest = mode === "test";

  if (!isTest) {
    applyWebClientEnvAliases();

    createWebClientEnv({
      VITE_ASSET_FOLDER_PREFIX: process.env.VITE_ASSET_FOLDER_PREFIX,
      VITE_CDN_BASE_URL: process.env.VITE_CDN_BASE_URL,
      VITE_CLERK_PUBLISHABLE_KEY: process.env.VITE_CLERK_PUBLISHABLE_KEY,
      VITE_CLERK_SIGN_IN_URL: process.env.VITE_CLERK_SIGN_IN_URL,
      VITE_CLERK_SIGN_UP_URL: process.env.VITE_CLERK_SIGN_UP_URL,
      VITE_LOG_DEPLOYMENT_ID: process.env.VITE_LOG_DEPLOYMENT_ID,
      VITE_LOG_DEPLOYMENT_TARGET: process.env.VITE_LOG_DEPLOYMENT_TARGET,
      VITE_LOG_PROXY_CLIENT_KEY: process.env.VITE_LOG_PROXY_CLIENT_KEY,
      VITE_API_URL: process.env.VITE_API_URL,
    });
    createWebServerEnv({
      ASSET_FOLDER_PREFIX: process.env.ASSET_FOLDER_PREFIX,
      AXIOM_DATASET: process.env.AXIOM_DATASET,
      AXIOM_EDGE_DOMAIN: process.env.AXIOM_EDGE_DOMAIN,
      AXIOM_TOKEN: process.env.AXIOM_TOKEN,
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
      DATABASE_URL: process.env.DATABASE_URL,
      BUNNY_IMAGE_FOLDER_PREFIX: process.env.BUNNY_IMAGE_FOLDER_PREFIX,
      LOGGER: process.env.LOGGER,
      LOG_DEPLOYMENT_ID: process.env.LOG_DEPLOYMENT_ID,
      LOG_DEPLOYMENT_TARGET: process.env.LOG_DEPLOYMENT_TARGET,
      LOG_LEVEL: process.env.LOG_LEVEL,
      LOG_PROXY_CLIENT_KEY: process.env.LOG_PROXY_CLIENT_KEY,
      BUNNY_CDN_BASE_URL: process.env.BUNNY_CDN_BASE_URL,
      BUNNY_CDN_TOKEN_KEY: process.env.BUNNY_CDN_TOKEN_KEY,
      BUNNY_RESOURCE_FOLDER_PREFIX: process.env.BUNNY_RESOURCE_FOLDER_PREFIX,
      BUNNY_STORAGE_ACCESS_KEY: process.env.BUNNY_STORAGE_ACCESS_KEY,
      BUNNY_STORAGE_ENDPOINT: process.env.BUNNY_STORAGE_ENDPOINT,
      BUNNY_STORAGE_ZONE_NAME: process.env.BUNNY_STORAGE_ZONE_NAME,
    });
  }

  return {
    optimizeDeps: {
      include: ["@clerk/tanstack-react-start", "@clerk/ui/experimental"],
    },
    plugins: [
      tanstackStart(),
      ...(isTest ? [] : [nitro()]),
      react(),
      tailwindcss(),
    ],
    preview: {
      port: 4005,
      strictPort: true,
    },
    resolve: {
      alias: {
        "@": "/src",
      },
    },
    server: {
      port: 4005,
      strictPort: true,
    },
  };
});
