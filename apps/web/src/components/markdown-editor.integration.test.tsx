/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { MarkdownEditor } from "./markdown-editor";

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Provides the locale for real visual editor tests.
   *
   * @returns The test locale.
   */
  useOptionalLocale: () => "en-US",
}));

it.each([
  "Plain text",
  "# Initial heading",
])("loads %s and switches Markdown from Source back to Visual", async (defaultValue) => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(
        <MarkdownEditor defaultValue={defaultValue} label="Description" />,
      );
      await import("./markdown-visual-editor");
    });
    await vi.waitFor(async () => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      expect(container.querySelector(".ProseMirror")).not.toBeNull();
    });
    await act(() => {
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "Source")
        ?.click();
    });
    const source = container.querySelector("textarea");
    expect(source).not.toBeNull();
    await act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set?.call(source, "Plain text\n\n# testing");
      source?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(() => {
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "Visual")
        ?.click();
    });
    await vi.waitFor(async () => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      expect(container.querySelector(".ProseMirror h1")?.textContent).toBe(
        "testing",
      );
    });
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.textContent).not.toContain("couldn't load");
  } finally {
    await act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
