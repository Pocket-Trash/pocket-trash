import { beforeEach, describe, expect, it, vi } from "vitest";

/** Provides public product-type Trends to the route loader. */
const listPublicProductTypeTrends = vi.hoisted(() => vi.fn());
/** Provides the active collection-item generation to the route loader. */
const getPublicCollectionItemTrends = vi.hoisted(() => vi.fn());

vi.mock("@/lib/catalog-api", () => ({
  getPublicCollectionItemTrends,
  listPublicProductTypeTrends,
}));
vi.mock("@/pages/trends-page", () => ({
  /**
   * Renders the stable Trends route test marker.
   *
   * @returns Trends route test marker.
   */
  TrendsPage: () => <div>trends-page</div>,
  /**
   * Renders the stable Trends pending test marker.
   *
   * @returns Trends pending test marker.
   */
  TrendsPendingPage: () => <div>trends-pending</div>,
}));

import { Route } from "./trends";

describe("Trends route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normalizes stable product-type IDs and loads public Trends", async () => {
    const validateSearch = Route.options.validateSearch;
    const loader = Route.options.loader;
    if (!validateSearch || !loader)
      throw new Error("Trends route search and loader contracts are missing.");

    const parseSearch = validateSearch as (
      search: Record<string, unknown>,
    ) => Record<string, unknown>;
    expect(parseSearch({ productTypeId: "1001" })).toEqual({
      productTypeId: 1001,
    });
    expect(parseSearch({ productTypeId: "invalid" })).toEqual({});

    const trends = [
      {
        count: 2,
        productTypeId: 1001,
        productTypeName: "Spinner",
      },
    ];
    const collectionTrends = {
      generatedAt: new Date("2026-10-14T00:00:00.000Z"),
      hasSuppressedValues: false,
      stale: false,
      values: trends,
    };
    listPublicProductTypeTrends.mockResolvedValueOnce(trends);
    getPublicCollectionItemTrends.mockResolvedValueOnce(collectionTrends);
    await expect(
      (loader as (context: unknown) => Promise<unknown>)({}),
    ).resolves.toEqual({ catalogTrends: trends, collectionTrends });
  });
});
