/** @vitest-environment jsdom */

import {
  Activity,
  act,
  StrictMode,
  useCallback,
  useImperativeHandle,
  useRef,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MarkdownEditorHandle } from "@/components/markdown-editor";
import type { CatalogOptions } from "@/lib/catalog-api";
import { createCatalogMaker, saveCatalogProduct } from "@/lib/catalog-api";
import { uploadImages } from "@/lib/upload-sessions";
import { ProductEditor } from "./catalog-form-pages";
import { CatalogApprovalControls } from "./catalog-pages";
import { productFixture } from "./catalog-test-fixtures";

/** Stable navigation observer. */
const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({
  /**
   * Supplies the navigation observer.
   * @returns Stable navigation spy.
   */
  useNavigate: () => navigate,
}));
vi.mock("@clerk/tanstack-react-start", () => ({
  /**
   * Supplies test authentication.
   * @returns Token callback.
   */
  useAuth: () => ({ getToken: vi.fn() }),
}));
vi.mock("@/providers/locale-provider", () => ({
  /**
   * Supplies the test locale.
   * @returns English locale context.
   */
  useLocale: () => ({ locale: "en-US" }),
  /**
   * Supplies the optional test locale.
   * @returns English locale.
   */
  useOptionalLocale: () => "en-US",
}));
vi.mock("@/lib/catalog-api", async (original) => ({
  ...(await original<object>()),
  saveCatalogProduct: vi.fn(),
  createCatalogMaker: vi.fn(),
}));
vi.mock("@/lib/upload-sessions", async (original) => ({
  ...(await original<object>()),
  uploadImages: vi.fn(),
}));
vi.mock("@/components/catalog-markdown-editor", () => ({
  /**
   * Reports committed readiness while keeping save tests focused on the consumer.
   * @param props - Markdown consumer contract.
   * @returns A committed editor readiness marker.
   */
  CatalogMarkdownEditor: (props: {
    /** Consumer imperative handle. */
    ref?: React.Ref<MarkdownEditorHandle>;
    /** Initial document. */
    defaultValue?: string;
    /**
     * Reports committed editor readiness.
     * @param loading - Whether initialization is pending.
     */
    onLoadingChange?: (loading: boolean) => void;
  }) => {
    const reported = useRef(false);
    useImperativeHandle(props.ref, () => ({
      /**
       * Reads this fixture's document.
       * @returns Initial Markdown.
       */
      getValue: () => props.defaultValue ?? "",
      /**
       * Focuses this fixture without creating an editor.
       * @returns Nothing.
       */
      focus: () => undefined,
      /**
       * Reports the ready test editor.
       * @returns Whether initialization is pending.
       */
      isLoading: () => false,
    }));
    const bind = useCallback(
      (node: HTMLSpanElement | null) => {
        if (node && !reported.current) {
          reported.current = true;
          props.onLoadingChange?.(false);
        }
      },
      [props.onLoadingChange],
    );
    return <span ref={bind} />;
  },
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/** Canonical choices matching the saved product fixture. */
const options: CatalogOptions = {
  colorEffects: [],
  colors: [],
  finishes: [{ id: 1002, name: "Polished", slug: "polished" }],
  makers: [
    {
      id: 1,
      name: "Maker",
      slug: "maker",
      rootUrl: null,
      description: null,
      images: [],
    },
  ],
  materials: [{ id: 1001, name: "Bronze", slug: "bronze" }],
  mechanisms: [],
  patterns: [],
  productTypes: [],
  relationshipProducts: [],
  spinnerButtons: [],
};
/**
 * Edits a controlled native input through React's change boundary.
 * @param input - Target control.
 * @param value - Replacement value.
 */
function edit(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
/**
 * Finds one native control by its accessible label.
 * @param container - Mounted controls.
 * @param label - Accessible control name.
 * @returns Named input.
 * @throws {Error} When the named control is missing.
 */
function input(container: HTMLElement, label: string) {
  const control = [...container.querySelectorAll("input")].find(
    (node) => node.getAttribute("aria-label") === label,
  );
  if (!control) throw new Error(`Missing input: ${label}`);
  return control;
}
/**
 * Clicks a named action and flushes its committed transitions.
 * @param container - Mounted controls.
 * @param name - Button text.
 * @rejects When the named button is missing.
 */
async function click(container: HTMLElement, name: string) {
  const button = [...container.querySelectorAll("button")].find(
    (node) => node.textContent === name,
  );
  if (!button) throw new Error(`Missing button: ${name}`);
  await act(async () => button.click());
}

describe("catalog mutation lifetimes", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.resetAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    };
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("retains product drafts and server field errors, then allows a successful repeat save", async () => {
    const product = productFixture(1000, "Spinner", "spinner");
    const created = vi.fn();
    vi.mocked(saveCatalogProduct)
      .mockResolvedValueOnce({
        ok: false,
        requiresConfirmation: false,
        formError: "web.catalog.error.form",
        fieldErrors: { name: ["web.catalog.error.required"] },
      })
      .mockResolvedValueOnce({ ok: true, product });
    await act(async () =>
      root.render(
        <ProductEditor
          initialProduct={product}
          options={options}
          productTypeSlug="spinner"
          onCreated={created}
        />,
      ),
    );
    await act(async () => edit(input(container, "Name"), "Retained draft"));
    const form = container.querySelector("form");
    await act(async () =>
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
    expect(saveCatalogProduct).toHaveBeenCalledTimes(1);
    expect(input(container, "Name").value).toBe("Retained draft");
    expect(container.textContent).toContain("This field is required");
    expect(created).not.toHaveBeenCalled();
    await act(async () =>
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
    expect(saveCatalogProduct).toHaveBeenCalledTimes(2);
    expect(created).toHaveBeenCalledExactlyOnceWith(product);
    expect(
      vi.mocked(saveCatalogProduct).mock.calls[1]?.[0]?.data,
    ).toMatchObject({
      name: "Retained draft",
      productId: 1000,
      productTypeSlug: "spinner",
      materialAssignments: [
        { materials: [{ materialId: 1001, materialSpecificId: null }] },
      ],
    });
  });

  it("uploads after saving, retains failed files, and retries against the saved product", async () => {
    const product = productFixture(1000, "Spinner", "spinner");
    const file = new File(["image"], "retained.png", { type: "image/png" });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:catalog-test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "Image").mockImplementation(function () {
      const image = document.createElement("img");
      queueMicrotask(() => image.dispatchEvent(new Event("error")));
      return image;
    });
    const removed = new File(["image"], "removed.png", { type: "image/png" });
    /**
     * Completes the pending upload response.
     * @param value - Upload result supplied by the test.
     * @returns Nothing.
     */
    let completeUpload: (
      value: Awaited<ReturnType<typeof uploadImages>>,
    ) => void = (value) => {
      void value;
    };
    const upload = new Promise<Awaited<ReturnType<typeof uploadImages>>>(
      (resolve) => {
        completeUpload = resolve;
      },
    );
    vi.mocked(saveCatalogProduct).mockResolvedValue({ ok: true, product });
    vi.mocked(uploadImages)
      .mockReturnValueOnce(upload)
      .mockResolvedValueOnce({ failed: [], uploaded: [file] });
    const created = vi.fn();
    await act(async () =>
      root.render(
        <ProductEditor
          initialProduct={product}
          options={options}
          productTypeSlug="spinner"
          onCreated={created}
        />,
      ),
    );
    const picker =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!picker) throw new Error("Missing image picker");
    Object.defineProperty(picker, "files", {
      configurable: true,
      value: [file, removed],
    });
    await act(async () =>
      picker.dispatchEvent(new Event("change", { bubbles: true })),
    );
    const form = container.querySelector("form");
    await act(async () =>
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
    expect(picker.disabled).toBe(true);
    const remove = container.querySelector<HTMLButtonElement>(
      'button[aria-label$="removed.png"]',
    );
    if (!remove) throw new Error("Missing selected image removal");
    await act(async () => remove.click());
    await act(async () =>
      completeUpload({ failed: [file, removed], uploaded: [] }),
    );
    expect(container.textContent).not.toContain("removed.png");
    expect(created).not.toHaveBeenCalled();
    expect(container.textContent).toContain("retained.png");
    expect(uploadImages).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(saveCatalogProduct).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(uploadImages).mock.invocationCallOrder[0] ?? 0);
    await act(async () =>
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
    expect(uploadImages).toHaveBeenCalledTimes(2);
    expect(uploadImages).toHaveBeenLastCalledWith(
      expect.objectContaining({
        files: [file],
        targetId: 1000,
        targetType: "product",
      }),
    );
    expect(saveCatalogProduct).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ productId: 1000 }),
      }),
    );
    expect(created).toHaveBeenCalledExactlyOnceWith(product);
  });

  it("does not repeat a completed or pending product mutation after Activity resumes", async () => {
    const product = productFixture(1000, "Spinner", "spinner");
    /**
     * Completes the pending server response.
     * @param value - Server result supplied by the test.
     * @returns Nothing.
     */
    let complete: (
      value: Awaited<ReturnType<typeof saveCatalogProduct>>,
    ) => void = (value) => {
      void value;
    };
    const pending = new Promise<Awaited<ReturnType<typeof saveCatalogProduct>>>(
      (resolve) => {
        complete = resolve;
      },
    );
    vi.mocked(saveCatalogProduct).mockReturnValue(pending);
    const created = vi.fn();
    /**
     * Keeps one product editor alive through Activity visibility changes.
     * @param mode - Activity visibility.
     * @returns Wrapped product editor.
     */
    const tree = (mode: "visible" | "hidden") => (
      <StrictMode>
        <Activity mode={mode}>
          <ProductEditor
            initialProduct={product}
            options={options}
            productTypeSlug="spinner"
            onCreated={created}
          />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(tree("visible")));
    await act(async () =>
      container
        .querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(saveCatalogProduct).toHaveBeenCalledTimes(1);
    await act(async () => root.render(tree("hidden")));
    await act(async () => complete({ ok: true, product }));
    expect(created).not.toHaveBeenCalled();
    await act(async () => root.render(tree("visible")));
    expect(saveCatalogProduct).toHaveBeenCalledTimes(1);
    expect(created).toHaveBeenCalledExactlyOnceWith(product);
    await act(async () => root.render(tree("hidden")));
    await act(async () => root.render(tree("visible")));
    expect(created).toHaveBeenCalledTimes(1);
  });

  it("keeps a failed inline maker draft and accepts retry without changing the payload", async () => {
    vi.mocked(createCatalogMaker)
      .mockResolvedValueOnce({
        ok: false,
        requiresConfirmation: false,
        formError: "web.catalog.error.form",
        fieldErrors: { name: ["web.catalog.error.required"] },
      })
      .mockResolvedValueOnce({
        ok: true,
        maker: {
          id: 2,
          name: "New maker",
          slug: "new-maker",
          rootUrl: "https://example.com",
          description: null,
          images: [],
        },
      });
    await act(async () =>
      root.render(
        <ProductEditor
          initialProduct={productFixture(1000, "Spinner", "spinner")}
          options={options}
          productTypeSlug="spinner"
        />,
      ),
    );
    await click(container, "Add maker");
    const dialog = [...container.querySelectorAll("dialog")].find(
      (node) => node.open,
    );
    expect(dialog).toBeDefined();
    if (!dialog) throw new Error("Missing inline dialog");
    await act(async () => {
      edit(input(dialog, "Name"), "New maker");
      const url = dialog.querySelector<HTMLInputElement>('input[type="url"]');
      if (!url) throw new Error("Missing maker URL");
      edit(url, "https://example.com");
    });
    await click(dialog, "Add maker");
    expect(input(dialog, "Name").value).toBe("New maker");
    expect(dialog.open).toBe(true);
    await click(dialog, "Add maker");
    expect(createCatalogMaker).toHaveBeenCalledTimes(2);
    expect(createCatalogMaker).toHaveBeenLastCalledWith({
      data: { name: "New maker", rootUrl: "https://example.com" },
    });
    expect(dialog.open).toBe(false);
  });

  it("preserves an open part draft through Activity cleanup and returns focus on cancellation", async () => {
    const product = productFixture(1000, "Pen", "pen");
    /**
     * Keeps embedded part creation alive through Activity visibility changes.
     * @param mode - Activity visibility.
     * @returns Wrapped Pen editor.
     */
    const tree = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <ProductEditor
          initialProduct={product}
          options={options}
          productTypeSlug="pen"
        />
      </Activity>
    );
    await act(async () => root.render(tree("visible")));
    const role = [...container.querySelectorAll("label")]
      .find((label) => /tips/iu.test(label.textContent ?? ""))
      ?.querySelector("input");
    if (!role) throw new Error("Missing Pen tip disclosure");
    await act(async () => role.click());
    const trigger = [...container.querySelectorAll("button")].find(
      (node) => node.textContent === "Add product",
    );
    if (!trigger) throw new Error("Missing part creation trigger");
    await act(async () => trigger.click());
    const dialog = [...document.querySelectorAll("dialog")].find(
      (node) => node.open,
    );
    if (!dialog) throw new Error("Missing part editor dialog");
    await act(async () => edit(input(dialog, "Name"), "Unsubmitted tip"));
    await act(async () => root.render(tree("hidden")));
    expect(dialog.open).toBe(false);
    await act(async () => root.render(tree("visible")));
    expect(dialog.open).toBe(true);
    expect(input(dialog, "Name").value).toBe("Unsubmitted tip");
    await act(async () =>
      dialog.dispatchEvent(new Event("cancel", { cancelable: true })),
    );
    expect(dialog.isConnected).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(saveCatalogProduct).not.toHaveBeenCalled();
  });

  it("retains a failed approval reason and never replays a completed decision", async () => {
    const decide = vi
      .fn<Parameters<typeof CatalogApprovalControls>[0]["onDecide"]>()
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce("approved");
    /**
     * Renders the same approval controls through Activity resumption.
     * @param mode - Activity visibility.
     * @returns Wrapped approval controls.
     */
    const tree = (mode: "visible" | "hidden") => (
      <StrictMode>
        <Activity mode={mode}>
          <CatalogApprovalControls initialStatus="pending" onDecide={decide} />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(tree("visible")));
    const reason = container.querySelector("textarea");
    if (!reason) throw new Error("Missing reason field");
    await act(async () => edit(reason, "Reviewed"));
    await click(container, "Approve product");
    expect(reason.value).toBe("Reviewed");
    await click(container, "Approve product");
    expect(decide).toHaveBeenCalledTimes(2);
    expect(reason.value).toBe("");
    await act(async () => root.render(tree("hidden")));
    await act(async () => root.render(tree("visible")));
    expect(decide).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Approved");
  });
});
