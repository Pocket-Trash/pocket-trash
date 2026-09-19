import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyWebClientEnvAliases } from "../../vite.config";
import { createWebClientEnv } from "./client.schema";
import { createWebServerEnv } from "./server.schema";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});
describe("web client env", () => {
  it("validates required Vite client variables", () => {
    const env = createWebClientEnv({
      VITE_ASSET_FOLDER_PREFIX: "assets",
      VITE_CDN_BASE_URL: "https://cdn.pocket-trash.app",
      VITE_CLERK_PUBLISHABLE_KEY: "pk_test_example",
      VITE_CLERK_SIGN_IN_URL: "/sign-in",
      VITE_CLERK_SIGN_UP_URL: "/sign-up",
      VITE_LOG_DEPLOYMENT_ID: "pr-27",
      VITE_LOG_DEPLOYMENT_TARGET: "web-client",
      VITE_LOG_PROXY_CLIENT_KEY: "client-key",
      VITE_API_URL: "http://localhost:4006",
    });

    expect(env.VITE_CLERK_PUBLISHABLE_KEY).toBe("pk_test_example");
    expect(env.VITE_ASSET_FOLDER_PREFIX).toBe("assets");
    expect(env.VITE_CDN_BASE_URL).toBe("https://cdn.pocket-trash.app");
    expect(env.VITE_CLERK_SIGN_IN_URL).toBe("/sign-in");
    expect(env.VITE_CLERK_SIGN_UP_URL).toBe("/sign-up");
    expect(env.VITE_LOG_DEPLOYMENT_ID).toBe("pr-27");
    expect(env.VITE_LOG_DEPLOYMENT_TARGET).toBe("web-client");
    expect(env.VITE_LOG_PROXY_CLIENT_KEY).toBe("client-key");
    expect(env.VITE_API_URL).toBe("http://localhost:4006");
  });

  it("rejects empty client values", () => {
    expect(() =>
      createWebClientEnv({
        VITE_CLERK_PUBLISHABLE_KEY: "",
        VITE_CLERK_SIGN_IN_URL: "/sign-in",
        VITE_CLERK_SIGN_UP_URL: "/sign-up",
        VITE_API_URL: "http://localhost:4006",
      }),
    ).toThrow("Invalid environment variables");
  });
});

describe("web client env aliases", () => {
  it("maps unprefixed log variables to their Vite client names", () => {
    const runtimeEnv: Record<string, string | undefined> = {
      ASSET_FOLDER_PREFIX: "assets",
      BUNNY_CDN_BASE_URL: "https://cdn.pocket-trash.app",
      LOG_DEPLOYMENT_ID: "development",
      LOG_DEPLOYMENT_TARGET: "web-client",
      LOG_PROXY_CLIENT_KEY: "client-key",
      API_URL: "http://localhost:4006",
    };

    applyWebClientEnvAliases(runtimeEnv);

    const env = createWebClientEnv({
      VITE_ASSET_FOLDER_PREFIX: runtimeEnv.VITE_ASSET_FOLDER_PREFIX,
      VITE_CDN_BASE_URL: runtimeEnv.VITE_CDN_BASE_URL,
      VITE_CLERK_PUBLISHABLE_KEY: "pk_test_example",
      VITE_CLERK_SIGN_IN_URL: "/sign-in",
      VITE_CLERK_SIGN_UP_URL: "/sign-up",
      VITE_LOG_DEPLOYMENT_ID: runtimeEnv.VITE_LOG_DEPLOYMENT_ID,
      VITE_LOG_DEPLOYMENT_TARGET: runtimeEnv.VITE_LOG_DEPLOYMENT_TARGET,
      VITE_LOG_PROXY_CLIENT_KEY: runtimeEnv.VITE_LOG_PROXY_CLIENT_KEY,
      VITE_API_URL: runtimeEnv.VITE_API_URL,
    });

    expect(env.VITE_LOG_DEPLOYMENT_ID).toBe("development");
    expect(env.VITE_ASSET_FOLDER_PREFIX).toBe("assets");
    expect(env.VITE_CDN_BASE_URL).toBe("https://cdn.pocket-trash.app");
    expect(env.VITE_LOG_DEPLOYMENT_TARGET).toBe("web-client");
    expect(env.VITE_LOG_PROXY_CLIENT_KEY).toBe("client-key");
    expect(env.VITE_API_URL).toBe("http://localhost:4006");
  });

  it("keeps explicit Vite logging variables over unprefixed aliases", () => {
    const runtimeEnv: Record<string, string | undefined> = {
      LOG_DEPLOYMENT_ID: "fallback",
      LOG_DEPLOYMENT_TARGET: "fallback-target",
      LOG_PROXY_CLIENT_KEY: "fallback-client-key",
      VITE_LOG_DEPLOYMENT_ID: "pr-27",
      VITE_LOG_DEPLOYMENT_TARGET: "web-client",
      VITE_LOG_PROXY_CLIENT_KEY: "client-key",
    };

    applyWebClientEnvAliases(runtimeEnv);

    expect(runtimeEnv.VITE_LOG_DEPLOYMENT_ID).toBe("pr-27");
    expect(runtimeEnv.VITE_LOG_DEPLOYMENT_TARGET).toBe("web-client");
    expect(runtimeEnv.VITE_LOG_PROXY_CLIENT_KEY).toBe("client-key");
  });
});

describe("web server env", () => {
  it("validates required server variables", () => {
    const env = createWebServerEnv({
      ASSET_FOLDER_PREFIX: "assets",
      AXIOM_DATASET: "development",
      AXIOM_EDGE_DOMAIN: "api.axiom.co",
      AXIOM_TOKEN: "xaat-example",
      CLERK_SECRET_KEY: "sk_test_example",
      DATABASE_URL: "postgres://user:password@example.com:5432/pocket_trash",
      BUNNY_IMAGE_FOLDER_PREFIX: "images/preview/pr-52",
      LOGGER: "verbose",
      LOG_DEPLOYMENT_ID: "pr-52",
      LOG_DEPLOYMENT_TARGET: "web-server",
      LOG_LEVEL: "debug",
      LOG_PROXY_CLIENT_KEY: "client-key",
      BUNNY_CDN_BASE_URL: "https://cdn.pocket-trash.app",
      BUNNY_CDN_TOKEN_KEY: "cdn-token-key",
      BUNNY_RESOURCE_FOLDER_PREFIX: "resources/preview/pr-52",
      BUNNY_STORAGE_ACCESS_KEY: "resource-storage-key",
      BUNNY_STORAGE_ENDPOINT: "https://ny.storage.bunnycdn.com",
      BUNNY_STORAGE_ZONE_NAME: "pocket-trash-storage",
    });

    expect(env.AXIOM_DATASET).toBe("development");
    expect(env.ASSET_FOLDER_PREFIX).toBe("assets");
    expect(env.AXIOM_EDGE_DOMAIN).toBe("api.axiom.co");
    expect(env.AXIOM_TOKEN).toBe("xaat-example");
    expect(env.CLERK_SECRET_KEY).toBe("sk_test_example");
    expect(env.DATABASE_URL).toBe(
      "postgres://user:password@example.com:5432/pocket_trash",
    );
    expect(env.BUNNY_IMAGE_FOLDER_PREFIX).toBe("images/preview/pr-52");
    expect(env.LOGGER).toBe("verbose");
    expect(env.LOG_DEPLOYMENT_ID).toBe("pr-52");
    expect(env.LOG_DEPLOYMENT_TARGET).toBe("web-server");
    expect(env.LOG_LEVEL).toBe("debug");
    expect(env.LOG_PROXY_CLIENT_KEY).toBe("client-key");
    expect(env.BUNNY_CDN_BASE_URL).toBe("https://cdn.pocket-trash.app");
    expect(env.BUNNY_CDN_TOKEN_KEY).toBe("cdn-token-key");
    expect(env.BUNNY_RESOURCE_FOLDER_PREFIX).toBe("resources/preview/pr-52");
    expect(env.BUNNY_STORAGE_ACCESS_KEY).toBe("resource-storage-key");
    expect(env.BUNNY_STORAGE_ENDPOINT).toBe("https://ny.storage.bunnycdn.com");
    expect(env.BUNNY_STORAGE_ZONE_NAME).toBe("pocket-trash-storage");
  });

  it("rejects missing server values", () => {
    expect(() =>
      createWebServerEnv({
        CLERK_SECRET_KEY: "sk_test_example",
      }),
    ).toThrow("Invalid environment variables");
  });

  it("rejects invalid server logger values", () => {
    expect(() =>
      createWebServerEnv({
        CLERK_SECRET_KEY: "sk_test_example",
        DATABASE_URL: "postgres://user:password@example.com:5432/pocket_trash",
        LOG_LEVEL: "loud",
      }),
    ).toThrow("Invalid environment variables");

    expect(() =>
      createWebServerEnv({
        CLERK_SECRET_KEY: "sk_test_example",
        DATABASE_URL: "postgres://user:password@example.com:5432/pocket_trash",
        LOGGER: "pretty",
      }),
    ).toThrow("Invalid environment variables");
  });
});
