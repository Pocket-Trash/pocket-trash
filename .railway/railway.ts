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

  /** Legacy queue retained until the separately approved migration cleanup. */
  const legacyScraperQueue = redis("scraper-queue", {
    region: "us-east4-eqdc4a",
  });
  legacyScraperQueue.deploy = {
    startCommand:
      '/bin/sh -c "rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH"',
  };
  legacyScraperQueue.networking = {
    privateNetworkEndpoint: "redis",
    tcpProxies: { "6379": {} },
  };

  /** Shared Redis queue provisioned additively for the migration. */
  const sharedQueue = redis("pocket-trash-queue", {
    region: "us-east4-eqdc4a",
  });
  sharedQueue.deploy = {
    startCommand:
      '/bin/sh -c "rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --save 60 1 --appendonly yes --appendfsync everysec --dir $RAILWAY_VOLUME_MOUNT_PATH"',
  };
  sharedQueue.networking = {
    privateNetworkEndpoint: "pocket-trash-queue",
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
          "railpack.json",
          "scripts/pnpm-install.sh",
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
        FONTAWESOME_PACKAGE_TOKEN: preserve(),
        LOG_LEVEL: preserve(),
        REDIS_URL: preserve(),
        RAILPACK_INSTALL_CMD:
          "./scripts/pnpm-install.sh --frozen-lockfile --prefer-offline",
        SCRAPER_CRON_ENABLED: preserve(),
        SCRAPER_IMAGE_BATCH_SIZE: preserve(),
        SCRAPER_ITEM_BATCH_SIZE: preserve(),
        SCRAPER_QUEUE_CONCURRENCY: preserve(),
        LOG_DEPLOYMENT_ID: preserve(),
        LOG_DEPLOYMENT_TARGET: preserve(),
      },
    },
  );

  const discordBot = production
    ? service("discord-bot", {
        source: github("Pocket-Trash/pocket-trash"),
        build: {
          builder: "RAILPACK",
          buildCommand:
            "pnpm security:audit && pnpm --filter @app/discord-bot... build",
          watchPatterns: [
            "apps/discord-bot/**",
            "packages/logger/**",
            "packages/queue/**",
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
        start: "pnpm --filter @app/discord-bot start",
        deploy: {
          healthcheckPath: "/health",
          healthcheckTimeout: 30,
          overlapSeconds: 0,
          restartPolicyMaxRetries: 10,
          restartPolicyType: "ON_FAILURE",
        },
        replicas: { "us-east4-eqdc4a": 1 },
        env: {
          APP_ENV: "production",
          AXIOM_DATASET: preserve(),
          AXIOM_EDGE_DOMAIN: preserve(),
          AXIOM_TOKEN: preserve(),
          DISCORD_APPLICATION_ID: preserve(),
          DISCORD_AXIOM_INTAKE_CHANNEL_ID: preserve(),
          DISCORD_AXIOM_INTAKE_WEBHOOK_ID: preserve(),
          DISCORD_BUG_TAG_ID: preserve(),
          DISCORD_FEATURE_REQUEST_TAG_ID: preserve(),
          DISCORD_GITHUB_CHANNEL_ID: preserve(),
          DISCORD_GITHUB_ERRORS_CHANNEL_ID: preserve(),
          DISCORD_GUILD_ID: preserve(),
          DISCORD_LOGGER_CHANNEL_ID: preserve(),
          DISCORD_MODERATOR_ROLE_ID: preserve(),
          DISCORD_OWNER_ROLE_ID: preserve(),
          DISCORD_SUPPORT_FORUM_ID: preserve(),
          DISCORD_TOKEN: preserve(),
          GITHUB_WEBHOOK_SECRET: preserve(),
          LINEAR_API_KEY: preserve(),
          LOGGER: preserve(),
          LOG_DEPLOYMENT_ID: preserve(),
          LOG_DEPLOYMENT_TARGET: preserve(),
          LOG_LEVEL: preserve(),
          RAILWAY_ENVIRONMENT_NAME: preserve(),
          REDIS_URL: sharedQueue.env.REDIS_URL,
        },
      })
    : undefined;

  return project("Pocket Trash", {
    resources: [
      legacyScraperQueue,
      sharedQueue,
      scraper,
      redisVolume,
      ...(discordBot ? [discordBot] : []),
    ],
  });
});
