import { randomUUID } from "node:crypto";
import { type Logger, loggerMessages } from "@package/logger";
import {
  createScraperJobContext,
  runAutmogProducerJob,
  runGrimsmoProducerJob,
  runQueueProcessorJob,
  type ScraperJobContext,
  type ScraperJobEnv,
} from "./jobs.js";
import { scraperSources } from "./scraper-types.js";

/**
 * Mutable schedule and distributed-lock settings for one recurring task.
 */
type ScheduledTask = {
  /**
   * Delay in milliseconds between completed task attempts.
   */
  intervalMs: number;
  /**
   * Redis key that prevents concurrent task execution across replicas.
   */
  lockKey: string;
  /**
   * Redis lock lifetime in milliseconds.
   */
  lockTtlMs: number;
  /**
   * Stable task name used in logs.
   */
  name: string;
  /**
   * Runs the scheduled task once.
   *
   * @returns A promise that settles when the task finishes.
   */
  run: () => Promise<void>;
  /**
   * Delay in milliseconds before the first task attempt.
   */
  startDelayMs: number;
  /**
   * Pending timeout for the next task attempt.
   */
  timer?: ReturnType<typeof setTimeout>;
};

/**
 * Handle for stopping the in-process scraper scheduler.
 */
export type ScraperScheduler = {
  /**
   * Stops scheduled tasks and releases scheduler resources.
   *
   * @returns A promise that settles after shutdown completes.
   */
  stop: () => Promise<void>;
};

/**
 * Number of milliseconds in one second.
 */
const millisecondsPerSecond = 1_000;
/**
 * Number of milliseconds in one minute.
 */
const millisecondsPerMinute = 60 * millisecondsPerSecond;

/**
 * Starts recurring producer and queue tasks with cross-replica Redis locks.
 *
 * @param options - Validated schedule configuration and logger.
 * @returns A handle that cancels timers and closes shared job resources.
 */
export async function startScraperScheduler({
  env,
  logger,
}: {
  /**
   * Validated job and scheduling configuration.
   */
  env: ScraperJobEnv;
  /**
   * Logger for scheduler and task lifecycle events.
   */
  logger: Logger;
}): Promise<ScraperScheduler> {
  const context = await createScraperJobContext(env, logger);
  const tasks: ScheduledTask[] = [
    {
      intervalMs: env.SCRAPER_AUTMOG_INTERVAL_MINUTES * millisecondsPerMinute,
      lockKey: `scraper:scheduler:${scraperSources.autmog}`,
      lockTtlMs:
        env.SCRAPER_AUTMOG_INTERVAL_MINUTES * millisecondsPerMinute * 2,
      name: scraperSources.autmog,
      /**
       * Runs the Autmog producer.
       *
       * @returns A promise that settles after the producer finishes.
       */
      run: () => runAutmogProducerJob({ context, logger }),
      startDelayMs:
        env.SCRAPER_AUTMOG_START_DELAY_SECONDS * millisecondsPerSecond,
    },
    {
      intervalMs: env.SCRAPER_GRIMSMO_INTERVAL_MINUTES * millisecondsPerMinute,
      lockKey: `scraper:scheduler:${scraperSources.grimsmoSaga}`,
      lockTtlMs:
        env.SCRAPER_GRIMSMO_INTERVAL_MINUTES * millisecondsPerMinute * 2,
      name: scraperSources.grimsmoSaga,
      /**
       * Runs the Grimsmo Saga producer.
       *
       * @returns A promise that settles after the producer finishes.
       */
      run: () =>
        runGrimsmoProducerJob({
          context,
          logger,
          proxyUrl: env.GRIMSMO_PROXY_URL,
          source: scraperSources.grimsmoSaga,
        }),
      startDelayMs:
        env.SCRAPER_GRIMSMO_SAGA_START_DELAY_SECONDS * millisecondsPerSecond,
    },
    {
      intervalMs: env.SCRAPER_GRIMSMO_INTERVAL_MINUTES * millisecondsPerMinute,
      lockKey: `scraper:scheduler:${scraperSources.grimsmoRask}`,
      lockTtlMs:
        env.SCRAPER_GRIMSMO_INTERVAL_MINUTES * millisecondsPerMinute * 2,
      name: scraperSources.grimsmoRask,
      /**
       * Runs the Grimsmo Rask producer.
       *
       * @returns A promise that settles after the producer finishes.
       */
      run: () =>
        runGrimsmoProducerJob({
          context,
          logger,
          proxyUrl: env.GRIMSMO_PROXY_URL,
          source: scraperSources.grimsmoRask,
        }),
      startDelayMs:
        env.SCRAPER_GRIMSMO_RASK_START_DELAY_SECONDS * millisecondsPerSecond,
    },
    {
      intervalMs: env.SCRAPER_GRIMSMO_INTERVAL_MINUTES * millisecondsPerMinute,
      lockKey: `scraper:scheduler:${scraperSources.grimsmoFjell}`,
      lockTtlMs:
        env.SCRAPER_GRIMSMO_INTERVAL_MINUTES * millisecondsPerMinute * 2,
      name: scraperSources.grimsmoFjell,
      /**
       * Runs the Grimsmo Fjell producer.
       *
       * @returns A promise that settles after the producer finishes.
       */
      run: () =>
        runGrimsmoProducerJob({
          context,
          logger,
          proxyUrl: env.GRIMSMO_PROXY_URL,
          source: scraperSources.grimsmoFjell,
        }),
      startDelayMs:
        env.SCRAPER_GRIMSMO_FJELL_START_DELAY_SECONDS * millisecondsPerSecond,
    },
    {
      intervalMs: env.SCRAPER_GRIMSMO_INTERVAL_MINUTES * millisecondsPerMinute,
      lockKey: `scraper:scheduler:${scraperSources.grimsmoNorseman}`,
      lockTtlMs:
        env.SCRAPER_GRIMSMO_INTERVAL_MINUTES * millisecondsPerMinute * 2,
      name: scraperSources.grimsmoNorseman,
      /**
       * Runs the Grimsmo Norseman producer.
       *
       * @returns A promise that settles after the producer finishes.
       */
      run: () =>
        runGrimsmoProducerJob({
          context,
          logger,
          proxyUrl: env.GRIMSMO_PROXY_URL,
          source: scraperSources.grimsmoNorseman,
        }),
      startDelayMs:
        env.SCRAPER_GRIMSMO_NORSEMAN_START_DELAY_SECONDS *
        millisecondsPerSecond,
    },
    {
      intervalMs:
        env.SCRAPER_QUEUE_PROCESSOR_INTERVAL_MINUTES * millisecondsPerMinute,
      lockKey: "scraper:scheduler:queue-processor",
      lockTtlMs:
        env.SCRAPER_QUEUE_PROCESSOR_INTERVAL_MINUTES *
        millisecondsPerMinute *
        2,
      name: "queue-processor",
      /**
       * Runs one queue-processing pass.
       *
       * @returns A promise that settles after queue processing finishes.
       */
      run: () => runQueueProcessorJob({ context, env, logger }),
      startDelayMs:
        env.SCRAPER_QUEUE_PROCESSOR_START_DELAY_SECONDS * millisecondsPerSecond,
    },
  ];
  let stopped = false;

  logger.info(loggerMessages.scraper.scheduler.started, {
    attributes: {
      autmogIntervalMinutes: env.SCRAPER_AUTMOG_INTERVAL_MINUTES,
      autmogStartDelaySeconds: env.SCRAPER_AUTMOG_START_DELAY_SECONDS,
      grimsmoFjellStartDelaySeconds:
        env.SCRAPER_GRIMSMO_FJELL_START_DELAY_SECONDS,
      grimsmoIntervalMinutes: env.SCRAPER_GRIMSMO_INTERVAL_MINUTES,
      grimsmoNorsemanStartDelaySeconds:
        env.SCRAPER_GRIMSMO_NORSEMAN_START_DELAY_SECONDS,
      grimsmoRaskStartDelaySeconds:
        env.SCRAPER_GRIMSMO_RASK_START_DELAY_SECONDS,
      grimsmoSagaStartDelaySeconds:
        env.SCRAPER_GRIMSMO_SAGA_START_DELAY_SECONDS,
      queueProcessorIntervalMinutes:
        env.SCRAPER_QUEUE_PROCESSOR_INTERVAL_MINUTES,
      queueProcessorStartDelaySeconds:
        env.SCRAPER_QUEUE_PROCESSOR_START_DELAY_SECONDS,
    },
  });

  for (const task of tasks) {
    scheduleNext(task, task.startDelayMs);
  }

  return {
    /**
     * Cancels future task attempts and closes shared job resources.
     *
     * @returns A promise that settles after scheduler shutdown completes.
     */
    async stop() {
      stopped = true;

      for (const task of tasks) {
        if (task.timer) {
          clearTimeout(task.timer);
        }
      }

      await context.close();
      logger.info(loggerMessages.scraper.scheduler.stopped);
    },
  };

  /**
   * Schedules one task attempt unless the scheduler has stopped.
   *
   * @param task - Mutable scheduled task.
   * @param delayMs - Delay before the attempt in milliseconds.
   */
  function scheduleNext(task: ScheduledTask, delayMs = task.intervalMs) {
    if (stopped) {
      return;
    }

    task.timer = setTimeout(() => {
      void runScheduledTask({ context, logger, task })
        .catch(() => undefined)
        .finally(() => scheduleNext(task));
    }, delayMs);
  }
}

/**
 * Runs one scheduled task under its distributed lock and logs failures.
 *
 * @param options - Shared resources, logger, and task definition.
 */
async function runScheduledTask({
  context,
  logger,
  task,
}: {
  /**
   * Shared job resources containing the Redis connection.
   */
  context: ScraperJobContext;
  /**
   * Logger for lock and task lifecycle events.
   */
  logger: Logger;
  /**
   * Task definition to execute.
   */
  task: ScheduledTask;
}) {
  const startedAt = Date.now();

  try {
    await withRedisLock({
      context,
      logger,
      lockKey: task.lockKey,
      lockTtlMs: task.lockTtlMs,
      taskName: task.name,
      /**
       * Runs and logs the scheduled task body.
       *
       * @returns A promise that settles after the task finishes.
       */
      run: async () => {
        logger.info(loggerMessages.scraper.scheduler.taskStarted, {
          attributes: {
            task: task.name,
          },
        });

        await task.run();
        logger.info(loggerMessages.scraper.scheduler.taskCompleted, {
          attributes: {
            durationMs: Date.now() - startedAt,
            task: task.name,
          },
        });
      },
    });
  } catch (error) {
    logger.error(loggerMessages.scraper.scheduler.taskFailed, {
      attributes: {
        durationMs: Date.now() - startedAt,
        task: task.name,
      },
      error,
    });
  }
}

/**
 * Runs a task only after acquiring its expiring Redis lock.
 * The lock is released only when its random ownership token still matches.
 *
 * @param options - Lock settings, task callback, logger, and Redis context.
 */
async function withRedisLock({
  context,
  logger,
  lockKey,
  lockTtlMs,
  run,
  taskName,
}: {
  /**
   * Shared job resources containing the Redis connection.
   */
  context: ScraperJobContext;
  /**
   * Logger used when another replica owns the lock.
   */
  logger: Logger;
  /**
   * Redis key used for mutual exclusion.
   */
  lockKey: string;
  /**
   * Lock lifetime in milliseconds.
   */
  lockTtlMs: number;
  /**
   * Runs the task while the distributed lock is held.
   *
   * @returns A promise that settles when the task finishes.
   */
  run: () => Promise<void>;
  /**
   * Task name recorded when lock acquisition is skipped.
   */
  taskName: string;
}) {
  const token = randomUUID();
  const acquired = await context.redis.set(
    lockKey,
    token,
    "PX",
    lockTtlMs,
    "NX",
  );

  if (acquired !== "OK") {
    logger.info(loggerMessages.scraper.scheduler.lockSkipped, {
      attributes: {
        lockKey,
        task: taskName,
      },
    });
    return;
  }

  try {
    await run();
  } finally {
    await context.redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      lockKey,
      token,
    );
  }
}
