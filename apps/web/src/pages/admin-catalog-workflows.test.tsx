import { formatTranslation } from "@pocket-trash/localizations";
/** @vitest-environment jsdom */

import type {
  AdminMaterial,
  CatalogImage,
  CatalogImageTrashItem,
  CatalogMaker,
  SliderMagnetPreset,
} from "@package/services";
import {
  Activity,
  act,
  type ReactNode,
  StrictMode,
  useCallback,
  useImperativeHandle,
  useRef,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MarkdownEditorHandle } from "@/components/markdown-editor";
import { uniformMagnetConfiguration } from "@/components/slider-magnet-configuration-editor";
import {
  createSliderMagnetPreset,
  deleteSliderMagnetPreset,
  getAdminMaterial,
  restoreCatalogImage,
  saveAdminMaker,
  saveAdminMaterial,
  saveAdminMaterialSpecific,
  softDeleteCatalogImage,
  updateSliderMagnetPreset,
} from "@/lib/catalog-api";
import { uploadImages } from "@/lib/upload-sessions";
import { AdminMakerFormPage } from "./admin-makers-page";
import { AdminMaterialFormPage } from "./admin-material-pages";
import { AdminSettingsPage } from "./admin-settings-page";
import { AdminSliderMagnetPresetsPage } from "./admin-slider-magnet-presets-page";
import { CatalogImageTrashPage } from "./catalog-image-trash-page";

/** Current account and route/integration observers. */
const session = vi.hoisted(() => ({
  userId: "user_a",
  navigate: vi.fn(),
  createExternalAccount: vi.fn(),
}));
vi.mock("@clerk/tanstack-react-start", () => ({
  /** Supplies the current authoring account.
   * @returns Token and account context. */
  useAuth: () => ({ userId: session.userId, getToken: vi.fn() }),
  /** Supplies the current integration account.
   * @returns User integration context. */
  useUser: () => ({
    isLoaded: true,
    user: {
      id: session.userId,
      externalAccounts: [],
      createExternalAccount: session.createExternalAccount,
    },
  }),
  /**
   * Keeps Clerk's reverification boundary callable in this fixture.
   * @param callback - Existing integration action.
   * @returns Existing action unchanged.
   */
  useReverification: (callback: (action: string) => Promise<unknown>) =>
    callback,
}));
vi.mock("@tanstack/react-router", () => ({
  /** Supplies navigation feedback.
   * @returns Navigation spy. */
  useNavigate: () => session.navigate,
  /**
   * Renders a context-free link.
   * @param props - Link content and destination.
   * @returns Plain anchor.
   */
  Link: ({
    children,
    to,
  }: {
    /** Link content. */
    children?: ReactNode;
    /** Link destination. */
    to: string;
  }) => <a href={to}>{children}</a>,
}));
vi.mock("@/providers/locale-provider", () => ({
  /** Supplies existing localized copy.
   * @returns English locale context. */
  useLocale: () => ({ locale: "en-US" }),
}));
vi.mock("@/components/admin-page-shell", () => ({
  /**
   * Keeps tests focused on the route workflow.
   * @param props - Route content.
   * @returns Route content.
   */
  AdminPageShell: ({
    children,
  }: {
    /** Nested route content. */
    children: ReactNode;
  }) => children,
}));
vi.mock("@/lib/catalog-api", async (original) => ({
  ...(await original<object>()),
  createSliderMagnetPreset: vi.fn(),
  deleteSliderMagnetPreset: vi.fn(),
  getAdminMaterial: vi.fn(),
  restoreCatalogImage: vi.fn(),
  saveAdminMaker: vi.fn(),
  saveAdminMaterial: vi.fn(),
  saveAdminMaterialSpecific: vi.fn(),
  softDeleteCatalogImage: vi.fn(),
  updateSliderMagnetPreset: vi.fn(),
}));
vi.mock("@/lib/upload-sessions", async (original) => ({
  ...(await original<object>()),
  uploadImages: vi.fn(),
}));

/**
 * Reports readiness through a commit ref while exposing the existing editor handle.
 * @param props - Markdown consumer contract.
 * @returns Editable Markdown fixture.
 */
function ReadyEditor({
  defaultValue = "",
  onChange,
  onLoadingChange,
  ref,
}: {
  /** Initial Markdown document. */
  defaultValue?: string;
  /** Existing editor handle. */
  ref?: React.Ref<MarkdownEditorHandle>;
  /** Receives document changes.
   * @param value - Current Markdown. */
  onChange(value: string): void;
  /** Receives editor readiness.
   * @param loading - Whether initialization is pending. */
  onLoadingChange(loading: boolean): void;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({
    /** Reads current Markdown.
     * @returns Current document. */
    getValue: () => field.current?.value ?? defaultValue,
    /** Reports fixture readiness.
     * @returns False after commit. */
    isLoading: () => false,
    /** Focuses the fixture document.
     * @returns Nothing. */
    focus: () => field.current?.focus(),
  }));
  /**
   * Reports committed editor readiness.
   * @param node - Current textarea node.
   */
  const bind = useCallback(
    (node: HTMLTextAreaElement | null) => {
      field.current = node;
      if (node) onLoadingChange(false);
    },
    [onLoadingChange],
  );
  return (
    <textarea
      aria-label="Markdown"
      defaultValue={defaultValue}
      ref={bind}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
vi.mock("@/components/catalog-markdown-editor", () => ({
  CatalogMarkdownEditor: ReadyEditor,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/** Existing canonical maker profile. */
const maker: CatalogMaker = {
  id: 77,
  name: "Maker",
  slug: "maker",
  rootUrl: null,
  description: "Profile",
  images: [],
};
/** Existing canonical material profile. */
const material: AdminMaterial = {
  id: 88,
  name: "Material",
  slug: "material",
  description: "Profile",
  images: [],
  specifics: [],
};
/** Persisted catalog image. */
const image: CatalogImage = {
  id: 11,
  fileName: "lead.png",
  contentType: "image/png",
  createdAt: new Date("2026-10-01"),
  deletedAt: null,
  deletedByClerkId: null,
  deletedByRole: null,
  objectPath: "images/lead.png",
  position: 0,
  size: 3,
  url: "https://example.test/lead.png",
};
/** Existing reusable configuration. */
const preset: SliderMagnetPreset = {
  id: 99,
  name: "Preset",
  magnetLayout: "2x4",
  configuration: uniformMagnetConfiguration("2x4", "N52"),
};

/**
 * Changes a native field through React's browser event path.
 * @param field - Mounted input or textarea.
 * @param value - Current field value.
 * @rejects When the expected field is absent.
 */
async function change(
  field: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
) {
  if (!field) throw new Error("Expected field");
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value",
    )?.set?.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
/**
 * Selects new files through the consumer's native picker.
 * @param field - Mounted picker.
 * @param files - Current selected files.
 * @rejects When the expected picker is absent.
 */
async function selectFiles(field: HTMLInputElement | null, files: File[]) {
  if (!field) throw new Error("Expected picker");
  await act(async () => {
    Object.defineProperty(field, "files", { configurable: true, value: files });
    field.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("catalog administration workflows", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.resetAllMocks();
    session.userId = "user_a";
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "prompt").mockReturnValue(" Staff reason ");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });
  /**
   * Clicks an existing command by its exact visible copy.
   * @param text - Existing command copy.
   * @rejects When the expected command is absent.
   */
  async function click(text: string) {
    const button = [...container.querySelectorAll("button")].find(
      (node) => node.textContent?.trim() === text,
    );
    if (!button) throw new Error(`Expected command: ${text}`);
    await act(async () => button.click());
  }
  /**
   * Submits the mounted authoring form.
   * @rejects When the expected form is absent.
   */
  async function submit() {
    const form = container.querySelector("form");
    if (!form) throw new Error("Expected form");
    await act(async () =>
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
  }

  it("keeps maker fields and files after upload failure and retries the created identity", async () => {
    vi.mocked(saveAdminMaker).mockResolvedValue({ ok: true, maker });
    vi.mocked(uploadImages)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ uploaded: [], failed: [] });
    await act(async () => root.render(<AdminMakerFormPage />));
    await change(
      container.querySelector('input:not([readonly]):not([type="file"])'),
      "Maker",
    );
    const file = new File(["png"], "new.png", { type: "image/png" });
    await selectFiles(container.querySelector('input[type="file"]'), [file]);
    await submit();
    expect(saveAdminMaker).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "Maker", makerId: null }),
    });
    expect(container.textContent).toContain("new.png");
    expect(session.navigate).not.toHaveBeenCalled();
    await submit();
    expect(saveAdminMaker).toHaveBeenLastCalledWith({
      data: expect.objectContaining({ name: "Maker", makerId: 77 }),
    });
    expect(uploadImages).toHaveBeenCalledTimes(2);
    expect(session.navigate).toHaveBeenCalledTimes(1);
  });

  it("retains only failed maker uploads after partial completion", async () => {
    vi.mocked(saveAdminMaker).mockResolvedValue({ ok: true, maker });
    const uploaded = new File(["one"], "one.png", { type: "image/png" });
    const failed = new File(["two"], "two.png", { type: "image/png" });
    vi.mocked(uploadImages)
      .mockResolvedValueOnce({ uploaded: [], failed: [failed] })
      .mockResolvedValueOnce({ uploaded: [], failed: [] });
    await act(async () => root.render(<AdminMakerFormPage maker={maker} />));
    await selectFiles(container.querySelector('input[type="file"]'), [
      uploaded,
      failed,
    ]);
    await submit();
    expect(session.navigate).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("one.png");
    expect(container.textContent).toContain("two.png");
    await submit();
    expect(uploadImages).toHaveBeenLastCalledWith(
      expect.objectContaining({ files: [failed] }),
    );
    expect(session.navigate).toHaveBeenCalledTimes(1);
  });

  it("preserves material failed files, scope and name through save/upload retry", async () => {
    vi.mocked(saveAdminMaterial).mockResolvedValue({ ok: true, material });
    vi.mocked(getAdminMaterial).mockResolvedValue(material);
    const file = new File(["png"], "material.png", { type: "image/png" });
    vi.mocked(uploadImages)
      .mockResolvedValueOnce({ uploaded: [], failed: [file] })
      .mockResolvedValueOnce({ uploaded: [], failed: [] });
    await act(async () =>
      root.render(<AdminMaterialFormPage initialMaterial={material} />),
    );
    await change(
      container.querySelector('input:not([readonly]):not([type="file"])'),
      "Updated material",
    );
    await selectFiles(container.querySelector('input[type="file"]'), [file]);
    await click("Save");
    expect(container.textContent).toContain("material.png");
    expect(
      container.querySelector<HTMLInputElement>("input:not([readonly])")?.value,
    ).toBe("Updated material");
    await click("Save");
    expect(uploadImages).toHaveBeenLastCalledWith(
      expect.objectContaining({
        files: [file],
        targetType: "material",
        targetId: 88,
        materialSpecificId: null,
      }),
    );
    expect(container.textContent).not.toContain("material.png");
    expect(container.textContent).toContain("Material saved");
  });

  it("retains material-specific fields after server failure and publishes only the selected editor's success", async () => {
    vi.mocked(saveAdminMaterialSpecific)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        ok: true,
        specific: {
          id: 101,
          name: "Grade",
          slug: "grade",
          description: "Grade profile",
          materialId: 88,
        },
      });
    await act(async () =>
      root.render(<AdminMaterialFormPage initialMaterial={material} />),
    );
    await click(formatTranslation("web.materials.specific.add", {}, "en-US"));
    const fields = container.querySelectorAll<HTMLInputElement>(
      'input:not([readonly]):not([type="file"]):not([role="combobox"])',
    );
    await change(fields[fields.length - 1] ?? null, "Grade");
    const buttons = [...container.querySelectorAll("button")].filter(
      (node) => node.textContent?.trim() === "Save",
    );
    await act(async () => buttons[0]?.click());
    expect(saveAdminMaterialSpecific).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector<HTMLInputElement>('input[value="Grade"]')?.value,
    ).toBe("Grade");
    await act(async () => buttons[0]?.click());
    expect(saveAdminMaterialSpecific).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Grade");
  });

  it("retries a failed canonical image refresh without repeating its committed archive", async () => {
    vi.mocked(softDeleteCatalogImage).mockResolvedValue(undefined);
    vi.mocked(getAdminMaterial)
      .mockRejectedValueOnce(new Error("refresh offline"))
      .mockResolvedValueOnce({
        ...material,
        images: [
          {
            ...image,
            deletedAt: new Date("2026-10-02"),
            deletedByRole: "admin",
          },
        ],
      });
    await act(async () =>
      root.render(
        <AdminMaterialFormPage
          initialMaterial={{ ...material, images: [image] }}
        />,
      ),
    );
    await click(formatTranslation("web.action.deleteImage", {}, "en-US"));
    expect(softDeleteCatalogImage).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    await click(formatTranslation("web.action.deleteImage", {}, "en-US"));
    expect(softDeleteCatalogImage).toHaveBeenCalledTimes(1);
    expect(getAdminMaterial).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain(
      formatTranslation("web.materials.image.restore", {}, "en-US"),
    );
  });

  it("populates an existing preset, updates its identity, and resets create defaults after save/cancel", async () => {
    vi.mocked(updateSliderMagnetPreset).mockResolvedValue({
      ok: true,
      preset: { ...preset, name: "Renamed preset" },
    });
    await act(async () =>
      root.render(<AdminSliderMagnetPresetsPage initialPresets={[preset]} />),
    );
    await click("Edit");
    expect(container.querySelector("input")?.value).toBe("Preset");
    await change(container.querySelector("input"), "Renamed preset");
    await submit();
    expect(updateSliderMagnetPreset).toHaveBeenCalledExactlyOnceWith({
      data: {
        presetId: 99,
        name: "Renamed preset",
        magnetLayout: "2x4",
        configuration: preset.configuration,
      },
    });
    expect(container.querySelector("input")?.value).toBe("");
    await click("Edit");
    expect(container.querySelector("input")?.value).toBe("Renamed preset");
    await click("Cancel");
    expect(container.querySelector("input")?.value).toBe("");
    expect(container.querySelector("select")?.value).toBe("2x4");
  });

  it("keeps one confirmed preset save across StrictMode/Activity and leaves failed deletion retryable", async () => {
    /** Completes the pending preset creation.
     * @param value - Canonical creation result.
     * @returns Nothing. */
    let complete: (
      value: Awaited<ReturnType<typeof createSliderMagnetPreset>>,
    ) => void = (value) => {
      void value;
    };
    vi.mocked(createSliderMagnetPreset).mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    /**
     * Preserves one reusable-preset consumer.
     * @param mode - Activity visibility.
     * @returns Strict preset administration.
     */
    const tree = (mode: "visible" | "hidden") => (
      <StrictMode>
        <Activity mode={mode}>
          <AdminSliderMagnetPresetsPage initialPresets={[]} />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(tree("visible")));
    await change(container.querySelector("input"), "Preset");
    await submit();
    await act(async () => root.render(tree("hidden")));
    await act(async () => complete({ ok: true, preset }));
    await act(async () => root.render(tree("visible")));
    expect(createSliderMagnetPreset).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll("li")).toHaveLength(1);
    vi.mocked(deleteSliderMagnetPreset)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: true });
    await click("Delete");
    expect(container.querySelectorAll("li")).toHaveLength(1);
    await click("Delete");
    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(deleteSliderMagnetPreset).toHaveBeenCalledTimes(2);
  });

  it("keeps failed image restores retryable and ignores old-account integration results", async () => {
    const deleted: CatalogImageTrashItem = {
      ...image,
      deletedAt: new Date("2026-10-02"),
      ownerClerkId: null,
      targetId: 77,
      targetType: "maker",
      targetName: "Maker",
    };
    vi.mocked(restoreCatalogImage)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    await act(async () =>
      root.render(<CatalogImageTrashPage initialImages={[deleted]} />),
    );
    await click("Restore");
    expect(container.querySelectorAll("article")).toHaveLength(1);
    await click("Restore");
    expect(restoreCatalogImage).toHaveBeenLastCalledWith({
      data: { imageId: 11, targetType: "maker", reason: "Staff reason" },
    });
    expect(container.querySelectorAll("article")).toHaveLength(0);
    /** Completes the old account integration action. */
    let complete = () => {};
    session.createExternalAccount.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
    );
    await act(async () => root.render(<AdminSettingsPage />));
    await click("Connect Linear");
    session.userId = "user_b";
    await act(async () => root.render(<AdminSettingsPage />));
    await act(async () => complete());
    expect(container.querySelector("button")?.disabled).toBe(false);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
