import type { Database } from "@package/database";
import { createNoopLogger, type Logger, loggerMessages } from "@package/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getGrimsmoVariationSyncState } from "../db/grimsmo.js";
import type { ScraperQueues } from "../queue/queues.js";
import { scraperSources } from "../scraper-types.js";
import type { ShopifyProduct } from "../shopify.js";
import { normalizeGrimsmoPenVariation } from "./normalize.js";
import { runGrimsmoProducer } from "./producer.js";

vi.mock("../db/grimsmo.js", () => ({
  getGrimsmoVariationSyncState: vi.fn(),
}));

describe("runGrimsmoProducer", () => {
  beforeEach(() => {
    vi.mocked(getGrimsmoVariationSyncState).mockReset().mockResolvedValue([]);
  });

  it("skips unchanged item jobs while preserving archive reconciliation", async () => {
    const product = createProduct({ handle: "saga-1", id: 1 });
    const item = normalizeGrimsmoPenVariation({
      collectionKind: "inventory",
      product,
      source: scraperSources.grimsmoSaga,
    });
    vi.mocked(getGrimsmoVariationSyncState).mockResolvedValue([
      {
        archivedAt: null,
        detailsHash: item.detailsHash,
        imageSetHash: item.imageSetHash,
        parentDetailsHash: item.product.detailsHash,
        sourceCollection: item.sourceCollection,
        sourceHandle: item.sourceHandle,
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

    const result = await runGrimsmoProducer({
      db: {} as Database,
      fetch: vi.fn(async (input: Parameters<typeof fetch>[0]) => {
        const url = input instanceof URL ? input : new URL(String(input));
        return jsonResponse(
          url.pathname.includes("saga-inventory") ? [product] : [],
        );
      }) as typeof fetch,
      logger,
      pagePauseMs: 0,
      queues,
      source: scraperSources.grimsmoSaga,
    });

    const [jobs] = addBulk.mock.calls[0] ?? [];
    expect(jobs).toHaveLength(1);
    expect(jobs[0].name).toBe("grimsmo.penVariationBatch");
    expect(result.enqueuedCount).toBe(0);
    expect(logger.info).toHaveBeenCalledWith(
      loggerMessages.scraper.grimsmo.producerCompleted,
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
      name: "details-hash changes",
      state: { detailsHash: "sha256:previous-details" },
    },
    {
      name: "image-only changes",
      state: { imageSetHash: "sha256:previous-images" },
    },
    {
      name: "parent-product changes",
      state: { parentDetailsHash: "sha256:previous-parent" },
    },
    {
      name: "source collection changes",
      state: { sourceCollection: "archive" },
    },
    {
      name: "archived items that reappear",
      state: { archivedAt: new Date("2026-01-04T00:00:00.000Z") },
    },
  ])("enqueues $name", async ({ state: stateOverrides }) => {
    const product = createProduct({ handle: "saga-1", id: 1 });
    const item = normalizeGrimsmoPenVariation({
      collectionKind: "inventory",
      product,
      source: scraperSources.grimsmoSaga,
    });
    vi.mocked(getGrimsmoVariationSyncState).mockResolvedValue([
      {
        archivedAt: null,
        detailsHash: item.detailsHash,
        imageSetHash: item.imageSetHash,
        parentDetailsHash: item.product.detailsHash,
        sourceCollection: item.sourceCollection,
        sourceHandle: item.sourceHandle,
        ...stateOverrides,
      },
    ]);
    const addBulk = vi.fn().mockResolvedValue([]);
    const queues = {
      close: vi.fn(),
      images: { addBulk: vi.fn() },
      items: { addBulk, getJob: vi.fn(async () => null) },
    } as unknown as ScraperQueues;

    const result = await runGrimsmoProducer({
      db: {} as Database,
      fetch: vi.fn(async (input: Parameters<typeof fetch>[0]) => {
        const url = input instanceof URL ? input : new URL(String(input));
        return jsonResponse(
          url.pathname.includes("saga-inventory") ? [product] : [],
        );
      }) as typeof fetch,
      logger: createNoopLogger({ app: "scraper" }),
      pagePauseMs: 0,
      queues,
      source: scraperSources.grimsmoSaga,
    });

    const [jobs] = addBulk.mock.calls[0] ?? [];
    expect(jobs[0].name).toBe("grimsmo.penVariation");
    expect(result.enqueuedCount).toBe(1);
  });

  it("re-enqueues an A → B → A transition despite its completed job", async () => {
    const addBulk = vi.fn().mockResolvedValue([]);
    const completedJob = {
      getState: vi.fn().mockResolvedValue("completed"),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const getJob = vi
      .fn()
      .mockResolvedValueOnce(completedJob)
      .mockResolvedValue(null);
    const queues = {
      close: vi.fn(),
      images: { addBulk: vi.fn() },
      items: {
        addBulk,
        getJob,
      },
    } as unknown as ScraperQueues;
    const inventoryProduct = createProduct({ handle: "saga-1", id: 1 });
    const archiveProduct = createProduct({
      available: false,
      handle: "saga-2",
      id: 2,
    });
    const inventoryItem = normalizeGrimsmoPenVariation({
      collectionKind: "inventory",
      product: inventoryProduct,
      source: scraperSources.grimsmoSaga,
    });
    vi.mocked(getGrimsmoVariationSyncState).mockResolvedValue([
      {
        archivedAt: null,
        detailsHash: "sha256:state-b",
        imageSetHash: inventoryItem.imageSetHash,
        parentDetailsHash: inventoryItem.product.detailsHash,
        sourceCollection: inventoryItem.sourceCollection,
        sourceHandle: inventoryItem.sourceHandle,
      },
    ]);
    const fetcher = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = input instanceof URL ? input : new URL(String(input));
      const handle = url.pathname.split("/").at(-2);

      if (handle === "saga-inventory") {
        return jsonResponse([inventoryProduct]);
      }

      if (handle === "saga") {
        return jsonResponse([inventoryProduct, archiveProduct]);
      }

      return jsonResponse([]);
    });

    const result = await runGrimsmoProducer({
      db: {} as Database,
      fetch: fetcher as typeof fetch,
      logger: createNoopLogger({ app: "scraper" }),
      pagePauseMs: 0,
      queues,
      source: scraperSources.grimsmoSaga,
    });

    expect(result.fetchedCount).toBe(2);
    expect(result.removedCompletedItemJobs).toBe(1);
    expect(result.inventoryFetchedCount).toBe(1);
    expect(result.archivedFetchedCount).toBe(1);
    expect(completedJob.remove).toHaveBeenCalledOnce();
    expect(addBulk).toHaveBeenCalledTimes(1);
    const [jobs] = addBulk.mock.calls[0] ?? [];
    expect(jobs).toHaveLength(3);
    expect(jobs[0]).toMatchObject({
      data: {
        item: {
          product: {
            productHandle: "saga",
          },
          sourceCollection: "inventory",
          sourceHandle: "saga-1",
        },
        source: "grimsmo-saga",
        type: "grimsmo.penVariation",
      },
      name: "grimsmo.penVariation",
    });
    expect(jobs[1]).toMatchObject({
      data: {
        item: {
          sourceCollection: "archive",
          sourceHandle: "saga-2",
        },
        source: "grimsmo-saga",
        type: "grimsmo.penVariation",
      },
    });
    expect(jobs[2]).toMatchObject({
      data: {
        items: expect.arrayContaining([
          expect.objectContaining({ sourceHandle: "saga-1" }),
          expect.objectContaining({ sourceHandle: "saga-2" }),
        ]),
        source: "grimsmo-saga",
        type: "grimsmo.penVariationBatch",
      },
      name: "grimsmo.penVariationBatch",
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
    const fetcher = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = input instanceof URL ? input : new URL(String(input));
      const handle = url.pathname.split("/").at(-2);

      if (handle === "saga-inventory") {
        return jsonResponse([createProduct({ handle: "saga-1", id: 1 })]);
      }

      return jsonResponse([]);
    });

    await runGrimsmoProducer({
      db: {} as Database,
      fetch: fetcher as typeof fetch,
      logger: createNoopLogger({ app: "scraper" }),
      pagePauseMs: 0,
      queues,
      skipArchiveReconciliation: true,
      source: scraperSources.grimsmoSaga,
    });

    const [jobs] = addBulk.mock.calls[0] ?? [];
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      data: {
        source: "grimsmo-saga",
        type: "grimsmo.penVariation",
      },
      name: "grimsmo.penVariation",
    });
  });
});

function jsonResponse(products: ShopifyProduct[]) {
  return new Response(JSON.stringify({ products }));
}

function createProduct(overrides: Partial<ShopifyProduct>): ShopifyProduct {
  return {
    available: true,
    body_html: "<ul><li>Stonewashed Titanium Body</li></ul>",
    created_at: "2026-01-01T00:00:00Z",
    handle: "saga-1",
    id: 1,
    images: [],
    product_type: "Pens",
    published_at: "2026-01-02T00:00:00Z",
    tags: ["grimsmo"],
    title: "Saga #1",
    updated_at: "2026-01-03T00:00:00Z",
    variants: [
      {
        available: true,
        id: 1,
        price: "975.00",
        title: "Default Title",
      },
    ],
    vendor: "Grimsmo",
    ...overrides,
  };
}
