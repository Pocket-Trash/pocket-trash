import { serve } from "@hono/node-server";
import { loggerMessages } from "@package/logger";
import {
  createBullMqQueueAdapter,
  createRedisCheckpointStore,
} from "@package/queue";
import { Client, Events } from "discord.js";
import { z } from "zod";
import { createApp, createWebhookIntake } from "./app.js";
import type { AuthorizedInteraction } from "./authorization.js";
import { createAxiomReconciler } from "./axiom-fallback.js";
import { createDiscordBotEnv } from "./env.js";
import {
  assertGatewayDisconnectAllowed,
  discordGatewayIntents,
  registerGatewayReadinessListeners,
} from "./gateway.js";
import { createGitHubWebhookNormalizer } from "./github.js";
import { createLinearApiKeyAuthentication } from "./linear.js";
import { createDiscordBotLogger } from "./logger.js";
import { createLoggerWebhookNormalizer } from "./logger-webhook.js";
import { createDeliveryQueueRuntime } from "./queue.js";
import { createReadiness } from "./readiness.js";
import { createInteractionRegistry } from "./registries.js";
import { renderDiscordNotification } from "./renderer.js";

/** Validated process configuration. */
const env = createDiscordBotEnv(process.env);
/** Process-wide centralized logger. */
const logger = createDiscordBotLogger({
  appEnv: env.APP_ENV,
  axiomDataset: env.AXIOM_DATASET,
  axiomEdgeDomain: env.AXIOM_EDGE_DOMAIN,
  axiomToken: env.AXIOM_TOKEN,
  deploymentId: env.LOG_DEPLOYMENT_ID,
  deploymentTarget: env.LOG_DEPLOYMENT_TARGET,
  loggerMode: env.LOGGER,
  logLevel: env.LOG_LEVEL,
  railwayEnvironmentName: env.RAILWAY_ENVIRONMENT_NAME,
});
/** Discord gateway client. */
const client = new Client({ intents: [...discordGatewayIntents] });
/** Empty command registry populated by later feature tickets. */
const commandRegistry = createInteractionRegistry([]);
/** Empty component registry populated by later feature tickets. */
const componentRegistry = createInteractionRegistry([]);
/** Empty modal registry populated by later feature tickets. */
const modalRegistry = createInteractionRegistry([]);
/** Dedicated Linear bot-member credential boundary. */
const linearAuthentication = createLinearApiKeyAuthentication({
  apiKey: env.LINEAR_API_KEY,
});
/** Shared Redis adapter hidden behind the queue package. */
const queueAdapter = createBullMqQueueAdapter({
  recoverAfterOutage: true,
  /**
   * Records queue lifecycle telemetry.
   *
   * @param event - Structured queue lifecycle event.
   */
  onEvent(event) {
    const log = event.exhausted ? logger.error : logger.info;
    log.call(logger, loggerMessages.discordBot.queueEvent, {
      attributes: event,
    });
  },
  redisUrl: env.REDIS_URL,
});
/** Continuous notification queue. */
const deliveryQueue = createDeliveryQueueRuntime({
  adapter: queueAdapter,
  /**
   * Delivers one normalized notification to its configured Discord channel.
   *
   * @param payload - Validated queue payload.
   * @returns Discord message delivery completion.
   * @rejects When the delivery kind or Discord destination is invalid.
   */
  async deliver(payload) {
    const channel = await client.channels.fetch(payload.destinationChannelId);
    if (!channel?.isSendable()) {
      throw new Error("Configured Discord destination is not sendable.");
    }
    await channel.send(
      renderDiscordNotification({
        ...payload.notification,
        occurredAt: new Date(payload.notification.occurredAt),
      }),
    );
  },
});
/** Health state shared by the HTTP endpoint and runtime lifecycle. */
const readiness = createReadiness(deliveryQueue.counts);
/** Durable cursor scoped to this guild and private intake channel. */
const axiomCursor = createRedisCheckpointStore({
  key: `discord-bot:axiom-cursor:${env.DISCORD_GUILD_ID}:${env.DISCORD_AXIOM_INTAKE_CHANNEL_ID}`,
  redisUrl: env.REDIS_URL,
  schema: z.object({
    messageId: z.string().regex(/^[1-9]\d{16,19}$/u),
    checkedAt: z.number().int().nonnegative(),
  }),
  /** Requests a scan when Redis becomes available again. */
  onReady() {
    if (deliveryQueue.started()) void reconcileAxiom();
  },
});
/** History-based fallback shared by all live and recovery triggers. */
const axiomReconciler = createAxiomReconciler({
  channelId: env.DISCORD_AXIOM_INTAKE_CHANNEL_ID,
  webhookId: new URL(env.AXIOM_INTAKE_WEBHOOK_URL).pathname.split("/")[3] ?? "",
  botUserId: env.DISCORD_APPLICATION_ID,
  destinationChannelId: env.DISCORD_LOGGER_CHANNEL_ID,
  cursor: axiomCursor,
  /**
   * Fetches newest-first pages from the configured private intake only.
   *
   * @param before - Oldest message from the previous page.
   * @returns Source metadata and lazily accessed Discord content.
   * @rejects When the configured channel cannot be read.
   */
  async fetchPage(before) {
    const channel = await client.channels.fetch(
      env.DISCORD_AXIOM_INTAKE_CHANNEL_ID,
    );
    if (!channel?.isTextBased() || !channel.isSendable())
      throw new Error("Invalid Axiom intake channel.");
    const messages = await channel.messages.fetch({
      limit: 100,
      ...(before ? { before } : {}),
    });
    return [...messages.values()].map((message) => ({
      id: message.id,
      channelId: message.channelId,
      webhookId: message.webhookId,
      authorId: message.author.id,
      createdTimestamp: message.createdTimestamp,
      /**
       * Reads source-authorized content.
       * @returns Content after authorization.
       */
      get content() {
        return message.content;
      },
      /**
       * Reads source-authorized embeds.
       * @returns Calibrated embed fields.
       */
      get embeds() {
        return message.embeds;
      },
    }));
  },
  /**
   * Persists fallback and health messages in the existing shared-ID queue.
   *
   * @param id - Stable event or operational notification identity.
   * @param payload - Validated notification envelope.
   * @returns Queue deduplication outcome.
   */
  enqueue: (id, payload) =>
    deliveryQueue.enqueue({ id, name: "axiom-notification", payload }),
});
/** Periodic history scan timer, initialized after gateway and Redis startup. */
let axiomTimer: ReturnType<typeof setInterval> | undefined;
/** Authenticated GitHub webhook intake backed by the delivery queue. */
const githubWebhook = createWebhookIntake({
  /**
   * Persists one normalized GitHub delivery under its stable delivery ID.
   *
   * @param delivery - Authenticated normalized webhook delivery.
   * @returns Queue enqueue disposition.
   */
  enqueue: (delivery) =>
    deliveryQueue.enqueue({
      id: delivery.id,
      name: "github-notification",
      payload: delivery.payload,
    }),
  normalize: createGitHubWebhookNormalizer({
    channelId: env.DISCORD_GITHUB_CHANNEL_ID,
    errorsChannelId: env.DISCORD_GITHUB_ERRORS_CHANNEL_ID,
    secret: env.GITHUB_WEBHOOK_SECRET,
  }),
});
/** App-authenticated direct logger intake backed by the delivery queue. */
const loggerWebhook = createWebhookIntake({
  /**
   * Persists one authenticated logger event under its stable event ID.
   *
   * @param delivery - Authenticated normalized logger delivery.
   * @returns Queue enqueue disposition.
   */
  enqueue: (delivery) =>
    deliveryQueue.enqueue({
      id: delivery.id,
      name: "logger-notification",
      payload: delivery.payload,
    }),
  normalize: createLoggerWebhookNormalizer({
    channelId: env.DISCORD_LOGGER_CHANNEL_ID,
    tokens: {
      api: env.LOGGER_NOTIFICATION_API_TOKEN,
      scraper: env.LOGGER_NOTIFICATION_SCRAPER_TOKEN,
      web: env.LOGGER_NOTIFICATION_WEB_TOKEN,
    },
  }),
});
/** Hono HTTP server used by Railway health checks and authenticated webhooks. */
const server = serve({
  fetch: createApp({
    readiness,
    webhookRoutes: [
      { handle: githubWebhook, path: "/webhooks/github" },
      { handle: loggerWebhook, path: "/webhooks/logger" },
    ],
  }).fetch,
  port: env.PORT,
});
/** Prevents duplicate resource shutdown. */
let shuttingDown = false;

registerGatewayReadinessListeners(client, readiness.setGatewayReady);
client.on(Events.ShardDisconnect, (event) => {
  readiness.setGatewayReady(false);
  try {
    assertGatewayDisconnectAllowed(event.code);
  } catch (error) {
    void fail(error);
  }
});
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isRepliable() || !interaction.inGuild()) return;
  const memberRoleIds = Array.isArray(interaction.member?.roles)
    ? interaction.member.roles
    : [...(interaction.member?.roles.cache.keys() ?? [])];
  const guardedInteraction: AuthorizedInteraction = {
    memberRoleIds,
    /**
     * Sends the role guard response through Discord.
     *
     * @param options - Localized response content and visibility.
     * @returns The Discord interaction response.
     */
    reply: (options) => interaction.reply(options),
  };
  if (interaction.isCommand()) {
    await commandRegistry.dispatch(interaction.commandName, guardedInteraction);
  } else if (interaction.isMessageComponent()) {
    await componentRegistry.dispatch(interaction.customId, guardedInteraction);
  } else if (interaction.isModalSubmit()) {
    await modalRegistry.dispatch(interaction.customId, guardedInteraction);
  }
});
client.on(Events.MessageCreate, (message) => {
  if (message.channelId === env.DISCORD_AXIOM_INTAKE_CHANNEL_ID)
    void reconcileAxiom();
});
client.on(Events.ShardResume, () => void reconcileAxiom());
client.on(Events.ClientReady, () => {
  if (deliveryQueue.started()) void reconcileAxiom();
});

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

void start().catch(fail);

/** Starts the queue worker and Discord gateway. */
async function start() {
  await linearAuthentication.validateAccess();
  await axiomCursor.connect();
  await client.login(env.DISCORD_TOKEN);
  await deliveryQueue.start();
  readiness.setWorkerStarted(true);
  await reconcileAxiom();
  axiomTimer = setInterval(() => void reconcileAxiom(), 5 * 60 * 1_000);
  logger.info(loggerMessages.discordBot.serverListening, {
    attributes: { port: env.PORT },
  });
}

/** Runs a durable history scan and records readiness without crashing gateway callbacks. */
async function reconcileAxiom() {
  if (shuttingDown || !client.isReady() || !deliveryQueue.started()) return;
  try {
    await axiomReconciler.reconcile();
    readiness.setReconcilerStarted(axiomReconciler.started());
  } catch (error) {
    readiness.setReconcilerStarted(false);
    logger.error(loggerMessages.discordBot.axiomReconciliationFailed, {
      error,
    });
  }
}

/**
 * Logs a fatal startup/runtime error and closes resources.
 *
 * @param error - Startup or gateway failure.
 */
async function fail(error: unknown) {
  logger.fatal(loggerMessages.discordBot.serverFailed, { error });
  process.exitCode = 1;
  await shutdown("failure");
}

/**
 * Closes HTTP, gateway, queue/Redis, and logger resources once.
 *
 * @param signal - Shutdown trigger recorded in telemetry.
 */
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  readiness.setGatewayReady(false);
  readiness.setWorkerStarted(false);
  readiness.setReconcilerStarted(false);
  clearInterval(axiomTimer);
  axiomCursor.close();
  logger.info(loggerMessages.discordBot.serverStopping, {
    attributes: { signal },
  });
  await closeServer();
  client.destroy();
  await deliveryQueue.close();
  await logger.flush();
}

/** Closes the Node HTTP server. */
async function closeServer() {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
