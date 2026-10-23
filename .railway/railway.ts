import {
  database,
  defineRailway,
  github,
  preserve,
  project,
  service,
} from "railway/iac";
import { resolveRailwayContext } from "./context.ts";

export default defineRailway((ctx) => {
  // Env-var targeting omits names; resolve them with the scoped workspace token.
  const resolved =
    ctx.projectId && ctx.environmentId && ctx.projectName !== "Pocket Trash"
      ? resolveRailwayContext(ctx.projectId, ctx.environmentId)
      : undefined;
  if ((resolved?.projectName ?? ctx.projectName) !== "Pocket Trash") {
    throw new Error(
      "Link the Pocket Trash project before planning its infrastructure.",
    );
  }
  /** Whether the linked environment uses the production scraper service. */
  const environment = resolved?.environmentName ?? ctx.environment;
  const production = environment === "production";
  if (!production && environment !== "preview") {
    throw new Error(
      "Link production or the preview template; native PR environments inherit its settings.",
    );
  }

  /** Shared Redis queue for scraper and Discord state in each environment. */
  const sharedQueue = database("pocket-trash-queue", "redis", {
    image: "redis:8.2",
    defaultMountPath: "/data",
    region: "us-east4-eqdc4a",
  });
  sharedQueue.deploy = {
    startCommand:
      '/bin/sh -c \'chown redis:redis "${RAILWAY_VOLUME_MOUNT_PATH:?Persistent volume is required}" && cd "$RAILWAY_VOLUME_MOUNT_PATH" && exec docker-entrypoint.sh redis-server --requirepass "${REDIS_PASSWORD:?REDIS_PASSWORD is required}" --save 60 1 --appendonly yes --appendfsync everysec --dir "$RAILWAY_VOLUME_MOUNT_PATH"\'',
  };
  sharedQueue.variables = {
    REDIS_PASSWORD: preserve(),
    REDIS_URL: {
      type: "literal",
      value:
        "redis://default:${{REDIS_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:6379",
    },
    REDIS_PUBLIC_URL: {
      type: "literal",
      value:
        "redis://default:${{REDIS_PASSWORD}}@${{RAILWAY_TCP_PROXY_DOMAIN}}:${{RAILWAY_TCP_PROXY_PORT}}",
    },
    REDISHOST: preserve(),
    REDISPASSWORD: preserve(),
    REDISPORT: preserve(),
    REDISUSER: preserve(),
  };
  sharedQueue.networking = {
    tcpProxies: { "6379": {} },
  };
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
        ASSET_FOLDER_PREFIX: preserve(),
        AXIOM_DATASET: preserve(),
        AXIOM_TOKEN: preserve(),
        BUNNY_CDN_BASE_URL: preserve(),
        BUNNY_IMAGE_FOLDER_PREFIX: preserve(),
        BUNNY_ASSET_FOLDER_PREFIX: preserve(),
        BUNNY_PULL_ZONE_ID: preserve(),
        BUNNY_RESOURCE_FOLDER_PREFIX: preserve(),
        BUNNY_STORAGE_ACCESS_KEY: preserve(),
        BUNNY_STORAGE_ENDPOINT: preserve(),
        BUNNY_STORAGE_ZONE_NAME: preserve(),
        DATABASE_URL: preserve(),
        FONTAWESOME_PACKAGE_TOKEN: preserve(),
        LOG_LEVEL: preserve(),
        LOGGER_NOTIFICATION_TOKEN: preserve(),
        LOGGER_NOTIFICATION_URL: preserve(),
        REDIS_URL: sharedQueue.env.REDIS_URL,
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
        },
        replicas: { "us-east4-eqdc4a": 1 },
        env: {
          APP_ENV: "production",
          AXIOM_DATASET: preserve(),
          AXIOM_EDGE_DOMAIN: preserve(),
          AXIOM_INTAKE_WEBHOOK_URL: preserve(),
          AXIOM_TOKEN: preserve(),
          CHEAPERINFERENCE_API_KEY: preserve(),
          DISCORD_APPLICATION_ID: preserve(),
          DISCORD_AXIOM_INTAKE_CHANNEL_ID: preserve(),
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
          FONTAWESOME_PACKAGE_TOKEN: scraper.env.FONTAWESOME_PACKAGE_TOKEN,
          GITHUB_WEBHOOK_SECRET: preserve(),
          LINEAR_API_KEY: preserve(),
          LOGGER_NOTIFICATION_API_TOKEN: preserve(),
          LOGGER_NOTIFICATION_SCRAPER_TOKEN: preserve(),
          LOGGER_NOTIFICATION_WEB_TOKEN: preserve(),
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
    resources: [sharedQueue, scraper, ...(discordBot ? [discordBot] : [])],
  });
});
