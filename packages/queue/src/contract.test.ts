import { expect, it } from "vitest";
import { z } from "zod";
import {
  createInMemoryQueueAdapter,
  type QueueLifecycleEvent,
} from "./index.js";
import { defineQueueAdapterContract } from "./test-contract.js";

/**
 * Creates the in-memory adapter under test.
 *
 * @returns A deterministic in-memory adapter.
 */
function createAdapter() {
  return createInMemoryQueueAdapter();
}

defineQueueAdapterContract("in-memory queue adapter", createAdapter);

it("models retry delay and exhaustion deterministically", async () => {
  let now = 1_000;
  /**
   * Supplies the mutable test clock.
   *
   * @returns Current test time.
   */
  const clock = () => now;
  const events: QueueLifecycleEvent[] = [];
  const adapter = createInMemoryQueueAdapter({
    now: clock,
    /**
     * Captures lifecycle events for exhaustion assertions.
     *
     * @param event - Emitted queue lifecycle event.
     */
    onEvent(event) {
      events.push(event);
    },
  });
  const queue = adapter.define({
    deduplication: { replaceCompleted: false },
    mode: "bounded",
    name: "retry",
    retention: {
      completed: { ageSeconds: 60, count: 10 },
      failed: { ageSeconds: 60 },
    },
    retry: { attempts: 2, backoff: { delayMs: 100, type: "fixed" } },
    schema: z.object({ value: z.string() }),
  });
  await queue.enqueue({ id: "job", name: "test", payload: { value: "x" } });
  const fail = {
    concurrency: 1,
    /**
     * Fails each processing attempt.
     *
     * @rejects On every attempt.
     */
    handler: async () => {
      throw new Error("expected failure");
    },
    limit: 1,
  };

  await queue.process(fail);
  await expect(queue.counts()).resolves.toMatchObject({
    delayed: 1,
    failed: 0,
  });
  now += 100;
  await queue.process(fail);
  await expect(queue.counts()).resolves.toMatchObject({
    delayed: 0,
    failed: 1,
  });
  expect(events.filter((event) => event.type === "failed")).toEqual([
    expect.objectContaining({ exhausted: false, jobId: "job" }),
    expect.objectContaining({ exhausted: true, jobId: "job" }),
  ]);
  now += 60_001;
  await expect(queue.counts()).resolves.toMatchObject({ failed: 0 });
  await adapter.close();
});

it("retries an immediate continuous failure and closes it with the queue", async () => {
  const adapter = createInMemoryQueueAdapter();
  const queue = adapter.define({
    deduplication: { replaceCompleted: false },
    mode: "continuous",
    name: "immediate-retry",
    retention: {
      completed: { ageSeconds: 60, count: 10 },
      failed: { ageSeconds: 60 },
    },
    retry: { attempts: 2 },
    schema: z.object({ value: z.string() }),
  });
  let attemptedTwice!: () => void;
  const twoAttempts = new Promise<void>((resolve) => {
    attemptedTwice = resolve;
  });
  let attempts = 0;
  await queue.processContinuously({
    concurrency: 1,
    /**
     * Fails twice to exhaust immediate retries.
     *
     * @rejects On every attempt.
     */
    handler: async () => {
      attempts += 1;
      if (attempts === 2) attemptedTwice();
      throw new Error("expected failure");
    },
  });
  await queue.enqueue({ id: "job", name: "test", payload: { value: "x" } });

  await expect(twoAttempts).resolves.toBeUndefined();
  await queue.close();
  await expect(
    queue.enqueue({ id: "later", name: "test", payload: { value: "x" } }),
  ).rejects.toThrow("Queue is closed");
  await adapter.close();
});
