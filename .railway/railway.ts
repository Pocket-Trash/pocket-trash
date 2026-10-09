import {
  defineRailway,
  github,
  preserve,
  project,
  redis,
  service,
  volume,
} from "railway/iac";

export default defineRailway((ctx) => {
  if (ctx.projectName !== "Pocket Trash") {
    throw new Error(
      "Link the Pocket Trash project before planning its infrastructure.",
    );
  }
  /** Whether the linked environment uses the production scraper service. */
  const production = ctx.environment === "production";
  if (!production && ctx.environment !== "preview") {
    throw new Error(
      "Link production or the preview template; native PR environments inherit its settings.",
    );
  }

  /** Existing Redis queue; its credentials and managed image remain in Railway. */
  const scraperQueue = redis("scraper-queue", { region: "us-east4-eqdc4a" });
  scraperQueue.deploy = {
    startCommand:
      '/bin/sh -c "rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH"',
  };
  scraperQueue.networking = {
    privateNetworkEndpoint: "redis",
    tcpProxies: { "6379": {} },
  };
  /** Existing database volume, retained without resizing or changing its mount. */
  const redisVolume = volume("redis-volume", {
    alerts: { usage: { "100": {}, "80": {}, "95": {} } },
    allowOnlineResize: true,
    region: "us-east4-eqdc4a",
    sizeMB: 5000,
  });
  /** Scraper service settings shared by production and native PR environments. */
  const scraper = service(
    production ? "pocket-trash" : "pocket-trash (preview)",
    {
      source: github(
        "Pocket-Trash/pocket-trash",
        production ? {} : { checkSuites: false },
      ),
      build: {
        builder: "RAILPACK",
        buildCommand:
          "pnpm security:audit && pnpm --filter @app/scraper... build",
        watchPatterns: [
          "apps/scraper/**",
          "packages/**",
          "package.json",
          "pnpm-lock.yaml",
          "pnpm-workspace.yaml",
          "patches/**",
          ".railway/**",
          ".railwayignore",
          "scripts/security-audit.mjs",
          "security-audit-exceptions.json",
          "turbo.json",
        ],
      },
      start: "pnpm --filter @app/scraper run cron:run",
      deploy: { cronSchedule: "*/5 * * * *", restartPolicyType: "NEVER" },
      replicas: { "us-east4-eqdc4a": 1 },
      networking: {
        privateNetworkEndpoint: production ? "precious-smile" : "field-log",
      },
      env: {
        APP_ENV: preserve(),
        AXIOM_DATASET: preserve(),
        AXIOM_TOKEN: preserve(),
        BUNNY_CDN_BASE_URL: preserve(),
        BUNNY_IMAGE_FOLDER_PREFIX: preserve(),
        BUNNY_STORAGE_ACCESS_KEY: preserve(),
        BUNNY_STORAGE_ENDPOINT: preserve(),
        BUNNY_STORAGE_ZONE_NAME: preserve(),
        DATABASE_URL: preserve(),
        IMAGE_CDN_BASE_URL: preserve(),
        IMAGE_FOLDER_PREFIX: preserve(),
        IMAGE_KIT_PRIVATE_KEY: preserve(),
        IMAGE_KIT_PUBLIC_KEY: preserve(),
        IMAGE_KIT_URL_ENDPOINT: preserve(),
        LOG_LEVEL: preserve(),
        REDIS_URL: preserve(),
        SCRAPER_CRON_ENABLED: preserve(),
        SCRAPER_IMAGE_BATCH_SIZE: preserve(),
        SCRAPER_ITEM_BATCH_SIZE: preserve(),
        SCRAPER_QUEUE_CONCURRENCY: preserve(),
        LOG_DEPLOYMENT_ID: preserve(),
        LOG_DEPLOYMENT_TARGET: preserve(),
        IMAGE_KIT_FOLDER_PREFIX: preserve(),
        REDIS: preserve(),
      },
    },
  );

  return project("Pocket Trash", {
    resources: [scraperQueue, scraper, redisVolume],
  });
});
