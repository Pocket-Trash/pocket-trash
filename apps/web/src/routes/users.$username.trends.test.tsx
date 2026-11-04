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

/** Published Trends lookup controlled by route tests. */
const getPublishedUserTrends = vi.hoisted(() => vi.fn());

vi.mock("@/lib/catalog-api", () => ({ getPublishedUserTrends }));
vi.mock("@/pages/user-trends-page", () => ({
  /**
   * Renders public route selection for navigation assertions.
   * @param root0 - Validated route search and navigation operation.
   * @returns Public route selection controls.
   */
  UserTrendsPage: ({
    search,
    onSearchChange,
  }: {
    /** Validated URL search state. */ search: CatalogTrendsSearch;
    /**
     * Navigates to a selected status without changing the material filter.
     * @param next - Next URL search state.
     */
    onSearchChange: (next: CatalogTrendsSearch) => void;
  }) => (
    <div>
      <output>
        {search.status ?? "none"}:{search.materialId}
      </output>
      <button onClick={() => onSearchChange({ ...search, status: "sold" })}>
        Sold
      </button>
    </div>
  ),
}));

import { Route } from "./users.$username.trends";

describe("published user Trends route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads the exact shareable username and emits noindex", async () => {
    const owner = { collections: [], items: [], username: "collector" };
    getPublishedUserTrends.mockResolvedValueOnce(owner);
    const loader = Route.options.loader;
    if (!loader) throw new Error("Published Trends route loader is missing.");

    await expect(
      (loader as (context: unknown) => Promise<unknown>)({
        params: { username: "collector" },
      }),
    ).resolves.toEqual(owner);
    expect(getPublishedUserTrends).toHaveBeenCalledWith({
      data: { username: "collector" },
    });
    expect(Route.options.head?.({} as never)).toEqual(
      expect.objectContaining({
        meta: expect.arrayContaining([
          { content: "noindex,follow", name: "robots" },
        ]),
      }),
    );
  });

  it("uses the same not-found response after publication is revoked", async () => {
    const loader = Route.options.loader;
    if (!loader) throw new Error("Published Trends route loader is missing.");
    getPublishedUserTrends
      .mockResolvedValueOnce({
        collections: [],
        items: [],
        username: "collector",
      })
      .mockResolvedValueOnce(null);

    await expect(
      (loader as (context: unknown) => Promise<unknown>)({
        params: { username: "collector" },
      }),
    ).resolves.toBeTruthy();
    await expect(
      (loader as (context: unknown) => Promise<unknown>)({
        params: { username: "collector" },
      }),
    ).rejects.toEqual(expect.objectContaining({ isNotFound: true }));
    expect(getPublishedUserTrends).toHaveBeenCalledTimes(2);
  });
  it("normalizes public status URLs and restores selection through Back and Forward", async () => {
    const validateSearch = Route.options.validateSearch;
    if (typeof validateSearch !== "function")
      throw new Error("Public Trends search is missing.");
    expect(validateSearch({ status: "want_to_sell", materialId: "2" })).toEqual(
      { materialId: 2 },
    );
    expect(validateSearch({ status: "want-to-sell", materialId: "2" })).toEqual(
      { status: "want-to-sell", materialId: 2 },
    );
    getPublishedUserTrends.mockResolvedValue({
      collections: [],
      items: [],
      statusItems: [],
      username: "collector",
    });
    const history = createMemoryHistory({
      initialEntries: ["/users/collector/trends?status=grail&materialId=2"],
    });
    const rootRoute = createRootRoute({ component: Outlet });
    Object.assign(Route.options, {
      id: "/users/$username/trends",
      path: "/users/$username/trends",
      /**
       * Resolves the public test route root.
       * @returns In-memory root route.
       */
      getParentRoute: () => rootRoute,
    });
    const router = createRouter({
      history,
      routeTree: rootRoute.addChildren([Route]),
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        await router.load();
        root.render(<RouterProvider router={router} />);
      });
      expect(container.querySelector("output")?.textContent).toBe("grail:2");
      await act(async () => {
        container.querySelector("button")?.click();
      });
      expect(history.location.pathname).toBe("/users/collector/trends");
      expect(container.querySelector("output")?.textContent).toBe("sold:2");
      await act(async () => {
        history.back();
      });
      expect(container.querySelector("output")?.textContent).toBe("grail:2");
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
