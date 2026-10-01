/** @vitest-environment jsdom */

import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownEditor, type MarkdownEditorHandle } from "./markdown-editor";

(
  globalThis as {
    /** Tells React that this test environment supports act(). */
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Returns a stable test locale.
   *
   * @returns The test locale.
   */
  useOptionalLocale: () => "en-US",
}));

vi.mock("./markdown-visual-editor", () => ({
  /**
   * Replaces the visual editor in focused unit tests.
   *
   * @returns No rendered content.
   */
  MarkdownVisualEditor: () => null,
}));

describe("MarkdownEditor", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
  });

  it("returns a safe current value synchronously from Source mode", async () => {
    const ref = createRef<MarkdownEditorHandle>();
    await act(() =>
      root.render(<MarkdownEditor label="Description" ref={ref} />),
    );

    const sourceMode = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Source",
    );
    act(() => sourceMode?.click());

    const textarea = container.querySelector("textarea");
    expect(textarea?.getAttribute("aria-label")).toBe("Description");
    act(() => {
      if (!textarea) return;
      setTextareaValue(textarea, "```markdown\n# Heading\n```");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(ref.current?.getValue()).toBe("\\# Heading");
  });

  it("unwraps only an exact Source selection and restores it", async () => {
    await act(() =>
      root.render(
        <MarkdownEditor defaultValue="**bold** plain" label="Description" />,
      ),
    );
    const sourceMode = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Source",
    );
    act(() => sourceMode?.click());

    const textarea = container.querySelector("textarea");
    act(() => {
      textarea?.focus();
      textarea?.setSelectionRange(0, 8);
    });
    const bold = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Bold"]',
    );
    act(() => bold?.click());

    expect(textarea?.value).toBe("bold plain");
    expect(textarea?.selectionStart).toBe(0);
    expect(textarea?.selectionEnd).toBe(4);
  });

  it("unwraps a numbered Source list with sequential markers", async () => {
    await act(() =>
      root.render(
        <MarkdownEditor defaultValue={"1. one\n2. two"} label="Description" />,
      ),
    );
    const sourceMode = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Source",
    );
    act(() => sourceMode?.click());

    const textarea = container.querySelector("textarea");
    act(() => textarea?.setSelectionRange(0, textarea.value.length));
    const orderedList = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Numbered list"]',
    );
    act(() => orderedList?.click());

    expect(textarea?.value).toBe("one\ntwo");
  });

  it("marks only over-limit content invalid", async () => {
    await act(() =>
      root.render(
        <MarkdownEditor
          counter={{ limit: 4, type: "characters", warningAt: 3 }}
          defaultValue="1234"
          label="Description"
        />,
      ),
    );
    const sourceMode = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Source",
    );
    act(() => sourceMode?.click());

    const textarea = container.querySelector("textarea");
    expect(textarea?.getAttribute("aria-invalid")).toBeNull();
    expect(container.textContent).toContain("4 / 4 characters, limit reached");

    act(() => {
      if (!textarea) return;
      setTextareaValue(textarea, "12345");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(textarea?.getAttribute("aria-invalid")).toBe("true");
    expect(container.textContent).toContain("1 over limit");
  });
});

/**
 * Updates a controlled textarea through its native value setter.
 *
 * @param textarea - Textarea to update.
 * @param value - New textarea value.
 * @returns Nothing.
 */
function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set?.call(textarea, value);
}
