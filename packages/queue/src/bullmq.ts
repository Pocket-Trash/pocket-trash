import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import type {
  DefinedQueue,
  QueueAdapter,
  QueueCounts,
  QueueDefinition,
  QueueEnqueueInput,
  QueueEnqueueResult,
  QueueLifecycleEvent,
  QueueProcessOptions,
  QueueProcessResult,
  QueueRedriveResult,
  QueueWorker,
} from "./index.js";

/**
 * Creates a production queue adapter backed by BullMQ and Redis.
 *
 * @param options - Redis connection and lifecycle event options.
 * @returns Production queue adapter.
 */
export function createBullMqQueueAdapter(options: {
  /**
   * Receives structured lifecycle events.
   *
   * @param event - Portable queue lifecycle event.
   */
  onEvent?: (event: QueueLifecycleEvent) => void;
  /** Redis connection URL owned by this adapter. */
  redisUrl: string;
}): QueueAdapter {
  const connection = new Redis(options.redisUrl, {
    connectTimeout: 5_000,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    /**
     * Limits Redis reconnect attempts during startup and outages.
     *
     * @param times - Consecutive reconnect attempt number.
     * @returns Bounded delay before reconnecting throughout an outage.
     */
    retryStrategy(times) {
      return Math.min(times * 250, 10_000);
    },
  });
  const queues = new Set<BullMqDefinedQueue<unknown>>();

  connection.on("error", () => {
    // The operation waiting on Redis surfaces connection failures.
  });

  return {
    /**
     * Closes every queue and the shared Redis connection.
     *
     * @returns Adapter cleanup completion.
     */
    async close() {
      await Promise.all([...queues].map((queue) => queue.close()));
      queues.clear();
      connection.disconnect();
    },
    /**
     * Defines one BullMQ queue from application policy.
     *
     * @param definition - Queue schema and policy.
     * @returns Defined typed queue.
     */
    define<TPayload, TMode extends "bounded" | "continuous">(
      definition: QueueDefinition<TPayload, TMode>,
    ) {
      const queue = new BullMqDefinedQueue(
        connection,
        definition,
        options.onEvent,
      );
      queues.add(queue as BullMqDefinedQueue<unknown>);
      return queue;
    },
  };
}

/**
 * BullMQ implementation of the transport-independent queue contract.
 *
 * @template TPayload - Validated payload type.
 */
class BullMqDefinedQueue<TPayload> implements DefinedQueue<TPayload> {
  /** Shared Redis connection owned by the adapter. */
  readonly #connection: Redis;
  /** Application queue policy and payload validator. */
  readonly #definition: QueueDefinition<TPayload, "bounded" | "continuous">;
  /**
   * Optional portable lifecycle event sink.
   *
   * @param event - Portable queue lifecycle event.
   */
  readonly #onEvent?: (event: QueueLifecycleEvent) => void;
  /** BullMQ queue hidden behind the portable interface. */
  readonly #queue: Queue<TPayload, unknown, string, TPayload, unknown, string>;
  /** Workers opened through this queue. */
  readonly #workers = new Set<Worker<TPayload>>();

  /**
   * Creates one BullMQ queue from application-owned policy.
   *
   * @param connection - Shared Redis connection.
   * @param definition - Queue schema and policy.
   * @param onEvent - Optional portable lifecycle event sink.
   */
  constructor(
    connection: Redis,
    definition: QueueDefinition<TPayload, "bounded" | "continuous">,
    onEvent?: (event: QueueLifecycleEvent) => void,
  ) {
    this.#connection = connection;
    this.#definition = definition;
    this.#onEvent = onEvent;
    this.#queue = new Queue<
      TPayload,
      unknown,
      string,
      TPayload,
      unknown,
      string
    >(definition.name, {
      connection,
      defaultJobOptions: {
        attempts: definition.retry.attempts,
        backoff: definition.retry.backoff
          ? {
              delay: definition.retry.backoff.delayMs,
              type: definition.retry.backoff.type,
            }
          : undefined,
        removeOnComplete: {
          age: definition.retention.completed.ageSeconds,
          count: definition.retention.completed.count,
        },
        removeOnFail: { age: definition.retention.failed.ageSeconds },
      },
    });
  }

  /**
   * Closes workers before the queue transport.
   *
   * @returns Queue cleanup completion.
   */
  async close() {
    await Promise.all([...this.#workers].map((worker) => worker.close(true)));
    this.#workers.clear();
    await this.#queue.close();
  }

  /**
   * Returns normalized BullMQ job counts.
   *
   * @returns Portable queue counts.
   */
  async counts(): Promise<QueueCounts> {
    const counts = await this.#queue.getJobCounts(
      "active",
      "delayed",
      "failed",
      "waiting",
    );
    return {
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
      failed: counts.failed ?? 0,
      waiting: counts.waiting ?? 0,
    };
  }

  /**
   * Validates and persists one job when its stable identifier is available.
   *
   * @param input - Job to validate and persist.
   * @returns Durable enqueue outcome.
   */
  async enqueue(
    input: QueueEnqueueInput<TPayload>,
  ): Promise<QueueEnqueueResult> {
    const payload = this.#definition.schema.parse(input.payload);
    const lockKey = `${this.#queue.toKey(input.id)}:enqueue-lock`;
    const lockToken = crypto.randomUUID();
    let acquired: "OK" | null;
    do {
      acquired = await this.#connection.set(
        lockKey,
        lockToken,
        "PX",
        30_000,
        "NX",
      );
      if (acquired !== "OK") {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    } while (acquired !== "OK");

    try {
      const existing = await this.#queue.getJob(input.id);
      let replacedCompleted = false;

      if (existing) {
        const state = await existing.getState();
        if (
          state !== "completed" ||
          !this.#definition.deduplication.replaceCompleted
        ) {
          return { accepted: false, replacedCompleted: false };
        }
        await existing.remove();
        replacedCompleted = true;
      }

      const enqueueToken = crypto.randomUUID();
      await this.#queue.add(input.name, payload, {
        jobId: input.id,
        telemetry: { metadata: enqueueToken, omitContext: true },
      });
      const stored = await this.#queue.getJob(input.id);
      return {
        accepted: stored?.opts.telemetry?.metadata === enqueueToken,
        replacedCompleted,
      };
    } finally {
      try {
        await this.#connection.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0",
          1,
          lockKey,
          lockToken,
        );
      } catch {
        // The lease expires; cleanup must not overwrite the durable enqueue outcome.
      }
    }
  }

  /**
   * Enqueues jobs in input order so duplicate results remain aligned.
   *
   * @param inputs - Jobs to enqueue.
   * @returns Outcomes aligned with input order.
   */
  async enqueueMany(
    inputs: readonly QueueEnqueueInput<TPayload>[],
  ): Promise<QueueEnqueueResult[]> {
    const results: QueueEnqueueResult[] = [];
    for (const input of inputs) results.push(await this.enqueue(input));
    return results;
  }

  /**
   * Drains this bounded queue until empty or its terminal-outcome limit.
   *
   * @param options - Handler and bounded drain controls.
   * @returns Terminal outcome counts.
   * @rejects When the worker emits an error or cannot close.
   */
  async process(
    options: QueueProcessOptions<TPayload>,
  ): Promise<QueueProcessResult> {
    if (this.#definition.mode !== "bounded") {
      throw new Error(`Queue ${this.#definition.name} is not bounded.`);
    }

    const stats: QueueProcessResult = { completed: 0, failed: 0, skipped: 0 };
    if (options.limit <= 0) return stats;

    return new Promise((resolve, reject) => {
      let finished: Promise<void> | undefined;
      const worker = this.#createWorker(options.concurrency, options.handler);
      const timeout = setTimeout(
        () => {
          void finish(true).then(() => resolve(stats), reject);
        },
        5 * 60 * 1_000,
      );

      /**
       * Closes the worker once and returns the shared close operation.
       *
       * @param force - Whether to abandon active jobs.
       * @returns Worker cleanup completion.
       */
      const finish = (force = false) => {
        if (finished) return finished;
        finished = (async () => {
          clearTimeout(timeout);
          await closeWorker(worker, force);
          this.#workers.delete(worker);
        })();
        return finished;
      };
      /** Stops the drain after its terminal-outcome limit. */
      const finishAtLimit = () => {
        if (stats.completed + stats.failed + stats.skipped >= options.limit) {
          void finish().then(() => resolve(stats), reject);
        }
      };

      worker.on("completed", (_job, result) => {
        if (result === "skipped") stats.skipped += 1;
        else stats.completed += 1;
        finishAtLimit();
      });
      worker.on("failed", () => {
        stats.failed += 1;
        finishAtLimit();
      });
      worker.on("drained", () => {
        void finish().then(() => resolve(stats), reject);
      });
      worker.on("error", (error) => {
        void finish(true).then(() => reject(error), reject);
      });
    });
  }

  /**
   * Starts a worker that remains open until its returned handle closes.
   *
   * @param options - Handler and concurrency controls.
   * @returns Open worker handle.
   * @rejects When the queue does not support continuous workers.
   */
  async processContinuously(options: {
    /** Maximum number of jobs processed at once. */
    concurrency: number;
    /** Application handler for one validated job. */
    handler: QueueProcessOptions<TPayload>["handler"];
  }): Promise<QueueWorker> {
    if (this.#definition.mode !== "continuous") {
      throw new Error(`Queue ${this.#definition.name} is not continuous.`);
    }
    const worker = this.#createWorker(options.concurrency, options.handler);
    return {
      /**
       * Closes the continuous worker.
       *
       * @returns Worker cleanup completion.
       */
      close: async () => {
        await closeWorker(worker, false);
        this.#workers.delete(worker);
      },
    };
  }

  /**
   * Redrives a bounded batch of retained failed jobs.
   *
   * @param limit - Maximum failed jobs to redrive.
   * @returns Redrive outcome counts.
   */
  async redriveFailed(limit: number): Promise<QueueRedriveResult> {
    const failed = await this.#queue.getFailedCount();
    const jobs = limit > 0 ? await this.#queue.getFailed(0, limit - 1) : [];
    let requeueFailed = 0;
    let requeued = 0;

    for (const job of jobs) {
      try {
        await job.retry("failed");
        requeued += 1;
      } catch {
        requeueFailed += 1;
      }
    }

    return { failed, requeueFailed, requeued };
  }

  /**
   * Creates one validating worker and emits portable lifecycle events.
   *
   * @param concurrency - Maximum concurrently active jobs.
   * @param handler - Application job handler.
   * @returns Open BullMQ worker.
   */
  #createWorker(
    concurrency: number,
    handler: QueueProcessOptions<TPayload>["handler"],
  ) {
    const worker = new Worker<TPayload>(
      this.#definition.name,
      async (job) => {
        const id = job.id;
        if (!id) throw new Error("Queue job is missing its stable identifier.");
        const payload = this.#definition.schema.parse(job.data);
        this.#onEvent?.({
          jobId: id,
          queue: this.#definition.name,
          type: "started",
        });
        return handler({
          attemptsMade: job.attemptsMade,
          id,
          name: job.name,
          payload,
        });
      },
      { autorun: true, concurrency, connection: this.#connection },
    );

    worker.on("completed", (job) => {
      this.#onEvent?.({
        jobId: job.id,
        queue: this.#definition.name,
        type: "completed",
      });
    });
    worker.on("failed", (job) => {
      this.#onEvent?.({
        exhausted: (job?.attemptsMade ?? 0) >= (job?.opts.attempts ?? 1),
        jobId: job?.id,
        queue: this.#definition.name,
        type: "failed",
      });
    });
    this.#workers.add(worker);
    return worker;
  }
}

/**
 * Closes a worker gracefully, forcing it after thirty seconds.
 *
 * @param worker - Worker to close.
 * @param force - Whether to abandon active jobs immediately.
 * @returns Worker cleanup completion.
 */
async function closeWorker(worker: Worker, force: boolean) {
  if (force) {
    await worker.close(true);
    return;
  }

  let forceClose: NodeJS.Timeout | undefined;
  await Promise.race([
    worker.close(),
    new Promise<void>((resolve) => {
      forceClose = setTimeout(
        () => void worker.close(true).finally(resolve),
        30_000,
      );
    }),
  ]);
  clearTimeout(forceClose);
}
