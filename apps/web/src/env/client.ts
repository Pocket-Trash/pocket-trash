import { createWebClientEnv } from "./client.schema";

export const clientEnv = createWebClientEnv({
  VITE_ASSET_FOLDER_PREFIX: import.meta.env.VITE_ASSET_FOLDER_PREFIX,
  VITE_CDN_BASE_URL: import.meta.env.VITE_CDN_BASE_URL,
  VITE_CLERK_PUBLISHABLE_KEY: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  VITE_CLERK_SIGN_IN_URL: import.meta.env.VITE_CLERK_SIGN_IN_URL,
  VITE_CLERK_SIGN_UP_URL: import.meta.env.VITE_CLERK_SIGN_UP_URL,
  VITE_LOG_DEPLOYMENT_ID: import.meta.env.VITE_LOG_DEPLOYMENT_ID,
  VITE_LOG_DEPLOYMENT_TARGET: import.meta.env.VITE_LOG_DEPLOYMENT_TARGET,
  VITE_LOG_PROXY_CLIENT_KEY: import.meta.env.VITE_LOG_PROXY_CLIENT_KEY,
  VITE_API_URL: import.meta.env.VITE_API_URL,
});
