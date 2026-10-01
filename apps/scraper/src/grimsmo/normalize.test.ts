import { describe, expect, it } from "vitest";
import { scraperSources } from "../scraper-types.js";
import type { ShopifyProduct } from "../shopify.js";
import {
  extractBullets,
  normalizeGrimsmoKnifeVariation,
  normalizeGrimsmoPenVariation,
} from "./normalize.js";

describe("Grimsmo normalization", () => {
  it("normalizes Saga listings as product variations", () => {
    const item = normalizeGrimsmoPenVariation({
      collectionKind: "inventory",
      product: createProduct({
        body_html: [
          "<ul>",
          "<li>Stonewashed Titanium Body, Tip and Clip</li>",
          "<li>Bronze Titanium Slider with Helix pattern</li>",
          "<li>Grimsmo Logo Engraving on the Button</li>",
          "<li>Schmidt P900F ink cartridge installed</li>",
          "<li>Nanuk x Grimsmo Bisaro Black carrying case</li>",
          "</ul>",
        ].join(""),
        handle: "saga-6800-1234567890",
        id: 6800,
        title: "Saga #6800",
      }),
      source: scraperSources.grimsmoSaga,
    });

    expect(item).toMatchObject({
      bodyColors: [],
      bodyFinishes: ["Stonewashed"],
      bodyMaterials: ["Titanium"],
      case: "Bisaro Black",
      currencyCode: "USD",
      engraving: "Grimsmo Logo",
      priceMaxCents: 97500,
      priceMinCents: 97500,
      product: {
        productHandle: "saga",
        productUrl: "https://grimsmoknives.com/collections/saga",
        title: "Saga",
      },
      productUrl: "https://grimsmoknives.com/products/saga-6800-1234567890",
      refill: "Schmidt P900F",
      sagaNumber: "6800",
      sliderColors: ["Bronze"],
      sliderMaterials: ["Titanium", "Bronze"],
      sliderStyle: "Helix",
      sourceCollection: "inventory",
      sourceHandle: "saga-6800-1234567890",
      sourceProductId: "6800",
      title: "Saga #6800",
    });
    expect(item.detailsHash).toMatch(/^sha256:/);
    expect(item.imageSetHash).toMatch(/^sha256:/);
    expect(item.images).toHaveLength(1);
  });

  it("extracts dash-style Saga bullets from archive descriptions", () => {
    expect(
      extractBullets(
        "Custom Titanium Saga Pen - Blasted Titanium Body - Blue Slider - Pilot G2 refill",
      ),
    ).toEqual(["Blasted Titanium Body", "Blue Slider", "Pilot G2 refill"]);
  });

  it("normalizes knife listings under stable knife products", () => {
    const item = normalizeGrimsmoKnifeVariation({
      collectionKind: "archive",
      product: createProduct({
        body_html: [
          "<ul>",
          "<li>Streamline titanium handle pattern with blue hardware</li>",
          "<li>RWL 34 blade with hand brushed finish</li>",
          "<li>Lock Bar Insert mechanism</li>",
          "<li>Nanuk carrying case</li>",
          "</ul>",
        ].join(""),
        handle: "rask-2000-1234567890",
        id: 2000,
        title: "Rask #2000",
      }),
      source: scraperSources.grimsmoRask,
    });

    expect(item).toMatchObject({
      bladeFinishes: ["Hand Brushed"],
      bladeSteels: ["RWL 34"],
      case: "Other Nanuk",
      currencyCode: "USD",
      handleMaterials: ["Titanium"],
      hardwareColors: ["Blue"],
      knifeNumber: "2000",
      knifeType: "rask",
      mechanisms: ["Lock Bar Insert"],
      patterns: ["Streamline"],
      product: {
        productHandle: "rask",
        productUrl: "https://grimsmoknives.com/collections/rask",
        title: "Rask",
      },
      sourceCollection: "archive",
      sourceHandle: "rask-2000-1234567890",
    });
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
    body_html: "<p>Listing body.</p>",
    created_at: "2026-01-01T00:00:00Z",
    handle: "saga-6800-1234567890",
    id: 6800,
    images: [
      {
        alt: "Grimsmo listing image",
        height: 1200,
        id: 100,
        position: 1,
        src: "https://cdn.shopify.com/grimsmo.jpg",
        width: 1600,
      },
    ],
    product_type: "Pens",
    published_at: "2026-01-02T00:00:00Z",
    tags: ["grimsmo"],
    title: "Saga #6800",
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
