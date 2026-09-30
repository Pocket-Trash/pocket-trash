import { createNoopLogger } from "@package/logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAutmogProducer } from "./autmog/producer.js";
import { finishScraperRun, startScraperRun } from "./db/autmog.js";
import { runGrimsmoProducer } from "./grimsmo/producer.js";
import {
  runAllSourceProducerJobs,
  runQueueProcessorJob,
  runSourceProducerJob,
  ScraperCommandInterruptedError,
  type ScraperJobContext,
  scraperSourceKeys,
} from "./jobs.js";
import { runQueueProcessor } from "./queue/processor.js";
import { scraperSources } from "./scraper-types.js";

vi.mock("./autmog/producer.js", () => ({
  runAutmogProducer: vi.fn(async () => ({
    enqueuedCount: 0,
    fetchedCount: 0,
    items: [],
    removedCompletedItemJobs: 0,
  })),
}));

vi.mock("./grimsmo/producer.js", () => ({
  runGrimsmoProducer: vi.fn(async () => ({
    archivedFetchedCount: 0,
    enqueuedCount: 0,
    fetchedCount: 0,
    inventoryFetchedCount: 0,
    items: [],
    removedCompletedItemJobs: 0,
  })),
}));

vi.mock("./queue/processor.js", () => ({
  runQueueProcessor: vi.fn(async () => ({
    images: {
      completed: 0,
      failed: 0,
      skipped: 0,
    },
    items: {
      completed: 1,
      failed: 0,
      skipped: 0,
    },
  })),
}));

vi.mock("./db/autmog.js", () => ({
  createScraperDb: vi.fn(),
  finishScraperRun: vi.fn(),
  startScraperRun: vi.fn(async () => ({
    id: 1000,
  })),
}));

describe("scraper jobs", () => {
  beforeEach(() => {
    vi.mocked(runAutmogProducer).mockResolvedValue({
      enqueuedCount: 0,
      fetchedCount: 0,
      items: [],
      removedCompletedItemJobs: 0,
    });
    vi.mocked(runGrimsmoProducer).mockResolvedValue({
      archivedFetchedCount: 0,
      enqueuedCount: 0,
      fetchedCount: 0,
      inventoryFetchedCount: 0,
      items: [],
      removedCompletedItemJobs: 0,
    });
    vi.mocked(startScraperRun).mockResolvedValue({
      id: 1000,
    } as Awaited<ReturnType<typeof startScraperRun>>);
    vi.mocked(finishScraperRun).mockResolvedValue({
      id: 1000,
    } as Awaited<ReturnType<typeof finishScraperRun>>);
  });

  afterEach(() => {
    vi.mocked(finishScraperRun).mockReset();
    vi.mocked(startScraperRun).mockReset();
    vi.mocked(runAutmogProducer).mockReset();
    vi.mocked(runGrimsmoProducer).mockReset();
    vi.mocked(runQueueProcessor).mockReset();
  });

  it("exposes supported source keys", () => {
    expect(scraperSourceKeys).toContain(scraperSources.autmog);
    expect(scraperSourceKeys).toContain(scraperSources.grimsmoSaga);
    expect(scraperSourceKeys).toContain(scraperSources.grimsmoFjell);
  });

  it("runs the Autmog source producer", async () => {
    await expect(
      runSourceProducerJob({
        context: createContext(),
        logger: createNoopLogger(),
        source: scraperSources.autmog,
      }),
    ).resolves.toBeUndefined();
  });

  it("runs Grimsmo source producers", async () => {
    await expect(
      runSourceProducerJob({
        context: createContext(),
        env: {
          GRIMSMO_PROXY_URL: "https://proxy.example.com",
        } as Parameters<typeof runSourceProducerJob>[0]["env"],
        logger: createNoopLogger(),
        source: scraperSources.grimsmoSaga,
      }),
    ).resolves.toBeUndefined();
  });

  it("runs all source producers in source key order", async () => {
    await expect(
      runAllSourceProducerJobs({
        context: createContext(),
        env: {
          GRIMSMO_PROXY_URL: "https://proxy.example.com",
        } as Parameters<typeof runAllSourceProducerJobs>[0]["env"],
        logger: createNoopLogger(),
      }),
    ).resolves.toBeUndefined();

    expect(runAutmogProducer).toHaveBeenCalledTimes(1);
    expect(runGrimsmoProducer).toHaveBeenCalledTimes(4);
    expect(runGrimsmoProducer).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        source: scraperSources.grimsmoFjell,
      }),
    );
    expect(runGrimsmoProducer).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        source: scraperSources.grimsmoSaga,
      }),
    );
  });

  it("marks active producer runs failed when interrupted", async () => {
    vi.mocked(runGrimsmoProducer).mockImplementationOnce(
      ({ signal }) =>
        new Promise((_, reject) => {
          signal?.addEventListener("abort", () => {
            reject(signal.reason);
          });
        }),
    );

    const promise = runSourceProducerJob({
      context: createContext(),
      logger: createNoopLogger(),
      source: scraperSources.grimsmoSaga,
    });

    await vi.waitFor(() => {
      expect(runGrimsmoProducer).toHaveBeenCalledOnce();
    });
    process.emit("SIGINT", "SIGINT");

    await expect(promise).rejects.toBeInstanceOf(
      ScraperCommandInterruptedError,
    );
    expect(finishScraperRun).toHaveBeenCalledWith(
      expect.anything(),
      1000,
      expect.objectContaining({
        errorMessage: "Scraper command interrupted by SIGINT.",
        status: "failed",
      }),
    );
  });

  it("skips empty queue processor runs before creating scraper runs", async () => {
    const context = createContext({
      images: { active: 0, delayed: 0, waiting: 0 },
      items: { active: 0, delayed: 0, waiting: 0 },
    });

    await expect(
      runQueueProcessorJob({
        context,
        env: createQueueEnv(),
        logger: createNoopLogger(),
      }),
    ).resolves.toBeUndefined();

    expect(startScraperRun).not.toHaveBeenCalled();
    expect(runQueueProcessor).not.toHaveBeenCalled();
  });

  it("records queue processor runs when actionable jobs exist", async () => {
    const context = createContext({
      images: { active: 0, delayed: 0, waiting: 0 },
      items: { active: 0, delayed: 0, waiting: 1 },
    });

    await expect(
      runQueueProcessorJob({
        context,
        env: createQueueEnv(),
        logger: createNoopLogger(),
      }),
    ).resolves.toBeUndefined();

    expect(startScraperRun).toHaveBeenCalledWith(expect.anything(), {
      jobType: "processor",
      source: "queue",
    });
    expect(runQueueProcessor).toHaveBeenCalledOnce();
  });
});

function createContext(
  counts = {
    images: { active: 0, delayed: 0, waiting: 0 },
    items: { active: 0, delayed: 0, waiting: 0 },
  },
): ScraperJobContext {
  return {
    close: vi.fn(),
    db: {} as ScraperJobContext["db"],
    imageFolderPrefix: "images/dev",
    imageStorage: {} as ScraperJobContext["imageStorage"],
    queues: {
      close: vi.fn(),
      images: {
        getJobCounts: vi.fn(async () => counts.images),
      } as unknown as ScraperJobContext["queues"]["images"],
      items: {
        getJobCounts: vi.fn(async () => counts.items),
      } as unknown as ScraperJobContext["queues"]["items"],
    },
    redis: {} as ScraperJobContext["redis"],
  };
}

function createQueueEnv() {
  return {
    SCRAPER_IMAGE_BATCH_SIZE: 10,
    SCRAPER_ITEM_BATCH_SIZE: 10,
    SCRAPER_QUEUE_CONCURRENCY: 1,
  } as Parameters<typeof runQueueProcessorJob>[0]["env"];
}
