/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ASSET_FOLDER_PREFIX?: string;
  readonly VITE_CDN_BASE_URL?: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  readonly VITE_CLERK_SIGN_IN_URL?: string;
  readonly VITE_CLERK_SIGN_UP_URL?: string;
  readonly VITE_LOG_DEPLOYMENT_ID?: string;
  readonly VITE_LOG_DEPLOYMENT_TARGET?: string;
  readonly VITE_LOG_PROXY_CLIENT_KEY?: string;
  readonly VITE_RESOURCE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
