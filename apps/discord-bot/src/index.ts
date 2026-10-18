import { serve } from "@hono/node-server";
import { loggerMessages } from "@package/logger";
import { createBullMqQueueAdapter } from "@package/queue";
import { Client, Events } from "discord.js";
import { createApp, createWebhookIntake } from "./app.js";
import type { AuthorizedInteraction } from "./authorization.js";
import { createDiscordBotEnv } from "./env.js";
import {
  assertGatewayDisconnectAllowed,
  discordGatewayIntents,
  registerGatewayReadinessListeners,
} from "./gateway.js";
import { createGitHubWebhookNormalizer } from "./github.js";
import { createLinearApiKeyAuthentication } from "./linear.js";
import { createDiscordBotLogger } from "./logger.js";
import { createDeliveryQueueRuntime } from "./queue.js";
import { createReadiness } from "./readiness.js";
import {
  createInteractionRegistry,
  createMessageRegistry,
} from "./registries.js";
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
/** Empty trusted-message registry populated by the Axiom adapter ticket. */
const messageRegistry = createMessageRegistry([]);
/** Dedicated Linear bot-member credential boundary. */
const linearAuthentication = createLinearApiKeyAuthentication({
  apiKey: env.LINEAR_API_KEY,
});
/** Shared Redis adapter hidden behind the queue package. */
const queueAdapter = createBullMqQueueAdapter({
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
    if (payload.kind !== "github") {
      throw new Error(`Unsupported Discord delivery kind: ${payload.kind}`);
    }
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
/** Hono HTTP server used by Railway health checks and authenticated webhooks. */
const server = serve({
  fetch: createApp({
    readiness,
    webhookRoutes: [{ handle: githubWebhook, path: "/webhooks/github" }],
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
client.on(Events.MessageCreate, async (message) => {
  await messageRegistry.dispatch({
    channelId: message.channelId,
    /**
     * Reads message content only after the source registry accepts its IDs.
     *
     * @returns Discord message content.
     */
    get content() {
      return message.content;
    },
    webhookId: message.webhookId,
  });
});

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

void start().catch(fail);

/** Starts the queue worker and Discord gateway. */
async function start() {
  await linearAuthentication.validateAccess();
  await client.login(env.DISCORD_TOKEN);
  await deliveryQueue.start();
  readiness.setWorkerStarted(true);
  logger.info(loggerMessages.discordBot.serverListening, {
    attributes: { port: env.PORT },
  });
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
