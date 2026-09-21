import { type Logger, loggerMessages } from "@package/logger";
import {
  runQueueProcessorJob,
  runSourceProducerJob,
  type ScraperJobContext,
  type ScraperJobEnv,
  scraperSourceKeys,
} from "./jobs.js";

type CronTaskFailure = {
  attributes: Record<string, unknown>;
  error: Error;
};

export async function runRailwayCronJob({
  context,
  env,
  logger,
  now = new Date(),
}: {
  context: ScraperJobContext;
  env: ScraperJobEnv;
  logger: Logger;
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

export function shouldRunRailwayCron(
  env: Pick<ScraperJobEnv, "APP_ENV" | "SCRAPER_CRON_ENABLED">,
): boolean {
  if (env.SCRAPER_CRON_ENABLED !== undefined) {
    return env.SCRAPER_CRON_ENABLED;
  }

  return env.APP_ENV !== "preview";
}

async function runQueueProcessor({
  context,
  env,
  failures,
  logger,
}: {
  context: ScraperJobContext;
  env: ScraperJobEnv;
  failures: CronTaskFailure[];
  logger: Logger;
}) {
  await runCronTask({
    attributes: {
      task: "process:queue",
    },
    failures,
    logger,
    run: () => runQueueProcessorJob({ context, env, logger }),
  });
}

async function runCronTask({
  attributes,
  failures,
  logger,
  run,
}: {
  attributes: Record<string, unknown>;
  failures: CronTaskFailure[];
  logger: Logger;
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

function formatErrorForAttributes(error: unknown): {
  cause?: ReturnType<typeof formatErrorForAttributes>;
  message: string;
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

function getNumberAttribute(
  attributes: Record<string, unknown>,
  key: string,
): number | undefined {
  return typeof attributes[key] === "number" ? attributes[key] : undefined;
}

function getStringAttribute(
  attributes: Record<string, unknown>,
  key: string,
): string | undefined {
  return typeof attributes[key] === "string" ? attributes[key] : undefined;
}
