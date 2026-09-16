import type { Database } from "@package/database";
import { createNoopLogger, type Logger, loggerMessages } from "@package/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAutmogPenSyncState } from "../db/autmog.js";
import type { ScraperQueues } from "../queue/queues.js";
import type { ShopifyProduct } from "../shopify.js";
import { normalizeAutmogProduct } from "./normalize.js";
import { runAutmogProducer } from "./producer.js";

vi.mock("../db/autmog.js", () => ({
  getAutmogPenSyncState: vi.fn(),
}));

describe("runAutmogProducer", () => {
  beforeEach(() => {
    vi.mocked(getAutmogPenSyncState).mockReset().mockResolvedValue([]);
  });

  it("skips unchanged item jobs while preserving archive reconciliation", async () => {
    const product = createProduct({ id: 123 });
    const item = normalizeAutmogProduct(product);
    vi.mocked(getAutmogPenSyncState).mockResolvedValue([
      {
        archivedAt: null,
        detailsHash: item.detailsHash,
        imageSetHash: item.imageSetHash,
        sourceProductId: "123",
      },
    ]);
    const addBulk = vi.fn().mockResolvedValue([]);
    const queues = {
      close: vi.fn(),
      images: { addBulk: vi.fn() },
      items: {
        addBulk,
        getJob: vi.fn(async () => null),
      },
    } as unknown as ScraperQueues;
    const logger = {
      error: vi.fn(),
      info: vi.fn(),
    } as unknown as Logger;

    const result = await runAutmogProducer({
      db: {} as Database,
      fetch: vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ products: [product] })),
        ),
      logger,
      queues,
    });

    const [jobs] = addBulk.mock.calls[0] ?? [];
    expect(jobs).toHaveLength(1);
    expect(jobs[0].name).toBe("autmog.archiveMissing");
    expect(result.enqueuedCount).toBe(0);
    expect(logger.info).toHaveBeenCalledWith(
      loggerMessages.scraper.autmog.producerCompleted,
      expect.objectContaining({
        attributes: expect.objectContaining({
          archiveReconciliationJobs: 1,
          enqueuedItemJobs: 0,
          fetchedCount: 1,
          skippedUnchangedItems: 1,
        }),
      }),
    );
  });

  it.each([
    {
      name: "image-only changes",
      state: { imageSetHash: "sha256:previous-images" },
    },
    {
      name: "archived items that reappear",
      state: { archivedAt: new Date("2026-01-04T00:00:00.000Z") },
    },
  ])("enqueues $name", async ({ state: stateOverrides }) => {
    const product = createProduct({ id: 123 });
    const item = normalizeAutmogProduct(product);
    vi.mocked(getAutmogPenSyncState).mockResolvedValue([
      {
        archivedAt: null,
        detailsHash: item.detailsHash,
        imageSetHash: item.imageSetHash,
        sourceProductId: item.sourceProductId,
        ...stateOverrides,
      },
    ]);
    const addBulk = vi.fn().mockResolvedValue([]);
    const queues = {
      close: vi.fn(),
      images: { addBulk: vi.fn() },
      items: { addBulk, getJob: vi.fn(async () => null) },
    } as unknown as ScraperQueues;

    const result = await runAutmogProducer({
      db: {} as Database,
      fetch: vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ products: [product] })),
        ),
      logger: createNoopLogger({ app: "scraper" }),
      queues,
    });

    const [jobs] = addBulk.mock.calls[0] ?? [];
    expect(jobs[0].name).toBe("autmog.pen");
    expect(result.enqueuedCount).toBe(1);
  });

  it("re-enqueues an A → B → A transition despite its completed job", async () => {
    const addBulk = vi.fn().mockResolvedValue([]);
    const completedJob = {
      getState: vi.fn().mockResolvedValue("completed"),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const waitingJob = {
      getState: vi.fn().mockResolvedValue("waiting"),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const getJob = vi
      .fn()
      .mockResolvedValueOnce(completedJob)
      .mockResolvedValueOnce(waitingJob);
    const queues = {
      close: vi.fn(),
      images: { addBulk: vi.fn() },
      items: { addBulk, getJob },
    } as unknown as ScraperQueues;
    const product = createProduct({ id: 123 });
    const item = normalizeAutmogProduct(product);
    vi.mocked(getAutmogPenSyncState).mockResolvedValue([
      {
        archivedAt: null,
        detailsHash: "sha256:state-b",
        imageSetHash: item.imageSetHash,
        sourceProductId: item.sourceProductId,
      },
    ]);
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          products: [product],
        }),
      ),
    );

    const result = await runAutmogProducer({
      db: {} as Database,
      fetch: fetcher,
      logger: createNoopLogger({ app: "scraper" }),
      queues,
    });

    expect(result.fetchedCount).toBe(1);
    expect(result.removedCompletedItemJobs).toBe(1);
    expect(completedJob.remove).toHaveBeenCalledTimes(1);
    expect(waitingJob.remove).not.toHaveBeenCalled();
    expect(addBulk).toHaveBeenCalledTimes(1);
    const [jobs] = addBulk.mock.calls[0] ?? [];
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      data: {
        source: "autmog",
        type: "autmog.pen",
      },
      name: "autmog.pen",
    });
    expect(jobs[0].opts.jobId).toMatch(/^autmog--pen--123--sha256%3A/);
    expect(jobs[1]).toMatchObject({
      data: {
        seenSourceProductIds: ["123"],
        source: "autmog",
        type: "autmog.archiveMissing",
      },
      name: "autmog.archiveMissing",
    });
  });

  it("skips archive reconciliation during limited source scrapes", async () => {
    const addBulk = vi.fn().mockResolvedValue([]);
    const queues = {
      close: vi.fn(),
      images: { addBulk: vi.fn() },
      items: {
        addBulk,
        getJob: vi.fn(async () => null),
      },
    } as unknown as ScraperQueues;
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          products: [
            {
              available: true,
              body_html: "<p>36 click pen clipless Pilot G2.</p>",
              created_at: "2026-01-01T00:00:00Z",
              handle: "36-click-pen",
              id: 123,
              images: [],
              product_type: "Pens",
              published_at: "2026-01-02T00:00:00Z",
              tags: ["pen"],
              title: "36 Click Pen Clipless Pilot G2",
              updated_at: "2026-01-03T00:00:00Z",
              variants: [],
              vendor: "Autmog",
            },
          ],
        }),
      ),
    );

    await runAutmogProducer({
      db: {} as Database,
      fetch: fetcher,
      logger: createNoopLogger({ app: "scraper" }),
      queues,
      skipArchiveReconciliation: true,
    });

    const [jobs] = addBulk.mock.calls[0] ?? [];
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      data: {
        source: "autmog",
        type: "autmog.pen",
      },
      name: "autmog.pen",
    });
  });
});

function createProduct(overrides: Partial<ShopifyProduct>): ShopifyProduct {
  return {
    available: true,
    body_html: "<p>36 click pen clipless Pilot G2.</p>",
    created_at: "2026-01-01T00:00:00Z",
    handle: "36-click-pen",
    id: 123,
    images: [],
    product_type: "Pens",
    published_at: "2026-01-02T00:00:00Z",
    tags: ["pen"],
    title: "36 Click Pen Clipless Pilot G2",
    updated_at: "2026-01-03T00:00:00Z",
    variants: [],
    vendor: "Autmog",
    ...overrides,
  };
}
