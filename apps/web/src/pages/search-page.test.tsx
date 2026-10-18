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

import { SearchPage, type SearchPageSearch } from "./search-page";

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
  });

  /**
   * Renders a normalized search state.
   *
   * @param search - URL-backed search state.
   */
  function render(search: SearchPageSearch) {
    act(() =>
      root.render(<SearchPage onNavigate={onNavigate} search={search} />),
    );
  }

  it("supports direct empty navigation without requesting search", () => {
    render({});

    expect(container.textContent).toContain(
      "Enter at least 2 characters to search.",
    );
    expect(searchPublic).not.toHaveBeenCalled();
  });

  it("renders counts, editorial rows, and pushes tab and query changes", async () => {
    searchPublic.mockResolvedValue(response);
    render({ q: "bolt" });
    await act(async () => Promise.resolve());

    expect(searchPublic).toHaveBeenCalledWith({
      data: { group: "all", page: 1, query: "bolt", surface: "page" },
    });
    expect(container.textContent).toContain("Results: 2");
    expect(container.textContent).toContain("Products 1");
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

    const input = container.querySelector(
      'input[aria-label="Search Pocket Trash"]',
    ) as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, "maker");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.form?.dispatchEvent(
        new SubmitEvent("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(onNavigate).toHaveBeenLastCalledWith(
      { q: "maker" },
      { replace: false },
    );
  });

  it("shows loading and error states without removing the query", async () => {
    let reject: ((error: Error) => void) | undefined;
    searchPublic.mockImplementation(
      () =>
        new Promise<SearchResponse>((_resolve, rejectPromise) => {
          reject = rejectPromise;
        }),
    );
    render({ q: "bolt" });
    expect(container.querySelector('[role="status"]')).not.toBeNull();

    await act(async () => reject?.(new Error("offline")));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "couldn’t complete",
    );
    expect(
      (
        container.querySelector(
          'input[aria-label="Search Pocket Trash"]',
        ) as HTMLInputElement
      ).value,
    ).toBe("bolt");
  });

  it("shows empty results", async () => {
    searchPublic.mockResolvedValue({ ...response, items: [], total: 0 });
    render({ q: "missing" });
    await act(async () => Promise.resolve());

    expect(container.textContent).toContain("No results match this search.");
  });

  it("pushes page changes while preserving the query and filter", async () => {
    searchPublic.mockResolvedValue({ ...response, total: 11 });
    render({ q: "bolt", type: "products" });
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

  it("replaces an out-of-range page with the last page", async () => {
    searchPublic.mockResolvedValue({ ...response, page: 100, total: 11 });
    render({ page: 100, q: "bolt", type: "products" });
    await act(async () => Promise.resolve());

    expect(onNavigate).toHaveBeenCalledWith(
      { page: 2, q: "bolt", type: "products" },
      { replace: true },
    );
  });
});
