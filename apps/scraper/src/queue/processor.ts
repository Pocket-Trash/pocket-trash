import type { Database } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import type { ImagesService } from "@package/services";
import { type Job, type Queue, Worker } from "bullmq";
import type { Redis } from "ioredis";
import { archiveMissingAutmogPens, syncAutmogPen } from "../db/autmog.js";
import {
  reconcileGrimsmoKnifeVariationBatch,
  reconcileGrimsmoPenVariationBatch,
  syncGrimsmoKnifeVariation,
  syncGrimsmoPenVariation,
} from "../db/grimsmo.js";
import {
  getTmpImageForProcessing,
  markTmpImageDeleted,
  markTmpImageFailed,
  markTmpImageUploaded,
} from "../db/images.js";
import {
  type GrimsmoKnifeSourceName,
  type GrimsmoPenSourceName,
  type ScraperImageJob,
  type ScraperItemJob,
  scraperQueueNames,
  scraperSources,
} from "../scraper-types.js";
import { getTmpImageDeleteJobId, getTmpImageUploadJobId } from "./job-ids.js";
import { removeCompletedJobsById, type ScraperQueues } from "./queues.js";

/**
 * Completed, failed, and skipped counts from draining one queue.
 */
export type QueueDrainStats = {
  /**
   * Number of jobs completed successfully.
   */
  completed: number;
  /**
   * Number of jobs that failed during this drain.
   */
  failed: number;
  /**
   * Number of jobs deliberately skipped.
   */
  skipped: number;
};

/**
 * Dependencies and limits for draining scraper item and image queues.
 */
export type RunQueueProcessorOptions = {
  /**
   * Target jobs processed from each queue during this run.
   */
  batchSize: {
    /**
     * Target image job count for this drain; concurrency may complete additional active jobs.
     */
    images: number;
    /**
     * Target item job count for this drain; concurrency may complete additional active jobs.
     */
    items: number;
  };
  /**
   * Maximum jobs processed concurrently by a queue worker.
   */
  concurrency: number;
  /**
   * Redis connection shared with BullMQ workers and queues.
   */
  connection: Redis;
  /**
   * Database used for scraper persistence.
   */
  db: Database;
  /**
   * Storage folder prefix for uploaded scraper images.
   */
  imageFolderPrefix: string;
  /**
   * Image service used for upload and deletion operations.
   */
  imageStorage: ImagesService;
  /**
   * Logger used for scraper lifecycle events.
   */
  logger: Logger;
  /**
   * Scraper item and image queues.
   */
  queues: ScraperQueues;
};

/**
 * Drain counts for the scraper item and image queues.
 */
export type RunQueueProcessorResult = {
  /**
   * Image-queue drain statistics.
   */
  images: QueueDrainStats;
  /**
   * Item-queue drain statistics.
   */
  items: QueueDrainStats;
};

/**
 * Failed-job and requeue counts for one queue.
 */
export type QueueDeadLetterStats = {
  /**
   * Total failed-job count read before retries, including jobs outside this batch.
   */
  failed: number;
  /**
   * Number of failed jobs that could not be retried.
   */
  requeueFailed: number;
  /**
   * Number of failed jobs successfully requeued for another processing attempt.
   */
  requeued: number;
};

/**
 * Queue dependencies and batch limits for dead-letter retries.
 */
export type RunQueueDeadLetterProcessorOptions = {
  /**
   * Maximum jobs processed from each queue during this run.
   */
  batchSize: {
    /**
     * Maximum failed image jobs retried during this run.
     */
    images: number;
    /**
     * Maximum failed item jobs retried during this run.
     */
    items: number;
  };
  /**
   * Logger used for scraper lifecycle events.
   */
  logger: Logger;
  /**
   * Scraper item and image queues.
   */
  queues: ScraperQueues;
};

/**
 * Dead-letter processing counts for the item and image queues.
 */
export type RunQueueDeadLetterProcessorResult = {
  /**
   * Image-queue dead-letter retry statistics.
   */
  images: QueueDeadLetterStats;
  /**
   * Item-queue dead-letter retry statistics.
   */
  items: QueueDeadLetterStats;
};

/**
 * Aggregated processor error counts and bounded samples.
 */
export type ProcessorErrorSummary = {
  /**
   * Error counts keyed by logger message.
   */
  errorsByMessage: Record<string, number>;
  /**
   * Bounded representative processor error samples.
   */
  sampleErrors: ProcessorErrorSample[];
  /**
   * Total processor errors across all messages.
   */
  totalErrors: number;
};

/**
 * Accumulator that groups processor errors and retains bounded samples.
 */
type ProcessorErrorCounter = {
  /**
   * Records one processor error count and optional bounded sample.
   *
   * @param message - Logger message that groups equivalent errors.
   *
   * @param sample - Optional representative error context.
   */
  record: (message: string, sample?: ProcessorErrorSampleInput) => void;
  /**
   * Returns sorted error counts, bounded samples, and the total count.
   *
   * @returns Sorted counts, bounded samples, and total errors.
   */
  summary: () => ProcessorErrorSummary;
};
/**
 * Serializable context retained for one representative processor error.
 */
type ProcessorErrorSample = {
  /**
   * Captured error value or its serializable representation.
   */
  error?: {
    /**
     * Serializable cause of the sampled error, when present.
     */
    cause?: {
      /**
       * Message from the captured error cause.
       */
      message: string;
      /**
       * Name of the captured error cause.
       */
      name: string;
    };
    /**
     * Message from the captured error.
     */
    message: string;
    /**
     * Name of the captured error.
     */
    name: string;
  };
  /**
   * Database identifier for the temporary image.
   */
  imageId?: number;
  /**
   * Deterministic BullMQ job identifier.
   */
  jobId?: string;
  /**
   * Logger message that groups equivalent processor errors.
   */
  message: string;
  /**
   * Scraper source identifier for the record or job.
   */
  source?: string;
  /**
   * Discriminator for the job or sampled error.
   */
  type?: string;
};
/**
 * Unformatted processor error context accepted by the accumulator.
 */
type ProcessorErrorSampleInput = Omit<
  ProcessorErrorSample,
  "error" | "message"
> & {
  /**
   * Captured error value or its serializable representation.
   */
  error?: unknown;
};
/**
 * Terminal outcome recorded for an image queue job.
 */
type ImageJobResult = "completed" | "skipped";

/**
 * Drains bounded item and image queue batches in sequence.
 *
 * @param options - Dependencies and controls for the operation.
 *
 * @returns Drain outcomes for the item and image queues.
 *
 * @rejects When queue processing or a required dependency fails.
 */
export async function runQueueProcessor({
  batchSize,
  concurrency,
  connection,
  db,
  imageFolderPrefix,
  imageStorage,
  logger,
  queues,
}: RunQueueProcessorOptions): Promise<RunQueueProcessorResult> {
  const startedAt = Date.now();
  const errorCounter = createProcessorErrorCounter();
  logger.info(loggerMessages.scraper.processor.started, {
    attributes: {
      imageFolderPrefix,
      imageBatchSize: batchSize.images,
      itemBatchSize: batchSize.items,
      queueConcurrency: concurrency,
    },
  });

  try {
    const items = await drainQueue<ScraperItemJob>({
      batchSize: batchSize.items,
      concurrency,
      connection,
      /**
       * Processes one queued job and returns its drain outcome.
       *
       * @param job - BullMQ job to process.
       *
       * @returns Promise resolving to `"skipped"` for a skipped job; `"completed"` or
       * `undefined` count as completed.
       *
       * @rejects When queue processing or a required dependency fails.
       */
      handler: (job) =>
        processItemJob({ db, errorCounter, job, logger, queues }),
      logger,
      queueName: scraperQueueNames.items,
    });
    const images = await drainQueue<ScraperImageJob>({
      batchSize: batchSize.images,
      concurrency,
      connection,
      /**
       * Processes one queued job and returns its drain outcome.
       *
       * @param job - BullMQ job to process.
       *
       * @returns Promise resolving to `"skipped"` for a skipped job; `"completed"` or
       * `undefined` count as completed.
       *
       * @rejects When queue processing or a required dependency fails.
       */
      handler: (job) =>
        processImageJob({
          db,
          errorCounter,
          imageFolderPrefix,
          imageStorage,
          job,
          logger,
        }),
      logger,
      queueName: scraperQueueNames.images,
    });

    logger.info(loggerMessages.scraper.processor.completed, {
      attributes: {
        durationMs: Date.now() - startedAt,
        failedImageJobs: images.failed,
        failedItemJobs: items.failed,
        processedImageJobs: images.completed,
        processedItemJobs: items.completed,
        skippedImageJobs: images.skipped,
      },
    });

    return {
      images,
      items,
    };
  } catch (error) {
    logger.error(loggerMessages.scraper.processor.failed, {
      attributes: {
        durationMs: Date.now() - startedAt,
      },
      error,
    });
    throw error;
  } finally {
    logProcessorErrorSummary({
      command: "process:queue",
      durationMs: Date.now() - startedAt,
      errorCounter,
      logger,
      processor: "queue",
    });
  }
}

/**
 * Retries bounded failed-job batches from both scraper queues.
 *
 * @param options - Dependencies and controls for the operation.
 *
 * @returns Dead-letter outcomes for both scraper queues.
 *
 * @rejects When queue processing or a required dependency fails.
 */
export async function runQueueDeadLetterProcessor({
  batchSize,
  logger,
  queues,
}: RunQueueDeadLetterProcessorOptions): Promise<RunQueueDeadLetterProcessorResult> {
  const startedAt = Date.now();
  logger.info(loggerMessages.scraper.queue.deadLetterStarted, {
    attributes: {
      imageBatchSize: batchSize.images,
      itemBatchSize: batchSize.items,
    },
  });

  try {
    const items = await processDeadLetters({
      batchSize: batchSize.items,
      logger,
      queue: queues.items,
      queueName: scraperQueueNames.items,
    });
    const images = await processDeadLetters({
      batchSize: batchSize.images,
      logger,
      queue: queues.images,
      queueName: scraperQueueNames.images,
    });

    logger.info(loggerMessages.scraper.queue.deadLetterCompleted, {
      attributes: {
        durationMs: Date.now() - startedAt,
        failedImageJobs: images.failed,
        failedItemJobs: items.failed,
        requeueFailedImageJobs: images.requeueFailed,
        requeueFailedItemJobs: items.requeueFailed,
        requeuedImageJobs: images.requeued,
        requeuedItemJobs: items.requeued,
      },
    });

    return {
      images,
      items,
    };
  } catch (error) {
    logger.error(loggerMessages.scraper.queue.deadLetterFailed, {
      attributes: {
        durationMs: Date.now() - startedAt,
      },
      error,
    });
    throw error;
  }
}

/**
 * Processes one scraper item or archive-reconciliation job.
 *
 * @param options - Dependencies and controls for the operation.
 *
 * @rejects When queue processing or a required dependency fails.
 */
async function processItemJob({
  db,
  errorCounter,
  job,
  logger,
  queues,
}: {
  /**
   * Database used for scraper persistence.
   */
  db: Database;
  /**
   * Accumulator for processor error counts and samples.
   */
  errorCounter: ProcessorErrorCounter;
  /**
   * BullMQ job being processed.
   */
  job: Job<ScraperItemJob>;
  /**
   * Logger used for scraper lifecycle events.
   */
  logger: Logger;
  /**
   * Scraper item and image queues.
   */
  queues: ScraperQueues;
}): Promise<undefined> {
  const startedAt = Date.now();

  try {
    if (job.data.type === "autmog.archiveMissing") {
      const archivedCount = await archiveMissingAutmogPens(
        db,
        job.data.seenSourceProductIds,
      );
      logger.info(loggerMessages.scraper.database.archiveCompleted, {
        attributes: {
          archivedCount,
          durationMs: Date.now() - startedAt,
          jobId: job.id,
          source: scraperSources.autmog,
        },
      });
      logger.info(loggerMessages.scraper.processor.itemJobCompleted, {
        attributes: {
          durationMs: Date.now() - startedAt,
          jobId: job.id,
          source: scraperSources.autmog,
          type: job.data.type,
        },
      });
      return;
    }

    if (job.data.type === "grimsmo.penVariationBatch") {
      const archivedCount = await reconcileGrimsmoPenVariationBatch(db, {
        items: job.data.items,
        source: job.data.source,
      });
      logger.info(loggerMessages.scraper.database.archiveCompleted, {
        attributes: {
          archivedCount,
          durationMs: Date.now() - startedAt,
          jobId: job.id,
          source: job.data.source,
        },
      });
      logger.info(loggerMessages.scraper.processor.itemJobCompleted, {
        attributes: {
          durationMs: Date.now() - startedAt,
          jobId: job.id,
          source: job.data.source,
          type: job.data.type,
        },
      });
      return;
    }

    if (job.data.type === "grimsmo.knifeVariationBatch") {
      const archivedCount = await reconcileGrimsmoKnifeVariationBatch(db, {
        items: job.data.items,
        source: job.data.source,
      });
      logger.info(loggerMessages.scraper.database.archiveCompleted, {
        attributes: {
          archivedCount,
          durationMs: Date.now() - startedAt,
          jobId: job.id,
          source: job.data.source,
        },
      });
      logger.info(loggerMessages.scraper.processor.itemJobCompleted, {
        attributes: {
          durationMs: Date.now() - startedAt,
          jobId: job.id,
          source: job.data.source,
          type: job.data.type,
        },
      });
      return;
    }

    if (job.data.type === "grimsmo.penVariation") {
      const data = job.data;
      const source: GrimsmoPenSourceName = data.source;
      const result = await syncGrimsmoPenVariation(db, data.item);
      const imageJobs = [
        ...result.uploadImageJobs.map((imageJob) => ({
          data: {
            imageId: imageJob.imageId,
            source,
            sourceHash: imageJob.sourceHash,
            type: "tmp.image.upload" as const,
          },
          name: "tmp.image.upload",
          opts: {
            jobId: getTmpImageUploadJobId({
              imageId: imageJob.imageId,
              source,
              sourceHash: imageJob.sourceHash,
            }),
          },
        })),
        ...result.deleteImageJobs.map((imageJob) => ({
          data: {
            imageId: imageJob.imageId,
            source,
            type: "tmp.image.delete" as const,
          },
          name: "tmp.image.delete",
          opts: {
            jobId: getTmpImageDeleteJobId({
              imageId: imageJob.imageId,
              source,
            }),
          },
        })),
      ];
      const removedCompletedImageJobs = await enqueueImageJobs(
        queues,
        imageJobs,
      );

      logItemMutationCompleted({
        durationMs: Date.now() - startedAt,
        imageJobs: imageJobs.length,
        jobId: job.id,
        logger,
        result,
        source,
        sourceProductId: data.item.sourceProductId,
        removedCompletedImageJobs,
      });
      logger.info(loggerMessages.scraper.processor.itemJobCompleted, {
        attributes: {
          durationMs: Date.now() - startedAt,
          jobId: job.id,
          source,
          sourceProductId: data.item.sourceProductId,
          type: data.type,
        },
      });
      return;
    }

    if (job.data.type === "grimsmo.knifeVariation") {
      const data = job.data;
      const source: GrimsmoKnifeSourceName = data.source;
      const result = await syncGrimsmoKnifeVariation(db, data.item);
      const imageJobs = [
        ...result.uploadImageJobs.map((imageJob) => ({
          data: {
            imageId: imageJob.imageId,
            source,
            sourceHash: imageJob.sourceHash,
            type: "tmp.image.upload" as const,
          },
          name: "tmp.image.upload",
          opts: {
            jobId: getTmpImageUploadJobId({
              imageId: imageJob.imageId,
              source,
              sourceHash: imageJob.sourceHash,
            }),
          },
        })),
        ...result.deleteImageJobs.map((imageJob) => ({
          data: {
            imageId: imageJob.imageId,
            source,
            type: "tmp.image.delete" as const,
          },
          name: "tmp.image.delete",
          opts: {
            jobId: getTmpImageDeleteJobId({
              imageId: imageJob.imageId,
              source,
            }),
          },
        })),
      ];
      const removedCompletedImageJobs = await enqueueImageJobs(
        queues,
        imageJobs,
      );

      logItemMutationCompleted({
        durationMs: Date.now() - startedAt,
        imageJobs: imageJobs.length,
        jobId: job.id,
        logger,
        result,
        source,
        sourceProductId: data.item.sourceProductId,
        removedCompletedImageJobs,
      });
      logger.info(loggerMessages.scraper.processor.itemJobCompleted, {
        attributes: {
          durationMs: Date.now() - startedAt,
          jobId: job.id,
          source,
          sourceProductId: data.item.sourceProductId,
          type: data.type,
        },
      });
      return;
    }

    const data = job.data;
    const result = await syncAutmogPen(db, data.item);
    const imageJobs = [
      ...result.uploadImageJobs.map((imageJob) => ({
        data: {
          imageId: imageJob.imageId,
          source: scraperSources.autmog,
          sourceHash: imageJob.sourceHash,
          type: "tmp.image.upload" as const,
        },
        name: "tmp.image.upload",
        opts: {
          jobId: getTmpImageUploadJobId({
            imageId: imageJob.imageId,
            source: scraperSources.autmog,
            sourceHash: imageJob.sourceHash,
          }),
        },
      })),
      ...result.deleteImageJobs.map((imageJob) => ({
        data: {
          imageId: imageJob.imageId,
          source: scraperSources.autmog,
          type: "tmp.image.delete" as const,
        },
        name: "tmp.image.delete",
        opts: {
          jobId: getTmpImageDeleteJobId({
            imageId: imageJob.imageId,
            source: scraperSources.autmog,
          }),
        },
      })),
    ];

    let removedCompletedImageJobs = 0;

    if (imageJobs.length > 0) {
      removedCompletedImageJobs = await removeCompletedJobsById(
        queues.images,
        imageJobs
          .map((imageJob) => imageJob.opts.jobId)
          .filter((jobId): jobId is string => Boolean(jobId)),
      );
      await queues.images.addBulk(imageJobs);
    }

    logger.info(loggerMessages.scraper.database.mutationCompleted, {
      attributes: {
        created: result.created,
        deleteImageJobs: result.deleteImageJobs.length,
        durationMs: Date.now() - startedAt,
        enqueuedImageJobs: imageJobs.length,
        jobId: job.id,
        payload: {
          dbResponse: {
            images: {
              upserted: result.dbResponse.images.upserted,
            },
          },
          mutationInput: {
            images: result.mutationInput.images,
          },
        },
        source: scraperSources.autmog,
        sourceProductId: data.item.sourceProductId,
        removedCompletedImageJobs,
        updated: result.updated,
        uploadImageJobs: result.uploadImageJobs.length,
        versioned: result.versioned,
      },
    });
    logger.info(loggerMessages.scraper.processor.itemJobCompleted, {
      attributes: {
        durationMs: Date.now() - startedAt,
        jobId: job.id,
        source: scraperSources.autmog,
        sourceProductId: data.item.sourceProductId,
        type: data.type,
      },
    });
  } catch (error) {
    errorCounter.record(loggerMessages.scraper.database.mutationFailed, {
      error,
      jobId: job.id,
      source: job.data.source,
      type: job.data.type,
    });
    logger.error(loggerMessages.scraper.database.mutationFailed, {
      attributes: {
        durationMs: Date.now() - startedAt,
        jobId: job.id,
        source: job.data.source,
        type: job.data.type,
      },
      error,
    });
    logger.error(loggerMessages.scraper.processor.itemJobFailed, {
      attributes: {
        durationMs: Date.now() - startedAt,
        jobId: job.id,
        source: job.data.source,
        type: job.data.type,
      },
      error,
    });
    throw error;
  }
}

/**
 * Processes one scraper image job through the shared image workflow.
 *
 * @param options - Dependencies and controls for the operation.
 *
 * @returns Completed or skipped image-job outcome.
 *
 * @rejects When queue processing or a required dependency fails.
 */
async function processImageJob({
  db,
  errorCounter,
  imageFolderPrefix,
  imageStorage,
  job,
  logger,
}: {
  /**
   * Database used for scraper persistence.
   */
  db: Database;
  /**
   * Accumulator for processor error counts and samples.
   */
  errorCounter: ProcessorErrorCounter;
  /**
   * Storage folder prefix for uploaded scraper images.
   */
  imageFolderPrefix: string;
  /**
   * Image service used for upload and deletion operations.
   */
  imageStorage: ImagesService;
  /**
   * BullMQ job being processed.
   */
  job: Job<ScraperImageJob>;
  /**
   * Logger used for scraper lifecycle events.
   */
  logger: Logger;
}): Promise<ImageJobResult> {
  const startedAt = Date.now();

  return processTmpImageJob({
    db,
    errorCounter,
    imageFolderPrefix,
    imageStorage,
    job,
    logger,
    startedAt,
  });
}

/**
 * Replaces completed duplicates and bulk-enqueues image jobs.
 *
 * @param queues - Scraper queues to inspect or enqueue into.
 *
 * @param imageJobs - Image jobs to enqueue.
 *
 * @returns Number of completed duplicate jobs removed.
 *
 * @rejects When queue processing or a required dependency fails.
 */
async function enqueueImageJobs(
  queues: ScraperQueues,
  imageJobs: {
    /**
     * Queue payload for the job.
     */
    data: ScraperImageJob;
    /**
     * BullMQ job name passed to `addBulk`.
     */
    name: string;
    /**
     * BullMQ options for the queued job.
     */
    opts: {
      /**
       * Deterministic BullMQ job identifier.
       */
      jobId: string;
    };
  }[],
) {
  if (imageJobs.length === 0) {
    return 0;
  }

  const removedCompletedImageJobs = await removeCompletedJobsById(
    queues.images,
    imageJobs.map((imageJob) => imageJob.opts.jobId),
  );
  await queues.images.addBulk(imageJobs);

  return removedCompletedImageJobs;
}

/**
 * Logs the database and image-job outcome for one item mutation.
 *
 * @param options - Dependencies and controls for the operation.
 */
function logItemMutationCompleted({
  durationMs,
  imageJobs,
  jobId,
  logger,
  removedCompletedImageJobs,
  result,
  source,
  sourceProductId,
}: {
  /**
   * Elapsed operation time in milliseconds.
   */
  durationMs: number;
  /**
   * Number of follow-up image jobs enqueued.
   */
  imageJobs: number;
  /**
   * Deterministic BullMQ job identifier.
   */
  jobId: string | undefined;
  /**
   * Logger used for scraper lifecycle events.
   */
  logger: Logger;
  /**
   * Number of completed image jobs removed before enqueueing.
   */
  removedCompletedImageJobs: number;
  /**
   * Synchronization result summarized by the logger.
   */
  result: {
    /**
     * Whether the variation came from the archive source collection.
     */
    archived?: boolean;
    /**
     * Whether synchronization inserted a new source record.
     */
    created: boolean;
    /**
     * Image deletion jobs produced by synchronization.
     */
    deleteImageJobs: readonly unknown[];
    /**
     * Whether synchronization changed normalized details.
     */
    updated: boolean;
    /**
     * Image upload jobs produced by synchronization.
     */
    uploadImageJobs: readonly unknown[];
    /**
     * Whether synchronization saved a previous-state version.
     */
    versioned: boolean;
  };
  /**
   * Scraper source identifier for the record or job.
   */
  source: string;
  /**
   * Stable product identifier supplied by the source.
   */
  sourceProductId: string;
}) {
  logger.info(loggerMessages.scraper.database.mutationCompleted, {
    attributes: {
      archived: result.archived,
      created: result.created,
      deleteImageJobs: result.deleteImageJobs.length,
      durationMs,
      enqueuedImageJobs: imageJobs,
      jobId,
      removedCompletedImageJobs,
      source,
      sourceProductId,
      updated: result.updated,
      uploadImageJobs: result.uploadImageJobs.length,
      versioned: result.versioned,
    },
  });
}

/**
 * Uploads or deletes one temporary image and persists its outcome.
 *
 * @param options - Dependencies and controls for the operation.
 *
 * @returns Completed or skipped image-job outcome.
 *
 * @rejects When queue processing or a required dependency fails.
 */
async function processTmpImageJob({
  db,
  errorCounter,
  imageFolderPrefix,
  imageStorage,
  job,
  logger,
  startedAt,
}: {
  /**
   * Database used for scraper persistence.
   */
  db: Database;
  /**
   * Accumulator for processor error counts and samples.
   */
  errorCounter: ProcessorErrorCounter;
  /**
   * Storage folder prefix for uploaded scraper images.
   */
  imageFolderPrefix: string;
  /**
   * Image service used for upload and deletion operations.
   */
  imageStorage: ImagesService;
  /**
   * BullMQ job being processed.
   */
  job: Job<ScraperImageJob>;
  /**
   * Logger used for scraper lifecycle events.
   */
  logger: Logger;
  /**
   * Operation start time as Unix milliseconds.
   */
  startedAt: number;
}): Promise<ImageJobResult> {
  try {
    const row = await getTmpImageForProcessing(db, job.data.imageId);

    if (!row) {
      return logMissingImageRow({ job, logger, startedAt });
    }

    if (job.data.type === "tmp.image.upload") {
      if (!["pending_upload", "upload_failed"].includes(row.image.status)) {
        logger.info(loggerMessages.scraper.image.uploadSkipped, {
          attributes: {
            durationMs: Date.now() - startedAt,
            imageId: row.image.id,
            jobId: job.id,
            status: row.image.status,
          },
        });
        return "skipped";
      }

      const result = await imageStorage.uploadRemoteImage({
        prefix: imageFolderPrefix,
        entity: "products",
        entityId: getTmpImageFolderKey({
          productId: row.image.productId,
          productVariationId: row.image.productVariationId,
        }),
        sourceImageId: row.image.sourceImageId ?? undefined,
        overwriteFile: true,
        overwriteTags: true,
        sourceUrl: row.image.sourceUrl,
        tags: getTmpImageTags({
          productId: row.product.id,
          productVariationId: row.productVariation?.id ?? null,
          source: row.product.source,
        }),
        useUniqueFileName: false,
      });

      if (!result) {
        logger.info(loggerMessages.scraper.image.uploadSkipped, {
          attributes: {
            durationMs: Date.now() - startedAt,
            imageId: row.image.id,
            jobId: job.id,
            skipReason: "dry-run",
          },
        });
        return "skipped";
      }

      const dbResponse = await markTmpImageUploaded(db, {
        height: result.height,
        imageId: row.image.id,
        imageFileId: result.fileId,
        imagePath: result.filePath,
        imageProvider: result.provider,
        imageUrl: result.url,
        width: result.width,
      });
      logger.info(loggerMessages.scraper.image.uploadCompleted, {
        attributes: {
          dbResponse,
          durationMs: Date.now() - startedAt,
          imageId: row.image.id,
          imageResponse: result,
          jobId: job.id,
          productId: row.product.id,
          productVariationId: row.productVariation?.id,
          source: row.product.source,
        },
      });
      return "completed";
    }

    if (!["pending_delete", "delete_failed"].includes(row.image.status)) {
      logger.info(loggerMessages.scraper.image.deleteSkipped, {
        attributes: {
          durationMs: Date.now() - startedAt,
          imageId: row.image.id,
          jobId: job.id,
          status: row.image.status,
        },
      });
      return "skipped";
    }

    if (row.image.imageFileId) {
      const deleteResult = await imageStorage.deleteFile(row.image.imageFileId);

      if (deleteResult === "skipped") {
        logger.info(loggerMessages.scraper.image.deleteSkipped, {
          attributes: {
            durationMs: Date.now() - startedAt,
            imageId: row.image.id,
            jobId: job.id,
            skipReason: "dry-run",
          },
        });
        return "skipped";
      }
    }

    await markTmpImageDeleted(db, row.image.id);
    logger.info(loggerMessages.scraper.image.deleteCompleted, {
      attributes: {
        durationMs: Date.now() - startedAt,
        imageId: row.image.id,
        jobId: job.id,
        productId: row.product.id,
        productVariationId: row.productVariation?.id,
        source: row.product.source,
      },
    });
    return "completed";
  } catch (error) {
    await markTmpImageFailed(db, {
      imageId: job.data.imageId,
      status:
        job.data.type === "tmp.image.upload"
          ? "upload_failed"
          : "delete_failed",
    });
    logImageJobError({ error, errorCounter, job, logger, startedAt });
    throw error;
  }
}

/**
 * Logs and skips an image job whose database row is absent.
 *
 * @param options - Dependencies and controls for the operation.
 *
 * @returns The skipped image-job outcome.
 */
function logMissingImageRow({
  job,
  logger,
  startedAt,
}: {
  /**
   * BullMQ job being processed.
   */
  job: Job<ScraperImageJob>;
  /**
   * Logger used for scraper lifecycle events.
   */
  logger: Logger;
  /**
   * Operation start time as Unix milliseconds.
   */
  startedAt: number;
}): ImageJobResult {
  logger.warn(loggerMessages.scraper.processor.imageJobCompleted, {
    attributes: {
      durationMs: Date.now() - startedAt,
      imageId: job.data.imageId,
      jobId: job.id,
      skipped: true,
      skipReason: "missing-image-row",
      type: job.data.type,
    },
  });
  return "skipped";
}

/**
 * Records and logs a failed temporary image job.
 *
 * @param options - Dependencies and controls for the operation.
 */
function logImageJobError({
  error,
  errorCounter,
  job,
  logger,
  startedAt,
}: {
  /**
   * Captured error value or its serializable representation.
   */
  error: unknown;
  /**
   * Accumulator for processor error counts and samples.
   */
  errorCounter: ProcessorErrorCounter;
  /**
   * BullMQ job being processed.
   */
  job: Job<ScraperImageJob>;
  /**
   * Logger used for scraper lifecycle events.
   */
  logger: Logger;
  /**
   * Operation start time as Unix milliseconds.
   */
  startedAt: number;
}) {
  const primaryErrorMessage = job.data.type.includes(".upload")
    ? loggerMessages.scraper.image.uploadFailed
    : loggerMessages.scraper.image.deleteFailed;

  errorCounter.record(primaryErrorMessage, {
    error,
    imageId: job.data.imageId,
    jobId: job.id,
    type: job.data.type,
  });
  logger.error(primaryErrorMessage, {
    attributes: {
      durationMs: Date.now() - startedAt,
      imageId: job.data.imageId,
      jobId: job.id,
      type: job.data.type,
    },
    error,
  });
  logger.error(loggerMessages.scraper.processor.imageJobFailed, {
    attributes: {
      durationMs: Date.now() - startedAt,
      imageId: job.data.imageId,
      jobId: job.id,
      type: job.data.type,
    },
    error,
  });
}

/**
 * Builds the storage folder key for a product or variation image.
 *
 * @param options - Dependencies and controls for the operation.
 *
 * @returns Product ID alone or product and variation IDs joined by a hyphen.
 */
export function getTmpImageFolderKey({
  productId,
  productVariationId,
}: {
  /**
   * Database identifier for the parent temporary product.
   */
  productId: number;
  /**
   * Database variation identifier, or `null` for parent-product images.
   */
  productVariationId: number | null;
}) {
  return productVariationId === null
    ? String(productId)
    : `${productId}-${productVariationId}`;
}

/**
 * Builds storage tags for a temporary product image.
 *
 * @param options - Dependencies and controls for the operation.
 *
 * @returns Stable storage tags for the image scope and source.
 */
function getTmpImageTags({
  productId,
  productVariationId,
  source,
}: {
  /**
   * Database identifier for the parent temporary product.
   */
  productId: number;
  /**
   * Database variation identifier, or `null` for parent-product images.
   */
  productVariationId: number | null;
  /**
   * Scraper source identifier for the record or job.
   */
  source: string;
}) {
  return [
    "scraper",
    source,
    `product:${productId}`,
    ...(productVariationId === null
      ? []
      : [`product-variation:${productVariationId}`]),
  ];
}

/**
 * Creates a bounded processor error accumulator.
 *
 * @returns A fresh bounded error accumulator.
 */
export function createProcessorErrorCounter(): ProcessorErrorCounter {
  const errorsByMessage = new Map<string, number>();
  const sampleErrors: ProcessorErrorSample[] = [];
  const maxSampleErrors = 5;

  return {
    /**
     * Records one processor error count and optional bounded sample.
     *
     * @param message - Logger message that groups equivalent errors.
     *
     * @param sample - Optional representative error context.
     */
    record(message, sample) {
      errorsByMessage.set(message, (errorsByMessage.get(message) ?? 0) + 1);
      if (sample && sampleErrors.length < maxSampleErrors) {
        sampleErrors.push({
          ...sample,
          error:
            sample.error === undefined
              ? undefined
              : formatProcessorErrorForAttributes(sample.error),
          message,
        });
      }
    },
    /**
     * Returns sorted error counts, bounded samples, and the total count.
     *
     * @returns Sorted counts, bounded samples, and total errors.
     */
    summary() {
      const entries = [...errorsByMessage.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      );
      const errors = Object.fromEntries(entries);

      return {
        errorsByMessage: errors,
        sampleErrors,
        totalErrors: Object.values(errors).reduce(
          (total, count) => total + count,
          0,
        ),
      };
    },
  };
}

/**
 * Converts an unknown error into serializable logger attributes.
 *
 * @param error - Unknown error value to serialize.
 *
 * @returns Serializable error name, message, and optional cause.
 */
function formatProcessorErrorForAttributes(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      message: String(error),
      name: "Error",
    };
  }

  return {
    ...(error.cause instanceof Error
      ? {
          cause: {
            message: error.cause.message,
            name: error.cause.name,
          },
        }
      : {}),
    message: error.message,
    name: error.name,
  };
}

/**
 * Logs aggregated processor errors when any were recorded.
 *
 * @param options - Dependencies and controls for the operation.
 */
function logProcessorErrorSummary({
  command,
  durationMs,
  errorCounter,
  logger,
  processor,
}: {
  /**
   * Processor command recorded in summary logs.
   */
  command: "process:queue";
  /**
   * Elapsed operation time in milliseconds.
   */
  durationMs: number;
  /**
   * Accumulator for processor error counts and samples.
   */
  errorCounter: ProcessorErrorCounter;
  /**
   * Logger used for scraper lifecycle events.
   */
  logger: Logger;
  /**
   * Processor identifier recorded in summary logs.
   */
  processor: "queue";
}) {
  const summary = errorCounter.summary();

  if (summary.totalErrors === 0) {
    return;
  }

  logger.error(loggerMessages.scraper.processor.errorSummary, {
    attributes: {
      command,
      durationMs,
      errorsByMessage: summary.errorsByMessage,
      processor,
      sampleErrors: summary.sampleErrors,
      totalErrors: summary.totalErrors,
    },
  });
}

/**
 * Processes one bounded queue batch and returns terminal job counts.
 * Forces worker closure after five minutes; earlier completion allows thirty seconds
 * for graceful closure before forcing it.
 *
 * @param options - Dependencies and controls for the operation.
 *
 * @returns Completed, failed, and skipped job counts.
 *
 * @template TJobData - Queue job payload type.
 *
 * @rejects When queue processing or a required dependency fails.
 */
async function drainQueue<TJobData>({
  batchSize,
  concurrency,
  connection,
  handler,
  logger,
  queueName,
}: {
  /**
   * Target job count for this drain; concurrency may complete additional active jobs.
   */
  batchSize: number;
  /**
   * Maximum jobs processed concurrently by a queue worker.
   */
  concurrency: number;
  /**
   * Redis connection shared with BullMQ workers and queues.
   */
  connection: Redis;
  /**
   * Processes one queued job and returns its drain outcome.
   *
   * @param job - BullMQ job to process.
   *
   * @returns Promise resolving to `"skipped"` for a skipped job; `"completed"` or
   * `undefined` count as completed.
   *
   * @rejects When queue processing or a required dependency fails.
   */
  handler: (job: Job<TJobData>) => Promise<"completed" | "skipped" | undefined>;
  /**
   * Logger used for scraper lifecycle events.
   */
  logger: Logger;
  /**
   * Stable BullMQ queue name.
   */
  queueName: string;
}): Promise<QueueDrainStats> {
  const startedAt = Date.now();
  const stats: QueueDrainStats = {
    completed: 0,
    failed: 0,
    skipped: 0,
  };

  return new Promise((resolve, reject) => {
    let finishPromise: Promise<void> | null = null;
    let worker: Worker<TJobData> | null = null;
    const timeout = setTimeout(
      () => {
        void finishDrain({ force: true }).then(() => resolve(stats), reject);
      },
      5 * 60 * 1000,
    );
    /**
     * Stops the active queue drain once and records its final statistics.
     *
     * @param options - Dependencies and controls for the operation.
     *
     * @returns The shared worker-close promise.
     */
    const finishDrain = ({
      force = false,
    }: {
      /**
       * Whether to force closure without waiting for active jobs.
       */
      force?: boolean;
    } = {}) => {
      if (finishPromise) {
        return finishPromise;
      }

      finishPromise = (async () => {
        clearTimeout(timeout);
        await closeWorkerWithDeadline(worker, force);
        logger.info(loggerMessages.scraper.queue.drainCompleted, {
          attributes: {
            completedJobs: stats.completed,
            durationMs: Date.now() - startedAt,
            failedJobs: stats.failed,
            queue: queueName,
            skippedJobs: stats.skipped,
          },
        });
      })();

      return finishPromise;
    };
    /**
     * Finishes the drain after the requested number of jobs reaches a terminal state.
     */
    const maybeCloseWorker = () => {
      if (stats.completed + stats.failed + stats.skipped >= batchSize) {
        void finishDrain().then(() => resolve(stats), reject);
      }
    };

    worker = new Worker<TJobData>(
      queueName,
      async (job) => {
        const result = await handler(job);

        if (result === "skipped") {
          stats.skipped += 1;
        } else {
          stats.completed += 1;
        }

        maybeCloseWorker();
      },
      {
        autorun: true,
        concurrency,
        connection,
      },
    );

    worker.on("drained", () => {
      void finishDrain().then(() => resolve(stats), reject);
    });
    worker.on("failed", () => {
      stats.failed += 1;
      maybeCloseWorker();
    });
    worker.on("error", (error) => {
      logger.error(loggerMessages.scraper.queue.drainFailed, {
        attributes: {
          queue: queueName,
        },
        error,
      });
      void finishDrain({ force: true }).then(() => reject(error), reject);
    });
  });
}

/**
 * Closes a worker immediately when forced; otherwise allows thirty seconds for
 * graceful closure before forcing it.
 *
 * @param worker - BullMQ worker to close, or `null` before creation.
 *
 * @param force - Whether to force worker closure.
 *
 * @template TJobData - Queue job payload type.
 *
 * @rejects When queue processing or a required dependency fails.
 */
async function closeWorkerWithDeadline<TJobData>(
  worker: Worker<TJobData> | null,
  force: boolean,
) {
  if (!worker) {
    return;
  }

  if (force) {
    await worker.close(true);
    return;
  }

  let forceClose: NodeJS.Timeout | undefined;

  await Promise.race([
    worker.close(),
    new Promise<void>((resolve) => {
      forceClose = setTimeout(() => {
        void worker.close(true).finally(resolve);
      }, 30_000);
    }),
  ]);

  clearTimeout(forceClose);
}

/**
 * Retries a bounded batch of failed jobs and reports requeue outcomes.
 *
 * @param options - Dependencies and controls for the operation.
 *
 * @returns Failed, requeued, and retry-failure counts.
 *
 * @template TJobData - Queue job payload type.
 *
 * @rejects When queue processing or a required dependency fails.
 */
async function processDeadLetters<TJobData>({
  batchSize,
  logger,
  queue,
  queueName,
}: {
  /**
   * Maximum jobs processed from each queue during this run.
   */
  batchSize: number;
  /**
   * Logger used for scraper lifecycle events.
   */
  logger: Logger;
  /**
   * BullMQ queue operated on by the processor.
   */
  queue: Queue<TJobData>;
  /**
   * Stable BullMQ queue name.
   */
  queueName: string;
}): Promise<QueueDeadLetterStats> {
  const startedAt = Date.now();
  const failedCount = await queue.getFailedCount();
  const jobs = batchSize > 0 ? await queue.getFailed(0, batchSize - 1) : [];
  const stats: QueueDeadLetterStats = {
    failed: failedCount,
    requeueFailed: 0,
    requeued: 0,
  };

  for (const job of jobs) {
    try {
      await job.retry("failed");
      stats.requeued += 1;
    } catch (error) {
      stats.requeueFailed += 1;
      logger.error(loggerMessages.scraper.queue.deadLetterFailed, {
        attributes: {
          attemptsMade: job.attemptsMade,
          failedReason: job.failedReason,
          jobId: job.id,
          jobName: job.name,
          queue: queueName,
        },
        error,
      });
    }
  }

  logger.info(loggerMessages.scraper.queue.deadLetterCompleted, {
    attributes: {
      batchSize,
      durationMs: Date.now() - startedAt,
      failedJobs: failedCount,
      queue: queueName,
      requeueFailedJobs: stats.requeueFailed,
      requeuedJobs: stats.requeued,
    },
  });

  return stats;
}
