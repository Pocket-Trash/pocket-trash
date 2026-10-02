/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionForm, type CollectionFormValue } from "./collection-form";

(
  globalThis as {
    /** Tells React that this test environment supports act(). */
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Provides locale data for tests.
   *
   * @returns The stable test locale.
   */
  useLocale: () => ({ locale: "en-US" }),
  /**
   * Provides an optional locale for tests.
   *
   * @returns The stable test locale.
   */
  useOptionalLocale: () => "en-US",
}));

/** Localized collection form copy used by the tests. */
const copy = {
  browse: "Browse",
  cancel: "Cancel",
  cover: "Images",
  description: "Description",
  descriptionPlaceholder: "Describe this collection",
  imageHelp: "Image help",
  imageTypes: "Image types",
  name: "Name",
  namePlaceholder: "Collection name",
  public: "Public",
  removeFile: "Remove file",
  submit: "Save",
};

describe("CollectionForm", () => {
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

  it("submits the synchronous editor value without waiting for form state", async () => {
    const onSubmit = vi.fn<(value: CollectionFormValue) => void>();
    await act(() =>
      root.render(
        <CollectionForm
          copy={copy}
          includeImages={false}
          initialValue={{
            description: "Old description",
            isPrivate: true,
            name: "Daily Carry",
          }}
          onSubmit={onSubmit}
        />,
      ),
    );
    clickButton(container, "Source");
    const textarea = container.querySelector("textarea");

    act(() => {
      if (!textarea) return;
      setTextareaValue(textarea, "Current **description**");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      container
        .querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });

    expect(onSubmit).toHaveBeenCalledWith(
      {
        description: "Current **description**",
        isPrivate: true,
        name: "Daily Carry",
      },
      [],
    );
  });

  it("splits large screens and keeps cancel and save in a full-width row", async () => {
    const onCancel = vi.fn();
    await act(() =>
      root.render(
        <CollectionForm
          copy={copy}
          includeImages={false}
          onCancel={onCancel}
          onSubmit={vi.fn()}
          splitOnLargeScreens
        />,
      ),
    );

    const form = container.querySelector("form");
    const save = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Save",
    );
    expect(form?.classList.contains("lg:grid-cols-2")).toBe(true);
    expect(save?.parentElement?.classList.contains("lg:col-span-2")).toBe(true);

    clickButton(container, "Cancel");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("keeps unsplit errors in a single grid column", async () => {
    await act(() =>
      root.render(
        <CollectionForm copy={copy} error="Try again" onSubmit={vi.fn()} />,
      ),
    );

    const error = Array.from(container.querySelectorAll("p")).find(
      (element) => element.textContent === "Try again",
    );
    expect(error?.classList.contains("lg:col-span-2")).toBe(false);
  });

  it("allows 200 words and blocks 201 without truncating", async () => {
    const onSubmit = vi.fn<(value: CollectionFormValue) => void>();
    await act(() =>
      root.render(
        <CollectionForm
          copy={copy}
          includeImages={false}
          initialValue={{ description: "", isPrivate: true, name: "Words" }}
          onSubmit={onSubmit}
        />,
      ),
    );
    clickButton(container, "Source");
    const textarea = container.querySelector("textarea");
    const form = container.querySelector("form");
    const atLimit = Array.from({ length: 200 }, () => "word").join(" ");

    act(() => {
      if (!textarea) return;
      setTextareaValue(textarea, atLimit);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(onSubmit).toHaveBeenCalledOnce();

    onSubmit.mockClear();
    act(() => {
      if (!textarea) return;
      setTextareaValue(textarea, `${atLimit} extra`);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    expect(textarea?.value).toBe(`${atLimit} extra`);
    expect(textarea?.getAttribute("aria-invalid")).toBe("true");
    expect(onSubmit).not.toHaveBeenCalled();
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
 * Clicks a button by visible text.
 *
 * @param container - Rendered test container.
 * @param name - Visible button name.
 * @returns Nothing.
 */
function clickButton(container: HTMLElement, name: string) {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent === name,
  );
  act(() => button?.click());
}
