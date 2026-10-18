/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mutable compact-layout result. */
const viewport = vi.hoisted(() => ({ mobile: false }));
/** Public search request spy. */
const searchPublic = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-mobile", () => ({
  /**
   * Returns whether the test viewport is compact.
   *
   * @returns Compact state.
   */
  useIsMobile: () => viewport.mobile,
}));
vi.mock("@/lib/search", () => ({ searchPublic }));
vi.mock("@/providers/locale-provider", () => ({
  /**
   * Returns fixed English locale state.
   *
   * @returns English locale state.
   */
  useLocale: () => ({ locale: "en-US" }),
}));

import { GlobalSearch } from "./global-search";

/** One complete search response for interactive tests. */
const response = {
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
      highlights: [{ matched: true, text: "Bolt" }],
      href: "/products/bolt",
      id: 1,
      kind: "product" as const,
      title: "Bolt",
    },
    {
      context: "Pens",
      highlights: [{ matched: true, text: "Bolt Works" }],
      href: "/makers/bolt-works",
      id: 2,
      kind: "maker" as const,
      title: "Bolt Works",
    },
  ],
  page: 1,
  pageSize: 7,
  total: 2,
};

describe("GlobalSearch", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    viewport.mobile = false;
    searchPublic.mockReset();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /**
   * Renders and opens the search surface.
   *
   * @returns The rendered search controls.
   */
  function openSearch() {
    act(() => root.render(<GlobalSearch />));
    const trigger = container.querySelector("button");
    act(() => trigger?.click());
    return {
      dialog: container.querySelector("dialog") as HTMLDialogElement,
      input: document.querySelector(
        'input[role="combobox"]',
      ) as HTMLInputElement,
      trigger: trigger as HTMLButtonElement,
    };
  }

  /**
   * Changes the controlled search input.
   *
   * @param input - Search input element.
   * @param value - Next input value.
   */
  function changeInput(input: HTMLInputElement, value: string) {
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  /** Finishes one debounce and its resolved request. */
  async function finishSearch() {
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
  }

  it("opens as a dialog, focuses the input, and restores trigger focus on close", () => {
    const { dialog, input, trigger } = openSearch();
    expect(dialog.open).toBe(true);
    expect(dialog.dataset.presentation).toBe("dialog");
    expect(document.activeElement).toBe(input);

    const close = container.querySelector(
      'button[aria-label="Close"]',
    ) as HTMLButtonElement;
    act(() => close.click());
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);

    act(() => trigger.click());
    expect(dialog.open).toBe(true);
    expect(document.activeElement).toBe(input);
    act(() => dialog.dispatchEvent(new Event("cancel", { cancelable: true })));
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);

    act(() => trigger.click());
    act(() => dialog.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it("uses the shared drawer presentation on compact viewports", () => {
    viewport.mobile = true;
    const { input, trigger } = openSearch();
    const drawer = document.querySelector('[data-slot="drawer-content"]');
    expect(drawer?.getAttribute("data-presentation")).toBe("drawer");
    expect(drawer?.getAttribute("role")).toBe("dialog");
    expect(document.activeElement).toBe(input);

    act(() =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      ),
    );
    act(() => vi.advanceTimersByTime(0));
    expect(document.querySelector('[data-slot="drawer-content"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes and clears search when its responsive presentation changes", async () => {
    searchPublic.mockResolvedValue(response);
    const { input, trigger } = openSearch();
    changeInput(input, "bolt");
    await finishSearch();
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(2);

    viewport.mobile = true;
    act(() => root.render(<GlobalSearch />));
    act(() => vi.advanceTimersByTime(0));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    act(() => trigger.click());
    const mobileInput = document.querySelector(
      'input[role="combobox"]',
    ) as HTMLInputElement;
    expect(mobileInput.value).toBe("");
  });

  it("debounces two-character queries and ignores stale responses", async () => {
    const deferred: Array<(value: typeof response) => void> = [];
    searchPublic.mockImplementation(
      () => new Promise<typeof response>((resolve) => deferred.push(resolve)),
    );
    const { input } = openSearch();

    changeInput(input, "b");
    act(() => vi.advanceTimersByTime(300));
    expect(searchPublic).not.toHaveBeenCalled();

    changeInput(input, "bolt");
    act(() => vi.advanceTimersByTime(299));
    expect(searchPublic).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(searchPublic).toHaveBeenCalledWith({
      data: { query: "bolt", surface: "modal" },
    });
    await act(async () => deferred[0]?.(response));
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(2);

    changeInput(input, "maker");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(input.hasAttribute("aria-activedescendant")).toBe(false);
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    act(() => vi.advanceTimersByTime(300));
    changeInput(input, "maker pen");
    act(() => vi.advanceTimersByTime(300));
    const maker = response.items[1];
    if (!maker) throw new Error("Missing maker fixture");
    await act(async () => deferred[2]?.({ ...response, items: [maker] }));
    await act(async () => deferred[1]?.(response));
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(container.querySelector('[role="option"]')?.textContent).toContain(
      "Bolt Works",
    );
  });

  it("keeps arrow selection in bounds and opens results from the input", async () => {
    searchPublic.mockResolvedValue(response);
    const { input } = openSearch();
    changeInput(input, "bolt");
    await finishSearch();

    const options = Array.from(container.querySelectorAll('[role="option"]'));
    expect(input.getAttribute("aria-activedescendant")).toBe(
      "global-search-result-0",
    );
    expect(options[0]?.getAttribute("aria-selected")).toBe("true");
    expect(options[0]?.className).toContain("bg-accent");

    act(() =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowUp" }),
      ),
    );
    expect(options[0]?.getAttribute("aria-selected")).toBe("true");

    act(() =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }),
      ),
    );
    act(() =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }),
      ),
    );
    expect(options[1]?.getAttribute("aria-selected")).toBe("true");
    expect(options[1]?.className).toContain("bg-accent");
    act(() =>
      options[1]?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowUp" }),
      ),
    );
    expect(options[1]?.getAttribute("aria-selected")).toBe("true");

    let destination = "";
    options[1]?.addEventListener("click", (event) => {
      event.preventDefault();
      destination = (event.currentTarget as HTMLAnchorElement).href;
    });
    act(() =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
      ),
    );
    expect(destination).toContain("/makers/bolt-works");
  });

  it("uses the exact tab cycle and only the platform modifier", () => {
    const { dialog, input } = openSearch();
    changeInput(input, "bolt pen");
    const controls = Array.from(
      dialog.querySelectorAll<
        HTMLInputElement | HTMLButtonElement | HTMLAnchorElement
      >('input, button, a:not([tabindex="-1"])'),
    );
    expect(controls.map((control) => control.tagName)).toEqual([
      "INPUT",
      "BUTTON",
      "A",
    ]);

    const seeAll = controls[2] as HTMLAnchorElement;
    act(() => {
      input.focus();
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "Tab",
          shiftKey: true,
        }),
      );
    });
    expect(document.activeElement).toBe(seeAll);
    act(() =>
      seeAll.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }),
      ),
    );
    expect(document.activeElement).toBe(input);

    let opened = "";
    seeAll.addEventListener("click", (event) => {
      event.preventDefault();
      opened = seeAll.href;
    });
    const platform = vi.spyOn(navigator, "platform", "get");
    platform.mockReturnValue("MacIntel");
    act(() =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "Enter",
          ctrlKey: true,
        }),
      ),
    );
    expect(opened).toBe("");
    act(() =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "Enter",
          metaKey: true,
        }),
      ),
    );
    expect(opened).toContain("/search?q=bolt%20pen");

    opened = "";
    platform.mockReturnValue("Linux x86_64");
    act(() =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "Enter",
          metaKey: true,
        }),
      ),
    );
    expect(opened).toBe("");
    act(() =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "Enter",
          ctrlKey: true,
        }),
      ),
    );
    expect(opened).toContain("/search?q=bolt%20pen");
  });

  it("keeps the shell visible through loading, errors, and empty results", async () => {
    searchPublic.mockRejectedValueOnce(new Error("offline"));
    const { input } = openSearch();
    changeInput(input, "bolt");
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    await finishSearch();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "couldn’t complete",
    );
    expect(input.value).toBe("bolt");

    searchPublic.mockResolvedValueOnce({ ...response, items: [], total: 0 });
    changeInput(input, "empty");
    await finishSearch();
    expect(container.textContent).toContain("No results match this search.");
  });
});
