import {
  createBullMqQueueAdapter,
  type DefinedQueue,
  type QueueAdapter,
  type QueueCounts,
  type QueueEnqueueInput,
} from "@package/queue";
import { z } from "zod";
import {
  type ScraperImageJob,
  type ScraperItemJob,
  scraperQueueNames,
  scraperSources,
} from "../scraper-types.js";

/** Retry and retention policy shared by scraper queues. */
const scraperQueuePolicy = {
  deduplication: { replaceCompleted: true },
  retention: {
    completed: { ageSeconds: 60 * 60 * 24, count: 1_000 },
    failed: { ageSeconds: 60 * 60 * 24 * 7 },
  },
  retry: {
    attempts: 5,
    backoff: { delayMs: 30_000, type: "exponential" as const },
  },
};

/** Runtime validator for scraper item payloads persisted in Redis. */
const scraperItemJobSchema = z.custom<ScraperItemJob>(isScraperItemJob, {
  error: "Invalid scraper item queue payload.",
});

/** Runtime validator for scraper image payloads persisted in Redis. */
const scraperImageJobSchema = z.custom<ScraperImageJob>(isScraperImageJob, {
  error: "Invalid scraper image queue payload.",
});

/** Item and image queues plus their shared close operation. */
export type ScraperQueues = {
  /**
   * Closes both queues and their adapter connections.
   *
   * @returns Queue cleanup completion.
   */
  close: () => Promise<void>;
  /** Queue containing scraper image upload and deletion jobs. */
  images: DefinedQueue<ScraperImageJob>;
  /** Queue containing normalized item and reconciliation jobs. */
  items: DefinedQueue<ScraperItemJob>;
};

/** Actionable counts for one scraper queue. */
export type ScraperQueueJobCounts = Pick<
  QueueCounts,
  "active" | "delayed" | "waiting"
>;

/**
 * Creates scraper queues over an owned production adapter.
 *
 * @param redisUrl - Redis URL used by the default production adapter.
 * @param adapter - Optional transport adapter supplied by tests.
 * @returns Configured item and image queues.
 */
export function createScraperQueues(
  redisUrl: string,
  adapter: QueueAdapter = createBullMqQueueAdapter({ redisUrl }),
): ScraperQueues {
  const items = adapter.define({
    ...scraperQueuePolicy,
    mode: "bounded",
    name: scraperQueueNames.items,
    schema: scraperItemJobSchema,
  });
  const images = adapter.define({
    ...scraperQueuePolicy,
    mode: "bounded",
    name: scraperQueueNames.images,
    schema: scraperImageJobSchema,
  });

  return {
    /**
     * Closes queue and connection resources.
     *
     * @returns Queue cleanup completion.
     */
    close: () => adapter.close(),
    images,
    items,
  };
}

/**
 * Enqueues a batch and returns the number of replaced completed jobs.
 *
 * @param queue - Typed scraper queue receiving jobs.
 * @param jobs - Jobs with deterministic identifiers.
 * @returns Number of retained completed jobs replaced by the batch.
 * @template TPayload - Scraper queue payload type.
 */
export async function enqueueScraperJobs<TPayload>(
  queue: DefinedQueue<TPayload>,
  jobs: readonly QueueEnqueueInput<TPayload>[],
) {
  const results = await queue.enqueueMany(jobs);
  return results.filter((result) => result.replacedCompleted).length;
}

/**
 * Loads actionable job counts for both scraper queues.
 *
 * @param queues - Scraper queues to inspect.
 * @returns Actionable counts keyed by queue purpose.
 */
export async function getScraperQueueJobCounts(queues: ScraperQueues) {
  const [items, images] = await Promise.all([
    queues.items.counts(),
    queues.images.counts(),
  ]);
  return {
    images: actionableCounts(images),
    items: actionableCounts(items),
  };
}

/**
 * Checks whether either scraper queue has actionable work.
 *
 * @param counts - Actionable counts for both scraper queues.
 * @returns Whether any queue contains active, delayed, or waiting work.
 */
export function hasActionableQueueJobs(counts: {
  /** Actionable image-queue job counts. */
  images: ScraperQueueJobCounts;
  /** Actionable item-queue job counts. */
  items: ScraperQueueJobCounts;
}) {
  return (
    counts.images.active +
      counts.images.delayed +
      counts.images.waiting +
      counts.items.active +
      counts.items.delayed +
      counts.items.waiting >
    0
  );
}

/**
 * Selects counts used to decide whether a scraper drain is needed.
 *
 * @param counts - Complete portable queue counts.
 * @returns Counts relevant to scraper processing.
 */
function actionableCounts(counts: QueueCounts): ScraperQueueJobCounts {
  return {
    active: counts.active,
    delayed: counts.delayed,
    waiting: counts.waiting,
  };
}

/**
 * Checks the common envelope and job-specific data of one item payload.
 *
 * @param value - Unknown persisted payload.
 * @returns Whether the payload is a supported scraper item job.
 */
function isScraperItemJob(value: unknown): value is ScraperItemJob {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (!Object.values(scraperSources).includes(value.source as never))
    return false;

  if (value.type === "grimsmo.sagaCatalog") return isRecord(value.snapshot);
  if (value.type === "grimsmo.sagaMaterials")
    return isStringArray(value.materialNames);
  if (value.type.endsWith("VariationBatch")) return Array.isArray(value.items);
  return (
    ["autmog.pen", "grimsmo.knifeVariation", "grimsmo.penVariation"].includes(
      value.type,
    ) && isRecord(value.item)
  );
}

/**
 * Checks the common envelope and job-specific data of one image payload.
 *
 * @param value - Unknown persisted payload.
 * @returns Whether the payload is a supported scraper image job.
 */
function isScraperImageJob(value: unknown): value is ScraperImageJob {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (!Object.values(scraperSources).includes(value.source as never))
    return false;

  if (value.type === "tmp.image.delete")
    return typeof value.imageId === "number";
  if (value.type === "tmp.image.upload") {
    return (
      typeof value.imageId === "number" && typeof value.sourceHash === "string"
    );
  }
  return (
    ["autmog.image.upload", "grimsmo.sagaImage.upload"].includes(value.type) &&
    typeof value.listingId === "number" &&
    typeof value.position === "number" &&
    typeof value.productId === "number" &&
    typeof value.sourceImageId === "string" &&
    typeof value.sourceUrl === "string"
  );
}

/**
 * Checks whether an unknown value is an object-like record.
 *
 * @param value - Unknown candidate.
 * @returns Whether the candidate is a non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks whether an unknown value is an array of strings.
 *
 * @param value - Unknown candidate.
 * @returns Whether every array member is a string.
 */
function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}
