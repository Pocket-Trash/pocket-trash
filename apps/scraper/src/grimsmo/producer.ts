import type { Database } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import type { QueueEnqueueInput } from "@package/queue";
import { getGrimsmoVariationSyncState } from "../db/grimsmo.js";
import {
  getGrimsmoKnifeVariationJobId,
  getGrimsmoPenVariationJobId,
  getGrimsmoSagaCatalogJobId,
  getGrimsmoVariationBatchJobId,
} from "../queue/job-ids.js";
import { enqueueScraperJobs, type ScraperQueues } from "../queue/queues.js";
import {
  type GrimsmoSourceName,
  type NormalizedGrimsmoKnifeVariation,
  type NormalizedGrimsmoPenVariation,
  type SagaCatalogAppearance,
  type SagaCatalogSnapshot,
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

/**
 * Dependencies, source, and fetch controls for a Grimsmo producer run.
 */
export type RunGrimsmoProducerOptions = FetchGrimsmoProductsOptions & {
  /**
   * Database used to compare persisted synchronization state.
   */
  db: Database;
  /**
   * Logger used for producer lifecycle events.
   */
  logger: Logger;
  /**
   * Scraper queues that receive normalized item jobs.
   */
  queues: ScraperQueues;
  /**
   * Whether to omit the batch job that reconciles archived listings.
   */
  skipArchiveReconciliation?: boolean;
};

/**
 * Counts and normalized items produced by a Grimsmo run.
 */
export type RunGrimsmoProducerResult = {
  /**
   * Number of archive variations retained after inventory duplicates are removed.
   */
  archivedFetchedCount: number;
  /**
   * Number of changed item jobs enqueued.
   */
  enqueuedCount: number;
  /**
   * Total normalized variations retained after merging source collections.
   */
  fetchedCount: number;
  /**
   * Number of normalized variations from the inventory collection.
   */
  inventoryFetchedCount: number;
  /**
   * Normalized source items involved in the producer operation.
   */
  items: (NormalizedGrimsmoKnifeVariation | NormalizedGrimsmoPenVariation)[];
  /**
   * Number of completed jobs removed before re-enqueueing.
   */
  removedCompletedItemJobs: number;
};

/**
 * Fetches one Grimsmo source and enqueues changed variations plus reconciliation.
 *
 * @param options - Producer dependencies, source, and fetch controls.
 *
 * @returns Producer counts and all normalized fetched variations.
 *
 * @rejects When fetching, synchronization lookup, or queue operations fail.
 */
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
    let jobs: QueueEnqueueInput<ScraperItemJob>[];
    let enqueuedItemJobs: number;
    let skippedUnchangedItems: number;

    if (definition.kind === "pen") {
      const snapshot = createSagaCatalogSnapshot(
        items as NormalizedGrimsmoPenVariation[],
      );
      jobs = [
        {
          id: getGrimsmoSagaCatalogJobId(snapshot),
          name: "grimsmo.sagaCatalog",
          payload: {
            snapshot,
            source: scraperSources.grimsmoSaga,
            type: "grimsmo.sagaCatalog",
          },
        },
      ];
      enqueuedItemJobs = jobs.length;
      skippedUnchangedItems = 0;
    } else {
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
      jobs = createJobs({
        changedItems,
        items,
        skipArchiveReconciliation,
        source,
      });
      enqueuedItemJobs = changedItems.length;
      skippedUnchangedItems = items.length - changedItems.length;
    }
    const archiveReconciliationJobs =
      definition.kind === "pen" || skipArchiveReconciliation ? 0 : 1;
    const removedCompletedItemJobs = await enqueueScraperJobs(
      queues.items,
      jobs,
    );

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
        archiveReconciliationJobs,
        enqueuedItemJobs,
        queue: "scraper-items",
        removedCompletedItemJobs,
        source,
      },
    });
    logger.info(loggerMessages.scraper.grimsmo.producerCompleted, {
      attributes: {
        archivedFetchedCount: archiveItems.length,
        archiveReconciliationJobs,
        durationMs: Date.now() - startedAt,
        enqueuedItemJobs,
        fetchedCount: items.length,
        inventoryFetchedCount: inventoryItems.length,
        removedCompletedItemJobs,
        skipArchiveReconciliation,
        source,
        skippedUnchangedItems,
      },
    });

    return {
      archivedFetchedCount: archiveItems.length,
      enqueuedCount: enqueuedItemJobs,
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

/**
 * Builds the bounded canonical Saga snapshot sent through the item queue.
 *
 * @param items - Normalized Saga listings from inventory and archive feeds.
 * @returns Compact taxonomy, appearance, and image candidates.
 */
export function createSagaCatalogSnapshot(
  items: readonly NormalizedGrimsmoPenVariation[],
): SagaCatalogSnapshot {
  const appearances: SagaCatalogAppearance[] = [];
  const appearanceKeys = new Set<string>();
  const images: SagaCatalogSnapshot["images"] = [];
  const imageUrls = new Set<string>();

  for (const item of items) {
    const appearance = {
      colorNames: uniqueSorted([...item.bodyColors, ...item.sliderColors]),
      finishNames: uniqueSorted(item.bodyFinishes),
      sliderOption: item.sliderStyle,
    };
    const appearanceKey = JSON.stringify(appearance);
    if (
      appearances.length < 100 &&
      !appearanceKeys.has(appearanceKey) &&
      (appearance.colorNames.length > 0 ||
        appearance.finishNames.length > 0 ||
        appearance.sliderOption !== null)
    ) {
      appearanceKeys.add(appearanceKey);
      appearances.push(appearance);
    }

    for (const image of item.images) {
      if (images.length >= 30 || imageUrls.has(image.sourceUrl)) continue;
      imageUrls.add(image.sourceUrl);
      images.push({
        listingUrl: item.productUrl,
        sourceHandle: item.sourceHandle,
        sourceImageId: image.sourceImageId ?? image.sourceHash,
        sourceProductId: item.sourceProductId,
        sourceUrl: image.sourceUrl,
      });
    }
  }

  return {
    appearances,
    colorNames: uniqueSorted(
      items.flatMap((item) => [...item.bodyColors, ...item.sliderColors]),
    ),
    finishNames: uniqueSorted(items.flatMap((item) => item.bodyFinishes)),
    images,
    materialNames: uniqueSorted(
      items.flatMap((item) => [...item.bodyMaterials, ...item.sliderMaterials]),
    ),
    sliderOptions: uniqueSorted(
      items.flatMap((item) =>
        item.sliderStyle === null ? [] : [item.sliderStyle],
      ),
    ),
  };
}

/**
 * Returns sorted unique non-empty labels.
 *
 * @param values - Source labels to deduplicate.
 * @returns Sorted unique labels.
 */
function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right),
  );
}

/**
 * Builds changed-item jobs and the optional archive reconciliation batch job.
 *
 * @param options - Normalized items, source, and archive reconciliation controls.
 *
 * @returns Queue jobs in item-first, reconciliation-last order.
 */
function createJobs({
  changedItems,
  items,
  skipArchiveReconciliation,
  source,
}: {
  /**
   * Normalized items whose persisted synchronization state changed.
   */
  changedItems: (
    | NormalizedGrimsmoKnifeVariation
    | NormalizedGrimsmoPenVariation
  )[];
  /**
   * Normalized source items involved in the producer operation.
   */
  items: (NormalizedGrimsmoKnifeVariation | NormalizedGrimsmoPenVariation)[];
  /**
   * Whether to omit the batch job that reconciles archived listings.
   */
  skipArchiveReconciliation: boolean;
  /**
   * Grimsmo scraper source identifier.
   */
  source: GrimsmoSourceName;
}) {
  const itemJobs = changedItems.map((item) => {
    if (source === scraperSources.grimsmoSaga) {
      const penItem = item as NormalizedGrimsmoPenVariation;
      return {
        id: getGrimsmoPenVariationJobId(source, penItem),
        name: "grimsmo.penVariation",
        payload: {
          item: penItem,
          source,
          type: "grimsmo.penVariation" as const,
        },
      };
    }

    const knifeItem = item as NormalizedGrimsmoKnifeVariation;
    return {
      id: getGrimsmoKnifeVariationJobId(source, knifeItem),
      name: "grimsmo.knifeVariation",
      payload: {
        item: knifeItem,
        source,
        type: "grimsmo.knifeVariation" as const,
      },
    };
  });
  const sourceHandles = items.map((item) => item.sourceHandle);
  const inventorySourceHandles = items
    .filter((item) => item.sourceCollection === "inventory")
    .map((item) => item.sourceHandle);

  if (skipArchiveReconciliation) {
    return itemJobs satisfies QueueEnqueueInput<ScraperItemJob>[];
  }

  const batchJob =
    source === scraperSources.grimsmoSaga
      ? {
          id: getGrimsmoVariationBatchJobId({
            inventorySourceHandles,
            source,
            sourceHandles,
          }),
          name: "grimsmo.penVariationBatch",
          payload: {
            items: items as NormalizedGrimsmoPenVariation[],
            source,
            type: "grimsmo.penVariationBatch" as const,
          },
        }
      : {
          id: getGrimsmoVariationBatchJobId({
            inventorySourceHandles,
            source,
            sourceHandles,
          }),
          name: "grimsmo.knifeVariationBatch",
          payload: {
            items: items as NormalizedGrimsmoKnifeVariation[],
            source: source as
              | typeof scraperSources.grimsmoFjell
              | typeof scraperSources.grimsmoNorseman
              | typeof scraperSources.grimsmoRask,
            type: "grimsmo.knifeVariationBatch" as const,
          },
        };

  return [...itemJobs, batchJob] satisfies QueueEnqueueInput<ScraperItemJob>[];
}
