import { describe, expect, it, vi } from "vitest";
import { scraperSources } from "../scraper-types.js";
import type { ShopifyProduct } from "../shopify.js";
import { fetchGrimsmoProducts } from "./source.js";

describe("fetchGrimsmoProducts", () => {
  it("limits non-production fetches across inventory and archive collections", async () => {
    const fetcher = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = input instanceof URL ? input : new URL(String(input));
      const handle = url.pathname.split("/").at(-2);

      if (handle === "saga-inventory") {
        return jsonResponse([
          createProduct({ handle: "saga-1", id: 1 }),
          createProduct({ handle: "saga-2", id: 2 }),
        ]);
      }

      if (handle === "saga") {
        return jsonResponse([createProduct({ handle: "saga-3", id: 3 })]);
      }

      return jsonResponse([]);
    });

    const products = await fetchGrimsmoProducts({
      fetch: fetcher as typeof fetch,
      maxProducts: 2,
      pagePauseMs: 0,
      source: scraperSources.grimsmoSaga,
    });

    expect(products).toHaveLength(2);
    expect(products.map((item) => item.product.handle)).toEqual([
      "saga-1",
      "saga-2",
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fills limited fetches from archive when inventory has room", async () => {
    const fetcher = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = input instanceof URL ? input : new URL(String(input));
      const handle = url.pathname.split("/").at(-2);

      if (handle === "saga-inventory") {
        return jsonResponse([createProduct({ handle: "saga-1", id: 1 })]);
      }

      if (handle === "saga") {
        return jsonResponse([createProduct({ handle: "saga-2", id: 2 })]);
      }

      return jsonResponse([]);
    });

    const products = await fetchGrimsmoProducts({
      fetch: fetcher as typeof fetch,
      maxProducts: 2,
      pagePauseMs: 0,
      source: scraperSources.grimsmoSaga,
    });

    expect(products).toHaveLength(2);
    expect(products.map((item) => item.collectionKind)).toEqual([
      "inventory",
      "archive",
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

/**
 * Creates a Shopify-style JSON response for source tests.
 *
 * @param products - Shopify products to encode in the response.
 *
 * @returns A response containing a Shopify products payload.
 */
function jsonResponse(products: ShopifyProduct[]) {
  return new Response(JSON.stringify({ products }));
}

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
