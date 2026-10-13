import type { Database } from "@package/database";
import { createNoopLogger } from "@package/logger";
import { describe, expect, it, vi } from "vitest";
import type { ScraperQueues } from "../queue/queues.js";
import { scraperSources } from "../scraper-types.js";
import type { ShopifyProduct } from "../shopify.js";
import { runGrimsmoProducer } from "./producer.js";

describe("runGrimsmoProducer", () => {
  it("enqueues one canonical Saga material reconciliation for the complete feed", async () => {
    const addBulk = vi.fn().mockResolvedValue([]);
    const queues = createQueues(addBulk);
    const inventoryProduct = createProduct({
      body_html:
        "<ul><li>Stonewashed Titanium Body</li><li>Bronze Slider</li></ul>",
      handle: "saga-1",
      id: 1,
    });
    const archiveProduct = createProduct({
      available: false,
      body_html: "<ul><li>Copper Body</li><li>Titanium Slider</li></ul>",
      handle: "saga-2",
      id: 2,
    });

    const result = await runGrimsmoProducer({
      db: {} as Database,
      fetch: createFetcher(inventoryProduct, archiveProduct),
      logger: createNoopLogger({ app: "scraper" }),
      pagePauseMs: 0,
      queues,
      source: scraperSources.grimsmoSaga,
    });

    expect(result).toMatchObject({
      archivedFetchedCount: 1,
      enqueuedCount: 1,
      fetchedCount: 2,
      inventoryFetchedCount: 1,
    });
    const [jobs] = addBulk.mock.calls[0] ?? [];
    expect(jobs).toEqual([
      expect.objectContaining({
        data: {
          materialNames: ["Bronze", "Copper", "Titanium"],
          source: "grimsmo-saga",
          type: "grimsmo.sagaMaterials",
        },
        name: "grimsmo.sagaMaterials",
      }),
    ]);
  });

  it("re-enqueues an identical weekly material snapshot after completion", async () => {
    const completedJob = {
      getState: vi.fn().mockResolvedValue("completed"),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const addBulk = vi.fn().mockResolvedValue([]);
    const queues = createQueues(
      addBulk,
      vi.fn().mockResolvedValue(completedJob),
    );
    const product = createProduct({ handle: "saga-1", id: 1 });

    const result = await runGrimsmoProducer({
      db: {} as Database,
      fetch: createFetcher(product),
      logger: createNoopLogger({ app: "scraper" }),
      pagePauseMs: 0,
      queues,
      skipArchiveReconciliation: true,
      source: scraperSources.grimsmoSaga,
    });

    expect(result.removedCompletedItemJobs).toBe(1);
    expect(completedJob.remove).toHaveBeenCalledOnce();
    expect(addBulk).toHaveBeenCalledOnce();
  });
});

/**
 * Creates the queue surface used by producer tests.
 *
 * @param addBulk - Spy receiving the produced item jobs.
 * @param getJob - Spy resolving previously queued jobs by identifier.
 * @returns Minimal scraper queue fixture.
 */
function createQueues(
  addBulk: ReturnType<typeof vi.fn>,
  getJob = vi.fn(async () => null),
): ScraperQueues {
  return {
    close: vi.fn(),
    images: { addBulk: vi.fn() },
    items: { addBulk, getJob },
  } as unknown as ScraperQueues;
}

/**
 * Creates a Shopify collection fetcher with inventory/archive fixtures.
 *
 * @param inventoryProduct - Product returned by the inventory collection.
 * @param archiveProduct - Optional additional product returned by the archive.
 * @returns Fetch-compatible Grimsmo source fixture.
 */
function createFetcher(
  inventoryProduct: ShopifyProduct,
  archiveProduct?: ShopifyProduct,
): typeof fetch {
  return vi.fn(async (input: Parameters<typeof fetch>[0]) => {
    const url = input instanceof URL ? input : new URL(String(input));
    const handle = url.pathname.split("/").at(-2);

    if (handle === "saga-inventory") return jsonResponse([inventoryProduct]);
    if (handle === "saga") {
      return jsonResponse([
        inventoryProduct,
        ...(archiveProduct ? [archiveProduct] : []),
      ]);
    }
    return jsonResponse([]);
  }) as typeof fetch;
}

/**
 * Creates a Shopify-style JSON response.
 *
 * @param products - Products encoded in the response body.
 * @returns JSON response consumed by the Shopify adapter.
 */
function jsonResponse(products: ShopifyProduct[]) {
  return new Response(JSON.stringify({ products }));
}

/**
 * Creates a representative Saga listing with selected overrides.
 *
 * @param overrides - Shopify fields replacing fixture defaults.
 * @returns Complete Saga Shopify product fixture.
 */
function createProduct(
  overrides: Partial<ShopifyProduct> = {},
): ShopifyProduct {
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
