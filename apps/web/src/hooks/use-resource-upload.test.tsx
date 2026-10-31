/** @vitest-environment jsdom */

import { Activity, act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadResourceSession } from "@/lib/upload-sessions";
import {
  type ResourceUploadRequest,
  useResourceUpload,
} from "./use-resource-upload";

/** Account and terminal navigation observers. */
const session = vi.hoisted(() => ({
  userId: "user_a",
  navigate: vi.fn(),
  getToken: vi.fn(),
}));
vi.mock("@clerk/tanstack-react-start", () => ({
  /**
   * Supplies the current test account.
   * @returns Scoped token and identity context.
   */
  useAuth: () => ({ userId: session.userId, getToken: session.getToken }),
}));
vi.mock("@tanstack/react-router", () => ({
  /**
   * Supplies the terminal navigation observer.
   * @returns Navigation spy.
   */
  useNavigate: () => session.navigate,
}));
vi.mock("@/providers/locale-provider", () => ({
  /**
   * Supplies the active test locale.
   * @returns English locale context.
   */
  useLocale: () => ({ locale: "en-US" }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/upload-sessions", async (original) => ({
  ...(await original<object>()),
  uploadResourceSession: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/**
 * Drives resource upload through its semantic public command.
 * @param props - Captured authoring request.
 * @returns Current upload eligibility and progress.
 */
function UploadFixture({
  input,
}: {
  /** Current validated authoring request. */ input: ResourceUploadRequest;
}) {
  const { startUpload, status, submitting } = useResourceUpload();
  return (
    <>
      <button
        disabled={submitting}
        onClick={() => startUpload(input)}
        type="button"
      >
        Upload
      </button>
      <output>{status}</output>
    </>
  );
}

describe("resource upload lifecycle", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.resetAllMocks();
    session.userId = "user_a";
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("preserves a pending session and reattaches progress after StrictMode/Activity resumption", async () => {
    /**
     * Completes the pending resource upload response.
     * @param value - Completed resource/version identifiers.
     * @returns Nothing.
     */
    let complete: (
      value: Awaited<ReturnType<typeof uploadResourceSession>>,
    ) => void = (value) => {
      void value;
    };
    const pending = new Promise<
      Awaited<ReturnType<typeof uploadResourceSession>>
    >((resolve) => {
      complete = resolve;
    });
    vi.mocked(uploadResourceSession).mockReturnValue(pending);
    const input: ResourceUploadRequest = {
      operation: "create",
      categories: ["Pens"],
      files: [new File(["file"], "private.stl")],
      images: [],
      name: "Resource",
      description: "Description",
      isPrivate: true,
    };
    /**
     * Keeps one account upload through Activity visibility changes.
     * @param mode - Activity visibility.
     * @returns Wrapped resource upload consumer.
     */
    const tree = (mode: "visible" | "hidden") => (
      <StrictMode>
        <Activity mode={mode}>
          <UploadFixture input={input} />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(tree("visible")));
    await act(async () => container.querySelector("button")?.click());
    expect(uploadResourceSession).toHaveBeenCalledTimes(1);
    expect(uploadResourceSession).toHaveBeenCalledWith(
      expect.objectContaining(input),
    );
    const request = vi.mocked(uploadResourceSession).mock.calls[0]?.[0];
    await act(async () => request?.onProgress?.("private.stl", 25));
    expect(container.textContent).toContain("private.stl");
    await act(async () => root.render(tree("hidden")));
    await act(async () => root.render(tree("visible")));
    await act(async () => request?.onProgress?.("private.stl", 75));
    expect(container.textContent).toContain("75");
    expect(uploadResourceSession).toHaveBeenCalledTimes(1);
    await act(async () => root.render(tree("hidden")));
    await act(async () => complete({ resourceId: 42, version: 1 }));
    expect(toast.success).not.toHaveBeenCalled();
    expect(session.navigate).not.toHaveBeenCalled();
    await act(async () => root.render(tree("visible")));
    expect(uploadResourceSession).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(session.navigate).toHaveBeenCalledExactlyOnceWith({
      params: { resourceId: "42" },
      to: "/resources/$resourceId",
    });
    await act(async () => request?.onProgress?.("late.stl", 100));
    expect(container.querySelector("output")?.textContent).toBe("");
    await act(async () => root.render(tree("hidden")));
    await act(async () => root.render(tree("visible")));
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("allows retry after a failed version session without changing the version/reason payload", async () => {
    vi.mocked(uploadResourceSession)
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce({ resourceId: 42, version: 2 });
    const input: ResourceUploadRequest = {
      operation: "version",
      resourceId: 42,
      reason: "Staff review",
      files: [new File(["version"], "next.stl")],
    };
    await act(async () => root.render(<UploadFixture input={input} />));
    await act(async () => container.querySelector("button")?.click());
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(container.querySelector("button")?.disabled).toBe(false);
    await act(async () => container.querySelector("button")?.click());
    expect(uploadResourceSession).toHaveBeenCalledTimes(2);
    expect(uploadResourceSession).toHaveBeenLastCalledWith(
      expect.objectContaining(input),
    );
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(session.navigate).toHaveBeenCalledTimes(1);
  });

  it("disposes prior-account feedback and ignores late private upload progress/results", async () => {
    /**
     * Completes the old account's pending upload response.
     * @param value - Completed resource/version identifiers.
     * @returns Nothing.
     */
    let complete: (
      value: Awaited<ReturnType<typeof uploadResourceSession>>,
    ) => void = (value) => {
      void value;
    };
    const pending = new Promise<
      Awaited<ReturnType<typeof uploadResourceSession>>
    >((resolve) => {
      complete = resolve;
    });
    vi.mocked(uploadResourceSession).mockReturnValue(pending);
    const input: ResourceUploadRequest = {
      operation: "create",
      files: [new File(["private"], "old-private.stl")],
    };
    await act(async () => root.render(<UploadFixture input={input} />));
    await act(async () => container.querySelector("button")?.click());
    const request = vi.mocked(uploadResourceSession).mock.calls[0]?.[0];
    await act(async () => request?.onProgress?.("old-private.stl", 10));
    session.userId = "user_b";
    await act(async () => root.render(<UploadFixture input={input} />));
    await act(async () => {
      request?.onProgress?.("old-private.stl", 100);
      complete({ resourceId: 42, version: 1 });
    });
    expect(container.querySelector("output")?.textContent).toBe("");
    expect(container.querySelector("button")?.disabled).toBe(false);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(session.navigate).not.toHaveBeenCalled();
  });
});
