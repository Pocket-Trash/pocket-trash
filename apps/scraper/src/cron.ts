import { type Logger, loggerMessages } from "@package/logger";
import {
  runQueueProcessorJob,
  runSourceProducerJob,
  type ScraperJobContext,
  type ScraperJobEnv,
  scraperSourceKeys,
} from "./jobs.js";

/**
 * Captured failure from one task in a Railway cron run.
 */
type CronTaskFailure = {
  /**
   * Structured task context recorded with the failure.
   */
  attributes: Record<string, unknown>;
  /**
   * Normalized task error.
   */
  error: Error;
};

/**
 * Runs every configured source producer sequentially, then processes the queue.
 * Individual task failures are logged and accumulated so later tasks still run;
 * they do not reject the cron command after its dependencies are initialized.
 *
 * @param options - Job dependencies and optional schedule time.
 * @returns A promise that settles after every source and queue task is attempted.
 */
export async function runRailwayCronJob({
  context,
  env,
  logger,
  now = new Date(),
}: {
  /**
   * Shared scraper resources.
   */
  context: ScraperJobContext;
  /**
   * Validated scraper job configuration.
   */
  env: ScraperJobEnv;
  /**
   * Logger for run and task lifecycle events.
   */
  logger: Logger;
  /**
   * Scheduled time recorded in logs; defaults to the current time.
   */
  now?: Date;
}) {
  const startedAt = Date.now();
  const failures: CronTaskFailure[] = [];

  logger.info(loggerMessages.scraper.cron.started, {
    attributes: {
      imageFolderPrefix: context.imageFolderPrefix,
      scheduledAt: now.toISOString(),
    },
  });

  for (const source of scraperSourceKeys) {
    await runCronTask({
      attributes: {
        source,
        task: `scrape:${source}`,
      },
      failures,
      logger,
      /**
       * Runs the producer for the current source.
       *
       * @returns A promise that settles after the source producer finishes.
       */
      run: () => runSourceProducerJob({ context, env, logger, source }),
    });
  }
  await runQueueProcessor({ context, env, failures, logger });

  const attributes = {
    durationMs: Date.now() - startedAt,
    failedTasks: failures.length,
    scheduledAt: now.toISOString(),
  };

  if (failures.length > 0) {
    logger.error(loggerMessages.scraper.cron.failed, {
      attributes: {
        ...attributes,
        failures: failures.map(formatCronTaskFailure),
      },
      error: new AggregateError(
        failures.map((failure) => failure.error),
        "Railway cron run failed.",
      ),
    });
    return;
  }

  logger.info(loggerMessages.scraper.cron.completed, {
    attributes,
  });
}

/**
 * Resolves whether Railway cron should run in the current environment.
 *
 * @param env - Application environment and optional explicit cron override.
 * @returns The override when supplied; otherwise `false` only for previews.
 */
export function shouldRunRailwayCron(
  env: Pick<ScraperJobEnv, "APP_ENV" | "SCRAPER_CRON_ENABLED">,
): boolean {
  if (env.SCRAPER_CRON_ENABLED !== undefined) {
    return env.SCRAPER_CRON_ENABLED;
  }

  return env.APP_ENV !== "preview";
}

/**
 * Runs queue processing as one captured cron task.
 *
 * @param options - Shared resources, configuration, logger, and failure accumulator.
 */
async function runQueueProcessor({
  context,
  env,
  failures,
  logger,
}: {
  /**
   * Shared scraper resources.
   */
  context: ScraperJobContext;
  /**
   * Validated scraper job configuration.
   */
  env: ScraperJobEnv;
  /**
   * Mutable failure accumulator for the cron run.
   */
  failures: CronTaskFailure[];
  /**
   * Logger for task lifecycle events.
   */
  logger: Logger;
}) {
  await runCronTask({
    attributes: {
      task: "process:queue",
    },
    failures,
    logger,
    /**
     * Runs one queue-processing pass.
     *
     * @returns A promise that settles after queue processing finishes.
     */
    run: () => runQueueProcessorJob({ context, env, logger }),
  });
}

/**
 * Runs and logs one cron task without aborting the remaining cron run on failure.
 *
 * @param options - Task callback, log attributes, logger, and failure accumulator.
 */
async function runCronTask({
  attributes,
  failures,
  logger,
  run,
}: {
  /**
   * Structured context attached to task logs.
   */
  attributes: Record<string, unknown>;
  /**
   * Mutable accumulator that receives normalized failures.
   */
  failures: CronTaskFailure[];
  /**
   * Logger for task lifecycle events.
   */
  logger: Logger;
  /**
   * Executes the cron task.
   *
   * @returns A promise that settles when the task finishes.
   */
  run: () => Promise<void>;
}) {
  const startedAt = Date.now();

  logger.info(loggerMessages.scraper.cron.taskStarted, {
    attributes,
  });

  try {
    await run();
    logger.info(loggerMessages.scraper.cron.taskCompleted, {
      attributes: {
        ...attributes,
        durationMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    const normalizedError =
      error instanceof Error ? error : new Error(String(error));

    const failureAttributes = {
      ...attributes,
      durationMs: Date.now() - startedAt,
    };

    failures.push({
      attributes: failureAttributes,
      error: normalizedError,
    });
    logger.error(loggerMessages.scraper.cron.taskFailed, {
      attributes: failureAttributes,
      error: normalizedError,
    });
  }
}

/**
 * Formats a captured task failure for aggregate cron log attributes.
 *
 * @param options - Captured task attributes and error.
 * @returns Selected task fields and a serializable error chain.
 */
function formatCronTaskFailure({ attributes, error }: CronTaskFailure) {
  return {
    command: getStringAttribute(attributes, "command"),
    durationMs: getNumberAttribute(attributes, "durationMs"),
    error: formatErrorForAttributes(error),
    jobType: getStringAttribute(attributes, "jobType"),
    source: getStringAttribute(attributes, "source"),
    task: getStringAttribute(attributes, "task"),
  };
}

/**
 * Converts an error and its causes into serializable log attributes.
 *
 * @param error - Error-like value to serialize.
 * @returns Error name, message, and recursively formatted cause.
 */
function formatErrorForAttributes(error: unknown): {
  /**
   * Recursively formatted error cause.
   */
  cause?: ReturnType<typeof formatErrorForAttributes>;
  /**
   * Error message.
   */
  message: string;
  /**
   * Error class name.
   */
  name: string;
} {
  if (!(error instanceof Error)) {
    return {
      message: String(error),
      name: "Error",
    };
  }

  return {
    ...(error.cause === undefined
      ? {}
      : { cause: formatErrorForAttributes(error.cause) }),
    message: error.message,
    name: error.name,
  };
}

/**
 * Reads a numeric field from structured task attributes.
 *
 * @param attributes - Structured task attributes.
 * @param key - Field to read.
 * @returns The numeric value, or `undefined` when the field is not numeric.
 */
function getNumberAttribute(
  attributes: Record<string, unknown>,
  key: string,
): number | undefined {
  return typeof attributes[key] === "number" ? attributes[key] : undefined;
}

/**
 * Reads a string field from structured task attributes.
 *
 * @param attributes - Structured task attributes.
 * @param key - Field to read.
 * @returns The string value, or `undefined` when the field is not text.
 */
function getStringAttribute(
  attributes: Record<string, unknown>,
  key: string,
): string | undefined {
  return typeof attributes[key] === "string" ? attributes[key] : undefined;
}
