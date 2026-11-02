/** @vitest-environment jsdom */

import { Activity, act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listResourceCategories } from "@/lib/resources";
import { ResourceCategoryInput } from "./resource-category-input";

vi.mock("@/lib/resources", () => ({ listResourceCategories: vi.fn() }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/** Category search result used by the public combobox tests. */
const documentation = { id: 1, name: "Documentation", slug: "documentation" };
/** Newer category result that must survive an older response. */
const templates = { id: 2, name: "Templates", slug: "templates" };

/**
 * Settles the superseded server response.
 *
 * @param categories - Results returned by the older request.
 */
type ResolveCategories = (categories: (typeof documentation)[]) => void;

describe("ResourceCategoryInput", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(listResourceCategories).mockReset();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it("keeps the latest results when an older request settles late", async () => {
    let resolveOld: ResolveCategories | undefined;
    const old = new Promise<(typeof documentation)[]>((resolve) => {
      resolveOld = resolve;
    });
    vi.mocked(listResourceCategories)
      .mockReturnValueOnce(old)
      .mockResolvedValueOnce([templates]);
    await act(async () =>
      root.render(
        <ResourceCategoryInput
          label="Categories"
          noResultsLabel="No categories found"
          onChange={vi.fn()}
          placeholder="Search categories"
          removeLabel={(category) => `Remove ${category}`}
          selected={[]}
        />,
      ),
    );
    await act(async () => vi.advanceTimersByTime(150));
    await act(async () => container.querySelector("button")?.click());
    const input = container.querySelector("input[role=combobox]");
    expect(input).toBeInstanceOf(HTMLInputElement);
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, "Templates");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => vi.advanceTimersByTime(150));
    expect(document.body.textContent).toContain("Templates");
    expect(
      vi.mocked(listResourceCategories).mock.calls[0]?.[0]?.signal?.aborted,
    ).toBe(true);
    await act(async () => resolveOld?.([documentation]));
    expect(document.body.textContent).toContain("Templates");
    expect(document.body.textContent).not.toContain("Documentation");
  });

  it("debounces initial results and clears failed results while keeping a custom query", async () => {
    vi.mocked(listResourceCategories)
      .mockResolvedValueOnce([documentation])
      .mockRejectedValueOnce(new Error("Lookup unavailable"));
    await renderPicker();
    await act(async () => vi.advanceTimersByTime(149));
    expect(listResourceCategories).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    await act(async () => container.querySelector("button")?.click());
    expect(document.body.textContent).toContain("Documentation");
    const input = container.querySelector("input[role=combobox]");
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, "Custom category");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => vi.advanceTimersByTime(150));
    expect(document.body.textContent).not.toContain("Documentation");
    expect(document.body.textContent).toContain("Custom category");
  });

  it("cancels an unmounted debounce and never replays a completed lookup after Activity resumes", async () => {
    vi.mocked(listResourceCategories).mockResolvedValue([documentation]);
    await renderPicker();
    await act(async () => root.render(null));
    await act(async () => vi.advanceTimersByTime(150));
    expect(listResourceCategories).not.toHaveBeenCalled();
    await renderPicker();
    await act(async () => vi.advanceTimersByTime(150));
    expect(listResourceCategories).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(listResourceCategories).mock.calls[0]?.[0]?.signal?.aborted,
    ).toBe(true);
    await renderPicker("hidden");
    await renderPicker();
    await act(async () => vi.advanceTimersByTime(150));
    expect(listResourceCategories).toHaveBeenCalledTimes(1);
  });

  /**
   * Renders the real picker inside React's replayable lifecycle boundaries.
   *
   * @param mode - Whether Activity exposes the picker.
   * @returns Completion of the committed render.
   */
  async function renderPicker(mode: "visible" | "hidden" = "visible") {
    await act(async () =>
      root.render(
        <StrictMode>
          <Activity mode={mode}>
            <ResourceCategoryInput
              label="Categories"
              noResultsLabel="No categories found"
              onChange={vi.fn()}
              placeholder="Search categories"
              removeLabel={(category) => `Remove ${category}`}
              selected={[]}
            />
          </Activity>
        </StrictMode>,
      ),
    );
  }
});
