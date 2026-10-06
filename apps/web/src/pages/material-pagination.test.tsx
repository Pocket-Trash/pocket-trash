// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MaterialResultPage } from "./material-pages";

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Returns the fixed test locale.
   *
   * @returns The English test locale.
   */
  useLocale: () => ({ locale: "en-US" }),
}));

/** Mounted roots cleaned after each pagination test. */
const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

describe("MaterialResultPage", () => {
  it("does not overwrite a valid mobile page before measuring the viewport", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 400,
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    cleanups.push(() => {
      root.unmount();
      container.remove();
    });
    const onPageChange = vi.fn();

    await act(async () => {
      root.render(
        <MaterialResultPage
          ariaLabel="Product pages"
          items={Array.from({ length: 9 }, (_, index) => index + 1)}
          onPageChange={onPageChange}
          requestedPage={2}
        >
          {(items) => <p>{items.join(",")}</p>}
        </MaterialResultPage>,
      );
    });

    expect(container.textContent).toContain("9");
    expect(container.textContent).toContain("Page 2 of 2");
    expect(onPageChange).not.toHaveBeenCalled();
  });
});
