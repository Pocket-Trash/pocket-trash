/** @vitest-environment jsdom */

import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogTrendsSearch } from "@/lib/catalog-filters";

/** Owner-scoped current item lookup. */
const getUserCollection = vi.hoisted(() => vi.fn());
/** Exact owner-scoped status assignments. */
const getUserCollectionStatusItems = vi.hoisted(() => vi.fn());
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
  getUserCollectionStatusItems,
  getUserCollections,
}));
vi.mock("@/pages/user-trends-page", () => ({
  /**
   * Renders controlled route selection for navigation assertions.
   * @param root0 - Page search and navigation operation.
   *
   * @returns Private Trends marker.
   */
  UserTrendsPage: ({
    search,
    onSearchChange,
  }: {
    /** Current route search snapshot. */ search: CatalogTrendsSearch;
    /**
     * Applies one user selection to route history.
     * @param next - Next URL search state.
     */ onSearchChange: (next: CatalogTrendsSearch) => void;
  }) => (
    <div>
      <output>
        {search.status ?? "none"}:{search.makerId}
      </output>
      <button onClick={() => onSearchChange({ ...search, status: "sold" })}>
        Sold
      </button>
    </div>
  ),
}));

import { Route } from "./user.trends";

describe("private user Trends route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads owner data with active privacy-safe community generations", async () => {
    getUserCollectionStatusItems.mockResolvedValueOnce([]);
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
      statusItems: [],
    });
    expect(getUserCollectionStatusItems).toHaveBeenCalledOnce();
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
        status: "want-to-trade",
        makerId: "2",
        materialId: "3",
        productId: "4",
        productTypeId: "1",
      }),
    ).toEqual({
      makerId: 2,
      materialId: 3,
      productId: 4,
      productTypeId: 1,
      status: "want-to-trade",
    });
    for (const status of [
      "grail",
      "favorite",
      "want-to-sell",
      "want-to-trade",
      "sold",
      "unstatused",
    ]) {
      expect(
        (validateSearch as (search: Record<string, unknown>) => unknown)({
          status,
          range: "week",
        }),
      ).toEqual({ status, range: "week" });
    }
    expect(
      (validateSearch as (search: Record<string, unknown>) => unknown)({
        status: "want_to_sell",
        makerId: 2,
      }),
    ).toEqual({ makerId: 2 });
  });
  it("restores status selection across browser Back and Forward while retaining composition filters", async () => {
    getUserCollection.mockResolvedValue([]);
    getUserCollections.mockResolvedValue([]);
    getUserCollectionStatusItems.mockResolvedValue([]);
    const history = createMemoryHistory({
      initialEntries: ["/user/trends?status=favorite&makerId=2"],
    });
    const rootRoute = createRootRoute({ component: Outlet });
    Object.assign(Route.options, {
      id: "/user/trends",
      path: "/user/trends",
      /**
       * Resolves the test route root.
       * @returns In-memory root route.
       */
      getParentRoute: () => rootRoute,
    });
    const routeTree = rootRoute.addChildren([Route]);
    const router = createRouter({ routeTree, history });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        await router.load();
        root.render(<RouterProvider router={router} />);
      });
      expect(container.querySelector("output")?.textContent).toBe("favorite:2");
      await act(async () => {
        container.querySelector("button")?.click();
      });
      expect(history.location.search).toContain("status=sold");
      expect(container.querySelector("output")?.textContent).toBe("sold:2");
      await act(async () => {
        history.back();
      });
      expect(container.querySelector("output")?.textContent).toBe("favorite:2");
      await act(async () => {
        history.forward();
      });
      expect(container.querySelector("output")?.textContent).toBe("sold:2");
    } finally {
      await act(() => root.unmount());
      container.remove();
    }
  });
});
