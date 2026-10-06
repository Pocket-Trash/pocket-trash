/** @vitest-environment jsdom */

import { act } from "react";
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
});
