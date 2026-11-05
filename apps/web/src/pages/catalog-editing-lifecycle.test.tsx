import { htmlToMarkdown, markdownToHtml } from "@package/markdown";
/** @vitest-environment jsdom */

import { formatTranslation } from "@pocket-trash/localizations";
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
import {
  addCollectionProduct,
  createCatalogMaker,
  createCatalogMaterial,
  saveCatalogProduct,
  saveCollection,
  updateCollectionItem,
} from "@/lib/catalog-api";
import { uploadImages } from "@/lib/upload-sessions";
import {
  CollectionAddPage,
  CollectionDeletionSection,
  CollectionEditPage,
  CollectionFormPage,
  ProductEditor,
} from "./catalog-form-pages";
import { CatalogApprovalControls } from "./catalog-pages";
import { collectionFixture, productFixture } from "./catalog-test-fixtures";

/** Stable navigation observer. */
const navigate = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-pen-settings", () => ({
  /**
   * Returns the preferred currency for form fixtures.
   * @returns Stable preference fixture.
   */
  usePenSettings: () => ({ currency: "USD" }),
}));

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
vi.mock("@/components/app-shell", () => ({
  /**
   * Keeps workflow tests focused on their route content.
   * @param props - Rendered route content.
   * @returns Route content.
   */
  AppShell: ({
    children,
  }: {
    /** Route content. */ children: React.ReactNode;
  }) => children,
}));
vi.mock("@/components/user-page-shell", () => ({
  /**
   * Keeps user workflow tests focused on their route content.
   * @param props - Rendered route content.
   * @returns Route content.
   */
  UserPageShell: ({
    children,
  }: {
    /** Route content. */ children: React.ReactNode;
  }) => children,
}));
vi.mock("@/lib/catalog-api", async (original) => ({
  ...(await original<object>()),
  saveCatalogProduct: vi.fn(),
  createCatalogMaker: vi.fn(),
  createCatalogMaterial: vi.fn(),
  addCollectionProduct: vi.fn(),
  updateCollectionItem: vi.fn(),
  saveCollection: vi.fn(),
}));
vi.mock("@/lib/upload-sessions", async (original) => ({
  ...(await original<object>()),
  uploadImages: vi.fn(),
}));
/**
 * Reports committed readiness while keeping save tests focused on the consumer.
 * @param props - Markdown consumer contract.
 * @returns Committed readiness marker.
 */
function ReadyMarkdownEditor(props: {
  /** Consumer imperative handle. */
  ref?: React.Ref<MarkdownEditorHandle>;
  /** Initial document. */
  defaultValue?: string;
  /** Accessible editor label. */
  label?: string;
  /**
   * Reports edited Markdown.
   * @param value - Current Markdown.
   */
  onChange?: (value: string) => void;
  /**
   * Reports committed editor readiness.
   * @param loading - Whether initialization is pending.
   */
  onLoadingChange?: (loading: boolean) => void;
}) {
  const reported = useRef(false);
  const document = useRef(props.defaultValue ?? "");
  useImperativeHandle(props.ref, () => ({
    /**
     * Reads this fixture's document.
     * @returns Initial Markdown.
     */
    getValue: () => htmlToMarkdown(markdownToHtml(document.current)) ?? "",
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
  const { onLoadingChange } = props;
  const bind = useCallback(
    (node: HTMLSpanElement | null) => {
      if (node && !reported.current) {
        reported.current = true;
        onLoadingChange?.(false);
      }
    },
    [onLoadingChange],
  );
  return (
    <span ref={bind}>
      <textarea
        aria-label={props.label}
        defaultValue={props.defaultValue}
        onChange={(event) => {
          document.current = event.target.value;
          props.onChange?.(event.target.value);
        }}
      />
    </span>
  );
}

vi.mock("@/components/catalog-markdown-editor", () => ({
  CatalogMarkdownEditor: ReadyMarkdownEditor,
}));
vi.mock("@/components/markdown-editor", () => ({
  MarkdownEditor: ReadyMarkdownEditor,
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
  productTypes: [
    {
      id: 1,
      name: "Spinner",
      slug: "spinner",
      isPartOrAccessory: false,
      imageAlt: "Spinner",
      imageUrl: "https://example.com/spinner.png",
    },
  ],
  relationshipProducts: [],
  spinnerButtons: [],
};
/** Existing collection shared by the collection workflow regressions. */
const collection = {
  canAdminister: false,
  canEdit: true,
  coverImage: null,
  coverImages: [],
  createdAt: new Date(0),
  description: null,
  id: 1000,
  isAdminPrivate: false,
  isOwner: true,
  isPrivate: false,
  itemCount: 2,
  name: "Daily Carry",
  ownerUserId: 1000,
  updatedAt: new Date(0),
};
/**
 * Finds the item visibility control outside nested collection and note editors.
 * @param container - Mounted collection form.
 * @returns The form-owned item visibility switch.
 * @throws When the expected item switch is missing.
 */
function collectionVisibilitySwitch(container: HTMLElement): HTMLElement {
  const control = [
    ...container.querySelectorAll<HTMLElement>(
      '[role="switch"][aria-label="Public"]',
    ),
  ].find((node) => !node.closest("dialog"));
  if (!control) throw new Error("Missing item visibility switch");
  return control;
}

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
    (node) =>
      node.getAttribute("aria-label") === label ||
      [...(node.labels ?? [])].some((element) => element.textContent === label),
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

/**
 * Selects files while stubbing browser-only metadata reads for consumer tests.
 * @param container - Mounted workflow.
 * @param id - File input identifier.
 * @param files - Selected file batch.
 * @rejects When the picker is missing.
 */
async function chooseFiles(container: HTMLElement, id: string, files: File[]) {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:collection-test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  vi.spyOn(globalThis, "Image").mockImplementation(function () {
    const image = document.createElement("img");
    queueMicrotask(() => image.dispatchEvent(new Event("error")));
    return image;
  });
  const picker = container.querySelector<HTMLInputElement>(`input[id="${id}"]`);
  if (!picker) throw new Error("Missing image picker");
  Object.defineProperty(picker, "files", { configurable: true, value: files });
  await act(async () =>
    picker.dispatchEvent(new Event("change", { bubbles: true })),
  );
}

describe("catalog mutation lifetimes", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) =>
        Object.assign(new EventTarget(), {
          matches: query === "(min-width: 640px)",
        }),
      ),
    );
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
    vi.unstubAllGlobals();
  });

  it("saves complete alias badges only with the product", async () => {
    const product = {
      ...productFixture(1000, "Spinner", "spinner"),
      aliases: ["Original"],
    };
    vi.mocked(saveCatalogProduct).mockResolvedValue({ ok: true, product });
    await act(async () =>
      root.render(
        <ProductEditor
          initialProduct={product}
          options={options}
          productTypeSlug="spinner"
        />,
      ),
    );
    const details = container.querySelector("details");
    if (!details) throw new Error("Missing alias disclosure");
    expect(details.open).toBe(false);
    details.open = true;
    const alias = input(container, "Alternative product name");
    await act(async () => edit(alias, " Model 36, special edition "));
    const enter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    await act(async () => alias.dispatchEvent(enter));
    expect(enter.defaultPrevented).toBe(true);
    expect(saveCatalogProduct).not.toHaveBeenCalled();
    expect(alias.value).toBe("");
    expect(
      container.querySelector(
        '[aria-label="Remove alias Model 36, special edition"]',
      ),
    ).not.toBeNull();
    await click(container, "Save");
    expect(saveCatalogProduct).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aliases: ["Original", "Model 36, special edition"],
          name: "Spinner",
        }),
      }),
    );
    expect(product.aliases).toEqual(["Original"]);
  });

  it("keeps canceled alias edits out of saved product data", async () => {
    const product = {
      ...productFixture(1000, "Spinner", "spinner"),
      aliases: ["Original"],
    };
    const cancel = vi.fn();
    await act(async () =>
      root.render(
        <ProductEditor
          initialProduct={product}
          options={options}
          productTypeSlug="spinner"
          onCancel={cancel}
        />,
      ),
    );
    const details = container.querySelector("details");
    if (!details) throw new Error("Missing alias disclosure");
    details.open = true;
    const remove = container.querySelector<HTMLButtonElement>(
      '[aria-label="Remove alias Original"]',
    );
    if (!remove) throw new Error("Missing alias remove action");
    await act(async () => remove.click());
    await act(async () =>
      edit(input(container, "Alternative product name"), "Another name"),
    );
    await click(container, "Add");
    const cancelButton = [...container.querySelectorAll("button")].find(
      (node) => node.textContent === "Cancel" && !node.closest("dialog"),
    );
    if (!cancelButton) throw new Error("Missing main product cancel action");
    await act(async () => cancelButton.click());
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(saveCatalogProduct).not.toHaveBeenCalled();
    expect(product.aliases).toEqual(["Original"]);
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

  it("creates a reusable material without assigning it to the product", async () => {
    const product = productFixture(1000, "Spinner", "spinner");
    for (const assignment of product.materials)
      assignment.weight = { unit: "g", value: "42" };
    vi.mocked(createCatalogMaterial).mockResolvedValue({
      ok: true,
      material: {
        id: 2000,
        name: "New metal",
        slug: "new-metal",
        description: null,
        images: [],
        specifics: [],
      },
    });
    vi.mocked(saveCatalogProduct).mockResolvedValue({ ok: true, product });
    await act(async () =>
      root.render(
        <ProductEditor
          initialProduct={product}
          options={options}
          productTypeSlug="spinner"
        />,
      ),
    );
    await click(container, "Add to material list");
    const dialog = [...container.querySelectorAll("dialog")].find(
      (node) => node.open,
    );
    if (!dialog) throw new Error("Missing material-list creation dialog.");
    await act(async () => edit(input(dialog, "Name"), "New metal"));
    await click(dialog, "Add to material list");
    expect(createCatalogMaterial).toHaveBeenCalledExactlyOnceWith({
      data: { name: "New metal" },
    });
    expect(dialog.open).toBe(false);
    await act(async () =>
      container
        .querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(saveCatalogProduct).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        data: expect.objectContaining({
          materialAssignments: product.materials.map(
            ({ materials, weight }) => ({
              weight: weight ?? { unit: "g", value: "" },
              materials: materials.map(({ id, specific }) => ({
                materialId: id,
                materialSpecificId: specific?.id ?? null,
              })),
            }),
          ),
        }),
      }),
    );
  });

  it("preserves an open part draft through Activity cleanup and returns focus on cancellation", async () => {
    const product = productFixture(1000, "Pen", "pen");
    product.interchangeableParts = {
      tip: true,
      clip: false,
      topCap: false,
      actuator: false,
      mechanism: false,
    };
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
      (node) => node.textContent === "Add pen tip",
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
  it.each([
    ["untouched", null, "Catalog description", ""],
    ["edited", null, "My personal description", "My personal description"],
    ["blank", null, "", ""],
    [
      "existing override",
      "My saved override",
      "My saved override",
      "My saved override",
    ],
    [
      "explicit override matching catalog",
      "Catalog description",
      "Catalog description",
      "Catalog description",
    ],
  ])("preserves %s description semantics when editing", async (_case, originalOverride, edited, expected) => {
    const product = {
      ...productFixture(1000, "Spinner", "spinner"),
      description: "Catalog description",
    };
    const item = {
      ...collectionFixture(42, product, 1003),
      descriptionOverride: originalOverride,
    };
    vi.mocked(updateCollectionItem).mockResolvedValue({ ok: true });
    await act(async () =>
      root.render(
        <CollectionEditPage
          buttonProducts={[]}
          collections={[collection]}
          item={item}
          options={options}
          ownedButtons={[]}
          product={product}
        />,
      ),
    );
    const editor = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Description"]',
    );
    if (!editor) throw new Error("Missing description");
    expect(editor.value).toBe(originalOverride ?? product.description);
    if (edited !== editor.value)
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value",
        )?.set?.call(editor, edited);
        editor.dispatchEvent(new Event("input", { bubbles: true }));
      });
    await click(container, "Save");
    expect(updateCollectionItem).toHaveBeenCalledWith({
      data: expect.objectContaining({ description: expected }),
    });
  });

  it("prefills a directly selected product without freezing its catalog description", async () => {
    const product = {
      ...productFixture(1000, "Spinner", "spinner"),
      description: "Catalog description",
    };
    vi.mocked(addCollectionProduct).mockResolvedValue({
      ok: true,
      collectionId: 1000,
      collectionItemId: 42,
    });
    await act(async () =>
      root.render(
        <CollectionAddPage
          collections={[collection]}
          defaultCollectionName={null}
          initialProductId={1000}
          options={options}
          products={[product]}
        />,
      ),
    );
    const editor = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Description"]',
    );
    expect(editor?.value).toBe("Catalog description");
    const metadata = [...container.querySelectorAll("details")].find((node) =>
      node.querySelector("summary")?.textContent?.includes("Add price"),
    );
    expect(metadata?.open).toBe(false);
    expect(metadata?.textContent).toContain("Ownership history");
    const images = container.querySelector("#collection-item-images");
    expect(
      images &&
        metadata &&
        Boolean(
          images.compareDocumentPosition(metadata) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ),
    ).toBe(true);
    await click(container, "Add to collection");
    expect(addCollectionProduct).toHaveBeenCalledWith({
      data: expect.objectContaining({ description: "" }),
    });
  });

  it("retains fallback for untouched noncanonical Markdown and shows staff read-only history", async () => {
    const product = {
      ...productFixture(1000, "Spinner", "spinner"),
      description: "_Catalog description_\n",
    };
    vi.mocked(addCollectionProduct).mockResolvedValue({
      ok: true,
      collectionId: 1000,
      collectionItemId: 42,
    });
    await act(async () =>
      root.render(
        <CollectionAddPage
          collections={[collection]}
          defaultCollectionName={null}
          initialProductId={1000}
          options={options}
          products={[product]}
        />,
      ),
    );
    await click(container, "Add to collection");
    expect(addCollectionProduct).toHaveBeenCalledWith({
      data: expect.objectContaining({ description: "" }),
    });
    const item = {
      ...collectionFixture(42, product, 1003),
      isOwner: false,
      canAdminister: true,
    };
    vi.spyOn(window, "prompt").mockReturnValue("Reviewed");
    vi.mocked(updateCollectionItem).mockResolvedValue({ ok: true });
    await act(async () =>
      root.render(
        <CollectionEditPage
          buttonProducts={[]}
          collections={[collection]}
          item={item}
          options={options}
          ownedButtons={[]}
          product={product}
        />,
      ),
    );
    const history = [...container.querySelectorAll("fieldset")].find(
      (node) =>
        node.querySelector("legend")?.textContent === "Ownership history",
    );
    expect(history?.closest("fieldset[disabled]")).not.toBeNull();
    expect(history?.closest("details")?.open).toBe(true);
    await click(container, "Save");
    expect(updateCollectionItem).toHaveBeenCalledWith({
      data: expect.objectContaining({ description: "", reason: "Reviewed" }),
    });
  });

  it("retains a clamped product page when catalog results shrink and expand", async () => {
    const products = Array.from({ length: 13 }, (_, index) =>
      productFixture(1000 + index, `Spinner ${index + 1}`, "spinner"),
    );
    /**
     * Renders new catalog results without replacing the collection draft.
     * @param catalogProducts - Current catalog result source.
     * @returns The same collection form with updated available products.
     */
    const tree = (catalogProducts: typeof products) => (
      <CollectionAddPage
        collections={[collection]}
        defaultCollectionName={null}
        initialProductId={1000}
        options={options}
        products={catalogProducts}
      />
    );
    await act(async () => root.render(tree(products)));
    const summary = container.querySelector("summary");
    if (!summary) throw new Error("Missing product selector summary");
    await act(async () => summary.click());
    await click(container, "Next page");
    expect(container.textContent).toContain("Page 2 of 2");
    await act(async () => root.render(tree(products.slice(0, 1))));
    expect(container.textContent).not.toContain("Previous page");
    expect(container.textContent).not.toContain("Next page");
    await act(async () => root.render(tree(products)));
    expect(container.textContent).toContain("Page 1 of 2");
    const previous = [...container.querySelectorAll("button")].find(
      (node) => node.textContent === "Previous page",
    );
    expect(previous?.disabled).toBe(true);
  });

  it("keeps saving eligible when the currently selected product is chosen again", async () => {
    const product = productFixture(1000, "Spinner", "spinner");
    await act(async () =>
      root.render(
        <CollectionAddPage
          collections={[collection]}
          defaultCollectionName={null}
          initialProductId={1000}
          options={options}
          products={[product]}
        />,
      ),
    );
    const summary = container.querySelector("summary");
    if (!summary) throw new Error("Missing product chooser disclosure");
    await act(async () => summary.click());
    await click(container, "Spinner");
    const add = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Add to collection",
    );
    expect(add?.disabled).toBe(false);
    expect(addCollectionProduct).not.toHaveBeenCalled();
  });

  it("persists item visibility from controlled add and edit switches", async () => {
    const product = productFixture(1000, "Spinner", "spinner");
    vi.mocked(addCollectionProduct).mockResolvedValue({
      ok: true,
      collectionId: 1000,
      collectionItemId: 42,
    });
    await act(async () =>
      root.render(
        <CollectionAddPage
          collections={[collection]}
          defaultCollectionName={null}
          initialProductId={1000}
          options={options}
          products={[product]}
        />,
      ),
    );
    const addSwitch = [
      ...container.querySelectorAll<HTMLButtonElement>(
        '[role="switch"][aria-label="Public"]',
      ),
    ].find((node) => !node.closest("dialog"));
    expect(addSwitch?.getAttribute("aria-checked")).toBe("true");
    await act(async () => addSwitch?.click());
    expect(addCollectionProduct).not.toHaveBeenCalled();
    await click(container, "Add to collection");
    expect(addCollectionProduct).toHaveBeenCalledWith({
      data: expect.objectContaining({ isPrivate: true }),
    });
    const item = {
      ...collectionFixture(42, product, 1003),
      isOwner: true,
      isPrivate: true,
    };
    vi.mocked(updateCollectionItem).mockResolvedValue({ ok: true });
    await act(async () =>
      root.render(
        <CollectionEditPage
          buttonProducts={[]}
          collections={[collection]}
          item={item}
          options={options}
          ownedButtons={[]}
          product={product}
        />,
      ),
    );
    const editSwitch = collectionVisibilitySwitch(container);
    expect(editSwitch?.getAttribute("aria-checked")).toBe("false");
    await act(async () => editSwitch?.click());
    expect(updateCollectionItem).not.toHaveBeenCalled();
    await click(container, "Save");
    expect(updateCollectionItem).toHaveBeenCalledWith({
      data: expect.objectContaining({ isPrivate: false }),
    });
  });

  it("locks effective visibility off for a private collection", async () => {
    const product = productFixture(1000, "Spinner", "spinner");
    vi.mocked(addCollectionProduct).mockResolvedValue({
      ok: true,
      collectionId: 1000,
      collectionItemId: 42,
    });
    await act(async () =>
      root.render(
        <CollectionAddPage
          collections={[{ ...collection, isPrivate: true }]}
          defaultCollectionName={null}
          initialProductId={1000}
          options={options}
          products={[product]}
        />,
      ),
    );
    const control = [
      ...container.querySelectorAll<HTMLButtonElement>(
        '[role="switch"][aria-label="Public"]',
      ),
    ].find((node) => !node.closest("dialog"));
    expect(control?.getAttribute("aria-disabled")).toBe("true");
    expect(control?.getAttribute("aria-checked")).toBe("false");
    await click(container, "Add to collection");
    expect(addCollectionProduct).toHaveBeenCalledWith({
      data: expect.objectContaining({ isPrivate: true }),
    });
  });

  it.each([
    { isAdminPrivate: true },
    { privacyInheritedFromItemId: 70 },
  ])("keeps constrained visibility unchanged while saving item details", async (constraint) => {
    const product = productFixture(1000, "Spinner", "spinner");
    const item = {
      ...collectionFixture(42, product, 1003),
      isOwner: true,
      isPrivate: true,
      ...constraint,
    };
    vi.mocked(updateCollectionItem).mockResolvedValue({ ok: true });
    await act(async () =>
      root.render(
        <CollectionEditPage
          buttonProducts={[]}
          collections={[collection]}
          item={item}
          options={options}
          ownedButtons={[]}
          product={product}
        />,
      ),
    );
    const control = collectionVisibilitySwitch(container);
    expect(control?.getAttribute("aria-disabled")).toBe("true");
    expect(control?.getAttribute("aria-checked")).toBe("false");
    await click(container, "Save");
    const data = vi.mocked(updateCollectionItem).mock.calls[0]?.[0]?.data;
    expect(data).not.toHaveProperty("isPrivate");
  });

  it("does not persist a toggled item when editing is canceled", async () => {
    const product = productFixture(1000, "Spinner", "spinner");
    const item = { ...collectionFixture(42, product, 1003), isOwner: true };
    await act(async () =>
      root.render(
        <CollectionEditPage
          buttonProducts={[]}
          collections={[collection]}
          item={item}
          options={options}
          ownedButtons={[]}
          product={product}
        />,
      ),
    );
    await act(async () => collectionVisibilitySwitch(container).click());
    const cancel = [...container.querySelectorAll("button")].find(
      (node) => node.textContent === "Cancel" && !node.closest("dialog"),
    );
    await act(async () => cancel?.click());
    expect(updateCollectionItem).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("keeps nonowner ownership switches read-only and out of the tab order", async () => {
    const product = productFixture(1000, "Spinner", "spinner");
    const item = { ...collectionFixture(42, product, 1003), isOwner: false };
    await act(async () =>
      root.render(
        <CollectionEditPage
          buttonProducts={[]}
          collections={[collection]}
          item={item}
          options={options}
          ownedButtons={[]}
          product={product}
        />,
      ),
    );
    for (const label of ["Acquisition date unknown", "Currently owned"]) {
      const control = container.querySelector<HTMLElement>(
        `[role="switch"][aria-label="${label}"]`,
      );
      expect(control?.getAttribute("aria-disabled")).toBe("true");
      expect(control?.tabIndex).toBe(-1);
    }
  });

  it("confirms duplicates and preserves the collection-item creation payload", async () => {
    const product = productFixture(1000, "Spinner", "spinner");
    vi.mocked(addCollectionProduct)
      .mockResolvedValueOnce({
        ok: false,
        requiresConfirmation: true,
        duplicateCounts: { 1000: 1 },
      })
      .mockResolvedValueOnce({
        ok: true,
        collectionItemId: 42,
        collectionId: 1000,
      });
    await act(async () =>
      root.render(
        <CollectionAddPage
          collections={[collection]}
          defaultCollectionName={null}
          initialProductId={1000}
          options={options}
          products={[product]}
        />,
      ),
    );
    await click(container, "Add to collection");
    expect(addCollectionProduct).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    await click(
      container,
      formatTranslation("web.action.confirmAdd", {}, "en-US"),
    );
    expect(addCollectionProduct).toHaveBeenCalledTimes(2);
    expect(addCollectionProduct).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        confirmed: true,
        productId: 1000,
        collectionId: 1000,
        materialAssignmentId: 1001,
        finishOptionId: 1003,
        productTypeSlug: "spinner",
      }),
    });
    expect(navigate).toHaveBeenCalledExactlyOnceWith({
      params: { collectionId: 1000 },
      to: "/user/collections/$collectionId",
    });
  });

  it("does not replay a pending collection creation across Activity resumption", async () => {
    const product = productFixture(1000, "Spinner", "spinner");
    /**
     * Completes the pending creation response.
     * @param value - Server result supplied by the test.
     * @returns Nothing.
     */
    let complete: (
      value: Awaited<ReturnType<typeof addCollectionProduct>>,
    ) => void = (value) => {
      void value;
    };
    const pending = new Promise<
      Awaited<ReturnType<typeof addCollectionProduct>>
    >((resolve) => {
      complete = resolve;
    });
    vi.mocked(addCollectionProduct).mockReturnValue(pending);
    /**
     * Keeps one creation workflow alive across Activity visibility changes.
     * @param mode - Activity visibility.
     * @returns Wrapped creation page.
     */
    const tree = (mode: "visible" | "hidden") => (
      <StrictMode>
        <Activity mode={mode}>
          <CollectionAddPage
            collections={[collection]}
            defaultCollectionName={null}
            initialProductId={1000}
            options={options}
            products={[product]}
          />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(tree("visible")));
    await click(container, "Add to collection");
    await act(async () => root.render(tree("hidden")));
    await act(async () =>
      complete({ ok: true, collectionId: 1000, collectionItemId: 42 }),
    );
    expect(navigate).not.toHaveBeenCalled();
    await act(async () => root.render(tree("visible")));
    expect(addCollectionProduct).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    await act(async () => root.render(tree("hidden")));
    await act(async () => root.render(tree("visible")));
    expect(addCollectionProduct).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("keeps failed collection-item drafts and uploads images before updating details", async () => {
    const product = productFixture(1000, "Spinner", "spinner");
    const item = collectionFixture(42, product, 1003);
    const file = new File(["image"], "owned.png", { type: "image/png" });
    vi.mocked(uploadImages).mockResolvedValue({ uploaded: [file], failed: [] });
    vi.mocked(updateCollectionItem)
      .mockResolvedValueOnce({
        ok: false,
        requiresConfirmation: false,
        formError: "web.catalog.error.form",
        fieldErrors: {},
      })
      .mockResolvedValueOnce({ ok: true });
    await act(async () =>
      root.render(
        <CollectionEditPage
          buttonProducts={[]}
          collections={[collection]}
          item={item}
          options={options}
          ownedButtons={[]}
          product={product}
        />,
      ),
    );
    await act(async () =>
      edit(input(container, "Display name"), "Retained owned draft"),
    );
    await chooseFiles(container, "collection-edit-images", [file]);
    await click(container, "Save");
    expect(navigate).not.toHaveBeenCalled();
    expect(input(container, "Display name").value).toBe("Retained owned draft");
    expect(uploadImages).toHaveBeenCalledTimes(1);
    expect(vi.mocked(uploadImages).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(updateCollectionItem).mock.invocationCallOrder[0] ?? 0,
    );
    await click(container, "Save");
    expect(updateCollectionItem).toHaveBeenCalledTimes(2);
    expect(uploadImages).toHaveBeenCalledTimes(1);
    expect(updateCollectionItem).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        displayName: "Retained owned draft",
        collectionId: 1000,
        collectionItemId: 42,
        finishOptionId: null,
        materialAssignmentId: 1001,
      }),
    });
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("retains upload-only collection-item saves when detail fields are invalid", async () => {
    const product = productFixture(1000, "Spinner", "spinner");
    const item = collectionFixture(42, product, 1003);
    const file = new File(["image"], "only.png", { type: "image/png" });
    vi.mocked(uploadImages).mockResolvedValue({ uploaded: [file], failed: [] });
    await act(async () =>
      root.render(
        <CollectionEditPage
          buttonProducts={[]}
          collections={[collection]}
          item={item}
          options={options}
          ownedButtons={[]}
          product={product}
        />,
      ),
    );
    await act(async () => edit(input(container, "Display name"), ""));
    await chooseFiles(container, "collection-edit-images", [file]);
    await click(container, "Save");
    expect(uploadImages).toHaveBeenCalledTimes(1);
    expect(updateCollectionItem).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("retains the created collection identifier when initial images fail and metadata is retried", async () => {
    const file = new File(["image"], "cover.png", { type: "image/png" });
    vi.mocked(saveCollection).mockResolvedValue({ ok: true, collection });
    vi.mocked(uploadImages)
      .mockResolvedValueOnce({ uploaded: [], failed: [file] })
      .mockResolvedValueOnce({ uploaded: [file], failed: [] });
    await act(async () => root.render(<CollectionFormPage />));
    const name = [...container.querySelectorAll("input")].find(
      (node) => node.type === "text",
    );
    if (!name) throw new Error("Missing collection name");
    await act(async () => edit(name, "Daily Carry"));
    await chooseFiles(container, "collection-images", [file]);
    await click(container, "Save");
    expect(navigate).not.toHaveBeenCalled();
    expect(name.value).toBe("Daily Carry");
    expect(container.textContent).toContain("cover.png");
    await click(container, "Save");
    expect(saveCollection).toHaveBeenCalledTimes(2);
    expect(saveCollection).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        collectionId: 1000,
        name: "Daily Carry",
      }),
    });
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("retains lifecycle confirmation fields after failure and allows a repeat deletion", async () => {
    const commit = vi
      .fn<Parameters<typeof CollectionDeletionSection>[0]["onSubmit"]>()
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce();
    await act(async () =>
      root.render(
        <CollectionDeletionSection
          collection={collection}
          destinations={[]}
          itemCount={2}
          onSubmit={commit}
        />,
      ),
    );
    await click(
      container,
      formatTranslation("web.collections.deletion.open", {}, "en-US"),
    );
    const radio = container.querySelector<HTMLInputElement>(
      'input[value="delete"]',
    );
    if (!radio) throw new Error("Missing deletion choice");
    await act(async () => radio.click());
    const confirm = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    if (!confirm) throw new Error("Missing deletion confirmation");
    await act(async () => confirm.click());
    const submit = container.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    if (!submit) throw new Error("Missing deletion submission");
    await act(async () => submit.click());
    expect(confirm.checked).toBe(true);
    expect(submit.disabled).toBe(false);
    await act(async () => submit.click());
    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenLastCalledWith("delete", null, undefined);
  });
});
