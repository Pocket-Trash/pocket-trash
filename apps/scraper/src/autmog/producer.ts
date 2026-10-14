import type { Database } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import { getAutmogPenJobId } from "../queue/job-ids.js";
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

/**
 * Dependencies and fetch controls for an Autmog producer run.
 */
export type RunAutmogProducerOptions = FetchAutmogProductsOptions & {
  /** Database connection retained by the shared producer interface. */
  db: Database;
  /**
   * Logger used for producer lifecycle events.
   */
  logger: Logger;
  /**
   * Scraper queues that receive normalized item jobs.
   */
  queues: ScraperQueues;
  /** Deprecated archive control retained for command compatibility. */
  skipArchiveReconciliation?: boolean;
};

/**
 * Counts and normalized items produced by an Autmog run.
 */
export type RunAutmogProducerResult = {
  /**
   * Number of changed item jobs enqueued.
   */
  enqueuedCount: number;
  /**
   * Total number of products fetched from the source.
   */
  fetchedCount: number;
  /**
   * Normalized source items involved in the producer operation.
   */
  items: NormalizedAutmogPen[];
  /**
   * Number of completed jobs removed before re-enqueueing.
   */
  removedCompletedItemJobs: number;
};

/**
 * Fetches Autmog products and enqueues canonical pen items.
 *
 * @param options - Producer dependencies and fetch controls.
 *
 * @returns Producer counts and all normalized fetched items.
 *
 * @rejects When fetching, synchronization lookup, or queue operations fail.
 */
export async function runAutmogProducer({
  logger,
  db,
  queues,
  skipArchiveReconciliation = false,
  ...fetchOptions
}: RunAutmogProducerOptions): Promise<RunAutmogProducerResult> {
  void db;
  void skipArchiveReconciliation;
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

    const items = products
      .map(normalizeAutmogProduct)
      .filter((item) => item.normalizedData.category === "pen");
    const jobs: {
      /**
       * Queue payload for the scraper job.
       */
      data: ScraperItemJob;
      /**
       * Deterministic identifier used to deduplicate the queue job.
       */
      jobId: string;
      /**
       * Queue job name consumed by the item worker.
       */
      name: string;
    }[] = items.map((item) => ({
      data: {
        item,
        source: scraperSources.autmog,
        type: "autmog.pen",
      },
      jobId: getAutmogPenJobId(item),
      name: "autmog.pen",
    }));
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
        archiveReconciliationJobs: 0,
        enqueuedItemJobs: items.length,
        queue: "scraper-items",
        removedCompletedItemJobs,
        source: scraperSources.autmog,
      },
    });
    logger.info(loggerMessages.scraper.autmog.producerCompleted, {
      attributes: {
        durationMs: Date.now() - startedAt,
        archiveReconciliationJobs: 0,
        enqueuedItemJobs: items.length,
        fetchedCount: products.length,
        removedCompletedItemJobs,
        skipArchiveReconciliation: true,
        source: scraperSources.autmog,
        skippedUnchangedItems: 0,
      },
    });

    return {
      enqueuedCount: items.length,
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
