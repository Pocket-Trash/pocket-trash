import type { z } from "zod";

export { createBullMqQueueAdapter } from "./bullmq.js";

/** Result of enqueueing one stable queue job. */
export type QueueEnqueueResult = {
  /** Whether this call persisted a new job. */
  accepted: boolean;
  /** Whether a retained completed job was removed before enqueueing. */
  replacedCompleted: boolean;
};

/** Portable queue counts used by application scheduling decisions. */
export type QueueCounts = {
  /** Jobs currently being processed. */
  active: number;
  /** Jobs waiting for a retry delay. */
  delayed: number;
  /** Jobs retained after exhausting attempts. */
  failed: number;
  /** Jobs ready to be processed. */
  waiting: number;
};

/**
 * Portable job supplied to an application handler.
 *
 * @template TPayload - Validated payload type.
 */
export type QueueJob<TPayload> = {
  /** Number of prior processing attempts. */
  attemptsMade: number;
  /** Stable queue job identifier. */
  id: string;
  /** Application-defined job name. */
  name: string;
  /** Validated application payload. */
  payload: TPayload;
};

/**
 * One typed job accepted by a defined queue.
 *
 * @template TPayload - Validated payload type.
 */
export type QueueEnqueueInput<TPayload> = {
  /** Stable identifier used for deduplication. */
  id: string;
  /** Application-defined job name. */
  name: string;
  /** Payload validated before persistence. */
  payload: TPayload;
};

/** Aggregate outcomes from a bounded processing run. */
export type QueueProcessResult = {
  /** Jobs handled successfully. */
  completed: number;
  /** Jobs whose handler rejected. */
  failed: number;
  /** Jobs explicitly handled without application work. */
  skipped: number;
};

/** Aggregate outcomes from a failed-job redrive. */
export type QueueRedriveResult = {
  /** Failed jobs present before the redrive. */
  failed: number;
  /** Jobs that could not be returned to the waiting state. */
  requeueFailed: number;
  /** Jobs returned to the waiting state. */
  requeued: number;
};

/** Queue lifecycle event emitted by an adapter. */
export type QueueLifecycleEvent = {
  /** Stable event kind. */
  type: "completed" | "failed" | "started";
  /** Stable job identifier when the event concerns one job. */
  jobId?: string;
  /** Defined queue name. */
  queue: string;
};

/**
 * Transport-independent policy for one typed queue.
 *
 * @template TPayload - Validated payload type.
 * @template TMode - Worker lifecycle mode.
 */
export type QueueDefinition<
  TPayload,
  TMode extends "bounded" | "continuous",
> = {
  /** Completed-job duplicate behavior. */
  deduplication: {
    /** Whether a completed job may be replaced by the same stable identifier. */
    replaceCompleted: boolean;
  };
  /** Worker lifecycle supported by this queue. */
  mode: TMode;
  /** Stable physical queue name. */
  name: string;
  /** Completed and failed job retention. */
  retention: {
    /** Completed-job retention limits. */
    completed: {
      /** Maximum completed-job age in seconds. */
      ageSeconds: number;
      /** Maximum retained completed-job count. */
      count: number;
    };
    /** Failed-job retention limit. */
    failed: {
      /** Maximum failed-job age in seconds. */
      ageSeconds: number;
    };
  };
  /** Retry attempts and optional backoff. */
  retry: {
    /** Total processing attempts before failure retention. */
    attempts: number;
    /** Delay policy between attempts. */
    backoff?: {
      /** Initial or fixed retry delay in milliseconds. */
      delayMs: number;
      /** Retry-delay progression. */
      type: "exponential" | "fixed";
    };
  };
  /** Runtime validator applied before persistence and after loading. */
  schema: z.ZodType<TPayload>;
};

/**
 * Options for one bounded queue drain.
 *
 * @template TPayload - Validated payload type.
 */
export type QueueProcessOptions<TPayload> = {
  /** Maximum number of jobs processed at once. */
  concurrency: number;
  /**
   * Application handler for one validated job.
   *
   * @param job - Validated portable queue job.
   * @returns Terminal handler outcome.
   */
  handler: (
    job: QueueJob<TPayload>,
  ) => Promise<"completed" | "skipped" | undefined>;
  /** Target number of terminal outcomes before the drain stops. */
  limit: number;
};

/** Handle for a continuous queue worker. */
export type QueueWorker = {
  /**
   * Stops accepting jobs and closes the worker.
   *
   * @returns Worker cleanup completion.
   */
  close: () => Promise<void>;
};

/**
 * Queue operations shared by bounded and continuous consumers.
 *
 * @template TPayload - Validated payload type.
 */
export interface DefinedQueue<TPayload> {
  /**
   * Closes this queue's transport resources.
   *
   * @returns Queue cleanup completion.
   */
  close(): Promise<void>;
  /**
   * Returns portable job counts.
   *
   * @returns Counts normalized across adapters.
   */
  counts(): Promise<QueueCounts>;
  /**
   * Enqueues one validated job under its stable identifier.
   *
   * @param input - Job to validate and persist.
   * @returns Durable enqueue outcome.
   */
  enqueue(input: QueueEnqueueInput<TPayload>): Promise<QueueEnqueueResult>;
  /**
   * Enqueues validated jobs in input order.
   *
   * @param inputs - Jobs to validate and persist.
   * @returns Outcomes aligned with input order.
   */
  enqueueMany(
    inputs: readonly QueueEnqueueInput<TPayload>[],
  ): Promise<QueueEnqueueResult[]>;
  /**
   * Drains a bounded number of jobs.
   *
   * @param options - Handler and drain limits.
   * @returns Terminal outcome counts.
   */
  process(options: QueueProcessOptions<TPayload>): Promise<QueueProcessResult>;
  /**
   * Starts a continuous worker for this queue.
   *
   * @param options - Handler and concurrency.
   * @returns Open worker handle.
   */
  processContinuously(options: {
    /** Maximum number of jobs processed at once. */
    concurrency: number;
    /** Application handler for one validated job. */
    handler: QueueProcessOptions<TPayload>["handler"];
  }): Promise<QueueWorker>;
  /**
   * Returns failed jobs to the waiting state.
   *
   * @param limit - Maximum jobs to redrive.
   * @returns Redrive counts.
   */
  redriveFailed(limit: number): Promise<QueueRedriveResult>;
}

/** Transport adapter that owns queue and connection lifecycles. */
export interface QueueAdapter {
  /**
   * Closes all defined queues and transport connections.
   *
   * @returns Adapter cleanup completion.
   */
  close(): Promise<void>;
  /**
   * Creates or opens one typed queue from application policy.
   *
   * @param definition - Queue schema and policy.
   * @returns Defined typed queue.
   */
  define<TPayload, TMode extends "bounded" | "continuous">(
    definition: QueueDefinition<TPayload, TMode>,
  ): DefinedQueue<TPayload>;
}

/**
 * In-memory job state used by the deterministic adapter.
 *
 * @template TPayload - Validated payload type.
 */
type MemoryJob<TPayload> = QueueJob<TPayload> & {
  /** Last handler failure. */
  error?: unknown;
  /** Current in-memory queue state. */
  state: "active" | "completed" | "delayed" | "failed" | "waiting";
  /** Completion timestamp used for deterministic retention. */
  completedAt?: number;
  /** Earliest timestamp at which a delayed retry may run. */
  retryAt?: number;
};

/**
 * Creates a deterministic transport-compatible queue adapter for tests.
 *
 * @param options - Clock and lifecycle event overrides.
 * @returns In-memory queue adapter.
 */
export function createInMemoryQueueAdapter(
  options: {
    /**
     * Receives structured lifecycle events.
     *
     * @param event - Portable queue event.
     */
    onEvent?: (event: QueueLifecycleEvent) => void;
    /**
     * Supplies Unix milliseconds for retention behavior.
     *
     * @returns Current Unix milliseconds.
     */
    now?: () => number;
  } = {},
): QueueAdapter {
  const queues = new Set<DefinedQueue<unknown>>();
  const now = options.now ?? Date.now;

  return {
    /**
     * Closes every in-memory queue.
     *
     * @returns Adapter cleanup completion.
     */
    async close() {
      await Promise.all([...queues].map((queue) => queue.close()));
      queues.clear();
    },
    /**
     * Defines one in-memory queue.
     *
     * @param definition - Queue schema and policy.
     * @returns Defined queue.
     */
    define<TPayload, TMode extends "bounded" | "continuous">(
      definition: QueueDefinition<TPayload, TMode>,
    ) {
      const jobs = new Map<string, MemoryJob<TPayload>>();
      const continuousWorkers = new Set<() => void>();
      let closed = false;

      const queue: DefinedQueue<TPayload> = {
        /**
         * Closes this in-memory queue.
         *
         * @returns Queue cleanup completion.
         */
        async close() {
          closed = true;
        },
        /**
         * Counts jobs by portable state.
         *
         * @returns Portable queue counts.
         */
        async counts() {
          pruneCompleted(jobs, definition, now());
          promoteDueRetries(jobs.values(), now());
          return countMemoryJobs(jobs.values());
        },
        /**
         * Validates and stores one job.
         *
         * @param input - Job to persist.
         * @returns Enqueue outcome.
         */
        async enqueue(input) {
          assertOpen(closed);
          const payload = definition.schema.parse(input.payload);
          pruneCompleted(jobs, definition, now());
          const existing = jobs.get(input.id);
          const replacedCompleted = Boolean(
            existing?.state === "completed" &&
              definition.deduplication.replaceCompleted,
          );

          if (existing && !replacedCompleted) {
            return { accepted: false, replacedCompleted: false };
          }

          jobs.set(input.id, {
            attemptsMade: 0,
            id: input.id,
            name: input.name,
            payload,
            state: "waiting",
          });
          for (const wake of continuousWorkers) wake();
          return { accepted: true, replacedCompleted };
        },
        /**
         * Enqueues jobs in input order.
         *
         * @param inputs - Jobs to persist.
         * @returns Ordered enqueue outcomes.
         */
        async enqueueMany(inputs) {
          const results: QueueEnqueueResult[] = [];
          for (const input of inputs) results.push(await queue.enqueue(input));
          return results;
        },
        /**
         * Drains a bounded batch.
         *
         * @param processOptions - Handler and limits.
         * @returns Terminal outcome counts.
         * @rejects When the handler or payload validation fails unexpectedly.
         */
        async process(processOptions) {
          assertOpen(closed);
          if (definition.mode !== "bounded") {
            throw new Error(`Queue ${definition.name} is not bounded.`);
          }
          return processMemoryJobs({
            definition,
            jobs,
            now,
            onEvent: options.onEvent,
            options: processOptions,
          });
        },
        /**
         * Starts an in-memory continuous worker.
         *
         * @param processOptions - Handler and concurrency.
         * @returns Worker handle.
         * @rejects When initial processing fails unexpectedly.
         */
        async processContinuously(processOptions) {
          assertOpen(closed);
          if (definition.mode !== "continuous") {
            throw new Error(`Queue ${definition.name} is not continuous.`);
          }
          let workerClosed = false;
          let processing = Promise.resolve();
          /** Schedules one continuous drain. */
          const wake = () => {
            processing = processing.then(async () => {
              if (workerClosed) return;
              await processMemoryJobs({
                definition,
                jobs,
                now,
                onEvent: options.onEvent,
                options: { ...processOptions, limit: Number.POSITIVE_INFINITY },
              });
            });
          };
          continuousWorkers.add(wake);
          wake();
          return {
            /**
             * Stops this continuous worker.
             *
             * @returns Worker cleanup completion.
             */
            async close() {
              workerClosed = true;
              continuousWorkers.delete(wake);
              await processing;
            },
          };
        },
        /**
         * Redrives retained failures.
         *
         * @param limit - Maximum jobs to redrive.
         * @returns Redrive counts.
         */
        async redriveFailed(limit) {
          assertOpen(closed);
          const failed = [...jobs.values()].filter(
            (job) => job.state === "failed",
          );
          for (const job of failed.slice(0, limit)) {
            job.state = "waiting";
            job.error = undefined;
          }
          return {
            failed: failed.length,
            requeueFailed: 0,
            requeued: Math.min(limit, failed.length),
          };
        },
      };

      queues.add(queue as DefinedQueue<unknown>);
      return queue;
    },
  };
}

/**
 * Throws when an operation targets a closed in-memory queue.
 *
 * @param closed - Whether the queue is closed.
 * @throws When the queue is closed.
 */
function assertOpen(closed: boolean) {
  if (closed) throw new Error("Queue is closed.");
}

/**
 * Counts in-memory jobs by portable state.
 *
 * @param jobs - Jobs to count.
 * @returns Portable queue counts.
 * @template TPayload - Validated payload type.
 */
function countMemoryJobs<TPayload>(jobs: Iterable<MemoryJob<TPayload>>) {
  const counts: QueueCounts = { active: 0, delayed: 0, failed: 0, waiting: 0 };
  for (const job of jobs) {
    if (job.state === "active") counts.active += 1;
    if (job.state === "delayed") counts.delayed += 1;
    if (job.state === "failed") counts.failed += 1;
    if (job.state === "waiting") counts.waiting += 1;
  }
  return counts;
}

/**
 * Moves due retries back to the waiting state.
 *
 * @param jobs - Jobs that may be delayed.
 * @param now - Current Unix milliseconds.
 * @template TPayload - Validated payload type.
 */
function promoteDueRetries<TPayload>(
  jobs: Iterable<MemoryJob<TPayload>>,
  now: number,
) {
  for (const job of jobs) {
    if (job.state === "delayed" && (job.retryAt ?? 0) <= now) {
      job.state = "waiting";
      job.retryAt = undefined;
    }
  }
}

/**
 * Applies completed-job age and count retention to in-memory state.
 *
 * @param jobs - Mutable jobs keyed by stable identifier.
 * @param definition - Queue retention policy.
 * @param now - Current Unix milliseconds.
 * @template TPayload - Validated payload type.
 */
function pruneCompleted<TPayload>(
  jobs: Map<string, MemoryJob<TPayload>>,
  definition: QueueDefinition<TPayload, "bounded" | "continuous">,
  now: number,
) {
  const completed = [...jobs.values()]
    .filter((job) => job.state === "completed")
    .sort((left, right) => (right.completedAt ?? 0) - (left.completedAt ?? 0));
  for (const [index, job] of completed.entries()) {
    if (
      index >= definition.retention.completed.count ||
      now - (job.completedAt ?? now) >
        definition.retention.completed.ageSeconds * 1_000
    ) {
      jobs.delete(job.id);
    }
  }
}

/**
 * Runs waiting in-memory jobs through the shared public handler contract.
 *
 * @param input - Queue state, policy, clock, and processing controls.
 * @returns Terminal outcome counts.
 * @template TPayload - Validated payload type.
 */
async function processMemoryJobs<TPayload>(input: {
  /** Queue policy and payload validator. */
  definition: QueueDefinition<TPayload, "bounded" | "continuous">;
  /** Mutable in-memory job state. */
  jobs: Map<string, MemoryJob<TPayload>>;
  /**
   * Deterministic clock.
   *
   * @returns Current Unix milliseconds.
   */
  now: () => number;
  /**
   * Optional lifecycle event sink.
   *
   * @param event - Portable queue event.
   */
  onEvent?: (event: QueueLifecycleEvent) => void;
  /** Bounded processing controls. */
  options: QueueProcessOptions<TPayload>;
}): Promise<QueueProcessResult> {
  const stats: QueueProcessResult = { completed: 0, failed: 0, skipped: 0 };
  promoteDueRetries(input.jobs.values(), input.now());
  const waiting = [...input.jobs.values()]
    .filter((job) => job.state === "waiting")
    .slice(0, input.options.limit);

  for (
    let index = 0;
    index < waiting.length;
    index += input.options.concurrency
  ) {
    await Promise.all(
      waiting
        .slice(index, index + input.options.concurrency)
        .map(async (job) => {
          job.state = "active";
          job.attemptsMade += 1;
          input.onEvent?.({
            jobId: job.id,
            queue: input.definition.name,
            type: "started",
          });
          try {
            const payload = input.definition.schema.parse(job.payload);
            const outcome = await input.options.handler({ ...job, payload });
            job.state = "completed";
            job.completedAt = input.now();
            if (outcome === "skipped") stats.skipped += 1;
            else stats.completed += 1;
            input.onEvent?.({
              jobId: job.id,
              queue: input.definition.name,
              type: "completed",
            });
          } catch (error) {
            job.error = error;
            if (job.attemptsMade < input.definition.retry.attempts) {
              const backoff = input.definition.retry.backoff;
              const multiplier =
                backoff?.type === "exponential"
                  ? 2 ** Math.max(0, job.attemptsMade - 1)
                  : 1;
              job.state = backoff ? "delayed" : "waiting";
              job.retryAt = backoff
                ? input.now() + backoff.delayMs * multiplier
                : undefined;
            } else {
              job.state = "failed";
            }
            stats.failed += 1;
            input.onEvent?.({
              jobId: job.id,
              queue: input.definition.name,
              type: "failed",
            });
          }
        }),
    );
  }

  pruneCompleted(input.jobs, input.definition, input.now());
  return stats;
}
