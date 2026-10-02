import { fileURLToPath } from "node:url";
import { type Logger, loggerMessages } from "@package/logger";
import { runRailwayCronJob, shouldRunRailwayCron } from "./cron.js";
import { readProcessScraperRuntimeEnv } from "./env.js";
import { createScraperJobEnv } from "./env.schema.js";
import {
  createScraperJobContext,
  runAllSourceProducerJobs,
  runQueueDeadLetterProcessorJob,
  runQueueProcessorJob,
  runSourceProducerJob,
  ScraperCommandInterruptedError,
  scraperSourceKeys,
} from "./jobs.js";
import { createScraperLogger } from "./lib/logger.js";
import type { ScraperSourceName } from "./scraper-types.js";

/**
 * Scraper command parsed from process arguments.
 */
type ScraperCommand =
  | {
      /**
       * Railway cron command discriminator.
       */
      type: "cron:run";
    }
  | {
      /**
       * Dead-letter queue command discriminator.
       */
      type: "process:dead-letter";
    }
  | {
      /**
       * Queue-processing command discriminator.
       */
      type: "process:queue";
    }
  | {
      /**
       * Scraper source to enqueue.
       */
      source: ScraperSourceName;
      /**
       * Single-source scrape command discriminator.
       */
      type: "scrape";
    }
  | {
      /**
       * All-source scrape command discriminator.
       */
      type: "scrape:all";
    };

/**
 * Runs the requested scraper CLI command and flushes acquired resources.
 *
 * @rejects When environment validation, resource setup, or the command fails.
 */
async function main() {
  let logger: Logger | undefined;
  let command: ScraperCommand | undefined;
  let context: Awaited<ReturnType<typeof createScraperJobContext>> | undefined;

  try {
    command = parseCommand(process.argv.slice(2));
    const env = createScraperJobEnv(readProcessScraperRuntimeEnv());
    logger = createScraperLogger({
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

    if (command.type === "cron:run" && !shouldRunRailwayCron(env)) {
      logger.info(loggerMessages.scraper.cron.runSkipped, {
        attributes: {
          appEnv: env.APP_ENV,
          cronEnabled: env.SCRAPER_CRON_ENABLED,
          reason: "cron-disabled",
          task: "cron:run",
        },
      });
      return;
    }

    context = await createScraperJobContext(env, logger);

    if (command.type === "cron:run") {
      await runRailwayCronJob({ context, env, logger });
      return;
    }

    if (command.type === "scrape") {
      await runSourceProducerJob({
        context,
        env,
        logger,
        source: command.source,
      });
      return;
    }

    if (command.type === "scrape:all") {
      await runAllSourceProducerJobs({
        context,
        env,
        logger,
      });
      return;
    }

    if (command.type === "process:dead-letter") {
      await runQueueDeadLetterProcessorJob({ context, env, logger });
      return;
    }

    await runQueueProcessorJob({ context, env, logger });
  } catch (error) {
    if (error instanceof ScraperCommandInterruptedError) {
      process.exitCode = 130;
      return;
    }

    logger ??= createScraperLogger({});
    logger.fatal(loggerMessages.scraper.run.failed, {
      attributes: {
        command: command ? formatCommand(command) : undefined,
        commandArgs: process.argv.slice(2).join(" "),
        redis: formatRedisEnvDebugValue(process.env.REDIS),
        redisUrl: formatRedisEnvDebugValue(process.env.REDIS_URL),
      },
      error,
    });
    throw error;
  } finally {
    await context?.close();
    await logger?.flush();
  }
}

/**
 * Parses supported scraper CLI arguments, tolerating the package-runner separator.
 *
 * @param args - Command arguments without the Node executable and script path.
 * @returns The normalized scraper command.
 * @throws When the command or scraper source is unsupported.
 */
export function parseCommand(args: string[]): ScraperCommand {
  const normalizedArgs = args.filter((arg) => arg !== "--");
  const [command, sourceArg] = normalizedArgs;

  if (command === "cron:run") {
    return { type: "cron:run" };
  }

  if (command === "process:queue") {
    return { type: "process:queue" };
  }

  if (command === "process:dead-letter") {
    return { type: "process:dead-letter" };
  }

  if (command === "scrape" && isScraperSourceKey(sourceArg)) {
    return {
      source: sourceArg,
      type: "scrape",
    };
  }

  if (command === "scrape" && sourceArg === undefined) {
    return {
      type: "scrape:all",
    };
  }

  throw new Error(
    `Unknown scraper command "${args.join(" ")}". Expected cron:run, scrape, scrape <source>, process:queue, or process:dead-letter. Supported sources: ${scraperSourceKeys.join(", ")}.`,
  );
}

/**
 * Formats a parsed command for structured diagnostic logging.
 *
 * @param command - Parsed scraper command.
 * @returns The command name, including its source when applicable.
 */
function formatCommand(command: ScraperCommand): string {
  if (
    command.type === "cron:run" ||
    command.type === "process:queue" ||
    command.type === "process:dead-letter" ||
    command.type === "scrape:all"
  ) {
    return command.type;
  }

  return `${command.type}:${command.source}`;
}

/**
 * Summarizes a Redis environment value without exposing URL credentials.
 *
 * @param value - Raw Redis environment value.
 * @returns Presence, length, reference syntax, and a credential-redacted value.
 */
export function formatRedisEnvDebugValue(value: string | undefined) {
  if (value === undefined) {
    return {
      present: false,
    };
  }

  return {
    length: value.length,
    present: true,
    reference: value.startsWith("${{") && value.endsWith("}}"),
    value: redactUrlCredentials(value),
  };
}

/**
 * Redacts username and password fields from a URL-like value.
 *
 * @param value - Potential URL.
 * @returns A serialized URL with redacted credentials, or the original non-URL value.
 */
function redactUrlCredentials(value: string): string {
  try {
    const url = new URL(value);
    if (url.username) {
      url.username = "redacted";
    }
    if (url.password) {
      url.password = "redacted";
    }
    return url.toString();
  } catch {
    return value;
  }
}

/**
 * Checks whether a value names a configured scraper source.
 *
 * @param value - Candidate source name.
 * @returns Whether the value is a supported scraper source key.
 */
function isScraperSourceKey(
  value: string | undefined,
): value is ScraperSourceName {
  return scraperSourceKeys.some((source) => source === value);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main().catch(() => {
    process.exitCode = 1;
  });
}
