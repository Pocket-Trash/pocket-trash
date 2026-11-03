/** @vitest-environment jsdom */

import { Activity, act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogFilterSearch, CatalogFilters } from "./catalog-filters";
import { useCatalogFilters } from "./use-catalog-filters";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/**
 * Exposes editable selections through the existing hook contract.
 * @param props - Current route search and navigation operation.
 * @returns Stable query and facet controls.
 */
function FilterProbe({
  search,
  commit,
}: {
  /** Current normalized route search. */
  search: CatalogFilterSearch;
  /**
   * Delivers replacement navigation.
   * @param search - Complete next URL search.
   */
  commit: (search: CatalogFilterSearch) => void;
}) {
  const [filters, edit] = useCatalogFilters(search, commit);
  return (
    <>
      <input
        aria-label="Query"
        value={filters.query}
        onChange={(event) => edit({ ...filters, query: event.target.value })}
      />
      <button
        type="button"
        onClick={() => edit((current) => ({ ...current, materialIds: [42] }))}
      >
        Material
      </button>
    </>
  );
}

describe("useCatalogFilters", () => {
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it("commits URL state after 300 ms", async () => {
    const commit = vi.fn();
    let setFilters:
      | React.Dispatch<React.SetStateAction<CatalogFilters>>
      | undefined;

    /**
     * Exposes the catalog-filter setter while rendering no UI.
     *
     * @returns `null`.
     */
    function Harness() {
      [, setFilters] = useCatalogFilters({}, commit);
      return null;
    }

    act(() => root.render(<Harness />));
    act(() => setFilters?.((current) => ({ ...current, materialIds: [42] })));
    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(commit).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(commit).toHaveBeenCalledWith({ material: [42] });
  });

  it("preserves edits newer than its URL acknowledgement and cancels them for history", async () => {
    const commit = vi.fn();
    /**
     * Renders editable selections through history and Activity changes.
     * @param search - Current normalized URL values.
     * @param mode - Activity visibility.
     * @returns Catalog filter fixture.
     */
    const tree = (
      search: CatalogFilterSearch,
      mode: "visible" | "hidden" = "visible",
    ) => (
      <StrictMode>
        <Activity mode={mode}>
          <FilterProbe search={search} commit={commit} />
        </Activity>
      </StrictMode>
    );
    act(() => root.render(tree({})));
    const input = document.querySelector("input");
    if (!input) throw new Error("Missing query fixture.");
    input.focus();
    /**
     * Edits the stable controlled query input.
     * @param value - New draft query.
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
    expect(commit).toHaveBeenLastCalledWith({ q: "bolt" });
    edit("bolt pen");
    act(() => document.querySelector("button")?.click());
    act(() => root.render(tree({ q: "bolt" })));
    expect(input.value).toBe("bolt pen");
    expect(document.querySelector("input")).toBe(input);
    expect(document.activeElement).toBe(input);
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(commit).toHaveBeenLastCalledWith({ material: [42], q: "bolt pen" });
    act(() => root.render(tree({ material: [42], q: "bolt pen" }, "hidden")));
    act(() => root.render(tree({ material: [42], q: "bolt pen" })));
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(commit).toHaveBeenCalledTimes(2);
    edit("stale");
    act(() => root.render(tree({ q: "restored" })));
    expect(input.value).toBe("restored");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it("uses the current committed navigation callback when the existing debounce expires", async () => {
    const previous = vi.fn();
    const current = vi.fn();
    act(() => root.render(<FilterProbe search={{}} commit={previous} />));
    act(() => document.querySelector("button")?.click());
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    act(() => root.render(<FilterProbe search={{}} commit={current} />));
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(previous).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledExactlyOnceWith({ material: [42] });
  });
});
