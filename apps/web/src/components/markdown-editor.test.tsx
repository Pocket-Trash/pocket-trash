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

  it("selects only content after wrapping a Source selection", async () => {
    await act(() =>
      root.render(
        <MarkdownEditor defaultValue="bold plain" label="Description" />,
      ),
    );
    const sourceMode = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Source",
    );
    act(() => sourceMode?.click());

    const textarea = container.querySelector("textarea");
    act(() => textarea?.setSelectionRange(0, 4));
    const bold = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Bold"]',
    );
    act(() => bold?.click());

    expect(textarea?.value).toBe("**bold** plain");
    expect(textarea?.selectionStart).toBe(2);
    expect(textarea?.selectionEnd).toBe(6);
  });

  it("keeps an empty Source selection between inserted markers", async () => {
    await act(() => root.render(<MarkdownEditor label="Description" />));
    const sourceMode = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Source",
    );
    act(() => sourceMode?.click());

    const textarea = container.querySelector("textarea");
    act(() => textarea?.setSelectionRange(0, 0));
    const bold = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Bold"]',
    );
    act(() => bold?.click());

    expect(textarea?.value).toBe("****");
    expect(textarea?.selectionStart).toBe(2);
    expect(textarea?.selectionEnd).toBe(2);
  });

  it("restores a partial-line selection after Source block formatting", async () => {
    await act(() =>
      root.render(
        <MarkdownEditor
          defaultValue={"one two\n\nthree"}
          label="Description"
        />,
      ),
    );
    const sourceMode = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Source",
    );
    act(() => sourceMode?.click());

    const textarea = container.querySelector("textarea");
    act(() => textarea?.setSelectionRange(1, 3));
    const quote = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Blockquote"]',
    );
    act(() => quote?.click());

    expect(textarea?.value).toBe("> one two\n\nthree");
    expect(textarea?.selectionStart).toBe(3);
    expect(textarea?.selectionEnd).toBe(5);
  });

  it("does not format the next line at a Source selection boundary", async () => {
    await act(() =>
      root.render(
        <MarkdownEditor defaultValue={"one\n\ntwo"} label="Description" />,
      ),
    );
    const sourceMode = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Source",
    );
    act(() => sourceMode?.click());

    const textarea = container.querySelector("textarea");
    act(() => textarea?.setSelectionRange(0, 4));
    const unorderedList = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Bulleted list"]',
    );
    act(() => unorderedList?.click());

    expect(textarea?.value).toBe("- one\n\ntwo");
    expect(textarea?.selectionStart).toBe(2);
    expect(textarea?.selectionEnd).toBe(6);
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

  it("wraps selected Source text in a safe link and restores focus", async () => {
    await act(() =>
      root.render(
        <MarkdownEditor defaultValue="Pocket Trash" label="Description" />,
      ),
    );
    clickButton(container, "Source");
    const textarea = container.querySelector("textarea");
    act(() => textarea?.setSelectionRange(0, 12));
    clickButton(container, "Link");

    const url = [...container.querySelectorAll("input")].find(
      (input) => input.labels?.[0]?.textContent === "URL",
    );
    act(() => {
      if (!url) return;
      setInputValue(url, "https://pocket-trash.app");
      url.dispatchEvent(new Event("input", { bubbles: true }));
    });
    clickButton(container, "Insert link");

    expect(textarea?.value).toBe("[Pocket Trash](https://pocket-trash.app)");
    expect(textarea?.selectionStart).toBe(1);
    expect(textarea?.selectionEnd).toBe(13);
    expect(document.activeElement).toBe(textarea);
  });

  it("removes only an exact Source link selection", async () => {
    await act(() =>
      root.render(
        <MarkdownEditor
          defaultValue="[Pocket Trash](/about) nearby"
          label="Description"
        />,
      ),
    );
    clickButton(container, "Source");
    const textarea = container.querySelector("textarea");
    act(() => textarea?.setSelectionRange(0, 22));
    clickButton(container, "Link");
    clickButton(container, "Remove link");

    expect(textarea?.value).toBe("Pocket Trash nearby");
    expect(textarea?.selectionStart).toBe(0);
    expect(textarea?.selectionEnd).toBe(12);
  });

  it("rejects unsafe Source link destinations", async () => {
    await act(() =>
      root.render(
        <MarkdownEditor defaultValue="Email us" label="Description" />,
      ),
    );
    clickButton(container, "Source");
    const textarea = container.querySelector("textarea");
    act(() => textarea?.setSelectionRange(0, 8));
    clickButton(container, "Link");
    const url = [...container.querySelectorAll("input")].find(
      (input) => input.labels?.[0]?.textContent === "URL",
    );
    act(() => {
      if (!url) return;
      setInputValue(url, "mailto:test@example.com");
      url.dispatchEvent(new Event("input", { bubbles: true }));
    });
    clickButton(container, "Insert link");

    expect(container.textContent).toContain(
      "Enter a relative, HTTP, or HTTPS URL.",
    );
    expect(textarea?.value).toBe("Email us");
  });

  it("inserts a three-column Source table with one body row", async () => {
    await act(() => root.render(<MarkdownEditor label="Description" />));
    clickButton(container, "Source");
    clickButton(container, "Table");

    expect(container.querySelector("textarea")?.value).toBe(
      "|  |  |  |\n| --- | --- | --- |\n|  |  |  |",
    );
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
    expect(
      container
        .querySelector(`#${textarea?.getAttribute("aria-describedby")}`)
        ?.classList.contains("text-destructive"),
    ).toBe(true);

    act(() => {
      if (!textarea) return;
      setTextareaValue(textarea, "12345");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(textarea?.getAttribute("aria-invalid")).toBe("true");
    expect(container.textContent).toContain("1 over limit");
  });

  it("announces counter transitions without announcing every edit", async () => {
    await act(() =>
      root.render(
        <MarkdownEditor
          counter={{ limit: 5, type: "characters", warningAt: 4 }}
          defaultValue="1"
          label="Description"
        />,
      ),
    );
    clickButton(container, "Source");
    const textarea = container.querySelector("textarea");
    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toContain("1 / 5");

    act(() => {
      if (!textarea) return;
      setTextareaValue(textarea, "12");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(status?.textContent).toContain("1 / 5");

    act(() => {
      if (!textarea) return;
      setTextareaValue(textarea, "1234");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(status?.textContent).toContain("4 / 5");
    expect(status?.textContent).toContain("approaching limit");
    expect(
      container
        .querySelector(`#${textarea?.getAttribute("aria-describedby")}`)
        ?.classList.contains("text-primary"),
    ).toBe(true);
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

/**
 * Updates a controlled input through its native value setter.
 *
 * @param input - Input to update.
 * @param value - New input value.
 * @returns Nothing.
 */
function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set?.call(input, value);
}

/**
 * Clicks a button by visible text or accessible label.
 *
 * @param container - Rendered test container.
 * @param name - Visible text or accessible label.
 * @returns Nothing.
 */
function clickButton(container: HTMLElement, name: string) {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) =>
      candidate.textContent === name ||
      candidate.getAttribute("aria-label") === name,
  );
  act(() => button?.click());
}
