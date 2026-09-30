/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogFilters } from "./catalog-filters";
import { useCatalogFilters } from "./use-catalog-filters";

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

  it("commits URL state after 300 ms", () => {
    const commit = vi.fn();
    let setFilters:
      | React.Dispatch<React.SetStateAction<CatalogFilters>>
      | undefined;

    function Harness() {
      [, setFilters] = useCatalogFilters({}, commit);
      return null;
    }

    act(() => root.render(<Harness />));
    act(() => setFilters?.((current) => ({ ...current, materialIds: [42] })));
    act(() => vi.advanceTimersByTime(299));
    expect(commit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(commit).toHaveBeenCalledWith({ material: [42] });
  });
});
