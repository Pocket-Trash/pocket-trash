import { createInMemoryQueueAdapter } from "@package/queue";
import { describe, expect, it } from "vitest";
import { createScraperQueues, enqueueScraperJobs } from "./queues.js";

describe("scraper queues", () => {
  it("replaces a completed deterministic job through scraper policy", async () => {
    const queues = createScraperQueues(
      "redis://unused",
      createInMemoryQueueAdapter(),
    );
    const job = {
      id: "image-1",
      name: "tmp.image.delete",
      payload: {
        imageId: 1,
        source: "autmog" as const,
        type: "tmp.image.delete" as const,
      },
    };

    await enqueueScraperJobs(queues.images, [job]);
    await queues.images.process({
      concurrency: 1,
      /**
       * Completes the representative scraper job.
       *
       * @returns A completed outcome.
       */
      handler: async () => undefined,
      limit: 1,
    });

    await expect(enqueueScraperJobs(queues.images, [job])).resolves.toBe(1);
    await queues.close();
  });
});
