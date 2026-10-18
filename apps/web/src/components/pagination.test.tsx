/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mutable viewport state for pagination tests. */
const viewport = vi.hoisted(() => ({ mobile: false }));

vi.mock("@/hooks/use-mobile", () => ({
  /**
   * Returns the test's compact viewport state.
   *
   * @returns Compact viewport state.
   */
  useIsMobile: () => viewport.mobile,
}));
vi.mock("@/lib/catalog-copy", () => ({
  /**
   * Returns fixed English pagination copy.
   *
   * @returns English pagination formatter.
   */
  useCatalogCopy:
    () =>
    (key: string, values: Readonly<Record<string, unknown>> = {}) => {
      const labels: Record<string, string> = {
        "web.search.pagination.firstPage": "First page",
        "web.search.pagination.lastPage": "Last page",
      };
      if (key === "web.search.pagination.goToPage") {
        return `Go to page ${String(values.page)}`;
      }
      return labels[key] ?? key;
    },
}));

import { getVisiblePages, Pagination } from "./pagination";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("Pagination", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    viewport.mobile = false;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows current plus or minus two on desktop and one on mobile", () => {
    expect(getVisiblePages(50, 100, false)).toEqual([48, 49, 50, 51, 52]);
    expect(getVisiblePages(50, 100, true)).toEqual([49, 50, 51]);
    expect(getVisiblePages(1, 100, false)).toEqual([1, 2, 3]);
    expect(getVisiblePages(100, 100, true)).toEqual([99, 100]);
  });

  it("renders accessible 100-page controls and reports selections", () => {
    const onPageChange = vi.fn();
    act(() =>
      root.render(
        <Pagination
          ariaLabel="Search"
          onPageChange={onPageChange}
          page={50}
          pageCount={100}
        />,
      ),
    );

    expect(container.querySelector("nav")?.getAttribute("aria-label")).toBe(
      "Search",
    );
    expect(
      container.querySelector('button[aria-label="First page"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="Last page"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('button[aria-current="page"]')?.textContent,
    ).toBe("50");
    act(() =>
      (
        container.querySelector(
          'button[aria-label="Go to page 52"]',
        ) as HTMLButtonElement
      ).click(),
    );
    expect(onPageChange).toHaveBeenCalledWith(52);
  });

  it("uses compact numbered controls on mobile", () => {
    viewport.mobile = true;
    act(() =>
      root.render(
        <Pagination
          ariaLabel="Search"
          onPageChange={vi.fn()}
          page={50}
          pageCount={100}
        />,
      ),
    );

    const numbered = Array.from(
      container.querySelectorAll('button[aria-label^="Go to page"]'),
      (button) => button.textContent,
    );
    expect(numbered).toEqual(["49", "50", "51"]);
  });
});
