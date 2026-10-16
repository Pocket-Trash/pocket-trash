import type { Database } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import type { QueueEnqueueInput, QueueJob } from "@package/queue";
import type { ImagesService } from "@package/services";
import {
  syncCanonicalAutmogImage,
  syncCanonicalAutmogPen,
} from "../db/autmog-catalog.js";
import {
  reconcileGrimsmoKnifeVariationBatch,
  syncGrimsmoKnifeVariation,
} from "../db/grimsmo.js";
import {
  syncCanonicalSagaCatalog,
  syncCanonicalSagaImage,
  syncCanonicalSagaMaterials,
} from "../db/grimsmo-catalog.js";
import {
  getTmpImageForProcessing,
  markTmpImageDeleted,
  markTmpImageFailed,
  markTmpImageUploaded,
} from "../db/images.js";
import {
  type GrimsmoKnifeSourceName,
  type ScraperImageJob,
  type ScraperItemJob,
  scraperSources,
} from "../scraper-types.js";
import {
  getAutmogImageUploadJobId,
  getGrimsmoSagaImageUploadJobId,
  getTmpImageDeleteJobId,
  getTmpImageUploadJobId,
} from "./job-ids.js";
import { enqueueScraperJobs, type ScraperQueues } from "./queues.js";

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
   * Database used for scraper persistence.
   */
  db: Database;
  /** Whether canonical catalog mutations and uploads are reported without writes. */
  dryRun?: boolean;
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
   * Deterministic queue job identifier.
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

/** Temporary-table image jobs retained for non-Pens scraper sources. */
type TmpScraperImageJob = Extract<
  ScraperImageJob,
  {
    /** Temporary-table image operation discriminator. */
    type: "tmp.image.delete" | "tmp.image.upload";
  }
>;

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
  db,
  dryRun = false,
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
    const items = await queues.items.process({
      concurrency,
      /**
       * Processes one queued job and returns its drain outcome.
       *
       * @param job - Validated queue job to process.
       *
       * @returns Promise resolving to `"skipped"` for a skipped job; `"completed"` or
       * `undefined` count as completed.
       *
       * @rejects When queue processing or a required dependency fails.
       */
      handler: (job) =>
        processItemJob({ db, dryRun, errorCounter, job, logger, queues }),
      limit: batchSize.items,
    });
    const images = await queues.images.process({
      concurrency,
      /**
       * Processes one queued job and returns its drain outcome.
       *
       * @param job - Validated queue job to process.
       *
       * @returns Promise resolving to `"skipped"` for a skipped job; `"completed"` or
       * `undefined` count as completed.
       *
       * @rejects When queue processing or a required dependency fails.
       */
      handler: (job) =>
        processImageJob({
          db,
          dryRun,
          errorCounter,
          imageFolderPrefix,
          imageStorage,
          job,
          logger,
        }),
      limit: batchSize.images,
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
    const items = await queues.items.redriveFailed(batchSize.items);
    const images = await queues.images.redriveFailed(batchSize.images);

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
  dryRun,
  errorCounter,
  job,
  logger,
  queues,
}: {
  /**
   * Database used for scraper persistence.
   */
  db: Database;
  /** Whether canonical catalog writes are disabled. */
  dryRun: boolean;
  /**
   * Accumulator for processor error counts and samples.
   */
  errorCounter: ProcessorErrorCounter;
  /**
   * Portable queue job being processed.
   */
  job: QueueJob<ScraperItemJob>;
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
    if (job.payload.type === "grimsmo.sagaCatalog") {
      const result = await syncCanonicalSagaCatalog(db, job.payload.snapshot, {
        dryRun,
      });
      const imageJobs = result.imageCandidates.map((image) => ({
        id: getGrimsmoSagaImageUploadJobId({
          listingId: image.listingId,
          sourceImageId: image.sourceImageId,
          sourceUrl: image.sourceUrl,
        }),
        name: "grimsmo.sagaImage.upload",
        payload: {
          listingId: image.listingId,
          position: image.position,
          productId: image.productId,
          source: scraperSources.grimsmoSaga,
          sourceImageId: image.sourceImageId,
          sourceUrl: image.sourceUrl,
          type: "grimsmo.sagaImage.upload" as const,
        },
      }));
      const removedCompletedImageJobs = dryRun
        ? 0
        : await enqueueImageJobs(queues, imageJobs);
      logger.info(loggerMessages.scraper.database.mutationCompleted, {
        attributes: {
          created: false,
          durationMs: Date.now() - startedAt,
          enqueuedImageJobs: imageJobs.length,
          jobId: job.id,
          payload: {
            cappedAppearanceCount: result.cappedAppearanceCount,
            dryRun,
            newAppearanceCount: result.newAppearanceCount,
            newColorNames: result.newColorNames,
            newFinishNames: result.newFinishNames,
            newMaterialNames: result.newMaterialNames,
            newSliderOptions: result.newSliderOptions,
            plannedImageCount: result.plannedImageCount,
            productId: result.productId,
          },
          removedCompletedImageJobs,
          source: job.payload.source,
          updated:
            result.newAppearanceCount > 0 ||
            result.newColorNames.length > 0 ||
            result.newFinishNames.length > 0 ||
            result.newMaterialNames.length > 0 ||
            result.newSliderOptions.length > 0,
          versioned: false,
        },
      });
      logger.info(loggerMessages.scraper.processor.itemJobCompleted, {
        attributes: {
          durationMs: Date.now() - startedAt,
          jobId: job.id,
          source: job.payload.source,
          type: job.payload.type,
        },
      });
      return;
    }

    if (
      job.payload.type === "grimsmo.sagaMaterials" ||
      job.payload.type === "grimsmo.penVariation" ||
      job.payload.type === "grimsmo.penVariationBatch"
    ) {
      const materialNames =
        job.payload.type === "grimsmo.sagaMaterials"
          ? job.payload.materialNames
          : job.payload.type === "grimsmo.penVariation"
            ? [
                ...job.payload.item.bodyMaterials,
                ...job.payload.item.sliderMaterials,
              ]
            : job.payload.items.flatMap((item) => [
                ...item.bodyMaterials,
                ...item.sliderMaterials,
              ]);
      const result = await syncCanonicalSagaMaterials(db, materialNames, {
        dryRun,
      });
      logger.info(loggerMessages.scraper.database.mutationCompleted, {
        attributes: {
          created: false,
          durationMs: Date.now() - startedAt,
          jobId: job.id,
          payload: {
            dryRun,
            existingMaterialNames: result.existingMaterialNames,
            newMaterialNames: result.newMaterialNames,
            productId: result.productId,
            unresolvedMaterialNames: result.unresolvedMaterialNames,
          },
          source: job.payload.source,
          updated: result.newMaterialNames.length > 0,
          versioned: false,
        },
      });
      logger.info(loggerMessages.scraper.processor.itemJobCompleted, {
        attributes: {
          durationMs: Date.now() - startedAt,
          jobId: job.id,
          source: job.payload.source,
          type: job.payload.type,
        },
      });
      return;
    }

    if (job.payload.type === "grimsmo.knifeVariationBatch") {
      const archivedCount = await reconcileGrimsmoKnifeVariationBatch(db, {
        items: job.payload.items,
        source: job.payload.source,
      });
      logger.info(loggerMessages.scraper.database.archiveCompleted, {
        attributes: {
          archivedCount,
          durationMs: Date.now() - startedAt,
          jobId: job.id,
          source: job.payload.source,
        },
      });
      logger.info(loggerMessages.scraper.processor.itemJobCompleted, {
        attributes: {
          durationMs: Date.now() - startedAt,
          jobId: job.id,
          source: job.payload.source,
          type: job.payload.type,
        },
      });
      return;
    }

    if (job.payload.type === "grimsmo.knifeVariation") {
      const data = job.payload;
      const source: GrimsmoKnifeSourceName = data.source;
      const result = await syncGrimsmoKnifeVariation(db, data.item);
      const imageJobs = [
        ...result.uploadImageJobs.map((imageJob) => ({
          id: getTmpImageUploadJobId({
            imageId: imageJob.imageId,
            source,
            sourceHash: imageJob.sourceHash,
          }),
          name: "tmp.image.upload",
          payload: {
            imageId: imageJob.imageId,
            source,
            sourceHash: imageJob.sourceHash,
            type: "tmp.image.upload" as const,
          },
        })),
        ...result.deleteImageJobs.map((imageJob) => ({
          id: getTmpImageDeleteJobId({
            imageId: imageJob.imageId,
            source,
          }),
          name: "tmp.image.delete",
          payload: {
            imageId: imageJob.imageId,
            source,
            type: "tmp.image.delete" as const,
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

    const data = job.payload;
    const result = await syncCanonicalAutmogPen(db, data.item, { dryRun });
    const imageJobs = result.imageCandidates.map((image) => ({
      id: getAutmogImageUploadJobId({
        listingId: image.listingId,
        sourceImageId: image.sourceImageId,
        sourceUrl: image.sourceUrl,
      }),
      name: "autmog.image.upload",
      payload: {
        listingId: image.listingId,
        position: image.position,
        productId: image.productId,
        source: scraperSources.autmog,
        sourceImageId: image.sourceImageId,
        sourceUrl: image.sourceUrl,
        type: "autmog.image.upload" as const,
      },
    }));

    let removedCompletedImageJobs = 0;

    if (!dryRun && imageJobs.length > 0) {
      removedCompletedImageJobs = await enqueueScraperJobs(
        queues.images,
        imageJobs,
      );
    }

    logger.info(loggerMessages.scraper.database.mutationCompleted, {
      attributes: {
        created: result.created,
        deleteImageJobs: 0,
        durationMs: Date.now() - startedAt,
        enqueuedImageJobs: imageJobs.length,
        jobId: job.id,
        payload: { dryRun: result.dryRun },
        source: scraperSources.autmog,
        sourceProductId: data.item.sourceProductId,
        removedCompletedImageJobs,
        updated: result.updated,
        uploadImageJobs: result.imageCandidates.length,
        versioned: false,
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
      source: job.payload.source,
      type: job.payload.type,
    });
    logger.error(loggerMessages.scraper.database.mutationFailed, {
      attributes: {
        durationMs: Date.now() - startedAt,
        jobId: job.id,
        source: job.payload.source,
        type: job.payload.type,
      },
      error,
    });
    logger.error(loggerMessages.scraper.processor.itemJobFailed, {
      attributes: {
        durationMs: Date.now() - startedAt,
        jobId: job.id,
        source: job.payload.source,
        type: job.payload.type,
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
  dryRun,
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
  /** Whether canonical uploads and database writes are disabled. */
  dryRun: boolean;
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
   * Portable queue job being processed.
   */
  job: QueueJob<ScraperImageJob>;
  /**
   * Logger used for scraper lifecycle events.
   */
  logger: Logger;
}): Promise<ImageJobResult> {
  const startedAt = Date.now();

  if (
    job.payload.type === "autmog.image.upload" ||
    job.payload.type === "grimsmo.sagaImage.upload"
  ) {
    if (dryRun) {
      logger.info(loggerMessages.scraper.processor.imageJobCompleted, {
        attributes: {
          durationMs: Date.now() - startedAt,
          jobId: job.id,
          source: job.payload.source,
          type: job.payload.type,
        },
      });
      return "skipped";
    }
    const uploaded = await imageStorage.uploadRemoteImage({
      entity: "products",
      entityId: job.payload.productId,
      prefix: imageFolderPrefix,
      sourceUrl: job.payload.sourceUrl,
    });
    if (!uploaded)
      throw new Error("Canonical catalog image upload returned no result.");
    const fileName = uploaded.filePath.split("/").at(-1);
    if (!fileName)
      throw new Error("Canonical catalog image path has no file name.");
    const uploadedImage = {
      contentType: uploaded.contentType,
      fileName,
      objectPath: uploaded.filePath.replace(/^\//u, ""),
      position: job.payload.position,
      sha256: uploaded.sha256,
      size: uploaded.size,
      sourceImageId: job.payload.sourceImageId,
      sourceUrl: job.payload.sourceUrl,
      url: uploaded.url,
    };
    if (job.payload.type === "autmog.image.upload")
      await syncCanonicalAutmogImage(db, {
        listingId: job.payload.listingId,
        productId: job.payload.productId,
        uploaded: uploadedImage,
      });
    else
      await syncCanonicalSagaImage(db, {
        listingId: job.payload.listingId,
        productId: job.payload.productId,
        uploaded: uploadedImage,
      });
    logger.info(loggerMessages.scraper.processor.imageJobCompleted, {
      attributes: {
        durationMs: Date.now() - startedAt,
        jobId: job.id,
        source: job.payload.source,
        type: job.payload.type,
      },
    });
    return "completed";
  }

  return processTmpImageJob({
    db,
    errorCounter,
    imageFolderPrefix,
    imageStorage,
    job: job as QueueJob<TmpScraperImageJob>,
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
  imageJobs: QueueEnqueueInput<ScraperImageJob>[],
) {
  if (imageJobs.length === 0) {
    return 0;
  }

  return enqueueScraperJobs(queues.images, imageJobs);
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
   * Deterministic queue job identifier.
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
   * Portable queue job being processed.
   */
  job: QueueJob<TmpScraperImageJob>;
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
    const row = await getTmpImageForProcessing(db, job.payload.imageId);

    if (!row) {
      return logMissingImageRow({ job, logger, startedAt });
    }

    if (job.payload.type === "tmp.image.upload") {
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
      imageId: job.payload.imageId,
      status:
        job.payload.type === "tmp.image.upload"
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
   * Portable queue job being processed.
   */
  job: QueueJob<TmpScraperImageJob>;
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
      imageId: job.payload.imageId,
      jobId: job.id,
      skipped: true,
      skipReason: "missing-image-row",
      type: job.payload.type,
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
   * Portable queue job being processed.
   */
  job: QueueJob<TmpScraperImageJob>;
  /**
   * Logger used for scraper lifecycle events.
   */
  logger: Logger;
  /**
   * Operation start time as Unix milliseconds.
   */
  startedAt: number;
}) {
  const primaryErrorMessage = job.payload.type.includes(".upload")
    ? loggerMessages.scraper.image.uploadFailed
    : loggerMessages.scraper.image.deleteFailed;

  errorCounter.record(primaryErrorMessage, {
    error,
    imageId: job.payload.imageId,
    jobId: job.id,
    type: job.payload.type,
  });
  logger.error(primaryErrorMessage, {
    attributes: {
      durationMs: Date.now() - startedAt,
      imageId: job.payload.imageId,
      jobId: job.id,
      type: job.payload.type,
    },
    error,
  });
  logger.error(loggerMessages.scraper.processor.imageJobFailed, {
    attributes: {
      durationMs: Date.now() - startedAt,
      imageId: job.payload.imageId,
      jobId: job.id,
      type: job.payload.type,
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
