import { beforeEach, describe, expect, it, vi } from "vitest";

/** Owner-scoped current item lookup. */
const getUserCollection = vi.hoisted(() => vi.fn());
/** Owner-scoped collection-summary lookup. */
const getUserCollections = vi.hoisted(() => vi.fn());
/** Privacy-safe community product-type lookup. */
const getPublicCollectionItemTrends = vi.hoisted(() => vi.fn());
/** Privacy-safe community maker and product lookup. */
const getPublicCollectionMakerProductTrends = vi.hoisted(() => vi.fn());
/** Privacy-safe community material lookup. */
const getPublicCollectionMaterialTrends = vi.hoisted(() => vi.fn());
/** Provides exact owner-scoped recorded activity. */
const getUserActivityTrends = vi.hoisted(() => vi.fn());
/** Provides exact owner-scoped effective-date history. */
const getUserCollectionHistoryTrends = vi.hoisted(() => vi.fn());

vi.mock("@/lib/catalog-api", () => ({
  getPublicCollectionItemTrends,
  getPublicCollectionMakerProductTrends,
  getPublicCollectionMaterialTrends,
  getUserActivityTrends,
  getUserCollectionHistoryTrends,
  getUserCollection,
  getUserCollections,
}));
vi.mock("@/pages/user-trends-page", () => ({
  /**
   * Renders the stable private Trends route marker.
   *
   * @returns Private Trends marker.
   */
  UserTrendsPage: () => <div>user-trends-page</div>,
}));

import { Route } from "./user.trends";

describe("private user Trends route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads owner data with active privacy-safe community generations", async () => {
    getUserCollection.mockResolvedValueOnce([{ collectionItemId: 1 }]);
    getUserCollections.mockResolvedValueOnce([{ id: 10 }, { id: 11 }]);
    getPublicCollectionItemTrends.mockResolvedValueOnce({ values: [] });
    getPublicCollectionMakerProductTrends.mockResolvedValueOnce(null);
    getPublicCollectionMaterialTrends.mockResolvedValueOnce(null);
    const activityTrends = {
      granularity: "month",
      range: "year",
      values: [],
    };
    getUserActivityTrends.mockResolvedValueOnce(activityTrends);
    const collectionHistoryTrends = {
      exactDateCount: 1,
      granularity: "month",
      imputedDateCount: 0,
      range: "year",
      values: [],
    };
    getUserCollectionHistoryTrends.mockResolvedValueOnce(
      collectionHistoryTrends,
    );
    const loader = Route.options.loader;
    if (!loader) throw new Error("Private Trends route loader is missing.");

    await expect(
      (loader as (context: unknown) => Promise<unknown>)({
        deps: { range: "year" },
      }),
    ).resolves.toEqual({
      activityTrends,
      collectionHistoryTrends,
      collectionCount: 2,
      communityTrends: {
        collectionItems: { values: [] },
        makerProducts: null,
        materials: null,
      },
      items: [{ collectionItemId: 1 }],
    });
    expect(getUserCollection).toHaveBeenCalledOnce();
    expect(getUserCollections).toHaveBeenCalledOnce();
    expect(getUserActivityTrends).toHaveBeenCalledWith({ data: "year" });
    expect(getUserCollectionHistoryTrends).toHaveBeenCalledWith({
      data: "year",
    });
    expect(getPublicCollectionItemTrends).toHaveBeenCalledOnce();
    expect(getPublicCollectionMakerProductTrends).toHaveBeenCalledOnce();
    expect(getPublicCollectionMaterialTrends).toHaveBeenCalledOnce();
  });

  it("normalizes stable personal Trends URL filters", () => {
    const validateSearch = Route.options.validateSearch;
    if (!validateSearch)
      throw new Error("Private Trends route search contract is missing.");

    expect(
      (validateSearch as (search: Record<string, unknown>) => unknown)({
        makerId: "2",
        materialId: "3",
        productId: "4",
        productTypeId: "1",
      }),
    ).toEqual({ makerId: 2, materialId: 3, productId: 4, productTypeId: 1 });
  });
});
