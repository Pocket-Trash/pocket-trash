import type { Database } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import { getAutmogPenSyncState } from "../db/autmog.js";
import { getAutmogArchiveJobId, getAutmogPenJobId } from "../queue/job-ids.js";
import {
  removeCompletedJobsById,
  type ScraperQueues,
} from "../queue/queues.js";
import {
  type NormalizedAutmogPen,
  type ScraperItemJob,
  scraperSources,
} from "../scraper-types.js";
import { normalizeAutmogProduct } from "./normalize.js";
import {
  type FetchAutmogProductsOptions,
  fetchAutmogProducts,
} from "./shopify.js";

export type RunAutmogProducerOptions = FetchAutmogProductsOptions & {
  db: Database;
  logger: Logger;
  queues: ScraperQueues;
  skipArchiveReconciliation?: boolean;
};

export type RunAutmogProducerResult = {
  enqueuedCount: number;
  fetchedCount: number;
  items: NormalizedAutmogPen[];
  removedCompletedItemJobs: number;
};

export async function runAutmogProducer({
  logger,
  db,
  queues,
  skipArchiveReconciliation = false,
  ...fetchOptions
}: RunAutmogProducerOptions): Promise<RunAutmogProducerResult> {
  const startedAt = Date.now();
  logger.info(loggerMessages.scraper.autmog.producerStarted, {
    attributes: {
      source: scraperSources.autmog,
    },
  });

  try {
    const products = await fetchAutmogProducts(fetchOptions);
    logger.info(loggerMessages.scraper.autmog.fetchCompleted, {
      attributes: {
        durationMs: Date.now() - startedAt,
        fetchedCount: products.length,
        source: scraperSources.autmog,
      },
    });

    const items = products.map(normalizeAutmogProduct);
    const seenSourceProductIds = items.map((item) => item.sourceProductId);
    const syncStateBySourceProductId = new Map(
      (await getAutmogPenSyncState(db, seenSourceProductIds)).map((state) => [
        state.sourceProductId,
        state,
      ]),
    );
    const changedItems = items.filter((item) => {
      const state = syncStateBySourceProductId.get(item.sourceProductId);

      return (
        !state ||
        state.archivedAt !== null ||
        state.detailsHash !== item.detailsHash ||
        state.imageSetHash !== item.imageSetHash
      );
    });
    const jobs: {
      data: ScraperItemJob;
      jobId: string;
      name: string;
    }[] = changedItems.map((item) => ({
      data: {
        item,
        source: scraperSources.autmog,
        type: "autmog.pen",
      },
      jobId: getAutmogPenJobId(item),
      name: "autmog.pen",
    }));
    if (!skipArchiveReconciliation) {
      jobs.push({
        data: {
          seenSourceProductIds,
          source: scraperSources.autmog,
          type: "autmog.archiveMissing",
        },
        jobId: getAutmogArchiveJobId(seenSourceProductIds),
        name: "autmog.archiveMissing",
      });
    }

    const removedCompletedItemJobs = await removeCompletedJobsById(
      queues.items,
      jobs.map((job) => job.jobId),
    );

    await queues.items.addBulk(
      jobs.map((job) => ({
        data: job.data,
        name: job.name,
        opts: {
          jobId: job.jobId,
        },
      })),
    );

    logger.info(loggerMessages.scraper.queue.enqueueCompleted, {
      attributes: {
        archiveReconciliationJobs: skipArchiveReconciliation ? 0 : 1,
        enqueuedItemJobs: changedItems.length,
        queue: "scraper-items",
        removedCompletedItemJobs,
        source: scraperSources.autmog,
      },
    });
    logger.info(loggerMessages.scraper.autmog.producerCompleted, {
      attributes: {
        durationMs: Date.now() - startedAt,
        archiveReconciliationJobs: skipArchiveReconciliation ? 0 : 1,
        enqueuedItemJobs: changedItems.length,
        fetchedCount: products.length,
        removedCompletedItemJobs,
        skipArchiveReconciliation,
        source: scraperSources.autmog,
        skippedUnchangedItems: items.length - changedItems.length,
      },
    });

    return {
      enqueuedCount: changedItems.length,
      fetchedCount: products.length,
      items,
      removedCompletedItemJobs,
    };
  } catch (error) {
    logger.error(loggerMessages.scraper.autmog.fetchFailed, {
      attributes: {
        durationMs: Date.now() - startedAt,
        source: scraperSources.autmog,
      },
      error,
    });
    logger.error(loggerMessages.scraper.queue.enqueueFailed, {
      attributes: {
        source: scraperSources.autmog,
      },
      error,
    });
    throw error;
  }
}
