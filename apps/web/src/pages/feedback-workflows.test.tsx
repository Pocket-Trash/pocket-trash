/** @vitest-environment jsdom */
import { Activity, act, type ReactNode, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as feedback from "@/lib/feedback";
import { AdminFeedbackNotificationsPage } from "./admin-feedback-notifications-page";
import {
  AdminActiveFeedbackPage,
  AdminFeedbackArchivePage,
  AdminFeedbackRequestsPage,
} from "./admin-feedback-pages";
import {
  CompletedFeedbackPage,
  FeedbackBoardPage,
  MyFeedbackPage,
  SubmitFeedbackPage,
} from "./feedback-pages";

/** Current account and terminal navigation/refresh observers. */
const session = vi.hoisted(() => ({
  userId: "user_a" as string | null,
  navigate: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("@clerk/tanstack-react-start", () => ({
  /** Supplies the current account boundary.
   * @returns Current account identity. */
  useAuth: () => ({ userId: session.userId }),
}));
vi.mock("@tanstack/react-router", () => ({
  /** Supplies terminal navigation.
   * @returns Navigation command. */
  useNavigate: () => session.navigate,
  /** Supplies canonical route refresh.
   * @returns Router refresh command. */
  useRouter: () => ({ invalidate: session.invalidate }),
  /** Renders only a fixture link's visible contents.
   * @param props - Existing link contents.
   * @returns Link contents. */
  Link: ({
    children,
  }: {
    /** Visible link contents. */ children?: ReactNode;
  }) => children,
}));
vi.mock("@/providers/locale-provider", () => ({
  /** Supplies the existing English copy.
   * @returns Current locale. */
  useLocale: () => ({ locale: "en-US" }),
}));
vi.mock("@/components/app-shell", () => ({
  /** Omits unrelated shell lifetimes.
   * @param props - Current route content.
   * @returns Current route content. */
  AppShell: ({
    children,
  }: {
    /** Current route content. */ children: ReactNode;
  }) => children,
}));
vi.mock("@/components/admin-page-shell", () => ({
  /** Omits unrelated administrative shell lifetimes.
   * @param props - Current route content.
   * @returns Current route content. */
  AdminPageShell: ({
    children,
  }: {
    /** Current route content. */ children: ReactNode;
  }) => children,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/feedback", () => ({
  markFeedbackNotificationRead: vi.fn(),
  findDuplicateFeedback: vi.fn(),
  submitFeedback: vi.fn(),
  listActiveFeedback: vi.fn(),
  listCompletedFeedback: vi.fn(),
  listMyFeedback: vi.fn(),
  toggleFeedbackVote: vi.fn(),
  listPendingFeedback: vi.fn(),
  listAdminActiveFeedback: vi.fn(),
  listAdminAllActiveFeedback: vi.fn(),
  listArchivedFeedback: vi.fn(),
  listFeedbackMergeTargets: vi.fn(),
  getLinearPlanOptions: vi.fn(),
  planFeedback: vi.fn(),
  approveFeedback: vi.fn(),
  denyFeedback: vi.fn(),
  mergePendingFeedback: vi.fn(),
  updateAdminFeedback: vi.fn(),
  syncFeedbackStatus: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
/** Representative visible feedback, shared with its moderation view. */
const item = {
  id: 1000,
  title: "Saved searches",
  description: "Save useful searches.",
  category: "feature" as const,
  status: "requested" as const,
  createdAt: new Date("2026-09-28T12:00:00Z"),
  updatedAt: new Date("2026-09-28T12:00:00Z"),
  completedAt: null,
  hasPermanentVote: false,
  hasVoted: false,
  voteCount: 8,
  linearClientUuid: null,
  submitterUsername: "ada",
};
/** Stable pending route snapshot. */
const pendingPage = {
  hasNext: false,
  items: [{ ...item, status: "pending" as const }],
};
/** Stable active route snapshot. */
const activePage = { hasNext: false, items: [item] };
/** Creates a controllable service result.
 * @template T - Settled service value.
 * @returns Deferred service result and completion command. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
/** Changes a current native form control through React's public input event.
 * @param node - Current form control.
 * @param value - New draft value.
 * @rejects When the expected control is absent. */
async function change(
  node: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null,
  value: string,
) {
  if (!node) throw new Error("Expected form control");
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(node),
    "value",
  )?.set;
  await act(async () => {
    setter?.call(node, value);
    node.dispatchEvent(
      new Event(node instanceof HTMLSelectElement ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}
/** Submits a current native form through its existing handler.
 * @param form - Current native form.
 * @param submitter - Optional save-and-approve intent.
 * @rejects When the expected form is absent. */
async function submit(
  form: HTMLFormElement | null | undefined,
  submitter?: HTMLButtonElement,
) {
  if (!form) throw new Error("Expected form");
  await act(async () => {
    form.dispatchEvent(
      new SubmitEvent("submit", { bubbles: true, cancelable: true, submitter }),
    );
  });
}

describe("feedback workflow ownership", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.resetAllMocks();
    session.userId = "user_a";
    session.navigate.mockResolvedValue(undefined);
    session.invalidate.mockResolvedValue(undefined);
    vi.mocked(feedback.findDuplicateFeedback).mockResolvedValue([]);
    vi.mocked(feedback.submitFeedback).mockResolvedValue({
      ok: true,
      feedbackId: 1002,
    });
    vi.mocked(feedback.listActiveFeedback).mockResolvedValue([]);
    vi.mocked(feedback.listCompletedFeedback).mockResolvedValue([]);
    vi.mocked(feedback.listMyFeedback).mockResolvedValue({
      hasNext: false,
      items: [],
    });
    vi.mocked(feedback.listAdminActiveFeedback).mockResolvedValue(activePage);
    vi.mocked(feedback.listPendingFeedback).mockResolvedValue(pendingPage);
    vi.mocked(feedback.listArchivedFeedback).mockResolvedValue({
      hasNext: false,
      items: [],
    });
    vi.mocked(feedback.listFeedbackMergeTargets).mockResolvedValue([]);
    vi.mocked(feedback.getLinearPlanOptions).mockResolvedValue({
      ok: true,
      labels: [{ id: "feature-label", name: "Feature" }],
      viewerName: "Ada",
    });
    vi.mocked(feedback.planFeedback).mockResolvedValue({ ok: true });
    vi.mocked(feedback.denyFeedback).mockResolvedValue({ ok: true });
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
  /** Finds a current visible command.
   * @param text - Existing command copy.
   * @param scope - Current dialog or page.
   * @returns Current command.
   * @throws When the expected command is absent. */
  function button(text: string, scope: ParentNode = container) {
    const node = [...scope.querySelectorAll("button")].find(
      (node) => node.textContent?.trim() === text,
    );
    if (!node) throw new Error(`Expected command: ${text}`);
    return node;
  }
  /** Clicks a current command.
   * @param text - Existing command copy.
   * @param scope - Current dialog or page.
   * @rejects When the expected command is absent. */
  async function click(text: string, scope: ParentNode = container) {
    await act(async () => button(text, scope).click());
  }
  /** Opens the current admin item through its existing accessible control. */
  async function manage() {
    const opener = container.querySelector<HTMLButtonElement>(
      '[aria-label="Manage Saved searches"]',
    );
    await act(async () => opener?.click());
  }
  /** Fills an existing submission draft. */
  async function draft() {
    await change(container.querySelector("#feedback-title"), "Saved filters");
    await change(
      container.querySelector("#feedback-description"),
      "Keep my filters.",
    );
    await change(container.querySelector("#feedback-category"), "feature");
  }

  it("shows duplicate suggestions, retains the draft, and sends submit-anyway once across StrictMode/Activity", async () => {
    vi.mocked(feedback.findDuplicateFeedback).mockResolvedValue([item]);
    const write =
      deferred<Awaited<ReturnType<typeof feedback.submitFeedback>>>();
    vi.mocked(feedback.submitFeedback).mockReturnValue(write.promise);
    /** Renders the preserved submission surface.
     * @param hidden - Whether its effects are disconnected.
     * @returns Current submission fixture. */
    const view = (hidden: boolean) => (
      <StrictMode>
        <Activity mode={hidden ? "hidden" : "visible"}>
          <SubmitFeedbackPage />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(view(false)));
    await draft();
    await submit(container.querySelector("form"));
    expect(container.textContent).toContain("Saved searches");
    expect(feedback.submitFeedback).not.toHaveBeenCalled();
    await click("Submit anyway");
    await act(async () => root.render(view(true)));
    await act(async () => write.resolve({ ok: true, feedbackId: 1002 }));
    expect(session.navigate).not.toHaveBeenCalled();
    await act(async () => root.render(view(false)));
    expect(feedback.submitFeedback).toHaveBeenCalledExactlyOnceWith({
      data: {
        title: "Saved filters",
        description: "Keep my filters.",
        category: "feature",
      },
    });
    expect(session.navigate).toHaveBeenCalledExactlyOnceWith({
      to: "/feedback/my-requests",
    });
  });

  it("retries failed submission navigation without creating feedback twice", async () => {
    session.navigate.mockRejectedValueOnce(new Error("navigation"));
    await act(async () => root.render(<SubmitFeedbackPage />));
    await draft();
    await submit(container.querySelector("form"));
    await submit(container.querySelector("form"));
    expect(feedback.submitFeedback).toHaveBeenCalledOnce();
    expect(session.navigate).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledOnce();
  });

  it("aborts replaced board reads, ignores late results, and shares one vote between card and details", async () => {
    const old = deferred<typeof activePage.items>();
    const next = deferred<typeof activePage.items>();
    vi.mocked(feedback.listActiveFeedback)
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(next.promise);
    await act(async () =>
      root.render(<FeedbackBoardPage initialItems={activePage.items} />),
    );
    await change(container.querySelector('input[type="search"]'), "old");
    await submit(container.querySelector("form"));
    await change(container.querySelector('input[type="search"]'), "new");
    await submit(container.querySelector("form"));
    expect(
      vi.mocked(feedback.listActiveFeedback).mock.calls[0]?.[0]?.signal
        ?.aborted,
    ).toBe(true);
    await act(async () => next.resolve([item]));
    await act(async () => old.resolve([{ ...item, title: "Stale result" }]));
    expect(container.textContent).not.toContain("Stale result");
    const vote = deferred<boolean>();
    vi.mocked(feedback.toggleFeedbackVote).mockReturnValue(vote.promise);
    await click("View");
    const controls = [
      ...container.querySelectorAll<HTMLButtonElement>(
        'button[aria-pressed="false"]',
      ),
    ];
    await act(async () => controls[0]?.click());
    expect(controls.every((node) => node.disabled)).toBe(true);
    await act(async () => vote.resolve(true));
    expect(feedback.toggleFeedbackVote).toHaveBeenCalledOnce();
    expect(
      container.querySelectorAll('button[aria-pressed="true"]'),
    ).toHaveLength(2);
  });

  it("searches completed feedback and paginates private history with current query snapshots", async () => {
    await act(async () =>
      root.render(<CompletedFeedbackPage initialItems={[]} />),
    );
    await change(container.querySelector('input[type="search"]'), "done");
    await submit(container.querySelector("form"));
    expect(feedback.listCompletedFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { offset: 0, search: "done" },
        signal: expect.any(AbortSignal),
      }),
    );
    const page = { hasNext: true, items: [item] };
    vi.mocked(feedback.listMyFeedback).mockResolvedValue(page);
    await act(async () =>
      root.render(<MyFeedbackPage actorId="user_a" initialPage={page} />),
    );
    await change(container.querySelector('input[type="search"]'), "mine");
    await submit(container.querySelector("form"));
    await click("Next page");
    expect(feedback.listMyFeedback).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { offset: 30, search: "mine" } }),
    );
    session.userId = "user_b";
    await act(async () =>
      root.render(<MyFeedbackPage actorId="user_a" initialPage={page} />),
    );
    expect(container.textContent).toBe("");
  });

  it("replaces 150ms admin debounce and cancels a pending query on disposal", async () => {
    vi.useFakeTimers();
    await act(async () =>
      root.render(<AdminActiveFeedbackPage initialPage={activePage} />),
    );
    await change(container.querySelector('input[type="search"]'), "first");
    await change(container.querySelector('input[type="search"]'), "latest");
    await act(async () => vi.advanceTimersByTime(149));
    expect(feedback.listAdminActiveFeedback).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(feedback.listAdminActiveFeedback).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        data: { offset: 0, search: "latest", sort: [] },
      }),
    );
    await change(container.querySelector('input[type="search"]'), "disposed");
    await act(async () => root.render(null));
    await act(async () => vi.advanceTimersByTime(150));
    expect(feedback.listAdminActiveFeedback).toHaveBeenCalledOnce();
  });

  it("preserves moderation edits across Activity and saves before approval once", async () => {
    /** Renders a preserved moderation surface.
     * @param hidden - Whether effects are disconnected.
     * @returns Current moderation fixture. */
    const view = (hidden: boolean) => (
      <Activity mode={hidden ? "hidden" : "visible"}>
        <AdminFeedbackRequestsPage initialPage={pendingPage} />
      </Activity>
    );
    await act(async () => root.render(view(false)));
    await manage();
    await click("Edit");
    await change(
      container.querySelector("#admin-feedback-title"),
      "Reviewed search",
    );
    await act(async () => root.render(view(true)));
    await act(async () => root.render(view(false)));
    expect(container.querySelector<HTMLDialogElement>("dialog")?.open).toBe(
      true,
    );
    expect(
      container.querySelector<HTMLInputElement>("#admin-feedback-title")?.value,
    ).toBe("Reviewed search");
    const save = button("Save & Approve");
    await submit(save.closest("form"), save);
    expect(feedback.updateAdminFeedback).toHaveBeenCalledExactlyOnceWith({
      data: {
        feedbackId: 1000,
        title: "Reviewed search",
        description: item.description,
        category: "feature",
      },
    });
    expect(feedback.approveFeedback).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledOnce();
    expect(container.querySelector("dialog")).toBeNull();
    expect(
      container.ownerDocument.activeElement?.getAttribute("aria-label"),
    ).toBe("Manage Saved searches");
  });

  it("retains a failed merge choice and refreshes merge targets after a successful retry", async () => {
    vi.mocked(feedback.mergePendingFeedback)
      .mockRejectedValueOnce(new Error("merge"))
      .mockResolvedValueOnce(undefined);
    await act(async () =>
      root.render(
        <AdminFeedbackRequestsPage
          initialPage={pendingPage}
          mergeTargets={[
            { id: 1001, title: "Existing request", status: "requested" },
          ]}
        />,
      ),
    );
    await manage();
    await change(container.querySelector("#feedback-merge-target"), "1001");
    await submit(container.querySelector("dialog form"));
    expect(
      container.querySelector<HTMLSelectElement>("#feedback-merge-target")
        ?.value,
    ).toBe("1001");
    await submit(container.querySelector("dialog form"));
    expect(feedback.mergePendingFeedback).toHaveBeenLastCalledWith({
      data: { feedbackId: 1000, targetId: 1001 },
    });
    expect(feedback.listFeedbackMergeTargets).toHaveBeenCalledWith(
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("keeps a planning reservation and project choices after failure without replay on resume", async () => {
    vi.mocked(feedback.planFeedback).mockResolvedValueOnce({
      ok: false,
      error: "web.feedback.admin.plan.failure",
    });
    /** Renders a preserved planning surface.
     * @param hidden - Whether effects are disconnected.
     * @returns Current planning fixture. */
    const view = (hidden: boolean) => (
      <StrictMode>
        <Activity mode={hidden ? "hidden" : "visible"}>
          <AdminActiveFeedbackPage initialPage={activePage} />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(view(false)));
    await manage();
    await click("Plan");
    await act(async () =>
      container
        .querySelector<HTMLInputElement>('input[value="project"]')
        ?.click(),
    );
    await act(async () =>
      container
        .querySelector<HTMLInputElement>('input[name="leadProject"]')
        ?.click(),
    );
    await submit(container.querySelector("dialog form"));
    const first = vi.mocked(feedback.planFeedback).mock.calls[0]?.[0]?.data;
    const write = deferred<Awaited<ReturnType<typeof feedback.planFeedback>>>();
    vi.mocked(feedback.planFeedback).mockReturnValueOnce(write.promise);
    await submit(container.querySelector("dialog form"));
    await act(async () => root.render(view(true)));
    await act(async () => write.resolve({ ok: true }));
    expect(container.querySelector("dialog")).not.toBeNull();
    await act(async () => root.render(view(false)));
    expect(feedback.planFeedback).toHaveBeenCalledTimes(2);
    expect(vi.mocked(feedback.planFeedback).mock.calls[1]?.[0]?.data).toEqual(
      first,
    );
    expect(first).toEqual(
      expect.objectContaining({
        kind: "project",
        leadProject: true,
        clientUuid: expect.any(String),
      }),
    );
  });

  it("allows planning-options retry after a failed connection and preserves an existing reservation", async () => {
    vi.mocked(feedback.getLinearPlanOptions).mockResolvedValueOnce({
      ok: false,
      error: "web.feedback.admin.plan.connectionRequired",
    });
    const page = {
      ...activePage,
      items: [
        { ...item, linearClientUuid: "123e4567-e89b-42d3-a456-426614174000" },
      ],
    };
    await act(async () =>
      root.render(<AdminActiveFeedbackPage initialPage={page} />),
    );
    await manage();
    await click("Plan");
    expect(button("Create and plan").disabled).toBe(true);
    await click("Cancel");
    await click("Plan");
    await submit(container.querySelector("dialog form"));
    expect(feedback.planFeedback).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientUuid: page.items[0]?.linearClientUuid,
        labelIds: ["feature-label"],
      }),
    });
  });

  it("applies archive filters and disposes stale sync feedback on account replacement", async () => {
    const sync =
      deferred<Awaited<ReturnType<typeof feedback.syncFeedbackStatus>>>();
    vi.mocked(feedback.syncFeedbackStatus).mockReturnValue(sync.promise);
    const page = {
      hasNext: false,
      items: [
        {
          ...item,
          status: "completed" as const,
          linearClientUuid: "linear-id",
        },
      ],
    };
    await act(async () =>
      root.render(
        <AdminFeedbackArchivePage
          actorId="user_a"
          initialPage={page}
          archiveStatuses={["completed", "canceled"]}
        />,
      ),
    );
    await change(container.querySelector("select"), "completed");
    expect(feedback.listArchivedFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { offset: 0, search: "", sort: [], statuses: ["completed"] },
      }),
    );
    await act(async () =>
      root.render(
        <AdminFeedbackArchivePage
          actorId="user_a"
          initialPage={{ ...page }}
          archiveStatuses={["completed", "canceled"]}
        />,
      ),
    );
    await click("Sync");
    session.userId = "user_b";
    await act(async () =>
      root.render(
        <AdminFeedbackArchivePage actorId="user_a" initialPage={page} />,
      ),
    );
    await act(async () => sync.resolve({ ok: true }));
    expect(container.textContent).toBe("");
  });
  it("retains notification acknowledgement when refresh fails and hides old-account notifications", async () => {
    session.invalidate.mockRejectedValueOnce(new Error("refresh"));
    const notifications = [
      {
        id: 1,
        type: "submitted" as const,
        title: "Private feedback",
        feedbackId: 1000,
        readByUsername: null,
        submitterUsername: "ada",
        createdAt: new Date("2026-09-28T12:00:00Z"),
        readAt: null,
      },
    ];
    await act(async () =>
      root.render(
        <AdminFeedbackNotificationsPage
          actorId="user_a"
          initialNotifications={notifications}
        />,
      ),
    );
    await click("Accept");
    await click("Accept");
    expect(
      feedback.markFeedbackNotificationRead,
    ).toHaveBeenCalledExactlyOnceWith({ data: { notificationId: 1 } });
    expect(session.invalidate).toHaveBeenCalledTimes(2);
    session.userId = "user_b";
    await act(async () =>
      root.render(
        <AdminFeedbackNotificationsPage
          actorId="user_a"
          initialNotifications={notifications}
        />,
      ),
    );
    expect(container.textContent).toBe("");
  });

  it("refreshes the current admin query after a slow sync instead of restoring its old query", async () => {
    vi.useFakeTimers();
    const sync =
      deferred<Awaited<ReturnType<typeof feedback.syncFeedbackStatus>>>();
    vi.mocked(feedback.syncFeedbackStatus).mockReturnValue(sync.promise);
    const page = {
      hasNext: false,
      items: [{ ...item, linearClientUuid: "linear-id" }],
    };
    await act(async () =>
      root.render(<AdminActiveFeedbackPage initialPage={page} />),
    );
    await click("Sync");
    await change(container.querySelector('input[type="search"]'), "new query");
    await act(async () => vi.advanceTimersByTime(150));
    await act(async () => sync.resolve({ ok: true }));
    expect(feedback.listAdminActiveFeedback).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { offset: 0, search: "new query", sort: [] },
      }),
    );
  });

  it("replaces a read that predates a confirmed vote and ignores its stale vote snapshot", async () => {
    const old = deferred<typeof activePage.items>();
    const fresh = deferred<typeof activePage.items>();
    vi.mocked(feedback.listActiveFeedback)
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(fresh.promise);
    vi.mocked(feedback.toggleFeedbackVote).mockResolvedValue(true);
    await act(async () =>
      root.render(<FeedbackBoardPage initialItems={activePage.items} />),
    );
    await submit(container.querySelector("form"));
    await click("Upvote");
    expect(
      vi.mocked(feedback.listActiveFeedback).mock.calls[0]?.[0]?.signal
        ?.aborted,
    ).toBe(true);
    await act(async () => old.resolve([item]));
    expect(
      container.querySelector('button[aria-pressed="true"]'),
    ).not.toBeNull();
    await act(async () =>
      fresh.resolve([{ ...item, hasVoted: true, voteCount: 9 }]),
    );
    expect(
      container.querySelector('button[aria-pressed="true"]'),
    ).not.toBeNull();
  });

  it("preserves a selected edit and focus when same-account loader data refreshes", async () => {
    await act(async () =>
      root.render(<AdminFeedbackRequestsPage initialPage={pendingPage} />),
    );
    await manage();
    await click("Edit");
    const input = container.querySelector<HTMLInputElement>(
      "#admin-feedback-title",
    );
    await change(input, "Unsaved review");
    input?.focus();
    await act(async () =>
      root.render(
        <AdminFeedbackRequestsPage
          initialPage={{ ...pendingPage, items: [...pendingPage.items] }}
        />,
      ),
    );
    expect(
      container.querySelector<HTMLInputElement>("#admin-feedback-title"),
    ).toBe(input);
    expect(input?.value).toBe("Unsaved review");
    expect(document.activeElement).toBe(input);
  });

  it("keeps category-required approval feedback in the edit form and permits a plain save", async () => {
    const page = {
      ...pendingPage,
      items: [{ ...item, status: "pending" as const, category: null }],
    };
    await act(async () =>
      root.render(<AdminFeedbackRequestsPage initialPage={page} />),
    );
    await manage();
    await click("Edit");
    const approve = button("Save & Approve");
    await submit(approve.closest("form"), approve);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(feedback.updateAdminFeedback).not.toHaveBeenCalled();
    await submit(button("Save").closest("form"));
    expect(feedback.updateAdminFeedback).toHaveBeenCalledOnce();
    expect(feedback.approveFeedback).not.toHaveBeenCalled();
  });
  it("retains one vote write while hidden and reconnects its confirmed result once", async () => {
    const write = deferred<boolean>();
    vi.mocked(feedback.toggleFeedbackVote).mockReturnValue(write.promise);
    /** Renders the account-scoped vote owner through Activity.
     * @param hidden - Whether effects are disconnected.
     * @returns Current vote fixture. */
    const view = (hidden: boolean) => (
      <StrictMode>
        <Activity mode={hidden ? "hidden" : "visible"}>
          <FeedbackBoardPage initialItems={activePage.items} />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(view(false)));
    await click("Upvote");
    await act(async () => root.render(view(true)));
    await act(async () => write.resolve(true));
    await act(async () => root.render(view(false)));
    expect(feedback.toggleFeedbackVote).toHaveBeenCalledOnce();
    expect(
      container.querySelector('button[aria-pressed="true"]'),
    ).not.toBeNull();
    await act(async () => root.render(view(true)));
    await act(async () => root.render(view(false)));
    expect(feedback.toggleFeedbackVote).toHaveBeenCalledOnce();
  });

  it("aborts hidden search reads and starts a fresh observer on Activity resumption", async () => {
    const old = deferred<typeof activePage.items>();
    const fresh = deferred<typeof activePage.items>();
    vi.mocked(feedback.listActiveFeedback)
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(fresh.promise);
    /** Renders the current search read through Activity.
     * @param hidden - Whether effects are disconnected.
     * @returns Current search fixture. */
    const view = (hidden: boolean) => (
      <Activity mode={hidden ? "hidden" : "visible"}>
        <FeedbackBoardPage initialItems={activePage.items} />
      </Activity>
    );
    await act(async () => root.render(view(false)));
    await submit(container.querySelector("form"));
    await act(async () => root.render(view(true)));
    expect(
      vi.mocked(feedback.listActiveFeedback).mock.calls[0]?.[0]?.signal
        ?.aborted,
    ).toBe(true);
    await act(async () => root.render(view(false)));
    await act(async () => old.resolve([{ ...item, title: "Old observer" }]));
    expect(container.textContent).not.toContain("Old observer");
    await act(async () => fresh.resolve([item]));
    await act(async () => root.render(view(true)));
    await act(async () => root.render(view(false)));
    expect(feedback.listActiveFeedback).toHaveBeenCalledTimes(2);
  });
});
