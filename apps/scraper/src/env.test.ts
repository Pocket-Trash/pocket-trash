import { describe, expect, it } from "vitest";
import {
  createScraperEnv,
  createScraperJobEnv,
  ScraperEnvValidationError,
} from "./env.schema.js";

describe("scraper env", () => {
  it.each([
    undefined,
    "",
    " ",
    "images/preview/../",
    "other",
  ])("rejects missing or invalid image prefixes (%s) in both startup modes", (prefix) => {
    const runtimeEnv = {
      BUNNY_IMAGE_FOLDER_PREFIX: prefix,
      DATABASE_URL: "postgres://user:password@example.com:5432/pocket_trash",
      REDIS_URL: "redis://localhost:4008",
      SCRAPER_DRY_RUN: "true",
    };
    expect(() => createScraperEnv(runtimeEnv)).toThrow(
      "Invalid environment variables: BUNNY_IMAGE_FOLDER_PREFIX",
    );
    expect(() => createScraperJobEnv(runtimeEnv)).toThrow(
      "Invalid environment variables: BUNNY_IMAGE_FOLDER_PREFIX",
    );
  });

  it.each([
    "images",
    "images/dev",
    "images/preview",
    "images/preview/pr-119",
  ])("accepts explicitly configured image prefix %s", (prefix) => {
    const runtimeEnv = {
      BUNNY_IMAGE_FOLDER_PREFIX: prefix,
      DATABASE_URL: "postgres://user:password@example.com:5432/pocket_trash",
      REDIS_URL: "redis://localhost:4008",
    };
    expect(createScraperEnv(runtimeEnv).BUNNY_IMAGE_FOLDER_PREFIX).toBe(prefix);
    expect(createScraperJobEnv(runtimeEnv).BUNNY_IMAGE_FOLDER_PREFIX).toBe(
      prefix,
    );
  });

  it("validates scraper environment variables", () => {
    const env = createScraperEnv({
      BUNNY_IMAGE_FOLDER_PREFIX: "images/dev",
      APP_ENV: "preview",
      LOG_DEPLOYMENT_ID: "pocket-trash-pr-27",
      LOG_DEPLOYMENT_TARGET: "railway",
      PORT: "4010",
      RAILWAY_ENVIRONMENT_NAME: "pocket-trash-pr-27",
    });

    expect(env.APP_ENV).toBe("preview");
    expect(env.LOG_DEPLOYMENT_ID).toBe("pocket-trash-pr-27");
    expect(env.LOG_DEPLOYMENT_TARGET).toBe("railway");
    expect(env.PORT).toBe(4010);
    expect(env.RAILWAY_ENVIRONMENT_NAME).toBe("pocket-trash-pr-27");
  });

  it("defaults PORT to 4007", () => {
    const env = createScraperEnv({ BUNNY_IMAGE_FOLDER_PREFIX: "images/dev" });

    expect(env.PORT).toBe(4007);
  });

  it("rejects invalid PORT values", () => {
    expect(() =>
      createScraperEnv({
        BUNNY_IMAGE_FOLDER_PREFIX: "images/dev",
        PORT: "70000",
      }),
    ).toThrow("Invalid environment variables: PORT");
  });

  it("exposes sanitized validation issue details", () => {
    expect(() =>
      createScraperEnv({
        BUNNY_IMAGE_FOLDER_PREFIX: "images/dev",
        PORT: "70000",
      }),
    ).toThrow(ScraperEnvValidationError);

    try {
      createScraperEnv({
        BUNNY_IMAGE_FOLDER_PREFIX: "images/dev",
        PORT: "70000",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ScraperEnvValidationError);
      expect(error).toMatchObject({
        issues: [{ variable: "PORT" }],
        message: "Invalid environment variables: PORT",
        name: "ScraperEnvValidationError",
        variables: ["PORT"],
      });
    }
  });

  it("validates scraper job environment variables", () => {
    const env = createScraperJobEnv({
      APP_ENV: "development",
      BUNNY_STORAGE_ACCESS_KEY: "storage-key",
      BUNNY_STORAGE_ENDPOINT: "https://ny.storage.bunnycdn.com",
      BUNNY_STORAGE_ZONE_NAME: "pocket-trash-storage",
      DATABASE_URL: "postgres://user:password@example.com:5432/pocket_trash",
      BUNNY_CDN_BASE_URL: "https://cdn.pocket-trash.app",
      BUNNY_IMAGE_FOLDER_PREFIX: "images/preview/pr-52",
      REDIS_URL: "redis://localhost:4008",
      GRIMSMO_PROXY_URL: "https://proxy.example.com",

      SCRAPER_DRY_RUN: "true",

      SCRAPER_IMAGE_BATCH_SIZE: "10",
      SCRAPER_ITEM_BATCH_SIZE: "20",

      SCRAPER_QUEUE_CONCURRENCY: "2",
      SCRAPER_CRON_ENABLED: "false",
    });

    expect(env.DATABASE_URL).toBe(
      "postgres://user:password@example.com:5432/pocket_trash",
    );
    expect(env.BUNNY_STORAGE_ACCESS_KEY).toBe("storage-key");
    expect(env.BUNNY_STORAGE_ENDPOINT).toBe("https://ny.storage.bunnycdn.com");
    expect(env.BUNNY_STORAGE_ZONE_NAME).toBe("pocket-trash-storage");
    expect(env.BUNNY_CDN_BASE_URL).toBe("https://cdn.pocket-trash.app");
    expect(env.BUNNY_IMAGE_FOLDER_PREFIX).toBe("images/preview/pr-52");
    expect(env.IMAGE_STORAGE_PROVIDER).toBe("bunny");
    expect(env.REDIS_URL).toBe("redis://localhost:4008");
    expect(env.GRIMSMO_PROXY_URL).toBe("https://proxy.example.com");

    expect(env.SCRAPER_DRY_RUN).toBe(true);

    expect(env.SCRAPER_IMAGE_BATCH_SIZE).toBe(10);
    expect(env.SCRAPER_ITEM_BATCH_SIZE).toBe(20);

    expect(env.SCRAPER_QUEUE_CONCURRENCY).toBe(2);
    expect(env.SCRAPER_CRON_ENABLED).toBe(false);
  });

  it("requires Redis and database URLs for scraper jobs", () => {
    expect(() =>
      createScraperJobEnv({ BUNNY_IMAGE_FOLDER_PREFIX: "images/dev" }),
    ).toThrow("Invalid environment variables: DATABASE_URL, REDIS_URL");
  });

  it("uses REDIS when REDIS_URL is missing", () => {
    const env = createScraperJobEnv({
      BUNNY_IMAGE_FOLDER_PREFIX: "images/dev",
      DATABASE_URL: "postgres://user:password@example.com:5432/pocket_trash",
      REDIS: "redis://localhost:4008",
    });

    expect(env.REDIS_URL).toBe("redis://localhost:4008");
  });

  it("allows overriding the image storage provider", () => {
    const env = createScraperJobEnv({
      BUNNY_IMAGE_FOLDER_PREFIX: "images/dev",
      DATABASE_URL: "postgres://user:password@example.com:5432/pocket_trash",
      IMAGE_STORAGE_PROVIDER: "test-provider",
      REDIS_URL: "redis://localhost:4008",
    });

    expect(env.IMAGE_STORAGE_PROVIDER).toBe("test-provider");
  });

  it("uses REDIS when REDIS_URL is not a resolved Redis URL", () => {
    const env = createScraperJobEnv({
      BUNNY_IMAGE_FOLDER_PREFIX: "images/dev",
      DATABASE_URL: "postgres://user:password@example.com:5432/pocket_trash",
      REDIS: "redis://localhost:4008",
      REDIS_URL: "$" + "{{scraper-queue.REDIS_PUBLIC_URL}}",
    });

    expect(env.REDIS_URL).toBe("redis://localhost:4008");
  });

  it("rejects Redis references that do not resolve to Redis URLs", () => {
    expect(() =>
      createScraperJobEnv({
        BUNNY_IMAGE_FOLDER_PREFIX: "images/dev",
        DATABASE_URL: "postgres://user:password@example.com:5432/pocket_trash",
        REDIS: "$" + "{{shared.REDIS}}",
        REDIS_URL: "$" + "{{scraper-queue.REDIS_PUBLIC_URL}}",
      }),
    ).toThrow("Invalid environment variables: REDIS_URL");
  });

  it("defaults the cron gate for scraper jobs", () => {
    const env = createScraperJobEnv({
      BUNNY_IMAGE_FOLDER_PREFIX: "images/dev",
      DATABASE_URL: "postgres://user:password@example.com:5432/pocket_trash",
      REDIS_URL: "redis://localhost:4008",
    });

    expect(env.SCRAPER_CRON_ENABLED).toBeUndefined();
  });
  it("exposes job controls without inactive scheduler settings", () => {
    const env = createScraperJobEnv({
      BUNNY_IMAGE_FOLDER_PREFIX: "images/dev",
      DATABASE_URL: "postgres://user:password@example.com:5432/pocket_trash",
      REDIS_URL: "redis://localhost:4008",
    });
    expect(
      Object.keys(env).filter((key) =>
        /SCHEDULER|INTERVAL|START_DELAY/u.test(key),
      ),
    ).toEqual([]);
    expect(env.SCRAPER_CRON_ENABLED).toBeUndefined();
    expect(env.SCRAPER_QUEUE_CONCURRENCY).toBe(3);
  });
});
