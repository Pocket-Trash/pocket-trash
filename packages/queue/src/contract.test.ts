import { expect, it } from "vitest";
import { z } from "zod";
import { createInMemoryQueueAdapter } from "./index.js";
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
  const adapter = createInMemoryQueueAdapter({ now: clock });
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
  now += 60_001;
  await expect(queue.counts()).resolves.toMatchObject({ failed: 0 });
  await adapter.close();
});
