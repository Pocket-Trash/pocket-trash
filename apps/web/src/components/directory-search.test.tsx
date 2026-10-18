/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/catalog-copy", () => ({
  /**
   * Returns a deterministic translation formatter.
   *
   * @returns Test translation formatter.
   */
  useCatalogCopy: () => (key: string) => key,
}));

import { DirectorySearch } from "./directory-search";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("DirectorySearch", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("debounces URL updates and guides one-character queries", () => {
    const onQueryChange = vi.fn();
    act(() =>
      root.render(
        <DirectorySearch
          onQueryChange={onQueryChange}
          placeholderKey="web.search.directory.makersPlaceholder"
          query=""
        />,
      ),
    );

    const input = container.querySelector("input") as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, "m");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.textContent).toContain("web.search.minimumLength");
    act(() => vi.advanceTimersByTime(299));
    expect(onQueryChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onQueryChange).toHaveBeenCalledWith("m");

    act(() =>
      root.render(
        <DirectorySearch
          onQueryChange={onQueryChange}
          placeholderKey="web.search.directory.makersPlaceholder"
          query="restored"
        />,
      ),
    );
    expect(input.value).toBe("restored");
  });
});
