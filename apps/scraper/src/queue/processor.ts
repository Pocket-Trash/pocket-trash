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

export type QueueDrainStats = {
  completed: number;
  failed: number;
  skipped: number;
};

export type RunQueueProcessorOptions = {
  batchSize: {
    images: number;
    items: number;
  };
  concurrency: number;
  connection: Redis;
  db: Database;
  imageFolderPrefix?: string;
  imageStorage: ImagesService;
  logger: Logger;
  queues: ScraperQueues;
};

export type RunQueueProcessorResult = {
  images: QueueDrainStats;
  items: QueueDrainStats;
};

export type QueueDeadLetterStats = {
  failed: number;
  requeueFailed: number;
  requeued: number;
};

export type RunQueueDeadLetterProcessorOptions = {
  batchSize: {
    images: number;
    items: number;
  };
  logger: Logger;
  queues: ScraperQueues;
};

export type RunQueueDeadLetterProcessorResult = {
  images: QueueDeadLetterStats;
  items: QueueDeadLetterStats;
};

export type ProcessorErrorSummary = {
  errorsByMessage: Record<string, number>;
  sampleErrors: ProcessorErrorSample[];
  totalErrors: number;
};

type ProcessorErrorCounter = {
  record: (message: string, sample?: ProcessorErrorSampleInput) => void;
  summary: () => ProcessorErrorSummary;
};
type ProcessorErrorSample = {
  error?: {
    cause?: {
      message: string;
      name: string;
    };
    message: string;
    name: string;
  };
  imageId?: number;
  jobId?: string;
  message: string;
  source?: string;
  type?: string;
};
type ProcessorErrorSampleInput = Omit<
  ProcessorErrorSample,
  "error" | "message"
> & {
  error?: unknown;
};
type ImageJobResult = "completed" | "skipped";

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
      handler: (job) =>
        processItemJob({ db, errorCounter, job, logger, queues }),
      logger,
      queueName: scraperQueueNames.items,
    });
    const images = await drainQueue<ScraperImageJob>({
      batchSize: batchSize.images,
      concurrency,
      connection,
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

async function processItemJob({
  db,
  errorCounter,
  job,
  logger,
  queues,
}: {
  db: Database;
  errorCounter: ProcessorErrorCounter;
  job: Job<ScraperItemJob>;
  logger: Logger;
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

async function processImageJob({
  db,
  errorCounter,
  imageFolderPrefix,
  imageStorage,
  job,
  logger,
}: {
  db: Database;
  errorCounter: ProcessorErrorCounter;
  imageFolderPrefix?: string;
  imageStorage: ImagesService;
  job: Job<ScraperImageJob>;
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

async function enqueueImageJobs(
  queues: ScraperQueues,
  imageJobs: {
    data: ScraperImageJob;
    name: string;
    opts: {
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
  durationMs: number;
  imageJobs: number;
  jobId: string | undefined;
  logger: Logger;
  removedCompletedImageJobs: number;
  result: {
    archived?: boolean;
    created: boolean;
    deleteImageJobs: readonly unknown[];
    updated: boolean;
    uploadImageJobs: readonly unknown[];
    versioned: boolean;
  };
  source: string;
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

async function processTmpImageJob({
  db,
  errorCounter,
  imageFolderPrefix,
  imageStorage,
  job,
  logger,
  startedAt,
}: {
  db: Database;
  errorCounter: ProcessorErrorCounter;
  imageFolderPrefix?: string;
  imageStorage: ImagesService;
  job: Job<ScraperImageJob>;
  logger: Logger;
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
        fileName: getTmpImageFileName({
          sourceHash: row.image.sourceHash,
          sourceImageId: row.image.sourceImageId,
        }),
        folder: buildImageFolder({
          entityId: getTmpImageFolderKey({
            productId: row.image.productId,
            productVariationId: row.image.productVariationId,
          }),
          prefix: imageFolderPrefix,
        }),
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

function logMissingImageRow({
  job,
  logger,
  startedAt,
}: {
  job: Job<ScraperImageJob>;
  logger: Logger;
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

function logImageJobError({
  error,
  errorCounter,
  job,
  logger,
  startedAt,
}: {
  error: unknown;
  errorCounter: ProcessorErrorCounter;
  job: Job<ScraperImageJob>;
  logger: Logger;
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

function getTmpImageFileName({
  sourceHash,
  sourceImageId,
}: {
  sourceHash: string;
  sourceImageId: string | null;
}): string {
  const suffix = sourceImageId ?? sourceHash.replace("sha256:", "");

  return `${suffix}.webp`;
}

export function getTmpImageFolderKey({
  productId,
  productVariationId,
}: {
  productId: number;
  productVariationId: number | null;
}) {
  return productVariationId === null
    ? String(productId)
    : `${productId}-${productVariationId}`;
}

function getTmpImageTags({
  productId,
  productVariationId,
  source,
}: {
  productId: number;
  productVariationId: number | null;
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

export function createProcessorErrorCounter(): ProcessorErrorCounter {
  const errorsByMessage = new Map<string, number>();
  const sampleErrors: ProcessorErrorSample[] = [];
  const maxSampleErrors = 5;

  return {
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

export function buildImageFolder({
  entityId,
  prefix,
}: {
  entityId: string;
  prefix?: string;
}) {
  const normalizedPrefix = normalizeImageFolderPrefix(prefix);
  const pathSegments = [normalizedPrefix, "products", entityId].filter(Boolean);

  return `/${pathSegments.join("/")}`;
}

function normalizeImageFolderPrefix(prefix: string | undefined) {
  return prefix?.replace(/^\/+|\/+$/g, "");
}

function logProcessorErrorSummary({
  command,
  durationMs,
  errorCounter,
  logger,
  processor,
}: {
  command: "process:queue";
  durationMs: number;
  errorCounter: ProcessorErrorCounter;
  logger: Logger;
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

async function drainQueue<TJobData>({
  batchSize,
  concurrency,
  connection,
  handler,
  logger,
  queueName,
}: {
  batchSize: number;
  concurrency: number;
  connection: Redis;
  handler: (job: Job<TJobData>) => Promise<"completed" | "skipped" | undefined>;
  logger: Logger;
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
    const finishDrain = ({ force = false }: { force?: boolean } = {}) => {
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

async function processDeadLetters<TJobData>({
  batchSize,
  logger,
  queue,
  queueName,
}: {
  batchSize: number;
  logger: Logger;
  queue: Queue<TJobData>;
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
