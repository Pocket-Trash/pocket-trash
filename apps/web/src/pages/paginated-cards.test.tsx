/** @vitest-environment jsdom */

import { Activity, act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaginatedCards } from "@/components/paginated-cards";

vi.mock("@/lib/catalog-copy", () => ({
  /**
   * Returns stable copy for pagination component tests.
   *
   * @returns A formatter that returns each requested key.
   */
  useCatalogCopy: () => (key: string) => key,
}));
vi.mock("@/hooks/use-mobile", () => ({
  /**
   * Returns compact pagination state.
   *
   * @returns Compact state.
   */
  useIsMobile: () => true,
}));
vi.mock("@/providers/locale-provider", () => ({
  /**
   * Returns fixed English locale state.
   *
   * @returns English locale state.
   */
  useLocale: () => ({ locale: "en-US" }),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("PaginatedCards", () => {
  let root: Root | undefined;

  afterEach(async () => {
    if (root) await act(() => root?.unmount());
    root = undefined;
  });

  it("does not replace a valid small-screen page before measuring the viewport", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 480,
    });
    const onPageChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(() =>
      root?.render(
        <PaginatedCards
          ariaLabel="Products"
          items={Array.from({ length: 17 }, (_value, index) => index + 1)}
          onPageChange={onPageChange}
          page={2}
          widePageSize={16}
        >
          {(items) => <div>{items.join(",")}</div>}
        </PaginatedCards>,
      ),
    );

    expect(container.textContent).toContain("17");
    expect(onPageChange).not.toHaveBeenCalled();
    container.remove();
  });

  it("replaces an out-of-range URL once and does not replay it through Activity", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 400,
    });
    const onPageChange = vi.fn();
    const container = document.createElement("div");
    root = createRoot(container);
    const items = Array.from({ length: 17 }, (_, index) => index + 1);
    /**
     * Renders the same pagination through Activity visibility changes.
     * @param mode - Activity visibility.
     * @returns StrictMode pagination fixture.
     */
    const tree = (mode: "visible" | "hidden") => (
      <StrictMode>
        <Activity mode={mode}>
          <PaginatedCards
            ariaLabel="Products"
            items={items}
            page={99}
            widePageSize={16}
            onPageChange={onPageChange}
          >
            {(page) => <div>{page.join(",")}</div>}
          </PaginatedCards>
        </Activity>
      </StrictMode>
    );
    await act(async () => root?.render(tree("visible")));
    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(2, { replace: true });
    await act(async () => root?.render(tree("hidden")));
    await act(async () => root?.render(tree("visible")));
    expect(onPageChange).toHaveBeenCalledTimes(1);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1440,
    });
    await act(async () => window.dispatchEvent(new Event("resize")));
    expect(onPageChange).toHaveBeenLastCalledWith(1, { replace: true });
    expect(onPageChange).toHaveBeenCalledTimes(2);
  });

  it("pushes user navigation and replaces corrections after controlled input changes", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 400,
    });
    const onPageChange = vi.fn();
    const container = document.createElement("div");
    root = createRoot(container);
    const items = Array.from({ length: 17 }, (_, index) => index + 1);
    await act(async () =>
      root?.render(
        <PaginatedCards
          ariaLabel="Products"
          items={items}
          page={0}
          widePageSize={16}
          onPageChange={onPageChange}
        >
          {(page) => <div>{page.join(",")}</div>}
        </PaginatedCards>,
      ),
    );
    const next = [
      ...container.querySelectorAll<HTMLButtonElement>("button"),
    ].find(
      (button) =>
        button.getAttribute("aria-label") === "web.search.pagination.nextPage",
    );
    expect(next).toBeDefined();
    await act(async () => next?.click());
    expect(onPageChange).toHaveBeenLastCalledWith(1, { replace: false });
    await act(async () =>
      root?.render(
        <PaginatedCards
          ariaLabel="Products"
          items={items.slice(0, 1)}
          page={2}
          widePageSize={16}
          onPageChange={onPageChange}
        >
          {(page) => <div>{page.join(",")}</div>}
        </PaginatedCards>,
      ),
    );
    expect(onPageChange).toHaveBeenLastCalledWith(0, { replace: true });
  });

  it("retains local navigation until its item set changes", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 400,
    });
    const container = document.createElement("div");
    root = createRoot(container);
    const items = Array.from({ length: 17 }, (_, index) => index + 1);
    await act(async () =>
      root?.render(
        <PaginatedCards ariaLabel="Products" items={items} widePageSize={16}>
          {(page) => <div data-items>{page.join(",")}</div>}
        </PaginatedCards>,
      ),
    );
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="web.search.pagination.nextPage"]',
        )
        ?.click(),
    );
    expect(container.querySelector("[data-items]")?.textContent).toBe(
      "9,10,11,12,13,14,15,16",
    );
    await act(async () =>
      root?.render(
        <PaginatedCards
          ariaLabel="Products"
          items={[...items]}
          widePageSize={16}
        >
          {(page) => <div data-items>{page.join(",")}</div>}
        </PaginatedCards>,
      ),
    );
    expect(container.querySelector("[data-items]")?.textContent).toBe(
      "1,2,3,4,5,6,7,8",
    );
  });
});
