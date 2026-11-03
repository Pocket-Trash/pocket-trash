/** @vitest-environment jsdom */

import { Editor } from "@milkdown/core";
import { EditorView } from "@milkdown/prose/view";
import { Activity, act, createRef, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownEditor, type MarkdownEditorHandle } from "./markdown-editor";
import {
  MarkdownVisualEditor,
  type MarkdownVisualEditorProps,
} from "./markdown-visual-editor";

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Supplies the real editor's test locale.
   * @returns Stable English locale.
   */
  useOptionalLocale: () => "en-US",
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/**
 * Waits for one real Milkdown surface after asynchronous initialization.
 * @param container - Mounted editor container.
 * @returns Resolves when exactly one visual surface exists.
 */
async function waitForSurface(container: HTMLElement) {
  await vi.waitFor(async () => {
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });
    expect(container.querySelectorAll(".ProseMirror")).toHaveLength(1);
  });
}

describe("Markdown editor DOM lifetimes", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("disposes a late view after initialization rejects without polling destroy", async () => {
    const make = Editor.make;
    vi.spyOn(Editor, "make").mockImplementationOnce(() =>
      make().use(() => async () => {
        throw new Error("initialization failed");
      }),
    );
    const destroyed = vi.spyOn(EditorView.prototype, "destroy");
    const loading = vi.fn();
    act(() =>
      root.render(
        <MarkdownEditor
          label="Description"
          defaultValue="# Kept"
          onLoadingChange={loading}
        />,
      ),
    );
    await vi.waitFor(async () => {
      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 10));
      });
      expect(container.querySelector("textarea")?.value.trim()).toBe("# Kept");
      expect(loading).toHaveBeenLastCalledWith(false);
      expect(destroyed).toHaveBeenCalledTimes(1);
    });
    await act(async () => root.render(null));
    expect(destroyed).toHaveBeenCalledTimes(1);
  });

  it("ignores disposed initialization and creates one active editor under StrictMode", async () => {
    const oldReady = vi.fn();
    const currentReady = vi.fn();
    const failed = vi.fn();
    const props: MarkdownVisualEditorProps = {
      ariaInvalid: false,
      disabled: false,
      label: "Description",
      onChange: vi.fn(),
      onError: failed,
      onReady: oldReady,
      onSelectionChange: vi.fn(),
      readOnly: false,
      value: "Old",
    };
    act(() => root.render(<MarkdownVisualEditor {...props} />));
    act(() => root.render(null));
    act(() =>
      root.render(
        <StrictMode>
          <MarkdownVisualEditor
            {...props}
            value="Current"
            onReady={currentReady}
          />
        </StrictMode>,
      ),
    );
    await waitForSurface(container);
    expect(container.querySelector(".ProseMirror")?.textContent).toBe(
      "Current",
    );
    expect(oldReady).not.toHaveBeenCalled();
    expect(currentReady).toHaveBeenCalledTimes(1);
    expect(failed).not.toHaveBeenCalled();
    await act(async () => root.render(null));
    expect(container.querySelector(".ProseMirror")).toBeNull();
    expect(oldReady).not.toHaveBeenCalled();
  });

  it("retains content and the editor node through property changes, then resumes Activity with current loading feedback", async () => {
    const loading = vi.fn();
    const ref = createRef<MarkdownEditorHandle>();
    /**
     * Renders the same editor through committed property and Activity changes.
     * @param mode - Activity visibility.
     * @param updated - Whether replacement initial content and read-only properties were supplied.
     * @returns Lifecycle-wrapped real editor.
     */
    const tree = (mode: "visible" | "hidden", updated = false) => (
      <StrictMode>
        <Activity mode={mode}>
          <MarkdownEditor
            defaultValue={updated ? "Replacement" : "# Kept"}
            label={updated ? "Updated" : "Description"}
            disabled={updated}
            readOnly={updated}
            onLoadingChange={loading}
            ref={ref}
          />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(tree("visible")));
    await waitForSurface(container);
    await vi.waitFor(() => expect(loading).toHaveBeenLastCalledWith(false));
    expect(loading.mock.calls.map(([value]) => value)).toEqual([true, false]);
    const surface = container.querySelector(".ProseMirror");
    await act(async () => root.render(tree("visible", true)));
    expect(container.querySelector(".ProseMirror")).toBe(surface);
    expect(surface?.textContent).toBe("Kept");
    expect(surface?.getAttribute("aria-label")).toBe("Updated");
    expect(surface?.getAttribute("contenteditable")).toBe("false");
    expect(ref.current?.getValue()).toBe("# Kept");
    await act(async () => root.render(tree("hidden", true)));
    expect(container.querySelector(".ProseMirror")).toBeNull();
    await act(async () => root.render(tree("visible", true)));
    await waitForSurface(container);
    await vi.waitFor(() =>
      expect(loading.mock.calls.map(([value]) => value)).toEqual([
        true,
        false,
        true,
        false,
      ]),
    );
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("Kept");
    expect(
      container.querySelector(".ProseMirror")?.getAttribute("contenteditable"),
    ).toBe("false");
    expect(ref.current?.isLoading()).toBe(false);
  });
});
