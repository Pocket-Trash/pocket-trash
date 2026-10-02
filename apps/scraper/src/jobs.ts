import type { Database } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import { createServices, type ImagesService } from "@package/services";
import { runAutmogProducer } from "./autmog/producer.js";
import {
  createScraperDb,
  finishScraperRun,
  startScraperRun,
} from "./db/autmog.js";
import type { createScraperJobEnv } from "./env.schema.js";
import { runGrimsmoProducer } from "./grimsmo/producer.js";
import {
  runQueueDeadLetterProcessor,
  runQueueProcessor,
} from "./queue/processor.js";
import {
  createScraperQueues,
  getScraperQueueJobCounts,
  hasActionableQueueJobs,
  type ScraperQueues,
} from "./queue/queues.js";
import { createRedisConnection } from "./queue/redis.js";
import {
  type GrimsmoSourceName,
  type ScraperSourceName,
  scraperSources,
} from "./scraper-types.js";
import { getSourceScrapeLimit } from "./source-limit.js";

/**
 * Validated environment consumed by scraper job commands.
 */
export type ScraperJobEnv = ReturnType<typeof createScraperJobEnv>;

/**
 * Configured scraper source names in declaration order.
 */
export const scraperSourceKeys = Object.values(scraperSources);

/**
 * Shared database, queue, Redis, and image resources for scraper jobs.
 */
export type ScraperJobContext = {
  /**
   * Releases the scraper job's shared resources.
   *
   * @returns A promise that settles after cleanup completes.
   */
  close: () => Promise<void>;
  /**
   * Database connection used by producers and processors.
   */
  db: Database;
  /**
   * Deployment-scoped object prefix for stored images.
   */
  imageFolderPrefix: string;
  /**
   * Configured image-storage service.
   */
  imageStorage: ImagesService;
  /**
   * Redis connection shared with BullMQ.
   */
  redis: ReturnType<typeof createRedisConnection>;
  /**
   * Scraper item and image queues.
   */
  queues: ScraperQueues;
};

/**
 * Signals that a scraper command stopped because the process was interrupted.
 */
export class ScraperCommandInterruptedError extends Error {
  /**
   * Process signal that interrupted the command.
   */
  readonly signal: NodeJS.Signals;

  /**
   * Creates an interruption error for a process signal.
   *
   * @param signal - Received process signal.
   */
  constructor(signal: NodeJS.Signals) {
    super(`Scraper command interrupted by ${signal}.`);
    this.name = "ScraperCommandInterruptedError";
    this.signal = signal;
  }
}

/**
 * Creates and verifies shared resources for scraper job commands. Shared
 * services own image storage only; scraper database and queue access remain
 * scraper-specific.
 *
 * @param env - Validated scraper job configuration.
 * @param logger - Logger supplied to shared services.
 * @returns Connected database, Redis, queue, and image resources with cleanup.
 * @rejects When Redis cannot be reached.
 */
export async function createScraperJobContext(
  env: ScraperJobEnv,
  logger: Logger,
): Promise<ScraperJobContext> {
  const services = createServices();
  services.configure({
    images: {
      accessKey: env.BUNNY_STORAGE_ACCESS_KEY,
      endpoint: env.BUNNY_STORAGE_ENDPOINT,
      zoneName: env.BUNNY_STORAGE_ZONE_NAME,
      cdnBaseUrl: env.BUNNY_CDN_BASE_URL,
      dryRun: env.SCRAPER_DRY_RUN,
      provider: env.IMAGE_STORAGE_PROVIDER,
    },
    logger,
  });
  const db = createScraperDb(env.DATABASE_URL);
  const redis = createRedisConnection(env.REDIS_URL);

  try {
    await redis.ping();
  } catch (error) {
    redis.disconnect();
    throw new Error("Failed to connect to Redis.", {
      cause: error,
    });
  }

  const queues = createScraperQueues(redis);

  return {
    /**
     * Closes BullMQ queues and disconnects Redis.
     *
     * @returns A promise that settles after queue connections close.
     */
    async close() {
      await queues.close();
      redis.disconnect();
    },
    db,
    imageFolderPrefix: env.BUNNY_IMAGE_FOLDER_PREFIX,
    imageStorage: services.images,
    queues,
    redis,
  };
}

/**
 * Runs the Autmog producer as a tracked scraper run.
 *
 * @param options - Shared resources, optional environment, and logger.
 */
export async function runAutmogProducerJob({
  context,
  env,
  logger,
}: {
  /**
   * Shared scraper job resources.
   */
  context: ScraperJobContext;
  /**
   * Environment used to apply the non-production source limit.
   */
  env?: ScraperJobEnv;
  /**
   * Logger for run lifecycle events.
   */
  logger: Logger;
}) {
  const sourceLimit = getSourceScrapeLimit(env?.APP_ENV);

  await runLoggedCommand({
    command: "scrape:autmog",
    db: context.db,
    /**
     * Fetches Autmog products and enqueues normalized item jobs.
     *
     * @param signal - Cancels source requests after a process interrupt.
     * @returns Producer counts recorded with the scraper run.
     */
    execute: async (signal) => {
      const result = await runAutmogProducer({
        db: context.db,
        logger,
        limit: sourceLimit,
        pageLimit: sourceLimit ? 1 : undefined,
        queues: context.queues,
        skipArchiveReconciliation: Boolean(sourceLimit),
        signal,
      });

      return {
        enqueuedItemJobs: result.enqueuedCount,
        fetchedCount: result.fetchedCount,
        removedCompletedItemJobs: result.removedCompletedItemJobs,
        sourceLimit,
      };
    },
    jobType: "producer",
    logger,
    source: scraperSources.autmog,
  });
}

/**
 * Dispatches one configured source to its producer implementation.
 *
 * @param options - Source, shared resources, optional environment, and logger.
 * @rejects When the source is unimplemented or its producer fails.
 */
export async function runSourceProducerJob({
  context,
  env,
  logger,
  source,
}: {
  /**
   * Shared scraper job resources.
   */
  context: ScraperJobContext;
  /**
   * Optional environment controlling limits and proxy settings.
   */
  env?: ScraperJobEnv;
  /**
   * Logger for run lifecycle events.
   */
  logger: Logger;
  /**
   * Configured source to run.
   */
  source: ScraperSourceName;
}) {
  if (source === scraperSources.autmog) {
    await runAutmogProducerJob({ context, env, logger });
    return;
  }

  if (isGrimsmoSource(source)) {
    await runGrimsmoProducerJob({
      context,
      logger,
      proxyUrl: env?.GRIMSMO_PROXY_URL,
      sourceLimit: getSourceScrapeLimit(env?.APP_ENV),
      source,
    });
    return;
  }

  throw new Error(`Scraper source "${source}" is not implemented yet.`);
}

/**
 * Runs every configured source producer sequentially.
 *
 * @param options - Shared resources, optional environment, and logger.
 * @rejects When any source producer fails; later sources are not run.
 */
export async function runAllSourceProducerJobs({
  context,
  env,
  logger,
}: {
  /**
   * Shared scraper job resources.
   */
  context: ScraperJobContext;
  /**
   * Optional environment controlling source limits and proxy settings.
   */
  env?: ScraperJobEnv;
  /**
   * Logger for run lifecycle events.
   */
  logger: Logger;
}) {
  for (const source of scraperSourceKeys) {
    await runSourceProducerJob({ context, env, logger, source });
  }
}

/**
 * Runs one Grimsmo catalog producer as a tracked scraper run.
 *
 * @param options - Source settings, shared resources, and logger.
 */
export async function runGrimsmoProducerJob({
  context,
  logger,
  proxyUrl,
  sourceLimit,
  source,
}: {
  /**
   * Shared scraper job resources.
   */
  context: ScraperJobContext;
  /**
   * Logger for run lifecycle events.
   */
  logger: Logger;
  /**
   * Optional proxy URL used for Grimsmo requests.
   */
  proxyUrl?: string;
  /**
   * Maximum products to fetch; also disables archive reconciliation when set.
   */
  sourceLimit?: number;
  /**
   * Grimsmo product feed to scrape.
   */
  source: GrimsmoSourceName;
}) {
  await runLoggedCommand({
    command: `scrape:${source}`,
    db: context.db,
    /**
     * Fetches a Grimsmo feed and enqueues normalized item jobs.
     *
     * @param signal - Cancels source requests after a process interrupt.
     * @returns Producer and archive counts recorded with the scraper run.
     */
    execute: async (signal) => {
      const result = await runGrimsmoProducer({
        db: context.db,
        logger,
        maxProducts: sourceLimit,
        proxyUrl,
        queues: context.queues,
        skipArchiveReconciliation: Boolean(sourceLimit),
        signal,
        source,
      });

      return {
        archivedFetchedCount: result.archivedFetchedCount,
        enqueuedItemJobs: result.enqueuedCount,
        fetchedCount: result.fetchedCount,
        inventoryFetchedCount: result.inventoryFetchedCount,
        removedCompletedItemJobs: result.removedCompletedItemJobs,
        sourceLimit,
      };
    },
    jobType: "producer",
    logger,
    source,
  });
}

/**
 * Checks whether a configured source belongs to the Grimsmo adapter.
 *
 * @param source - Configured scraper source.
 * @returns Whether the source has the `grimsmo-` prefix.
 */
function isGrimsmoSource(
  source: ScraperSourceName,
): source is GrimsmoSourceName {
  return source.startsWith("grimsmo-");
}

/**
 * Processes actionable scraper queues as one tracked run.
 *
 * @param options - Shared resources, validated batch settings, and logger.
 */
export async function runQueueProcessorJob({
  context,
  env,
  logger,
}: {
  /**
   * Shared scraper job resources.
   */
  context: ScraperJobContext;
  /**
   * Validated batch-size and concurrency settings.
   */
  env: ScraperJobEnv;
  /**
   * Logger for queue and run lifecycle events.
   */
  logger: Logger;
}) {
  const queueJobCounts = await getScraperQueueJobCounts(context.queues);

  if (!hasActionableQueueJobs(queueJobCounts)) {
    logger.info(loggerMessages.scraper.cron.taskSkipped, {
      attributes: {
        images: queueJobCounts.images,
        items: queueJobCounts.items,
        reason: "empty-queue",
        task: "process:queue",
      },
    });
    return;
  }

  await runLoggedCommand({
    command: "process:queue",
    db: context.db,
    /**
     * Processes one configured batch from the item and image queues.
     *
     * @returns Completion, failure, and skip counts recorded with the run.
     */
    execute: async () => {
      const result = await runQueueProcessor({
        batchSize: {
          images: env.SCRAPER_IMAGE_BATCH_SIZE,
          items: env.SCRAPER_ITEM_BATCH_SIZE,
        },
        concurrency: env.SCRAPER_QUEUE_CONCURRENCY,
        connection: context.redis,
        db: context.db,
        imageFolderPrefix: context.imageFolderPrefix,
        imageStorage: context.imageStorage,
        logger,
        queues: context.queues,
      });

      return {
        failedImageJobs: result.images.failed,
        failedItemJobs: result.items.failed,
        processedImageJobs: result.images.completed,
        processedItemJobs: result.items.completed,
        skippedImageJobs: result.images.skipped,
      };
    },
    jobType: "processor",
    logger,
    source: "queue",
  });
}

/**
 * Requeues failed scraper jobs as one tracked dead-letter run.
 *
 * @param options - Shared queues, validated batch settings, and logger.
 */
export async function runQueueDeadLetterProcessorJob({
  context,
  env,
  logger,
}: {
  /**
   * Shared scraper job resources.
   */
  context: ScraperJobContext;
  /**
   * Validated dead-letter batch sizes.
   */
  env: ScraperJobEnv;
  /**
   * Logger for queue and run lifecycle events.
   */
  logger: Logger;
}) {
  await runLoggedCommand({
    command: "process:dead-letter",
    db: context.db,
    /**
     * Requeues one configured batch of failed item and image jobs.
     *
     * @returns Failed, requeued, and requeue-failure counts for both queues.
     */
    execute: async () => {
      const result = await runQueueDeadLetterProcessor({
        batchSize: {
          images: env.SCRAPER_IMAGE_BATCH_SIZE,
          items: env.SCRAPER_ITEM_BATCH_SIZE,
        },
        logger,
        queues: context.queues,
      });

      return {
        deadLetterFailedImageJobs: result.images.failed,
        deadLetterFailedItemJobs: result.items.failed,
        deadLetterRequeueFailedImageJobs: result.images.requeueFailed,
        deadLetterRequeueFailedItemJobs: result.items.requeueFailed,
        deadLetterRequeuedImageJobs: result.images.requeued,
        deadLetterRequeuedItemJobs: result.items.requeued,
      };
    },
    jobType: "dead-letter-processor",
    logger,
    source: "queue",
  });
}

/**
 * Tracks a scraper command in the database and structured logs.
 * Process interrupts abort the command, mark the run failed, and surface an interruption error.
 *
 * @param options - Command identity, database, logger, and cancellable operation.
 * @rejects When the run cannot start, execution fails, or the process is interrupted.
 */
async function runLoggedCommand({
  command,
  db,
  execute,
  jobType,
  logger,
  source,
}: {
  /**
   * CLI command label recorded with logs.
   */
  command:
    | "process:dead-letter"
    | "process:queue"
    | `scrape:${ScraperSourceName}`;
  /**
   * Database used to persist the scraper-run lifecycle.
   */
  db: Database;
  /**
   * Runs the command with cooperative cancellation.
   *
   * @param signal - Aborts work after a process interrupt.
   * @returns Numeric run statistics keyed by metric name.
   */
  execute: (signal: AbortSignal) => Promise<Record<string, number | undefined>>;
  /**
   * Stable job category stored with the scraper run.
   */
  jobType: string;
  /**
   * Logger for run lifecycle events.
   */
  logger: Logger;
  /**
   * Source identifier stored with the scraper run.
   */
  source: string;
}) {
  const run = await startScraperRun(db, { jobType, source });
  const startedAt = Date.now();
  const abortController = new AbortController();
  let interruptError: ScraperCommandInterruptedError | undefined;
  const interruptListeners = new Map<NodeJS.Signals, () => void>();
  const interruptPromise = new Promise<never>((_, reject) => {
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      /**
       * Aborts the active command and rejects its interrupt race.
       *
       * @rejects With the received process signal.
       */
      const listener = () => {
        interruptError ??= new ScraperCommandInterruptedError(signal);
        abortController.abort(interruptError);
        reject(interruptError);
      };

      interruptListeners.set(signal, listener);
      process.once(signal, listener);
    }
  });

  if (!run) {
    throw new Error(`Failed to create scraper run for ${source}:${jobType}.`);
  }

  logger.info(loggerMessages.scraper.run.started, {
    attributes: {
      command,
      jobType,
      runId: run.id,
      source,
    },
  });

  try {
    const stats = await Promise.race([
      execute(abortController.signal),
      interruptPromise,
    ]);
    await finishScraperRun(db, run.id, {
      stats,
      status: "completed",
    });
    logger.info(loggerMessages.scraper.run.completed, {
      attributes: {
        ...stats,
        command,
        durationMs: Date.now() - startedAt,
        jobType,
        runId: run.id,
        source,
      },
    });
  } catch (error) {
    const runError = interruptError ?? error;

    await finishScraperRun(db, run.id, {
      errorMessage:
        runError instanceof Error ? runError.message : String(runError),
      status: "failed",
    });
    logger.error(loggerMessages.scraper.run.failed, {
      attributes: {
        command,
        durationMs: Date.now() - startedAt,
        jobType,
        runId: run.id,
        source,
      },
      error: runError,
    });
    throw runError;
  } finally {
    for (const [signal, listener] of interruptListeners) {
      process.removeListener(signal, listener);
    }
  }
}
