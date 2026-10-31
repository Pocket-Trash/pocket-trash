/** @vitest-environment jsdom */

import { formatTranslation } from "@pocket-trash/localizations";
import { Activity, act, type ReactNode, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PermanentDeletionControls } from "@/components/permanent-deletion-controls";
import {
  type AdminErasureStatusView,
  type ErasureTarget,
  findErasureTarget,
  getAdminErasureStatus,
  getSelfErasureStatus,
  requestAdminErasure,
  requestSelfErasure,
  retryAdminErasure,
} from "@/lib/account-erasure";
import { AccountErasureStatusPage } from "./account-erasure-pages";
import { AdminAccountErasurePage } from "./admin-account-erasure-page";
import { DeleteAccountSection } from "./delete-account-section";

/** Current account, strict reverification, and navigation observers. */
const session = vi.hoisted(() => ({
  userId: "user_a" as string | null,
  navigate: vi.fn(),
  reverified: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@clerk/tanstack-react-start", () => ({
  /** Supplies current account scope.
   * @returns Current account identity. */
  useAuth: () => ({
    userId: session.userId,
    isLoaded: true,
    isSignedIn: Boolean(session.userId),
  }),
  /** Supplies the signed-out navigation boundary.
   * @returns Clerk sign-out observer. */
  useClerk: () => ({ signOut: session.signOut }),
  /**
   * Preserves the existing strict-reverification wrapper contract in this fixture.
   * @param request - Existing confirmed erasure request.
   * @returns Request wrapper recording reverification execution.
   */
  useReverification:
    (request: (input: unknown) => Promise<unknown>) =>
    async (input: unknown) => {
      session.reverified(input);
      return await request(input);
    },
}));
vi.mock("@tanstack/react-router", () => ({
  /**
   * Exposes the declarative redirect destination without executing navigation during render.
   * @param props - Router's redirect destination.
   * @returns Current declarative redirect marker.
   */
  Navigate: ({
    to,
  }: {
    /** Current redirect destination. */
    to: string;
  }) => <output data-redirect={to} />,

  /** Supplies terminal navigation feedback.
   * @returns Navigation observer. */
  useNavigate: () => session.navigate,
}));
vi.mock("@/providers/locale-provider", () => ({
  /** Supplies the current UI locale.
   * @returns English locale context. */
  useLocale: () => ({ locale: "en-US" }),
}));
vi.mock("@/components/app-shell", () => ({
  /**
   * Renders only the current route content.
   * @param props - Nested route content.
   * @returns Route content.
   */
  AppShell: ({
    children,
  }: {
    /** Current route content. */
    children: ReactNode;
  }) => children,
}));
vi.mock("@/lib/account-erasure", () => ({
  findErasureTarget: vi.fn(),
  getAdminErasureStatus: vi.fn(),
  getSelfErasureStatus: vi.fn(),
  requestAdminErasure: vi.fn(),
  requestSelfErasure: vi.fn(),
  retryAdminErasure: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
/** Existing authorized erasure target. */
const target: ErasureTarget = {
  clerkId: "target_user",
  email: "target@example.test",
  name: "Target user",
};
/** Existing processing receipt used by privacy workflow fixtures. */
const processing: AdminErasureStatusView = {
  requestId: "00000000-0000-4000-8000-000000000001",
  status: "processing",
  errorCode: null,
  targetClerkId: target.clerkId,
};
/** Existing permanent-product-deletion copy. */
const deleteAction = formatTranslation(
  "web.catalog.deletion.action",
  {},
  "en-US",
);

/**
 * Changes a native controlled field through React's browser event path.
 * @param field - Current input or textarea.
 * @param value - Next field value.
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
 * Submits one existing native form through its public handler.
 * @param form - Current native form.
 * @rejects When the expected form is absent.
 */
async function submit(form: HTMLFormElement | null) {
  if (!form) throw new Error("Expected form");
  await act(async () =>
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    ),
  );
}

describe("confirmed deletion and erasure workflows", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.resetAllMocks();
    session.userId = "user_a";
    session.navigate.mockResolvedValue(undefined);
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
    vi.useRealTimers();
  });
  /**
   * Clicks an existing command within its current dialog/page scope.
   * @param text - Existing visible command copy.
   * @param scope - Current dialog or page.
   * @rejects When the expected command is absent.
   */
  async function click(text: string, scope: ParentNode = container) {
    const button = [...scope.querySelectorAll("button")].find(
      (node) => node.textContent?.trim() === text,
    );
    if (!button) throw new Error(`Expected command: ${text}`);
    await act(async () => button.click());
  }
  /**
   * Reads the current confirmation dialog.
   * @returns Mounted confirmation dialog.
   * @throws When the confirmation is absent.
   */
  function dialog() {
    const node = container.querySelector("dialog");
    if (!node) throw new Error("Expected confirmation");
    return node;
  }
  /** Toggles the current explicit confirmation checkbox. */
  async function confirm() {
    await act(async () =>
      dialog()
        .querySelector<HTMLInputElement>('input[type="checkbox"]')
        ?.click(),
    );
  }

  it("preserves staff confirmation/reason on failure and retries completion without deleting twice", async () => {
    const remove = vi
      .fn()
      .mockRejectedValueOnce(new Error("web.catalog.deletion.blocked"))
      .mockResolvedValueOnce(undefined);
    const completed = vi
      .fn()
      .mockRejectedValueOnce(new Error("private navigation detail"))
      .mockResolvedValueOnce(undefined);
    await act(async () =>
      root.render(
        <PermanentDeletionControls
          name="Fixture product"
          reasonRequired
          onDelete={remove}
          onDeleted={completed}
        />,
      ),
    );
    await click(deleteAction);
    await submit(dialog().querySelector("form"));
    expect(remove).not.toHaveBeenCalled();
    await confirm();
    await change(dialog().querySelector("textarea"), " Staff review ");
    await submit(dialog().querySelector("form"));
    expect(dialog().textContent).toContain(
      formatTranslation("web.catalog.deletion.blocked", {}, "en-US"),
    );
    expect(dialog().querySelector("textarea")?.value).toBe(" Staff review ");
    await submit(dialog().querySelector("form"));
    expect(remove).toHaveBeenCalledTimes(2);
    expect(completed).toHaveBeenCalledTimes(1);
    expect(dialog().textContent).not.toContain("private navigation detail");
    await submit(dialog().querySelector("form"));
    expect(remove).toHaveBeenCalledTimes(2);
    expect(completed).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenLastCalledWith("Staff review");
    expect(container.querySelector("dialog")).toBeNull();
    await click(deleteAction);
    expect(dialog().querySelector('input[type="checkbox"]')).toHaveProperty(
      "checked",
      false,
    );
  });

  it("preserves pending confirmation through Activity and blocks duplicate/cancel intent", async () => {
    /** Completes the confirmed deletion service call. */
    let finish = () => {};
    const remove = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const completed = vi.fn();
    /**
     * Preserves the current confirmed product deletion consumer.
     * @param mode - Activity visibility.
     * @returns Strict deletion consumer.
     */
    const tree = (mode: "visible" | "hidden") => (
      <StrictMode>
        <Activity mode={mode}>
          <PermanentDeletionControls
            name="Fixture product"
            reasonRequired
            onDelete={remove}
            onDeleted={completed}
          />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(tree("visible")));
    await click(deleteAction);
    await confirm();
    await change(dialog().querySelector("textarea"), "Staff reason");
    await submit(dialog().querySelector("form"));
    const cancel = new Event("cancel", { cancelable: true });
    await act(async () => dialog().dispatchEvent(cancel));
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog().open).toBe(true);
    await submit(dialog().querySelector("form"));
    expect(remove).toHaveBeenCalledTimes(1);
    await act(async () => root.render(tree("hidden")));
    await act(async () => root.render(tree("visible")));
    expect(dialog().querySelector("textarea")?.value).toBe("Staff reason");
    expect(dialog().querySelector('input[type="checkbox"]')).toHaveProperty(
      "checked",
      true,
    );
    expect(remove).toHaveBeenCalledTimes(1);
    await act(async () => root.render(tree("hidden")));
    await act(async () => finish());
    expect(completed).not.toHaveBeenCalled();
    await act(async () => root.render(tree("visible")));
    expect(completed).toHaveBeenCalledTimes(1);
    expect(container.querySelector("dialog")).toBeNull();
    await act(async () => root.render(tree("hidden")));
    await act(async () => root.render(tree("visible")));
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("disposes old-account deletion completion and same-name replacement confirmations", async () => {
    /** Completes the old account's confirmed deletion. */
    let finish = () => {};
    const remove = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const completed = vi.fn();
    await act(async () =>
      root.render(
        <PermanentDeletionControls
          key="first_target"
          name="Same name"
          reasonRequired={false}
          onDelete={remove}
          onDeleted={completed}
        />,
      ),
    );
    await click(deleteAction);
    await confirm();
    await submit(dialog().querySelector("form"));
    session.userId = "user_b";
    await act(async () =>
      root.render(
        <PermanentDeletionControls
          key="first_target"
          name="Same name"
          reasonRequired={false}
          onDelete={remove}
          onDeleted={completed}
        />,
      ),
    );
    await act(async () => finish());
    expect(completed).not.toHaveBeenCalled();
    expect(container.querySelector("dialog")).toBeNull();
    await click(deleteAction);
    await confirm();
    await act(async () =>
      root.render(
        <PermanentDeletionControls
          key="second_target"
          name="Same name"
          reasonRequired={false}
          onDelete={remove}
          onDeleted={completed}
        />,
      ),
    );
    expect(container.querySelector("dialog")).toBeNull();
    await click(deleteAction);
    expect(dialog().querySelector('input[type="checkbox"]')).toHaveProperty(
      "checked",
      false,
    );
  });

  it("keeps strict reverification and defers self-erasure navigation while hidden", async () => {
    /** Completes the current reverified erasure request.
     * @param value - Existing created receipt protocol.
     * @returns Nothing. */
    let finish: (
      value: Awaited<ReturnType<typeof requestSelfErasure>>,
    ) => void = (value) => {
      void value;
    };
    vi.mocked(requestSelfErasure).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    /**
     * Preserves the current account's confirmation consumer.
     * @param mode - Activity visibility.
     * @returns Strict account deletion consumer.
     */
    const tree = (mode: "visible" | "hidden") => (
      <StrictMode>
        <Activity mode={mode}>
          <DeleteAccountSection />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(tree("visible")));
    await click(formatTranslation("web.erasure.self.open", {}, "en-US"));
    await submit(dialog().querySelector("form"));
    expect(requestSelfErasure).not.toHaveBeenCalled();
    await confirm();
    await submit(dialog().querySelector("form"));
    expect(session.reverified).toHaveBeenCalledExactlyOnceWith({
      data: { confirmed: true },
    });
    await act(async () => root.render(tree("hidden")));
    await act(async () => finish(processing));
    expect(session.navigate).not.toHaveBeenCalled();
    await act(async () => root.render(tree("visible")));
    expect(requestSelfErasure).toHaveBeenCalledTimes(1);
    expect(session.navigate).toHaveBeenCalledExactlyOnceWith({
      to: "/account-erasure",
    });
    expect(container.querySelector("dialog")).toBeNull();
  });

  it("retries failed self-erasure navigation without another privacy request", async () => {
    vi.mocked(requestSelfErasure).mockResolvedValue(processing);
    session.navigate
      .mockRejectedValueOnce(new Error("navigation failed"))
      .mockResolvedValueOnce(undefined);
    await act(async () => root.render(<DeleteAccountSection />));
    await click(formatTranslation("web.erasure.self.open", {}, "en-US"));
    await confirm();
    await submit(dialog().querySelector("form"));
    expect(dialog().textContent).toContain(
      formatTranslation("web.erasure.self.failure", {}, "en-US"),
    );
    await submit(dialog().querySelector("form"));
    expect(requestSelfErasure).toHaveBeenCalledTimes(1);
    expect(session.reverified).toHaveBeenCalledTimes(1);
    expect(session.navigate).toHaveBeenCalledTimes(2);
    expect(container.querySelector("dialog")).toBeNull();
  });

  it("replaces email lookups and preserves bounded verification evidence through request/retry failures", async () => {
    vi.useFakeTimers();
    /** Completes a superseded verified-target lookup.
     * @param value - Previous email's matched account.
     * @returns Nothing. */
    let finishLookup: (value: ErasureTarget) => void = (value) => {
      void value;
    };
    vi.mocked(findErasureTarget)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishLookup = resolve;
        }),
      )
      .mockResolvedValueOnce(target);
    vi.mocked(requestAdminErasure)
      .mockRejectedValueOnce(new Error("create offline"))
      .mockResolvedValueOnce({
        ...processing,
        status: "needs_support",
        errorCode: "retry_needed",
      });
    vi.mocked(retryAdminErasure)
      .mockRejectedValueOnce(new Error("retry offline"))
      .mockResolvedValueOnce(processing);
    vi.mocked(getAdminErasureStatus).mockResolvedValue({
      ...processing,
      status: "completed",
    });
    await act(async () => root.render(<AdminAccountErasurePage />));
    await change(container.querySelector("input"), "old@example.test");
    await submit(container.querySelector("form"));
    await change(container.querySelector("input"), target.email);
    expect(
      vi.mocked(findErasureTarget).mock.calls[0]?.[0]?.signal?.aborted,
    ).toBe(true);
    await submit(container.querySelector("form"));
    await act(async () =>
      finishLookup({
        ...target,
        clerkId: "old_user",
        name: "Old private target",
      }),
    );
    expect(container.textContent).not.toContain("Old private target");
    await change(
      container.querySelector("#verification-reference"),
      "contains spaces",
    );
    await submit(container.querySelectorAll("form")[1] ?? null);
    expect(requestAdminErasure).not.toHaveBeenCalled();
    await change(
      container.querySelector("#verification-reference"),
      "privacy_request:123",
    );
    const method = container.querySelector("select");
    if (!method) throw new Error("Expected verification method");
    await act(async () => {
      method.value = "verified_email";
      method.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await submit(container.querySelectorAll("form")[1] ?? null);
    expect(
      container.querySelector<HTMLInputElement>("#verification-reference")
        ?.value,
    ).toBe("privacy_request:123");
    await submit(container.querySelectorAll("form")[1] ?? null);
    expect(requestAdminErasure).toHaveBeenLastCalledWith({
      data: {
        email: target.email,
        targetClerkId: target.clerkId,
        verificationMethod: "verified_email",
        verificationReference: "privacy_request:123",
      },
    });
    await click(formatTranslation("web.erasure.admin.retry", {}, "en-US"));
    await click(formatTranslation("web.erasure.admin.retry", {}, "en-US"));
    expect(retryAdminErasure).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(container.textContent).toContain(
      formatTranslation("web.erasure.status.completed", {}, "en-US"),
    );
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(getAdminErasureStatus).toHaveBeenCalledTimes(1);
  });

  it("redirects a revoked/signed-out current session while stopping private receipt polling", async () => {
    vi.useFakeTimers();
    vi.mocked(getSelfErasureStatus).mockReturnValueOnce(new Promise(() => {}));
    await act(async () =>
      root.render(
        <AccountErasureStatusPage
          actorId="user_a"
          initialStatus={processing}
        />,
      ),
    );
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(getSelfErasureStatus).toHaveBeenCalledTimes(1);
    session.userId = null;
    await act(async () =>
      root.render(
        <AccountErasureStatusPage
          actorId="user_a"
          initialStatus={processing}
        />,
      ),
    );
    expect(
      vi.mocked(getSelfErasureStatus).mock.calls[0]?.[0]?.signal?.aborted,
    ).toBe(true);
    expect(container.querySelector("output")?.dataset.redirect).toBe(
      "/account-erased",
    );
    expect(container.textContent).not.toContain(processing.requestId);
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(getSelfErasureStatus).toHaveBeenCalledTimes(1);
  });

  it("retains one pending admin request through Activity and clears private target/polling state on account replacement", async () => {
    vi.useFakeTimers();
    vi.mocked(findErasureTarget).mockResolvedValue(target);
    /** Completes a confirmed administrator erasure request.
     * @param value - Created processing receipt.
     * @returns Nothing. */
    let finishCreate: (value: AdminErasureStatusView) => void = (value) => {
      void value;
    };
    vi.mocked(requestAdminErasure).mockReturnValueOnce(
      new Promise((resolve) => {
        finishCreate = resolve;
      }),
    );
    /** Completes an old account's receipt poll.
     * @param value - Old receipt status.
     * @returns Nothing. */
    let finishPoll: (value: AdminErasureStatusView) => void = (value) => {
      void value;
    };
    vi.mocked(getAdminErasureStatus).mockReturnValueOnce(
      new Promise((resolve) => {
        finishPoll = resolve;
      }),
    );
    /**
     * Preserves one administrator's current privacy action.
     * @param mode - Activity visibility.
     * @returns Strict administrator erasure consumer.
     */
    const tree = (mode: "visible" | "hidden") => (
      <StrictMode>
        <Activity mode={mode}>
          <AdminAccountErasurePage />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(tree("visible")));
    await change(container.querySelector("input"), target.email);
    await submit(container.querySelector("form"));
    await change(
      container.querySelector("#verification-reference"),
      "privacy_request:123",
    );
    await submit(container.querySelectorAll("form")[1] ?? null);
    await act(async () => root.render(tree("hidden")));
    await act(async () => root.render(tree("visible")));
    expect(requestAdminErasure).toHaveBeenCalledTimes(1);
    await act(async () => finishCreate(processing));
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    const reads = vi.mocked(getAdminErasureStatus).mock.calls;
    session.userId = "user_b";
    await act(async () => root.render(tree("visible")));
    expect(reads.every(([input]) => input?.signal?.aborted)).toBe(true);
    await act(async () =>
      finishPoll({
        ...processing,
        status: "needs_support",
        errorCode: "private_old_error",
      }),
    );
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(container.textContent).not.toContain("Target user");
    expect(container.textContent).not.toContain("private_old_error");
    expect(container.querySelector("input")?.value).toBe("");
    const completedReads = reads.length;
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(getAdminErasureStatus).toHaveBeenCalledTimes(completedReads);
    await act(async () =>
      root.render(
        <AccountErasureStatusPage
          actorId="user_a"
          initialStatus={{ ...processing, status: "needs_support" }}
        />,
      ),
    );
    expect(container.textContent).toBe("");
  });
});
