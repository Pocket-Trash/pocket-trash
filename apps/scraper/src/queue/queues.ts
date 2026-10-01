import { type JobsOptions, Queue } from "bullmq";
import type { Redis } from "ioredis";
import {
  type ScraperImageJob,
  type ScraperItemJob,
  scraperQueueNames,
} from "../scraper-types.js";

/**
 * Retry and retention defaults shared by scraper queues.
 */
const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: {
    delay: 30_000,
    type: "exponential",
  },
  removeOnComplete: {
    age: 60 * 60 * 24,
    count: 1_000,
  },
  removeOnFail: {
    age: 60 * 60 * 24 * 7,
  },
};

/**
 * Item and image queues plus their shared close operation.
 */
export type ScraperQueues = {
  /**
   * Closes both scraper queues.
   *
   * @returns A promise that resolves after both queues close.
   *
   * @rejects When queue processing or a required dependency fails.
   */
  close: () => Promise<void>;
  /**
   * Queue containing scraper image upload and deletion jobs.
   */
  images: Queue<ScraperImageJob>;
  /**
   * Queue containing normalized item and reconciliation jobs.
   */
  items: Queue<ScraperItemJob>;
};

/**
 * Actionable BullMQ job counts for one scraper queue.
 */
export type ScraperQueueJobCounts = {
  /**
   * Number of jobs currently being processed.
   */
  active: number;
  /**
   * Number of jobs waiting for a delay to expire.
   */
  delayed: number;
  /**
   * Number of jobs waiting to be processed.
   */
  waiting: number;
};

/**
 * Creates the item and image BullMQ queues over one Redis connection.
 *
 * @param connection - Redis connection shared by both queues.
 *
 * @returns Configured item and image queues.
 */
export function createScraperQueues(connection: Redis): ScraperQueues {
  const items = new Queue<ScraperItemJob>(scraperQueueNames.items, {
    connection,
    defaultJobOptions,
  });
  const images = new Queue<ScraperImageJob>(scraperQueueNames.images, {
    connection,
    defaultJobOptions,
  });

  return {
    /**
     * Closes both scraper queues.
     *
     * @rejects When queue processing or a required dependency fails.
     */
    async close() {
      await Promise.all([items.close(), images.close()]);
    },
    images,
    items,
  };
}

/**
 * Removes completed jobs whose deterministic IDs will be reused.
 *
 * @param queue - BullMQ queue containing the jobs.
 *
 * @param jobIds - Deterministic job IDs that may be reused.
 *
 * @returns Number of completed jobs removed.
 *
 * @template TJobData - Queue job payload type.
 *
 * @rejects When queue processing or a required dependency fails.
 */
export async function removeCompletedJobsById<TJobData>(
  queue: Queue<TJobData>,
  jobIds: readonly string[],
) {
  let removed = 0;

  for (const jobId of new Set(jobIds)) {
    const job = await queue.getJob(jobId);

    if (!job || (await job.getState()) !== "completed") {
      continue;
    }

    await job.remove();
    removed += 1;
  }

  return removed;
}

/**
 * Loads actionable job counts for both scraper queues.
 *
 * @param queues - Item and image queues whose counts are queried.
 *
 * @returns Actionable counts keyed by image and item queue.
 *
 * @rejects When queue processing or a required dependency fails.
 */
export async function getScraperQueueJobCounts(
  queues: Pick<ScraperQueues, "images" | "items">,
) {
  const [items, images] = await Promise.all([
    queues.items.getJobCounts("active", "delayed", "waiting"),
    queues.images.getJobCounts("active", "delayed", "waiting"),
  ]);

  return {
    images: normalizeQueueCounts(images),
    items: normalizeQueueCounts(items),
  };
}

/**
 * Checks whether either scraper queue has active, delayed, or waiting work.
 *
 * @param counts - Already-normalized queue counts to inspect.
 *
 * @returns Whether any queue has actionable work.
 */
export function hasActionableQueueJobs(counts: {
  /**
   * Actionable image-queue job counts.
   */
  images: ScraperQueueJobCounts;
  /**
   * Actionable item-queue job counts.
   */
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
 * Fills missing BullMQ job-count fields with zero.
 *
 * @param counts - Queue counts to inspect or normalize.
 *
 * @returns Complete active, delayed, and waiting counts.
 */
function normalizeQueueCounts(counts: Partial<ScraperQueueJobCounts>) {
  return {
    active: counts.active ?? 0,
    delayed: counts.delayed ?? 0,
    waiting: counts.waiting ?? 0,
  };
}
