import { type Logger, loggerMessages } from "@package/logger";
import cronParser from "cron-parser";
import {
  runQueueProcessorJob,
  runSourceProducerJob,
  type ScraperJobContext,
  type ScraperJobEnv,
  scraperSourceKeys,
} from "./jobs.js";
import type { ScraperSourceName } from "./scraper-types.js";

/** Reviewed UTC producer schedules; every source must declare one. */
export const scraperSchedules: Record<ScraperSourceName, string> = {
  autmog: "0 * * * *",
  "grimsmo-fjell": "0 * * * *",
  "grimsmo-norseman": "0 * * * *",
  "grimsmo-rask": "0 * * * *",
  "grimsmo-saga": "0 * * * *",
};

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
 * Runs due source producers sequentially, then processes the queue on every tick.
 * Individual task failures are logged and accumulated so later tasks still run;
 * they do not reject the cron command after its dependencies are initialized.
 *
 * @param options - Job dependencies and optional schedule time.
 * @returns A promise that settles after every source and queue task is attempted.
 * @rejects When the invocation time or any committed schedule is invalid.
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
   * Invocation snapshot used for every schedule decision; defaults to the current time.
   */
  now?: Date;
}) {
  const startedAt = Date.now();
  const snapshot = now.getTime();
  const scheduledAt = new Date(snapshot).toISOString();
  const tickStart = Math.floor(snapshot / 300_000) * 300_000;
  const slots = scraperSourceKeys.map((source) => {
    const schedule = scraperSchedules[source];
    const numeric = schedule.replace(
      /\b(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|SUN|MON|TUE|WED|THU|FRI|SAT)\b/giu,
      "1",
    );
    if (
      schedule.trim().split(/\s+/u).length !== 5 ||
      !/^[\d*,/\-\s]+$/u.test(numeric)
    ) {
      throw new Error(
        `Expected a standard five-field cron schedule for ${source}.`,
      );
    }
    return {
      source,
      schedule,
      latestSlot: cronParser
        .parseExpression(schedule, {
          currentDate: new Date(snapshot + 1),
          tz: "UTC",
        })
        .prev()
        .toDate(),
    };
  });
  const failures: CronTaskFailure[] = [];
  let skippedSources = 0;
  const recoveries: Record<string, unknown>[] = [];

  logger.info(loggerMessages.scraper.cron.started, {
    attributes: {
      imageFolderPrefix: context.imageFolderPrefix,
      scheduledAt,
    },
  });

  for (const { source, schedule, latestSlot } of slots) {
    const attributes: Record<string, unknown> = {
      source,
      task: `scrape:${source}`,
      schedule,
      latestSlot: latestSlot.toISOString(),
      storedSlot: null,
      recoveryReason: "scheduled-slot",
    };
    const attempted = await runCronTask({
      attributes,
      failures,
      logger,
      /**
       * Records due attempts or establishes an uninitialized source's baseline.
       * @returns Whether a producer should run.
       * @rejects When Redis cannot read or remember the attempted slot.
       */
      prepare: async () => {
        const key = `scraper:cron:last-attempted-slot:${source}`;
        const stored = await context.redis.get(key);
        attributes.storedSlot = stored;
        const storedTime = stored === null ? Number.NaN : Date.parse(stored);
        const valid =
          Number.isFinite(storedTime) &&
          stored === new Date(storedTime).toISOString();
        const initialized = valid && storedTime <= snapshot;
        if (!initialized) {
          attributes.recoveryReason =
            stored === null
              ? "missing-state"
              : valid
                ? "future-state"
                : "malformed-state";
          await context.redis.set(key, latestSlot.toISOString());
          recoveries.push({ ...attributes });
          return latestSlot.getTime() >= tickStart;
        }
        if (latestSlot.getTime() <= storedTime) return false;
        if (latestSlot.getTime() < tickStart)
          attributes.recoveryReason = "missed-slot";
        await context.redis.set(key, latestSlot.toISOString());
        return true;
      },
      /**
       * Runs the producer after remembering its calendar slot.
       * @returns Completion of this source's producer.
       */
      run: () => runSourceProducerJob({ context, env, logger, source }),
    });
    if (attempted === false) skippedSources += 1;
  }
  await runQueueProcessor({ context, env, failures, logger });

  const attributes = {
    durationMs: Date.now() - startedAt,
    failedTasks: failures.length,
    skippedSources,
    recoveries,
    scheduledAt,
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
 * @returns False when the task is not due; otherwise completion after its attempt.
 */
async function runCronTask({
  attributes,
  failures,
  logger,
  prepare,
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
  /**
   * Prepares the task and returns false when it is not due.
   * @returns Whether execution should proceed.
   */
  prepare?: () => Promise<boolean>;
}) {
  const startedAt = Date.now();

  try {
    if (prepare && !(await prepare())) return false;
    logger.info(loggerMessages.scraper.cron.taskStarted, { attributes });
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
