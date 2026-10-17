import type {
  QueueAdapter,
  QueueEnqueueInput,
  QueueWorker,
} from "@package/queue";
import { z } from "zod";

/** Serializable renderer action stored in the delivery queue. */
const queuedActionSchema = z.object({
  label: z.string().min(1).max(80),
  url: z.url(),
});

/** Serializable renderer input stored in the delivery queue. */
export const queuedNotificationSchema = z.object({
  actions: z.array(queuedActionSchema).max(5).optional(),
  description: z.string().min(1).max(4_000),
  diagnostics: z.array(z.string().min(1).max(1_000)).max(5).optional(),
  occurredAt: z.iso.datetime(),
  provenance: z.string().min(1).max(300),
  source: z.string().min(1).max(100),
  status: z.string().min(1).max(200),
  tags: z.array(z.string().min(1).max(100)).max(10),
  title: z.string().min(1).max(300),
  titleUrl: z.url().optional(),
  tone: z.enum(["success", "info", "warning", "error"]),
});

/** Serializable renderer input stored in the delivery queue. */
export type QueuedNotification = z.infer<typeof queuedNotificationSchema>;

/** Minimal transport-neutral delivery envelope owned by the bot. */
const baseDeliveryJobSchema = z.object({
  deliveryId: z.string().min(1).max(200),
  destinationChannelId: z.string().regex(/^[1-9]\d{16,19}$/u),
  version: z.literal(1),
});

/** Validated delivery envelope accepted by the bot queue. */
export const deliveryJobSchema = z.discriminatedUnion("kind", [
  baseDeliveryJobSchema.extend({
    kind: z.literal("github"),
    notification: queuedNotificationSchema,
  }),
  baseDeliveryJobSchema.extend({ kind: z.enum(["logger", "system"]) }),
]);

/** Validated job accepted by the bot delivery queue. */
export type DeliveryJob = z.infer<typeof deliveryJobSchema>;

/**
 * Creates the continuous Discord delivery queue lifecycle.
 *
 * @param options - Queue adapter and delivery operation.
 * @returns The delivery queue lifecycle.
 */
export function createDeliveryQueueRuntime(options: {
  /** Queue adapter that owns the Redis connection. */
  adapter: QueueAdapter;
  /**
   * Delivers one validated notification envelope.
   *
   * @param payload - Validated delivery envelope.
   * @returns A promise that resolves after Discord delivery.
   */
  deliver(payload: DeliveryJob): Promise<void>;
}) {
  const queue = options.adapter.define({
    deduplication: { replaceCompleted: false },
    mode: "continuous",
    name: "discord-notifications",
    retention: {
      completed: { ageSeconds: 60 * 60 * 24, count: 1_000 },
      failed: { ageSeconds: 60 * 60 * 24 * 14 },
    },
    retry: {
      attempts: 5,
      backoff: { delayMs: 30_000, type: "exponential" },
    },
    schema: deliveryJobSchema,
  });
  let worker: QueueWorker | undefined;

  return {
    /** Closes the worker, queue, and adapter-owned Redis connection. */
    async close() {
      try {
        await worker?.close();
      } finally {
        await options.adapter.close();
        worker = undefined;
      }
    },
    /**
     * Checks Redis through portable queue counts.
     *
     * @returns Current queue counts.
     */
    counts: () => queue.counts(),
    /**
     * Enqueues one validated delivery job.
     *
     * @param input - Stable job identity, name, and payload.
     * @returns The enqueue disposition.
     */
    enqueue: (input: QueueEnqueueInput<DeliveryJob>) => queue.enqueue(input),
    /**
     * Starts the continuous worker exactly once.
     *
     * @returns A promise that resolves when the worker is running.
     * @rejects When the worker is already running or cannot start.
     */
    async start() {
      if (worker) throw new Error("Discord delivery worker already started.");
      worker = await queue.processContinuously({
        concurrency: 4,
        /**
         * Delivers one validated queue job.
         *
         * @param job - Queue job containing the validated envelope.
         * @returns A promise that resolves after delivery.
         */
        handler: async (job) => {
          await options.deliver(job.payload);
        },
      });
    },
    /**
     * Reports whether the continuous worker has started.
     *
     * @returns Whether a worker reference exists.
     */
    started: () => worker !== undefined,
  };
}

/** Discord queue lifecycle returned by {@link createDeliveryQueueRuntime}. */
export type DeliveryQueueRuntime = ReturnType<
  typeof createDeliveryQueueRuntime
>;
