/** @vitest-environment jsdom */

import { Activity, act, StrictMode } from "react";
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

  it("debounces URL updates and guides one-character queries", async () => {
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
    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(onQueryChange).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
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

  it("retains newer edits through URL acknowledgement and cancels them for external history", async () => {
    const commit = vi.fn();
    /**
     * Renders the public input through query and Activity changes.
     * @param query - Current route query.
     * @param mode - Activity visibility.
     * @returns Lifecycle-wrapped directory input.
     */
    const tree = (query: string, mode: "visible" | "hidden" = "visible") => (
      <StrictMode>
        <Activity mode={mode}>
          <DirectorySearch
            query={query}
            onQueryChange={commit}
            placeholderKey="web.search.directory.makersPlaceholder"
          />
        </Activity>
      </StrictMode>
    );
    act(() => root.render(tree("")));
    const input = container.querySelector("input");
    if (!input) throw new Error("Missing directory input.");
    input.focus();
    /**
     * Edits the existing input through its public DOM event.
     * @param value - Next draft text.
     */
    const edit = (value: string) => {
      act(() => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    edit("bolt");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(commit).toHaveBeenLastCalledWith("bolt");
    edit("bolt pen");
    act(() => root.render(tree("bolt")));
    expect(input.value).toBe("bolt pen");
    expect(container.querySelector("input")).toBe(input);
    expect(document.activeElement).toBe(input);
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(commit).toHaveBeenLastCalledWith("bolt pen");
    act(() => root.render(tree("bolt pen", "hidden")));
    act(() => root.render(tree("bolt pen")));
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(commit).toHaveBeenCalledTimes(2);
    edit("stale");
    act(() => root.render(tree("restored")));
    expect(input.value).toBe("restored");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it("delivers through the current committed callback without restarting its debounce", async () => {
    const previous = vi.fn();
    const current = vi.fn();
    act(() =>
      root.render(
        <DirectorySearch
          query=""
          onQueryChange={previous}
          placeholderKey="web.search.directory.makersPlaceholder"
        />,
      ),
    );
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
    act(() =>
      root.render(
        <DirectorySearch
          query=""
          onQueryChange={current}
          placeholderKey="web.search.directory.makersPlaceholder"
        />,
      ),
    );
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(previous).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledExactlyOnceWith("maker");
  });
});
