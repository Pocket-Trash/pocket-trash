/** @vitest-environment jsdom */

import { Activity, act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AdminErasureStatusView,
  type ErasureStatusView,
  getAdminErasureStatus,
  getSelfErasureStatus,
} from "@/lib/account-erasure";
import { useErasurePolling } from "./use-erasure-polling";

/** Current account and Clerk redirect observers. */
const session = vi.hoisted(() => ({ userId: "user_a", signOut: vi.fn() }));
vi.mock("@clerk/tanstack-react-start", () => ({
  /** Supplies the current polling account.
   * @returns Current account identity. */
  useAuth: () => ({ userId: session.userId }),
  /** Supplies Clerk's existing signed-out redirect boundary.
   * @returns Sign-out observer. */
  useClerk: () => ({ signOut: session.signOut }),
}));
vi.mock("@/lib/account-erasure", () => ({
  getAdminErasureStatus: vi.fn(),
  getSelfErasureStatus: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
/** Current request receipt. */
const processing: AdminErasureStatusView = {
  requestId: "00000000-0000-4000-8000-000000000001",
  status: "processing",
  errorCode: null,
  targetClerkId: "target_user",
};

/**
 * Observes self/admin polling through its public receipt/feedback seam.
 * @param props - Current receipt, protocol, and explicit retry lifetime.
 * @returns Current receipt status and terminal feedback markers.
 */
function Polling({
  initial = processing,
  mode = "self",
  retry = 0,
}: {
  /** Current owner-supplied receipt. */
  initial?: ErasureStatusView | AdminErasureStatusView;
  /** Existing status protocol. */
  mode?: "self" | "admin";
  /** Explicit administrator retry lifetime. */
  retry?: number;
}) {
  const state = useErasurePolling(initial, mode, retry);
  return (
    <output data-failed={state.failed} data-signed-out={state.signedOut}>
      {state.status?.requestId}:{state.status?.status}
    </output>
  );
}

describe("erasure polling lifetimes", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    session.userId = "user_a";
    session.signOut.mockResolvedValue(undefined);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("keeps SSR pure, waits three seconds, and stops at needs-support/completed states", async () => {
    expect(renderToString(<Polling />)).toContain("processing");
    expect(getSelfErasureStatus).not.toHaveBeenCalled();
    vi.mocked(getSelfErasureStatus)
      .mockResolvedValueOnce(processing)
      .mockResolvedValueOnce({ ...processing, status: "needs_support" });
    await act(async () => root.render(<Polling />));
    await act(async () => vi.advanceTimersByTimeAsync(2999));
    expect(getSelfErasureStatus).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(getSelfErasureStatus).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(container.textContent).toContain("needs_support");
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(getSelfErasureStatus).toHaveBeenCalledTimes(2);
    await act(async () =>
      root.render(<Polling initial={{ ...processing, status: "completed" }} />),
    );
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(container.textContent).toContain("completed");
    expect(getSelfErasureStatus).toHaveBeenCalledTimes(2);
  });

  it("aborts replaced receipts and ignores their late private status", async () => {
    /** Completes an old receipt status.
     * @param value - Superseded receipt.
     * @returns Nothing. */
    let complete: (value: AdminErasureStatusView) => void = (value) => {
      void value;
    };
    vi.mocked(getAdminErasureStatus)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          complete = resolve;
        }),
      )
      .mockResolvedValueOnce({
        ...processing,
        requestId: "00000000-0000-4000-8000-000000000002",
        status: "completed",
      });
    await act(async () => root.render(<Polling mode="admin" />));
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    await act(async () =>
      root.render(
        <Polling
          mode="admin"
          initial={{
            ...processing,
            requestId: "00000000-0000-4000-8000-000000000002",
          }}
        />,
      ),
    );
    expect(
      vi.mocked(getAdminErasureStatus).mock.calls[0]?.[0]?.signal?.aborted,
    ).toBe(true);
    await act(async () =>
      complete({
        ...processing,
        status: "needs_support",
        errorCode: "private_old_failure",
      }),
    );
    expect(container.textContent).not.toContain("needs_support");
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(container.textContent).toContain("000000000002:completed");
    expect(getAdminErasureStatus).toHaveBeenCalledTimes(2);
  });

  it("cancels hidden timers/reads and restarts the current read on Activity resumption", async () => {
    /** Completes the currently active status read.
     * @param value - Current receipt status.
     * @returns Nothing. */
    let complete: (value: AdminErasureStatusView) => void = (value) => {
      void value;
    };
    vi.mocked(getAdminErasureStatus).mockImplementation(
      (input) =>
        new Promise((resolve, reject) => {
          complete = resolve;
          input?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    /**
     * Preserves the receipt consumer's logical state through visibility changes.
     * @param mode - Activity visibility.
     * @returns Strict polling consumer.
     */
    const tree = (mode: "visible" | "hidden") => (
      <StrictMode>
        <Activity mode={mode}>
          <Polling mode="admin" />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(tree("visible")));
    await act(async () => root.render(tree("hidden")));
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(getAdminErasureStatus).not.toHaveBeenCalled();
    await act(async () => root.render(tree("visible")));
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    await act(async () => root.render(tree("hidden")));
    expect(
      vi.mocked(getAdminErasureStatus).mock.calls[0]?.[0]?.signal?.aborted,
    ).toBe(true);
    await act(async () => root.render(tree("visible")));
    const attempts = vi.mocked(getAdminErasureStatus).mock.calls;
    expect(attempts.length).toBeGreaterThanOrEqual(2);
    expect(
      attempts.slice(0, -1).every(([input]) => input?.signal?.aborted),
    ).toBe(true);
    expect(attempts.at(-1)?.[0]?.signal?.aborted).toBe(false);
    await act(async () => complete({ ...processing, status: "completed" }));
    expect(container.querySelector("output")?.dataset.failed).toBe("false");
    const completedReads = attempts.length;
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(getAdminErasureStatus).toHaveBeenCalledTimes(completedReads);
  });

  it("retries failed/null polls and restarts same-ID receipts after explicit administrator retry", async () => {
    vi.mocked(getAdminErasureStatus)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...processing,
        status: "needs_support",
        errorCode: "retry_needed",
      })
      .mockResolvedValueOnce({ ...processing, status: "completed" });
    await act(async () => root.render(<Polling mode="admin" />));
    for (let poll = 0; poll < 3; poll++)
      await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(container.textContent).toContain("needs_support");
    expect(container.querySelector("output")?.dataset.failed).toBe("true");
    await act(async () => root.render(<Polling mode="admin" retry={1} />));
    expect(container.textContent).toContain("processing");
    expect(container.querySelector("output")?.dataset.failed).toBe("false");
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(container.textContent).toContain("completed");
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(getAdminErasureStatus).toHaveBeenCalledTimes(4);
  });

  it("stops reads on signed-out status and resumes one pending Clerk redirect without replay", async () => {
    vi.mocked(getSelfErasureStatus).mockResolvedValue("signed_out");
    /** Completes the pending Clerk sign-out redirect. */
    let complete = () => {};
    session.signOut.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
    );
    /**
     * Preserves the current self-erasure consumer.
     * @param mode - Activity visibility.
     * @returns Strict self-erasure consumer.
     */
    const tree = (mode: "visible" | "hidden") => (
      <StrictMode>
        <Activity mode={mode}>
          <Polling />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(tree("visible")));
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(session.signOut).toHaveBeenCalledExactlyOnceWith({
      redirectUrl: "/account-erased",
    });
    await act(async () => root.render(tree("hidden")));
    await act(async () => root.render(tree("visible")));
    expect(session.signOut).toHaveBeenCalledTimes(1);
    await act(async () => root.render(tree("hidden")));
    await act(async () => complete());
    await act(async () => root.render(tree("visible")));
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(getSelfErasureStatus).toHaveBeenCalledTimes(1);
    expect(session.signOut).toHaveBeenCalledTimes(1);
    expect(container.querySelector("output")?.dataset.signedOut).toBe("true");
  });

  it("retries only a failed signed-out redirect and stops polling on sign-out/unmount", async () => {
    vi.mocked(getSelfErasureStatus).mockResolvedValue("signed_out");
    session.signOut
      .mockRejectedValueOnce(new Error("redirect offline"))
      .mockResolvedValueOnce(undefined);
    await act(async () => root.render(<Polling />));
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(getSelfErasureStatus).toHaveBeenCalledTimes(1);
    expect(session.signOut).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(session.signOut).toHaveBeenCalledTimes(2);
    await act(async () => root.render(<Polling retry={1} />));
    session.userId = "";
    await act(async () => root.render(<Polling retry={1} />));
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(getSelfErasureStatus).toHaveBeenCalledTimes(1);
    await act(async () => root.render(null));
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(getSelfErasureStatus).toHaveBeenCalledTimes(1);
  });
});
