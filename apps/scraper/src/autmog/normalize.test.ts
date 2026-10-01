import { describe, expect, it } from "vitest";
import { normalizeAutmogProduct } from "./normalize.js";
import type { ShopifyProduct } from "./shopify.js";

describe("normalizeAutmogProduct", () => {
  it("normalizes Shopify Autmog product data", () => {
    const product = createProduct({
      body_html:
        "<p>40 click pen with tumbled titanium body, cone nose, and Pilot G2 refill.</p>",
      title: "40 Click Pen - 6Al-4V Titanium - Pilot G2",
    });

    const item = normalizeAutmogProduct(product);

    expect(item).toMatchObject({
      availableForSale: true,
      clip: null,
      description:
        "40 click pen with tumbled titanium body, cone nose, and Pilot G2 refill.",
      finish: "tumbled",
      mechanism: "click",
      nose: "cone",
      priceMaxCents: 15000,
      priceMinCents: 12500,
      productTypes: ["pen"],
      productUrl: "https://www.autmog.com/products/40-click-pen",
      refill: "Pilot G2",
      size: "40",
      sourceProductId: "123",
      title: "40 Click Pen - 6Al-4V Titanium - Pilot G2",
    });
    expect(item.materials).toContain("6al-4v titanium");
    expect(item.images).toHaveLength(1);
    expect(item.detailsHash).toMatch(/^sha256:/);
    expect(item.imageSetHash).toMatch(/^sha256:/);
  });

  it("leaves visual classification null when source text is inconclusive", () => {
    const item = normalizeAutmogProduct(
      createProduct({
        body_html: "<p>Machined pen.</p>",
        title: "Pen",
      }),
    );

    expect(item.clip).toBeNull();
    expect(item.grip).toBeNull();
    expect(item.bodyDetails).toEqual([]);
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
    body_html: "<p>Pen body.</p>",
    created_at: "2026-01-01T00:00:00Z",
    handle: "40-click-pen",
    id: 123,
    images: [
      {
        height: 1200,
        id: 456,
        position: 1,
        src: "https://cdn.shopify.com/image.jpg",
        width: 1600,
      },
    ],
    product_type: "Pens",
    published_at: "2026-01-02T00:00:00Z",
    tags: ["pen"],
    title: "40 Click Pen",
    updated_at: "2026-01-03T00:00:00Z",
    variants: [
      {
        available: true,
        id: 1,
        price: "125.00",
        title: "Default",
      },
      {
        available: false,
        id: 2,
        price: "150.00",
        title: "Variant",
      },
    ],
    vendor: "Autmog",
    ...overrides,
  };
}
