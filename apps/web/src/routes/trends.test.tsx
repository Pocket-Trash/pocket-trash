import { beforeEach, describe, expect, it, vi } from "vitest";

/** Provides public product-type Trends to the route loader. */
const listPublicProductTypeTrends = vi.hoisted(() => vi.fn());
/** Provides app-wide recorded activity to the route loader. */
const getPublicActivityTrends = vi.hoisted(() => vi.fn());
/** Provides the active collection-item generation to the route loader. */
const getPublicCollectionItemTrends = vi.hoisted(() => vi.fn());
/** Provides privacy-safe public maker and product Trends. */
const getPublicCollectionMakerProductTrends = vi.hoisted(() => vi.fn());
/** Provides exact catalog material Trends to the route loader. */
const getPublicCatalogMaterialTrends = vi.hoisted(() => vi.fn());
/** Provides privacy-safe collection material Trends to the route loader. */
const getPublicCollectionMaterialTrends = vi.hoisted(() => vi.fn());
/** Provides the active Parts and Accessories generation to the route loader. */
const getPublicPartAccessoryTrends = vi.hoisted(() => vi.fn());

vi.mock("@/lib/catalog-api", () => ({
  getPublicActivityTrends,
  getPublicCatalogMaterialTrends,
  getPublicCollectionItemTrends,
  getPublicCollectionMakerProductTrends,
  getPublicCollectionMaterialTrends,
  getPublicPartAccessoryTrends,
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
    expect(
      parseSearch({
        makerId: "2001",
        productId: "3001",
        productTypeId: "1001",
      }),
    ).toEqual({
      makerId: 2001,
      productId: 3001,
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
    getPublicCollectionMakerProductTrends.mockResolvedValueOnce(null);
    getPublicPartAccessoryTrends.mockResolvedValueOnce(collectionTrends);
    getPublicCatalogMaterialTrends.mockResolvedValueOnce([]);
    getPublicCollectionMaterialTrends.mockResolvedValueOnce(null);
    const activityTrends = {
      granularity: "month",
      range: "year",
      values: [],
    };
    getPublicActivityTrends.mockResolvedValueOnce(activityTrends);
    await expect(
      (loader as (context: unknown) => Promise<unknown>)({
        deps: { range: "year" },
      }),
    ).resolves.toEqual({
      activityTrends,
      catalogTrends: trends,
      catalogMaterialTrends: [],
      collectionMaterialTrends: null,
      collectionTrends,
      makerProductTrends: null,
      partAccessoryTrends: collectionTrends,
    });
    expect(getPublicActivityTrends).toHaveBeenCalledWith({ data: "year" });
  });
});
