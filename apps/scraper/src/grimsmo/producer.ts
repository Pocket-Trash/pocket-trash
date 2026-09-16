import type { Database } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import { getGrimsmoVariationSyncState } from "../db/grimsmo.js";
import {
  getGrimsmoKnifeVariationJobId,
  getGrimsmoPenVariationJobId,
  getGrimsmoVariationBatchJobId,
} from "../queue/job-ids.js";
import {
  removeCompletedJobsById,
  type ScraperQueues,
} from "../queue/queues.js";
import {
  type GrimsmoSourceName,
  type NormalizedGrimsmoKnifeVariation,
  type NormalizedGrimsmoPenVariation,
  type ScraperItemJob,
  scraperSources,
} from "../scraper-types.js";
import {
  normalizeGrimsmoKnifeVariation,
  normalizeGrimsmoPenVariation,
} from "./normalize.js";
import {
  type FetchGrimsmoProductsOptions,
  fetchGrimsmoProducts,
  getGrimsmoSourceDefinition,
} from "./source.js";

export type RunGrimsmoProducerOptions = FetchGrimsmoProductsOptions & {
  db: Database;
  logger: Logger;
  queues: ScraperQueues;
  skipArchiveReconciliation?: boolean;
};

export type RunGrimsmoProducerResult = {
  archivedFetchedCount: number;
  enqueuedCount: number;
  fetchedCount: number;
  inventoryFetchedCount: number;
  items: (NormalizedGrimsmoKnifeVariation | NormalizedGrimsmoPenVariation)[];
  removedCompletedItemJobs: number;
};

export async function runGrimsmoProducer({
  db,
  logger,
  queues,
  skipArchiveReconciliation = false,
  source,
  ...fetchOptions
}: RunGrimsmoProducerOptions): Promise<RunGrimsmoProducerResult> {
  const startedAt = Date.now();
  const definition = getGrimsmoSourceDefinition(source);

  logger.info(loggerMessages.scraper.grimsmo.producerStarted, {
    attributes: {
      source,
    },
  });

  try {
    const fetchedProducts = await fetchGrimsmoProducts({
      ...fetchOptions,
      source,
    });
    const items = fetchedProducts.map((item) => {
      if (definition.kind === "pen") {
        return normalizeGrimsmoPenVariation({
          collectionKind: item.collectionKind,
          product: item.product,
          source: scraperSources.grimsmoSaga,
        });
      }

      return normalizeGrimsmoKnifeVariation({
        collectionKind: item.collectionKind,
        product: item.product,
        source: definition.source,
      });
    });
    const inventoryItems = items.filter(
      (item) => item.sourceCollection === "inventory",
    );
    const archiveItems = items.filter(
      (item) => item.sourceCollection === "archive",
    );
    const syncStateBySourceHandle = new Map(
      (
        await getGrimsmoVariationSyncState(
          db,
          source,
          items.map((item) => item.sourceHandle),
        )
      ).map((state) => [state.sourceHandle, state]),
    );
    const changedItems = items.filter((item) => {
      const state = syncStateBySourceHandle.get(item.sourceHandle);

      return (
        !state ||
        Boolean(state.archivedAt) !== (item.sourceCollection === "archive") ||
        state.detailsHash !== item.detailsHash ||
        state.imageSetHash !== item.imageSetHash ||
        state.parentDetailsHash !== item.product.detailsHash ||
        state.sourceCollection !== item.sourceCollection
      );
    });
    const jobs = createJobs({
      changedItems,
      items,
      skipArchiveReconciliation,
      source,
    });
    const removedCompletedItemJobs = await removeCompletedJobsById(
      queues.items,
      jobs.map((job) => job.opts.jobId).filter(Boolean),
    );

    await queues.items.addBulk(jobs);

    logger.info(loggerMessages.scraper.grimsmo.fetchCompleted, {
      attributes: {
        archivedFetchedCount: archiveItems.length,
        durationMs: Date.now() - startedAt,
        fetchedCount: items.length,
        inventoryFetchedCount: inventoryItems.length,
        source,
      },
    });
    logger.info(loggerMessages.scraper.queue.enqueueCompleted, {
      attributes: {
        archiveReconciliationJobs: skipArchiveReconciliation ? 0 : 1,
        enqueuedItemJobs: changedItems.length,
        queue: "scraper-items",
        removedCompletedItemJobs,
        source,
      },
    });
    logger.info(loggerMessages.scraper.grimsmo.producerCompleted, {
      attributes: {
        archivedFetchedCount: archiveItems.length,
        archiveReconciliationJobs: skipArchiveReconciliation ? 0 : 1,
        durationMs: Date.now() - startedAt,
        enqueuedItemJobs: changedItems.length,
        fetchedCount: items.length,
        inventoryFetchedCount: inventoryItems.length,
        removedCompletedItemJobs,
        skipArchiveReconciliation,
        source,
        skippedUnchangedItems: items.length - changedItems.length,
      },
    });

    return {
      archivedFetchedCount: archiveItems.length,
      enqueuedCount: changedItems.length,
      fetchedCount: items.length,
      inventoryFetchedCount: inventoryItems.length,
      items,
      removedCompletedItemJobs,
    };
  } catch (error) {
    logger.error(loggerMessages.scraper.grimsmo.fetchFailed, {
      attributes: {
        durationMs: Date.now() - startedAt,
        source,
      },
      error,
    });
    logger.error(loggerMessages.scraper.queue.enqueueFailed, {
      attributes: {
        source,
      },
      error,
    });
    throw error;
  }
}

function createJobs({
  changedItems,
  items,
  skipArchiveReconciliation,
  source,
}: {
  changedItems: (
    | NormalizedGrimsmoKnifeVariation
    | NormalizedGrimsmoPenVariation
  )[];
  items: (NormalizedGrimsmoKnifeVariation | NormalizedGrimsmoPenVariation)[];
  skipArchiveReconciliation: boolean;
  source: GrimsmoSourceName;
}) {
  const itemJobs = changedItems.map((item) => {
    if (source === scraperSources.grimsmoSaga) {
      const penItem = item as NormalizedGrimsmoPenVariation;
      return {
        data: {
          item: penItem,
          source,
          type: "grimsmo.penVariation" as const,
        },
        name: "grimsmo.penVariation",
        opts: {
          jobId: getGrimsmoPenVariationJobId(source, penItem),
        },
      };
    }

    const knifeItem = item as NormalizedGrimsmoKnifeVariation;
    return {
      data: {
        item: knifeItem,
        source,
        type: "grimsmo.knifeVariation" as const,
      },
      name: "grimsmo.knifeVariation",
      opts: {
        jobId: getGrimsmoKnifeVariationJobId(source, knifeItem),
      },
    };
  });
  const sourceHandles = items.map((item) => item.sourceHandle);
  const inventorySourceHandles = items
    .filter((item) => item.sourceCollection === "inventory")
    .map((item) => item.sourceHandle);

  if (skipArchiveReconciliation) {
    return itemJobs satisfies {
      data: ScraperItemJob;
      name: string;
      opts: { jobId: string };
    }[];
  }

  const batchJob =
    source === scraperSources.grimsmoSaga
      ? {
          data: {
            items: items as NormalizedGrimsmoPenVariation[],
            source,
            type: "grimsmo.penVariationBatch" as const,
          },
          name: "grimsmo.penVariationBatch",
          opts: {
            jobId: getGrimsmoVariationBatchJobId({
              inventorySourceHandles,
              source,
              sourceHandles,
            }),
          },
        }
      : {
          data: {
            items: items as NormalizedGrimsmoKnifeVariation[],
            source: source as
              | typeof scraperSources.grimsmoFjell
              | typeof scraperSources.grimsmoNorseman
              | typeof scraperSources.grimsmoRask,
            type: "grimsmo.knifeVariationBatch" as const,
          },
          name: "grimsmo.knifeVariationBatch",
          opts: {
            jobId: getGrimsmoVariationBatchJobId({
              inventorySourceHandles,
              source,
              sourceHandles,
            }),
          },
        };

  return [...itemJobs, batchJob] satisfies {
    data: ScraperItemJob;
    name: string;
    opts: { jobId: string };
  }[];
}
