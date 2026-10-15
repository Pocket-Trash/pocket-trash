import type { Database } from "@package/database";
import { createNoopLogger, type Logger, loggerMessages } from "@package/logger";
import { describe, expect, it, vi } from "vitest";
import type { ScraperQueues } from "../queue/queues.js";
import type { ShopifyProduct } from "../shopify.js";
import { runAutmogProducer } from "./producer.js";

describe("runAutmogProducer", () => {
  it("enqueues canonical item jobs without archive reconciliation", async () => {
    const product = createProduct({ id: 123 });
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
    expect(jobs[0].name).toBe("autmog.pen");
    expect(result.enqueuedCount).toBe(1);
    expect(logger.info).toHaveBeenCalledWith(
      loggerMessages.scraper.autmog.producerCompleted,
      expect.objectContaining({
        attributes: expect.objectContaining({
          archiveReconciliationJobs: 0,
          enqueuedItemJobs: 1,
          fetchedCount: 1,
          skippedUnchangedItems: 0,
        }),
      }),
    );
  });

  it("re-enqueues an A → B → A transition despite its completed job", async () => {
    const addBulk = vi.fn().mockResolvedValue([]);
    const completedJob = {
      getState: vi.fn().mockResolvedValue("completed"),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const getJob = vi.fn().mockResolvedValueOnce(completedJob);
    const queues = {
      close: vi.fn(),
      images: { addBulk: vi.fn() },
      items: { addBulk, getJob },
    } as unknown as ScraperQueues;
    const product = createProduct({ id: 123 });
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
    expect(addBulk).toHaveBeenCalledTimes(1);
    const [jobs] = addBulk.mock.calls[0] ?? [];
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      data: {
        source: "autmog",
        type: "autmog.pen",
      },
      name: "autmog.pen",
    });
    expect(jobs[0].opts.jobId).toMatch(/^autmog--pen--123--sha256%3A/);
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

  it("does not enqueue Autmog accessories as canonical Pens", async () => {
    const addBulk = vi.fn().mockResolvedValue([]);
    const queues = {
      close: vi.fn(),
      images: { addBulk: vi.fn() },
      items: {
        addBulk,
        getJob: vi.fn(async () => null),
      },
    } as unknown as ScraperQueues;

    const result = await runAutmogProducer({
      db: {} as Database,
      fetch: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            products: [
              createProduct({
                body_html: "<p>Replacement clips for Autmog pens.</p>",
                handle: "pen-clips",
                id: 6_955_113_873_595,
                product_type: "Pen",
                title: "Pen Clips",
              }),
              createProduct({
                body_html: "<p>Clip add-on for an Autmog pen.</p>",
                handle: "clip-add-on",
                product_type: "Pen",
                title: "Clip Add-on for Pen",
              }),
              createProduct({
                body_html: "<p>Wood pen tray.</p>",
                handle: "pen-tray",
                id: 124,
                product_type: "Accessories",
                title: "Pen Tray",
              }),
            ],
          }),
        ),
      ),
      logger: createNoopLogger({ app: "scraper" }),
      queues,
    });

    expect(result).toMatchObject({
      enqueuedCount: 0,
      fetchedCount: 3,
      items: [],
    });
    expect(addBulk).toHaveBeenCalledWith([]);
  });
});

/**
 * Creates a representative Shopify product with selected overrides.
 *
 * @param overrides - Shopify fields that replace fixture defaults.
 *
 * @returns A complete Shopify product fixture.
 */
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
