/** @vitest-environment jsdom */

import type { SearchResponse } from "@package/services";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchPage } from "@/pages/search-page";
import {
  canonicalizeSearchPage,
  loadSearchPage,
  parseSearchPageSearch,
} from "./search";

/** Public search boundary exercised by real route loaders. */
const searchPublic = vi.hoisted(() => vi.fn());
vi.mock("@/lib/search", () => ({ searchPublic }));
vi.mock("@/hooks/use-mobile", () => ({
  /**
   * Supplies desktop pagination in the route regression.
   * @returns Desktop layout.
   */
  useIsMobile: () => false,
}));
vi.mock("@/providers/locale-provider", () => ({
  /**
   * Supplies the English route-test locale.
   * @returns Stable locale context.
   */
  useLocale: () => ({ locale: "en-US" }),
}));
vi.mock("@/components/app-shell", () => ({
  /**
   * Preserves page contents without authentication chrome.
   * @param props - Shell content.
   * @param props.children - Search controls and results.
   * @returns Search page contents.
   */
  AppShell: ({
    children,
  }: {
    /** Page contents. */ children: React.ReactNode;
  }) => <>{children}</>,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/**
 * Creates public search results with deterministic query identity.
 * @param query - Query identifying the result.
 * @param total - Total matching items for pagination.
 * @returns Complete public search response.
 */
function response(query: string, total = 1): SearchResponse {
  return {
    counts: {
      all: total,
      collections: 0,
      makers: 0,
      materials: 0,
      people: 0,
      products: total,
      resources: 0,
    },
    items: [
      {
        highlights: [],
        href: `/results/${query}`,
        id: 1,
        kind: "product",
        title: `Result ${query}`,
      },
    ],
    page: 1,
    pageSize: 10,
    total,
  };
}

/**
 * Runs production search parsing, loading, and UI through a browser-history router.
 * @param entry - Initial URL, including untrusted search parameters.
 * @returns Non-mutating route regression router.
 */
function createSearchRouter(entry: string) {
  const rootRoute = createRootRoute({ component: Outlet });
  const searchRoute = createRoute({
    /**
     * Supplies the regression root route.
     * @returns Root route.
     */
    getParentRoute: () => rootRoute,
    path: "/search",
    validateSearch: parseSearchPageSearch,
    pendingMs: Infinity,
    /**
     * Applies production URL canonicalization before loading.
     * @param context - Route pre-load context.
     * @param context.location - Raw current location.
     * @param context.search - Validated query values.
     * @throws Replacement redirect for noncanonical search.
     */
    beforeLoad: ({ location, search }) => {
      canonicalizeSearchPage(location.searchStr, search);
    },
    /**
     * Keys results by normalized URL search.
     * @param context - Validated route context.
     * @param context.search - Normalized query, group, and page.
     * @returns Loader dependencies.
     */
    loaderDeps: ({ search }) => parseSearchPageSearch(search),
    /**
     * Calls the production loader with router cancellation.
     * @param context - Router loader context.
     * @param context.deps - Normalized search values.
     * @param context.abortController - Router cancellation lifetime.
     * @returns Production route results.
     * @rejects Replacement redirect for invalid pagination.
     */
    loader: ({ deps, abortController }) =>
      loadSearchPage(deps, abortController.signal),
    component: SearchHarness,
  });
  /**
   * Connects the real page to route-owned results without remounting inputs.
   * @returns URL-owned search page.
   */
  function SearchHarness(): ReactElement {
    const { location, isLoading: loading } = useRouterState();
    const data = searchRoute.useLoaderData();
    const navigate = useNavigate();
    return (
      <SearchPage
        data={loading ? { status: "loading" } : data}
        search={parseSearchPageSearch(location.search)}
        onNavigate={(search, options) => {
          void navigate({ to: "/search", search, replace: options.replace });
        }}
      />
    );
  }
  return createRouter({
    routeTree: rootRoute.addChildren([searchRoute]),
    history: createMemoryHistory({ initialEntries: [entry] }),
    /**
     * Makes unintended pending-screen input replacement observable.
     * @returns Pending screen marker.
     */
    defaultPendingComponent: () => <p>Pending screen</p>,
  });
}

describe("route-owned public search", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    searchPublic.mockReset();
    searchPublic.mockImplementation(({ data }) =>
      Promise.resolve(response(data.query)),
    );
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("canonicalizes direct invalid URLs before one result request", async () => {
    const router = createSearchRouter(
      "/search?q=%20bolt%20&type=all&page=0&extra=1",
    );
    await act(async () => {
      await router.load();
      root.render(<RouterProvider router={router} />);
    });
    expect(router.state.location.search).toEqual({ q: "bolt" });
    expect(searchPublic).toHaveBeenCalledExactlyOnceWith({
      data: { group: "all", page: 1, query: "bolt", surface: "page" },
      signal: expect.any(AbortSignal),
    });
    expect(container.textContent).toContain("Result bolt");
  });

  it("replaces out-of-range pagination in the loader", async () => {
    searchPublic.mockResolvedValue(response("bolt", 11));
    const router = createSearchRouter("/search?page=99&type=products&q=bolt");
    await act(async () => {
      await router.load();
      root.render(<RouterProvider router={router} />);
    });
    expect(router.state.location.search).toEqual({
      page: 2,
      q: "bolt",
      type: "products",
    });
    expect(searchPublic).toHaveBeenCalledTimes(2);
    expect(searchPublic.mock.calls[1]?.[0].data.page).toBe(2);
  });

  it("keeps focused inputs mounted through slow navigation and ignores older loader results", async () => {
    const router = createSearchRouter("/search?q=bolt");
    await act(async () => {
      await router.load();
      root.render(<RouterProvider router={router} />);
    });
    const input = container.querySelector("input");
    input?.focus();
    let resolveSlow: ((value: SearchResponse) => void) | undefined;
    searchPublic
      .mockImplementationOnce(
        () =>
          new Promise<SearchResponse>((resolve) => {
            resolveSlow = resolve;
          }),
      )
      .mockResolvedValue(response("new"));
    let pending: Promise<void> | undefined;
    await act(async () => {
      pending = router.navigate({ to: "/search", search: { q: "slow" } });
    });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1100));
    });
    expect(container.querySelector("input")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(container.textContent).not.toContain("Pending screen");
    await act(async () => {
      await router.navigate({ to: "/search", search: { q: "new" } });
    });
    await act(async () => {
      resolveSlow?.(response("slow"));
      await pending;
    });
    expect(container.textContent).toContain("Result new");
    expect(container.textContent).not.toContain("Result slow");
    expect(container.querySelector("input")).toBe(input);
    expect(input?.value).toBe("new");
  });

  it("pushes pagination, replaces rapid query edits, and restores them through history", async () => {
    searchPublic.mockImplementation(({ data }) =>
      Promise.resolve(response(data.query, 31)),
    );
    const router = createSearchRouter("/search?q=bolt&type=products");
    await act(async () => {
      await router.load();
      root.render(<RouterProvider router={router} />);
    });
    const input = container.querySelector("input");
    input?.focus();
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Go to page 2"]')
        ?.click();
      await vi.waitFor(() =>
        expect(
          searchPublic.mock.calls.some(([request]) => request.data.page === 2),
        ).toBe(true),
      );
    });
    await act(async () => {
      router.history.back();
      await vi.waitFor(() =>
        expect(router.state.location.search.page).toBeUndefined(),
      );
    });
    await act(async () => {
      router.history.forward();
      await vi.waitFor(() => expect(router.state.location.search.page).toBe(2));
    });
    act(() => {
      for (const value of ["ma", "maker"]) {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set?.call(input, value);
        input?.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    });
    expect(
      searchPublic.mock.calls.filter(
        ([request]) => request.data.query === "maker",
      ),
    ).toHaveLength(1);
    expect(
      searchPublic.mock.calls.some(([request]) => request.data.query === "ma"),
    ).toBe(false);
    expect(router.state.location.search).toEqual({
      q: "maker",
      type: "products",
    });
    expect(container.querySelector("input")).toBe(input);
    await act(async () => {
      router.history.back();
      await vi.waitFor(() =>
        expect(router.state.location.search).toEqual({
          q: "bolt",
          type: "products",
        }),
      );
    });
    expect(input?.value).toBe("bolt");
    expect(container.querySelector("input")).toBe(input);
  });
});
