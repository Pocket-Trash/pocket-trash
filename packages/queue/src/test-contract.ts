import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { QueueAdapter } from "./index.js";

/** Representative payload validator shared by adapter contract tests. */
const payloadSchema = z.object({ value: z.string() });

/**
 * Registers the shared behavioral contract for one queue adapter.
 *
 * @param name - Adapter name shown in test output.
 * @param createAdapter - Creates an isolated adapter for each test.
 */
export function defineQueueAdapterContract(
  name: string,
  createAdapter: () => Promise<QueueAdapter> | QueueAdapter,
) {
  describe(name, () => {
    it("validates payloads and suppresses retained completed duplicates", async () => {
      const adapter = await createAdapter();
      const queue = adapter.define({
        deduplication: { replaceCompleted: false },
        mode: "bounded",
        name: `contract-${crypto.randomUUID()}`,
        retention: {
          completed: { ageSeconds: 86_400, count: 1_000 },
          failed: { ageSeconds: 1_209_600 },
        },
        retry: { attempts: 2, backoff: { delayMs: 1, type: "exponential" } },
        schema: payloadSchema,
      });
      await expect(
        queue.enqueue({
          id: "invalid",
          name: "test",
          payload: { value: 1 } as never,
        }),
      ).rejects.toThrow();
      await expect(
        queue.enqueue({
          id: "stable",
          name: "test",
          payload: { value: "first" },
        }),
      ).resolves.toEqual({ accepted: true, replacedCompleted: false });
      await expect(
        queue.enqueue({
          id: "stable",
          name: "test",
          payload: { value: "second" },
        }),
      ).resolves.toEqual({ accepted: false, replacedCompleted: false });
      await queue.process({
        concurrency: 1,
        limit: 1,
        /**
         * Completes the representative job.
         *
         * @returns A completed outcome.
         */
        handler: async () => undefined,
      });
      await expect(
        queue.enqueue({
          id: "stable",
          name: "test",
          payload: { value: "fallback" },
        }),
      ).resolves.toEqual({ accepted: false, replacedCompleted: false });
      await adapter.close();
    });

    it("replaces completed jobs only when policy allows it", async () => {
      const adapter = await createAdapter();
      const queue = adapter.define({
        deduplication: { replaceCompleted: true },
        mode: "bounded",
        name: `contract-replace-${crypto.randomUUID()}`,
        retention: {
          completed: { ageSeconds: 86_400, count: 1_000 },
          failed: { ageSeconds: 604_800 },
        },
        retry: { attempts: 1 },
        schema: payloadSchema,
      });
      await queue.enqueue({
        id: "stable",
        name: "test",
        payload: { value: "a" },
      });
      await queue.process({
        concurrency: 1,
        limit: 1,
        /**
         * Completes the representative job.
         *
         * @returns A completed outcome.
         */
        handler: async () => undefined,
      });
      await expect(
        queue.enqueue({ id: "stable", name: "test", payload: { value: "b" } }),
      ).resolves.toEqual({ accepted: true, replacedCompleted: true });
      await adapter.close();
    });

    it("accepts only one concurrent enqueue for a stable identifier", async () => {
      const adapter = await createAdapter();
      const queue = adapter.define({
        deduplication: { replaceCompleted: false },
        mode: "bounded",
        name: `contract-concurrent-${crypto.randomUUID()}`,
        retention: {
          completed: { ageSeconds: 86_400, count: 1_000 },
          failed: { ageSeconds: 604_800 },
        },
        retry: { attempts: 1 },
        schema: payloadSchema,
      });
      const outcomes = await Promise.all([
        queue.enqueue({ id: "stable", name: "test", payload: { value: "a" } }),
        queue.enqueue({ id: "stable", name: "test", payload: { value: "b" } }),
      ]);

      expect(outcomes.filter((outcome) => outcome.accepted)).toHaveLength(1);
      await adapter.close();
    });

    it("delivers jobs enqueued after a continuous worker starts", async () => {
      const adapter = await createAdapter();
      const queue = adapter.define({
        deduplication: { replaceCompleted: false },
        mode: "continuous",
        name: `contract-continuous-${crypto.randomUUID()}`,
        retention: {
          completed: { ageSeconds: 86_400, count: 1_000 },
          failed: { ageSeconds: 604_800 },
        },
        retry: { attempts: 1 },
        schema: payloadSchema,
      });
      let delivered!: () => void;
      const delivery = new Promise<void>((resolve) => {
        delivered = resolve;
      });
      const worker = await queue.processContinuously({
        concurrency: 1,
        /**
         * Records delivery of the representative job.
         *
         * @returns A completed outcome after recording delivery.
         */
        handler: async () => {
          delivered();
        },
      });
      await queue.enqueue({
        id: "later",
        name: "test",
        payload: { value: "later" },
      });
      await expect(delivery).resolves.toBeUndefined();
      await worker.close();
      await adapter.close();
    });

    it("reports matching attempt numbers and retries continuous jobs", async () => {
      const adapter = await createAdapter();
      const queue = adapter.define({
        deduplication: { replaceCompleted: false },
        mode: "continuous",
        name: `contract-retry-${crypto.randomUUID()}`,
        retention: {
          completed: { ageSeconds: 86_400, count: 1_000 },
          failed: { ageSeconds: 604_800 },
        },
        retry: { attempts: 2, backoff: { delayMs: 5, type: "fixed" } },
        schema: payloadSchema,
      });
      const attempts: number[] = [];
      let delivered!: () => void;
      const delivery = new Promise<void>((resolve) => {
        delivered = resolve;
      });
      const worker = await queue.processContinuously({
        concurrency: 1,
        /**
         * Fails once, then records successful retry delivery.
         *
         * @param job - Portable queue job under test.
         * @returns A completed outcome on the retry.
         * @rejects On the first delivery attempt.
         */
        handler: async (job) => {
          attempts.push(job.attemptsMade);
          if (attempts.length === 1) throw new Error("retry once");
          delivered();
        },
      });
      await queue.enqueue({
        id: "retry",
        name: "test",
        payload: { value: "retry" },
      });

      await expect(delivery).resolves.toBeUndefined();
      expect(attempts).toEqual([0, 1]);
      await worker.close();
      await adapter.close();
    });

    it("reports counts and redrives retained failures", async () => {
      const adapter = await createAdapter();
      const queue = adapter.define({
        deduplication: { replaceCompleted: false },
        mode: "bounded",
        name: `contract-redrive-${crypto.randomUUID()}`,
        retention: {
          completed: { ageSeconds: 86_400, count: 1_000 },
          failed: { ageSeconds: 604_800 },
        },
        retry: { attempts: 1 },
        schema: payloadSchema,
      });
      await queue.enqueue({
        id: "failed-job",
        name: "test",
        payload: { value: "bad" },
      });
      await queue.process({
        concurrency: 1,
        /**
         * Fails the representative job.
         *
         * @rejects To retain the representative failed job.
         */
        handler: async () => {
          throw new Error("expected failure");
        },
        limit: 1,
      });

      await expect(queue.counts()).resolves.toMatchObject({ failed: 1 });
      await expect(queue.redriveFailed(1)).resolves.toEqual({
        failed: 1,
        requeueFailed: 0,
        requeued: 1,
      });
      await expect(queue.counts()).resolves.toMatchObject({ waiting: 1 });
      await adapter.close();
    });
  });
}
