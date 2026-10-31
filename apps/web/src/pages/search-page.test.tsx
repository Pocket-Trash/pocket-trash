/** @vitest-environment jsdom */

import type { SearchResponse } from "@package/services";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Public search request spy. */
const searchPublic = vi.hoisted(() => vi.fn());

vi.mock("@/lib/search", () => ({ searchPublic }));
vi.mock("@/hooks/use-mobile", () => ({
  /**
   * Returns desktop pagination state.
   *
   * @returns Desktop pagination state.
   */
  useIsMobile: () => false,
}));
vi.mock("@/providers/locale-provider", () => ({
  /**
   * Returns fixed English locale state.
   *
   * @returns English locale state.
   */
  useLocale: () => ({ locale: "en-US" }),
}));
vi.mock("@/components/app-shell", () => ({
  /**
   * Renders search content without application providers.
   *
   * @param props - Test shell properties.
   * @param props.children - Search page content.
   * @param props.meta - Search result count.
   * @param props.title - Search page title.
   * @returns Minimal search shell.
   */
  AppShell: ({
    children,
    meta,
    title,
  }: {
    /** Search page content. */
    children: React.ReactNode;
    /** Search result count. */
    meta: React.ReactNode;
    /** Search page title. */
    title: string;
  }) => (
    <div>
      <h1>{title}</h1>
      <div>{meta}</div>
      {children}
    </div>
  ),
}));

import {
  SearchPage,
  type SearchPageData,
  type SearchPageSearch,
} from "./search-page";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/** Complete public search response fixture. */
const response: SearchResponse = {
  counts: {
    all: 2,
    collections: 0,
    makers: 1,
    materials: 0,
    people: 0,
    products: 1,
    resources: 0,
  },
  items: [
    {
      highlights: [
        { matched: true, text: "Bolt" },
        { matched: false, text: " pen" },
      ],
      href: "/products/bolt",
      id: 1,
      imageUrl: "https://example.com/bolt.jpg",
      kind: "product",
      title: "Bolt",
    },
    {
      context: "Pens",
      highlights: [{ matched: true, text: "Bolt Works" }],
      href: "/makers/bolt-works",
      id: 2,
      kind: "maker",
      title: "Bolt Works",
    },
  ],
  page: 1,
  pageSize: 10,
  total: 2,
};

describe("SearchPage", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onNavigate: ReturnType<
    typeof vi.fn<Parameters<typeof SearchPage>[0]["onNavigate"]>
  >;

  beforeEach(() => {
    searchPublic.mockReset();
    onNavigate = vi.fn<Parameters<typeof SearchPage>[0]["onNavigate"]>();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  /**
   * Renders a normalized search state.
   *
   * @param search - URL-backed search state.
   * @param data - Result and feedback supplied by the route loader.
   */
  function render(
    search: SearchPageSearch,
    data: SearchPageData = (search.q?.length ?? 0) >= 2
      ? { status: "ready", response }
      : { status: "idle" },
  ) {
    act(() =>
      root.render(
        <SearchPage data={data} onNavigate={onNavigate} search={search} />,
      ),
    );
  }

  it("supports direct empty navigation without requesting search", () => {
    render({});

    expect(container.textContent).not.toContain(
      "Enter at least 2 characters to search.",
    );
    expect(container.textContent).not.toContain(
      "No results match this search.",
    );
    expect(searchPublic).not.toHaveBeenCalled();
  });

  it("shows minimum-length guidance without requesting search", () => {
    render({ q: "b" });

    expect(container.textContent).toContain(
      "Enter at least 2 characters to search.",
    );
    expect(searchPublic).not.toHaveBeenCalled();
  });

  it("renders counts and rows, pushes tabs, and replaces typed queries", async () => {
    render({ q: "bolt" });
    await act(async () => Promise.resolve());

    expect(searchPublic).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Results: 2");
    expect(
      Array.from(
        container.querySelectorAll('[role="tab"]'),
        (tab) => tab.textContent,
      ),
    ).toEqual([
      "All 2",
      "Products 1",
      "Collections 0",
      "Makers 1",
      "People 0",
      "Materials 0",
      "Resources 0",
    ]);
    expect(
      container.querySelector('img[src="https://example.com/bolt.jpg"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("Bolt Works");
    expect(container.querySelector("strong")?.textContent).toBe("Bolt");

    const productsTab = Array.from(
      container.querySelectorAll('[role="tab"]'),
    ).find((tab) => tab.textContent?.startsWith("Products"));
    act(() => (productsTab as HTMLButtonElement).click());
    expect(onNavigate).toHaveBeenCalledWith(
      { q: "bolt", type: "products" },
      { replace: false },
    );

    for (const type of [
      "collections",
      "makers",
      "people",
      "materials",
      "resources",
    ] as const) {
      const tab = Array.from(container.querySelectorAll('[role="tab"]')).find(
        (candidate) => candidate.textContent?.toLowerCase().startsWith(type),
      );
      act(() => (tab as HTMLButtonElement).click());
      expect(onNavigate).toHaveBeenLastCalledWith(
        { q: "bolt", type },
        { replace: false },
      );
    }

    const input = container.querySelector(
      'input[aria-label="Search Pocket Trash"]',
    ) as HTMLInputElement;
    expect(input.maxLength).toBe(256);
    onNavigate.mockClear();
    vi.useFakeTimers();
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, "maker");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => vi.advanceTimersByTime(299));
    expect(onNavigate).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(onNavigate).toHaveBeenLastCalledWith(
      { q: "maker" },
      { replace: true },
    );
  });

  it("shows route loading and error feedback without remounting its query input", () => {
    render({ q: "bolt" }, { status: "loading" });
    const input = container.querySelector(
      'input[aria-label="Search Pocket Trash"]',
    );
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    render({ q: "bolt" }, { status: "error" });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "couldn’t complete",
    );
    expect(
      container.querySelector('input[aria-label="Search Pocket Trash"]'),
    ).toBe(input);
    expect((input as HTMLInputElement).value).toBe("bolt");
    expect(searchPublic).not.toHaveBeenCalled();
  });

  it("shows empty results", async () => {
    render(
      { q: "missing" },
      { status: "ready", response: { ...response, items: [], total: 0 } },
    );
    await act(async () => Promise.resolve());

    expect(container.textContent).toContain("No results match this search.");
  });

  it("pushes page changes while preserving the query and filter", async () => {
    render(
      { q: "bolt", type: "products" },
      { status: "ready", response: { ...response, total: 11 } },
    );
    await act(async () => Promise.resolve());

    act(() =>
      (
        container.querySelector(
          'button[aria-label="Go to page 2"]',
        ) as HTMLButtonElement
      ).click(),
    );
    expect(onNavigate).toHaveBeenCalledWith(
      { page: 2, q: "bolt", type: "products" },
      { replace: false },
    );
  });

  it("keeps the latest tab when a query debounce began on an earlier tab", async () => {
    vi.useFakeTimers();
    render({ q: "bolt", type: "products" });
    const input = container.querySelector("input");
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, "maker");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    render({ q: "bolt", type: "makers" });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith(
      { q: "maker", type: "makers" },
      { replace: true },
    );
    expect(container.querySelector("input")).toBe(input);
  });

  it("uses the route's accepted page without issuing a client request", () => {
    render(
      { page: 2, q: "bolt", type: "products" },
      { status: "ready", response: { ...response, page: 2, total: 11 } },
    );
    expect(searchPublic).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe(
      "2",
    );
  });
});
