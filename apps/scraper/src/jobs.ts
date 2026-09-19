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

export type ScraperJobEnv = ReturnType<typeof createScraperJobEnv>;

export const scraperSourceKeys = Object.values(scraperSources);

export type ScraperJobContext = {
  close: () => Promise<void>;
  db: Database;
  imageFolderPrefix?: string;
  imageStorage: ImagesService;
  redis: ReturnType<typeof createRedisConnection>;
  queues: ScraperQueues;
};

export class ScraperCommandInterruptedError extends Error {
  readonly signal: NodeJS.Signals;

  constructor(signal: NodeJS.Signals) {
    super(`Scraper command interrupted by ${signal}.`);
    this.name = "ScraperCommandInterruptedError";
    this.signal = signal;
  }
}

export async function createScraperJobContext(
  env: ScraperJobEnv,
  logger: Logger,
): Promise<ScraperJobContext> {
  const services = createServices();
  services.configure({
    images: {
      bunnyStorageAccessKey: env.BUNNY_STORAGE_ACCESS_KEY,
      bunnyStorageEndpoint: env.BUNNY_STORAGE_ENDPOINT,
      bunnyStorageZoneName: env.BUNNY_STORAGE_ZONE_NAME,
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

export async function runAutmogProducerJob({
  context,
  env,
  logger,
}: {
  context: ScraperJobContext;
  env?: ScraperJobEnv;
  logger: Logger;
}) {
  const sourceLimit = getSourceScrapeLimit(env?.APP_ENV);

  await runLoggedCommand({
    command: "scrape:autmog",
    db: context.db,
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

export async function runSourceProducerJob({
  context,
  env,
  logger,
  source,
}: {
  context: ScraperJobContext;
  env?: ScraperJobEnv;
  logger: Logger;
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

export async function runAllSourceProducerJobs({
  context,
  env,
  logger,
}: {
  context: ScraperJobContext;
  env?: ScraperJobEnv;
  logger: Logger;
}) {
  for (const source of scraperSourceKeys) {
    await runSourceProducerJob({ context, env, logger, source });
  }
}

export async function runGrimsmoProducerJob({
  context,
  logger,
  proxyUrl,
  sourceLimit,
  source,
}: {
  context: ScraperJobContext;
  logger: Logger;
  proxyUrl?: string;
  sourceLimit?: number;
  source: GrimsmoSourceName;
}) {
  await runLoggedCommand({
    command: `scrape:${source}`,
    db: context.db,
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

function isGrimsmoSource(
  source: ScraperSourceName,
): source is GrimsmoSourceName {
  return source.startsWith("grimsmo-");
}

export async function runQueueProcessorJob({
  context,
  env,
  logger,
}: {
  context: ScraperJobContext;
  env: ScraperJobEnv;
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

export async function runQueueDeadLetterProcessorJob({
  context,
  env,
  logger,
}: {
  context: ScraperJobContext;
  env: ScraperJobEnv;
  logger: Logger;
}) {
  await runLoggedCommand({
    command: "process:dead-letter",
    db: context.db,
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

async function runLoggedCommand({
  command,
  db,
  execute,
  jobType,
  logger,
  source,
}: {
  command:
    | "process:dead-letter"
    | "process:queue"
    | `scrape:${ScraperSourceName}`;
  db: Database;
  execute: (signal: AbortSignal) => Promise<Record<string, number | undefined>>;
  jobType: string;
  logger: Logger;
  source: string;
}) {
  const run = await startScraperRun(db, { jobType, source });
  const startedAt = Date.now();
  const abortController = new AbortController();
  let interruptError: ScraperCommandInterruptedError | undefined;
  const interruptListeners = new Map<NodeJS.Signals, () => void>();
  const interruptPromise = new Promise<never>((_, reject) => {
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
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
