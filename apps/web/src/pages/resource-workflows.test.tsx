/** @vitest-environment jsdom */

import { Activity, act, type ReactNode, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResourceVisibilityToggle } from "@/components/resource-visibility-toggle";
import {
  markResourceNotificationRead,
  markResourcePrivate,
  permanentlyDeleteResource,
  restoreResource,
  softDeleteResource,
  updateResource,
} from "@/lib/resources";
import { uploadResourceSession } from "@/lib/upload-sessions";
import { AdminResourceNotificationsPage } from "./admin-resource-notifications-page";
import { ResourceDetailPage } from "./resource-detail-page";
import {
  ResourceEditPage,
  ResourceVersionUploadPage,
} from "./resource-management-pages";
import {
  AdminResourceTrashPage,
  OwnerResourceTrashPage,
} from "./resource-trash-page";
import { ResourceUploadPage } from "./resource-upload-page";

/** Current account and route observers. */
const session = vi.hoisted(() => ({
  userId: "user_a",
  navigate: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("@clerk/tanstack-react-start", () => ({
  /** Supplies the current account.
   * @returns Current test account. */
  useAuth: () => ({
    userId: session.userId,
    getToken: vi.fn(),
    sessionClaims: { role: "admin" },
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  /** Supplies navigation feedback.
   * @returns Navigation observer. */
  useNavigate: () => session.navigate,
  /** Supplies loader refresh feedback.
   * @returns Loader refresh observer. */
  useRouter: () => ({ invalidate: session.invalidate }),
  /**
   * Renders a link without a router context.
   * @param props - Public link properties.
   * @returns Anchor content.
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
  /** Supplies the test locale.
   * @returns English locale context. */
  useLocale: () => ({ locale: "en-US" }),
}));
vi.mock("@/components/app-shell", () => ({
  /**
   * Renders route content without unrelated shell controls.
   * @param props - Nested route content.
   * @returns Route content.
   */
  AppShell: ({
    children,
  }: {
    /** Route content. */
    children: ReactNode;
  }) => children,
}));
vi.mock("@/components/user-page-shell", () => ({
  /**
   * Renders user route content.
   * @param props - Nested route content.
   * @returns Route content.
   */
  UserPageShell: ({
    children,
  }: {
    /** Route content. */
    children: ReactNode;
  }) => children,
}));
vi.mock("@/components/admin-page-shell", () => ({
  /**
   * Renders admin route content.
   * @param props - Nested route content.
   * @returns Route content.
   */
  AdminPageShell: ({
    children,
  }: {
    /** Route content. */
    children: ReactNode;
  }) => children,
}));
vi.mock("@/components/resource-category-input", () => ({
  /**
   * Exposes the category consumer contract without its separately tested lookup.
   * @param props - Current category selection and callback.
   * @returns Category selection command.
   */
  ResourceCategoryInput: ({
    onChange,
  }: {
    /**
     * Publishes selected categories.
     * @param categories - Current category names.
     */
    onChange(categories: string[]): void;
  }) => (
    <button type="button" onClick={() => onChange(["3D printing"])}>
      Choose category
    </button>
  ),
}));
vi.mock("@/lib/resources", async (original) => ({
  ...(await original<object>()),
  markResourceNotificationRead: vi.fn(),
  markResourcePrivate: vi.fn(),
  permanentlyDeleteResource: vi.fn(),
  restoreResource: vi.fn(),
  softDeleteResource: vi.fn(),
  updateResource: vi.fn(),
}));
vi.mock("@/lib/upload-sessions", async (original) => ({
  ...(await original<object>()),
  uploadResourceSession: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/** Fixed resource timestamps. */
const createdAt = new Date("2026-09-16T12:00:00Z");
/** Existing resource file version. */
const version = {
  createdAt,
  downloadCount: 0,
  files: [
    { contentType: "model/stl", fileName: "clip.stl", id: 1002, size: 42 },
  ],
  id: 1001,
  version: 1,
};
/** Complete editable resource contract. */
const detail: React.ComponentProps<typeof ResourceDetailPage>["detail"] = {
  canAdminister: true,
  canEdit: true,
  categories: [{ id: 1002, name: "3D printing", slug: "3d-printing" }],
  createdAt,
  currentVersion: version,
  description: "A useful clip.",
  downloadCount: 0,
  id: 1000,
  images: [],
  isAdminPrivate: false,
  isPrivate: false,
  isOwner: true,
  name: "Pocket clip",
  privateReason: null,
  privatedAt: null,
  uploaderIsProfilePublic: true,
  uploaderUsername: "roy",
  versions: [version],
};
/** Deleted resource contract used by both trash consumers. */
const deleted = {
  deletedAt: createdAt,
  deletedByUsername: "admin",
  deletedByRole: "admin" as const,
  id: 1000,
  isPrivate: false,
  name: "Pocket clip",
  uploaderUsername: "roy",
};
/** Unread resource moderation notification. */
const notification: React.ComponentProps<
  typeof AdminResourceNotificationsPage
>["initialNotifications"][number] = {
  categories: ["3D printing"],
  categoryName: null,
  createdAt,
  id: 1000,
  isPrivate: false,
  readAt: null,
  readByUsername: null,
  resourceId: 1000,
  resourceName: "Pocket clip",
  type: "resource_created",
  uploaderUsername: "roy",
};

/**
 * Changes a controlled native field through React's browser event path.
 * @param field - Mounted input or textarea.
 * @param value - Next field value.
 * @rejects When the expected control is absent.
 */
async function change(
  field: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
) {
  if (!field) throw new Error("Expected field");
  const prototype =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(
      field,
      value,
    );
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
/**
 * Selects a browser file list through the public file input.
 * @param field - Mounted picker.
 * @param files - Selected files.
 * @rejects When the expected control is absent.
 */
async function selectFiles(field: HTMLInputElement | null, files: File[]) {
  if (!field) throw new Error("Expected file picker");
  await act(async () => {
    Object.defineProperty(field, "files", { configurable: true, value: files });
    field.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("resource authoring and moderation lifecycles", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.resetAllMocks();
    session.userId = "user_a";
    session.invalidate.mockResolvedValue(undefined);
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.open = false;
    };
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
   * Clicks the current visible command with exact text.
   * @param label - Existing command copy.
   * @param scope - Optional dialog or row scope.
   * @rejects When the expected control is absent.
   */
  async function click(label: string, scope: ParentNode = container) {
    const button = [...scope.querySelectorAll("button")].find(
      (node) => node.textContent?.trim() === label,
    );
    if (!button) throw new Error(`Expected button: ${label}`);
    await act(async () => button.click());
  }
  /**
   * Submits the existing native authoring form.
   * @param form - Mounted form.
   * @rejects When the expected control is absent.
   */
  async function submit(
    form: HTMLFormElement | null = container.querySelector("form"),
  ) {
    if (!form) throw new Error("Expected form");
    await act(async () =>
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
  }

  it("retains upload fields after validation and service failure and retries the original create payload", async () => {
    vi.mocked(uploadResourceSession)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ resourceId: 1000, version: 1 });
    await act(async () => root.render(<ResourceUploadPage />));
    await change(container.querySelector('[name="name"]'), "Pocket clip");
    await change(
      container.querySelector('[name="description"]'),
      "Draft description",
    );
    await submit();
    expect(uploadResourceSession).not.toHaveBeenCalled();
    await click("Choose category");
    const file = new File(["stl"], "clip.stl", { type: "model/stl" });
    await selectFiles(
      container.querySelector('input[type="file"][accept*=".stl"]'),
      [file],
    );
    const image = new File(["png"], "clip.png", { type: "image/png" });
    await selectFiles(
      container.querySelector('input[type="file"][accept*="image/png"]'),
      [image],
    );
    await submit();
    expect(toast.error).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("clip.stl");
    expect(
      container.querySelector<HTMLInputElement>('[name="name"]')?.value,
    ).toBe("Pocket clip");
    await submit();
    expect(uploadResourceSession).toHaveBeenCalledTimes(2);
    expect(uploadResourceSession).toHaveBeenLastCalledWith(
      expect.objectContaining({
        operation: "create",
        name: "Pocket clip",
        description: "Draft description",
        categories: ["3D printing"],
        files: [file],
        images: [image],
        isPrivate: false,
      }),
    );
    expect(session.navigate).toHaveBeenCalledTimes(1);
  });

  it("retains metadata image selections after failure and captures a fresh multipart retry", async () => {
    vi.mocked(updateResource)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ id: 1000 });
    await act(async () => root.render(<ResourceEditPage detail={detail} />));
    const image = new File(["png"], "clip.png", { type: "image/png" });
    await selectFiles(
      container.querySelector('input[type="file"][accept*="image/png"]'),
      [image],
    );
    await change(container.querySelector('[name="name"]'), "Updated clip");
    await submit();
    expect(updateResource).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("clip.png");
    await submit();
    const data = vi.mocked(updateResource).mock.lastCall?.[0]?.data;
    if (!(data instanceof FormData))
      throw new Error("Expected multipart payload");
    expect(data?.get("name")).toBe("Updated clip");
    expect(data?.getAll("categories")).toEqual(["3D printing"]);
    expect(data?.getAll("images")).toEqual([image]);
    expect(session.navigate).toHaveBeenCalledTimes(1);
  });

  it("validates staff version reasons while preserving files and the original version wire payload", async () => {
    vi.mocked(uploadResourceSession).mockResolvedValue({
      resourceId: 1000,
      version: 2,
    });
    await act(async () =>
      root.render(
        <ResourceVersionUploadPage detail={{ ...detail, isOwner: false }} />,
      ),
    );
    const file = new File(["stl"], "next.stl", { type: "model/stl" });
    await selectFiles(container.querySelector('input[type="file"]'), [file]);
    await submit();
    expect(uploadResourceSession).not.toHaveBeenCalled();
    await change(container.querySelector("textarea"), " Staff update ");
    await submit();
    expect(uploadResourceSession).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "version",
        resourceId: 1000,
        reason: " Staff update ",
        files: [file],
      }),
    );
  });

  it("preserves failed forced-privacy reasons and resumes one pending mutation without replay", async () => {
    vi.mocked(markResourcePrivate).mockRejectedValueOnce(new Error("offline"));
    /** Completes the retried privacy mutation. */
    let complete = () => {};
    /**
     * Preserves one moderation dialog across Activity visibility.
     * @param mode - Activity visibility.
     * @returns Current visibility consumer.
     */
    const tree = (mode: "visible" | "hidden") => (
      <StrictMode>
        <Activity mode={mode}>
          <ResourceVisibilityToggle
            resourceId={1000}
            name="Pocket clip"
            isOwner={false}
            canAdminister
            isAdminPrivate={false}
            isPrivate={false}
          />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(tree("visible")));
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[role="switch"]')?.click(),
    );
    await change(container.querySelector("textarea"), " Staff review ");
    await click("Mark private");
    expect(container.querySelector("textarea")?.value).toBe(" Staff review ");
    vi.mocked(markResourcePrivate).mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    await click("Mark private");
    await act(async () => root.render(tree("hidden")));
    await act(async () => complete());
    expect(toast.success).not.toHaveBeenCalled();
    await act(async () => root.render(tree("visible")));
    expect(markResourcePrivate).toHaveBeenCalledTimes(2);
    expect(markResourcePrivate).toHaveBeenLastCalledWith({
      data: { resourceId: 1000, reason: " Staff review " },
    });
    expect(container.querySelector("dialog")).toBeNull();
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("serializes each trash row while allowing other restores and preserving failed rows for retry", async () => {
    /** Completes the first row restore. */
    let complete = () => {};
    vi.mocked(restoreResource)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          complete = resolve;
        }),
      )
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    await act(async () =>
      root.render(
        <OwnerResourceTrashPage
          initialResources={[
            deleted,
            { ...deleted, id: 1001, name: "Other clip" },
          ]}
        />,
      ),
    );
    await click("Restore", container.querySelectorAll("article")[0]);
    expect(container.querySelector("button")?.disabled).toBe(true);
    await click("Restore", container.querySelectorAll("article")[1]);
    expect(container.querySelectorAll("article")).toHaveLength(2);
    await click("Restore", container.querySelectorAll("article")[1]);
    expect(container.querySelectorAll("article")).toHaveLength(1);
    await act(async () => complete());
    expect(container.querySelectorAll("article")).toHaveLength(0);
    expect(restoreResource).toHaveBeenCalledTimes(3);
  });

  it("keeps permanent-deletion confirmation and draft across suspension without repeating the mutation", async () => {
    /** Completes the confirmed permanent deletion. */
    let complete = () => {};
    vi.mocked(permanentlyDeleteResource).mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    /**
     * Preserves the administrator's current trash controls.
     * @param mode - Activity visibility.
     * @returns Admin trash consumer.
     */
    const tree = (mode: "visible" | "hidden") => (
      <StrictMode>
        <Activity mode={mode}>
          <AdminResourceTrashPage initialResources={[deleted]} />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(tree("visible")));
    await click("Delete permanently");
    expect(container.textContent).toContain("This cannot be undone.");
    await change(container.querySelector("textarea"), " Staff cleanup ");
    await act(async () => root.render(tree("hidden")));
    await act(async () => root.render(tree("visible")));
    expect(container.querySelector("dialog")?.open).toBe(true);
    expect(container.querySelector("textarea")?.value).toBe(" Staff cleanup ");
    const dialog = container.querySelector("dialog");
    if (!dialog) throw new Error("Expected confirmation");
    await click("Delete permanently", dialog);
    expect(
      container.querySelector<HTMLButtonElement>("article button")?.disabled,
    ).toBe(true);
    await act(async () => root.render(tree("hidden")));
    await act(async () => complete());
    await act(async () => root.render(tree("visible")));
    expect(permanentlyDeleteResource).toHaveBeenCalledExactlyOnceWith({
      data: { resourceId: 1000, reason: " Staff cleanup " },
    });
    expect(container.querySelector("article")).toBeNull();
  });

  it("keeps notification mutations attached to their loader refresh and ignores disposed-account completions", async () => {
    /** Completes a notification acknowledgement while suspended. */
    let complete = () => {};
    vi.mocked(markResourceNotificationRead).mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    /**
     * Preserves the current notification consumer.
     * @param mode - Activity visibility.
     * @returns Admin notifications consumer.
     */
    const tree = (mode: "visible" | "hidden") => (
      <StrictMode>
        <Activity mode={mode}>
          <AdminResourceNotificationsPage
            initialNotifications={[notification]}
          />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(tree("visible")));
    await click("Accept");
    await act(async () => root.render(tree("hidden")));
    await act(async () => complete());
    expect(session.invalidate).not.toHaveBeenCalled();
    await act(async () => root.render(tree("visible")));
    expect(markResourceNotificationRead).toHaveBeenCalledTimes(1);
    expect(session.invalidate).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    await click("Mark private");
    await change(container.querySelector("textarea"), "Moderation reason");
    vi.mocked(markResourcePrivate).mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    await submit();
    session.userId = "user_b";
    await act(async () => root.render(tree("visible")));
    await act(async () => complete());
    expect(session.invalidate).toHaveBeenCalledTimes(1);
    expect(container.querySelector("dialog")).toBeNull();
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("retries notification refresh without repeating a successful moderation mutation", async () => {
    session.invalidate
      .mockRejectedValueOnce(new Error("refresh offline"))
      .mockResolvedValueOnce(undefined);
    vi.mocked(markResourcePrivate).mockResolvedValue(undefined);
    await act(async () =>
      root.render(
        <AdminResourceNotificationsPage
          initialNotifications={[notification]}
        />,
      ),
    );
    await click("Mark private");
    await change(container.querySelector("textarea"), "Staff reason");
    await submit();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(container.querySelector("textarea")?.value).toBe("Staff reason");
    await submit();
    expect(markResourcePrivate).toHaveBeenCalledTimes(1);
    expect(session.invalidate).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(container.querySelector("dialog")).toBeNull();
  });

  it("reconciles refreshed privacy without replacing active reason fields or focus", async () => {
    await act(async () =>
      root.render(
        <ResourceDetailPage detail={{ ...detail, isOwner: false }} />,
      ),
    );
    await click("Move to trash");
    await change(container.querySelector("textarea"), "Deletion draft");
    const deletionField = container.querySelector("textarea");
    deletionField?.focus();
    await act(async () =>
      root.render(
        <ResourceDetailPage
          detail={{ ...detail, isOwner: false, isPrivate: true }}
        />,
      ),
    );
    expect(container.querySelector("textarea")).toBe(deletionField);
    expect(deletionField?.value).toBe("Deletion draft");
    expect(document.activeElement).toBe(deletionField);
    await act(async () =>
      root.render(
        <ResourceVisibilityToggle
          resourceId={1000}
          name="Pocket clip"
          isOwner={false}
          canAdminister
          isAdminPrivate={false}
          isPrivate={false}
        />,
      ),
    );
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[role="switch"]')?.click(),
    );
    await change(container.querySelector("textarea"), "Privacy draft");
    const privacyField = container.querySelector("textarea");
    privacyField?.focus();
    await act(async () =>
      root.render(
        <ResourceVisibilityToggle
          resourceId={1000}
          name="Pocket clip"
          isOwner={false}
          canAdminister
          isAdminPrivate
          isPrivate
        />,
      ),
    );
    expect(container.querySelector("textarea")).toBe(privacyField);
    expect(privacyField?.value).toBe("Privacy draft");
    expect(document.activeElement).toBe(privacyField);
    expect(
      container.querySelector('[role="switch"]')?.getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("disposes same-permission account deletion and visibility completions", async () => {
    /** Completes the prior actor deletion.
     * @param value - Confirmed deletion role.
     * @returns Nothing. */
    let completeDelete: (
      value: Awaited<ReturnType<typeof softDeleteResource>>,
    ) => void = (value) => {
      void value;
    };
    vi.mocked(softDeleteResource).mockReturnValueOnce(
      new Promise((resolve) => {
        completeDelete = resolve;
      }),
    );
    await act(async () =>
      root.render(
        <ResourceDetailPage detail={{ ...detail, isOwner: false }} />,
      ),
    );
    await click("Move to trash");
    await change(container.querySelector("textarea"), "Private staff draft");
    const dialog = container.querySelector("dialog");
    if (!dialog) throw new Error("Expected confirmation");
    await click("Move to trash", dialog);
    session.userId = "user_b";
    await act(async () =>
      root.render(
        <ResourceDetailPage detail={{ ...detail, isOwner: false }} />,
      ),
    );
    await act(async () => completeDelete({ deletedByRole: "admin" }));
    expect(session.navigate).not.toHaveBeenCalled();
    expect(container.querySelector("dialog")).toBeNull();
    /** Completes the prior actor visibility mutation. */
    let completePrivacy = () => {};
    vi.mocked(markResourcePrivate).mockReturnValueOnce(
      new Promise((resolve) => {
        completePrivacy = resolve;
      }),
    );
    const control = (
      <ResourceVisibilityToggle
        resourceId={1000}
        name="Pocket clip"
        isOwner={false}
        canAdminister
        isAdminPrivate={false}
        isPrivate={false}
      />
    );
    await act(async () => root.render(control));
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[role="switch"]')?.click(),
    );
    await change(container.querySelector("textarea"), "Private reason");
    await click("Mark private");
    session.userId = "user_c";
    await act(async () =>
      root.render(
        <ResourceVisibilityToggle
          resourceId={1000}
          name="Pocket clip"
          isOwner={false}
          canAdminister
          isAdminPrivate={false}
          isPrivate={false}
        />,
      ),
    );
    await act(async () => completePrivacy());
    expect(container.querySelector("dialog")).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("retains a failed staff resource deletion reason and preserves history disclosure", async () => {
    vi.mocked(softDeleteResource)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ deletedByRole: "admin" });
    await act(async () =>
      root.render(
        <ResourceDetailPage
          detail={{
            ...detail,
            isOwner: false,
            versions: [version, { ...version, id: 1004, version: 0 }],
          }}
        />,
      ),
    );
    const history = container.querySelector<HTMLButtonElement>(
      "button[aria-expanded]",
    );
    expect(history?.getAttribute("aria-expanded")).toBe("false");
    await act(async () => history?.click());
    expect(history?.getAttribute("aria-expanded")).toBe("true");
    await click("Move to trash");
    await change(
      container.querySelector("dialog textarea"),
      " Staff deletion ",
    );
    const dialog = container.querySelector("dialog");
    if (!dialog) throw new Error("Expected confirmation");
    await click("Move to trash", dialog);
    expect(container.querySelector("textarea")?.value).toBe(" Staff deletion ");
    await click("Move to trash", dialog);
    expect(softDeleteResource).toHaveBeenLastCalledWith({
      data: { resourceId: 1000, reason: " Staff deletion " },
    });
    expect(session.navigate).toHaveBeenCalledTimes(1);
  });
});
