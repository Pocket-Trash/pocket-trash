/** @vitest-environment jsdom */

import { Activity, act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadResourceFile, downloadResourceVersion } from "@/lib/resources";
import { useResourceDownloads } from "./use-resource-downloads";

/** Current signed URL account. */
const session = vi.hoisted(() => ({ userId: "user_a" }));
vi.mock("@clerk/tanstack-react-start", () => ({
  /** Supplies the signed URL account.
   * @returns Current account context. */
  useAuth: () => ({ userId: session.userId }),
}));
vi.mock("@/lib/resources", () => ({
  downloadResourceFile: vi.fn(),
  downloadResourceVersion: vi.fn(),
}));
vi.mock("@/providers/locale-provider", () => ({
  /** Supplies the test locale.
   * @returns English locale context. */
  useLocale: () => ({ locale: "en-US" }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/**
 * Drives both public download commands and renders their control state.
 * @param props - Current resource identity.
 * @returns Download controls and archive fallback state.
 */
function Downloads({
  id,
}: {
  /** Current resource identifier. */
  id: number;
}) {
  const state = useResourceDownloads(id, true);
  return (
    <>
      <button
        disabled={state.downloadingFileId === 1}
        onClick={() => state.startFile(1, "one.stl")}
      >
        One
      </button>
      <button
        disabled={state.downloadingFileId === 2}
        onClick={() => state.startFile(2, "two.stl")}
      >
        Two
      </button>
      <button
        disabled={
          state.downloadingVersionId === 3 || state.failedVersionIds.has(3)
        }
        onClick={() => state.startVersion(3, 1)}
      >
        Archive
      </button>
      <output>{state.failedVersionIds.has(3) ? "fallback" : ""}</output>
    </>
  );
}

describe("resource download lifecycle", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.resetAllMocks();
    session.userId = "user_a";
    window.history.replaceState(null, "", "/");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("makes missing file URLs retryable and archive failures terminal with the detail fallback", async () => {
    vi.mocked(downloadResourceFile)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("#file");
    vi.mocked(downloadResourceVersion).mockRejectedValue(
      new Error("archive unavailable"),
    );
    await act(async () => root.render(<Downloads id={42} />));
    const buttons = container.querySelectorAll("button");
    await act(async () => buttons[0]?.click());
    expect(buttons[0]?.disabled).toBe(false);
    expect(toast.error).toHaveBeenCalledTimes(1);
    await act(async () => buttons[0]?.click());
    expect(window.location.hash).toBe("#file");
    expect(buttons[0]?.disabled).toBe(true);
    await act(async () => buttons[2]?.click());
    expect(buttons[2]?.disabled).toBe(true);
    expect(container.querySelector("output")?.textContent).toBe("fallback");
    expect(toast.error).toHaveBeenLastCalledWith(
      expect.stringContaining("resource-42-v1.zip"),
      expect.objectContaining({ description: expect.anything() }),
    );
    await act(async () => buttons[2]?.click());
    expect(downloadResourceVersion).toHaveBeenCalledTimes(1);
  });

  it("ignores replaced channels and resource identities before navigating to a signed URL", async () => {
    /**
     * Completes the superseded file request.
     * @param value - Late signed URL.
     * @returns Nothing.
     */
    let complete: (value: string) => void = (value) => {
      void value;
    };
    vi.mocked(downloadResourceFile)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          complete = resolve;
        }),
      )
      .mockResolvedValueOnce("#current");
    await act(async () => root.render(<Downloads id={42} />));
    await act(async () => container.querySelectorAll("button")[0]?.click());
    await act(async () => container.querySelectorAll("button")[1]?.click());
    await act(async () => complete("#stale"));
    expect(window.location.hash).toBe("#current");
    vi.mocked(downloadResourceFile).mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    await act(async () => container.querySelectorAll("button")[0]?.click());
    await act(async () => root.render(<Downloads id={43} />));
    await act(async () => complete("#private-old-resource"));
    expect(window.location.hash).toBe("#current");
    expect(container.querySelector("button")?.disabled).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("disposes pending signed URLs when the account changes on the same resource", async () => {
    /** Completes the prior account download.
     * @param value - Prior account signed URL.
     * @returns Nothing. */
    let complete: (value: string) => void = (value) => {
      void value;
    };
    vi.mocked(downloadResourceFile).mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    await act(async () => root.render(<Downloads id={42} />));
    await act(async () => container.querySelector("button")?.click());
    session.userId = "user_b";
    await act(async () => root.render(<Downloads id={42} />));
    await act(async () => complete("#old-account-url"));
    expect(window.location.hash).toBe("");
    expect(container.querySelector("button")?.disabled).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("retains a recorded download across StrictMode and pending/completed Activity cycles", async () => {
    /**
     * Completes the recorded file download.
     * @param value - Signed URL returned while hidden.
     * @returns Nothing.
     */
    let complete: (value: string) => void = (value) => {
      void value;
    };
    vi.mocked(downloadResourceFile).mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    /**
     * Renders one preserved download consumer.
     * @param mode - Activity visibility.
     * @returns Strict download consumer.
     */
    const tree = (mode: "visible" | "hidden") => (
      <StrictMode>
        <Activity mode={mode}>
          <Downloads id={42} />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(tree("visible")));
    await act(async () => container.querySelector("button")?.click());
    await act(async () => root.render(tree("hidden")));
    await act(async () => root.render(tree("visible")));
    expect(downloadResourceFile).toHaveBeenCalledTimes(1);
    await act(async () => root.render(tree("hidden")));
    await act(async () => complete("#resumed"));
    expect(window.location.hash).toBe("");
    await act(async () => root.render(tree("visible")));
    expect(window.location.hash).toBe("#resumed");
    window.history.replaceState(null, "", "/#after-terminal");
    await act(async () => root.render(tree("hidden")));
    await act(async () => root.render(tree("visible")));
    expect(window.location.hash).toBe("#after-terminal");
    expect(downloadResourceFile).toHaveBeenCalledExactlyOnceWith({
      data: { fileId: 1, resourceId: 42 },
    });
  });
});
