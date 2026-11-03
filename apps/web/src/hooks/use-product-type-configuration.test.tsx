/** @vitest-environment jsdom */

import { Activity, act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  setProductTypePartOrAccessory,
  setProductTypeTrendsInclusion,
} from "@/lib/catalog-api";
import { useProductTypeConfiguration } from "./use-product-type-configuration";

/** Current configuration account. */
const session = vi.hoisted(() => ({ userId: "user_a" }));
vi.mock("@clerk/tanstack-react-start", () => ({
  /** Supplies current account identity.
   * @returns Current test account. */
  useAuth: () => ({ userId: session.userId }),
}));
vi.mock("@/providers/locale-provider", () => ({
  /** Supplies the active locale.
   * @returns English locale context. */
  useLocale: () => ({ locale: "en-US" }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/catalog-api", () => ({
  setProductTypePartOrAccessory: vi.fn(),
  setProductTypeTrendsInclusion: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
/** Canonical initial product-type rows. */
const firstRow = {
  id: 1,
  name: "Type 1",
  slug: "type-1",
  isPartOrAccessory: false,
  imageAlt: "",
  imageUrl: "",
};
/** Second independently configurable row. */
const secondRow = { ...firstRow, id: 2, name: "Type 2", slug: "type-2" };
/** Canonical initial configuration list. */
const rows = [firstRow, secondRow];

/**
 * Drives independent configuration rows through public checkbox intent.
 * @param props - Current Router-loaded configuration rows.
 * @returns Configuration rows and server-write eligibility.
 */
function Configuration({
  initialRows = rows,
}: {
  /** Current Router-loaded configuration rows. */
  initialRows?: typeof rows;
} = {}) {
  const state = useProductTypeConfiguration(initialRows, "classification");
  return (
    <>
      {state.rows.map((row) => (
        <input
          key={row.id}
          aria-label={row.name}
          type="checkbox"
          checked={row.isPartOrAccessory}
          disabled={state.savingIds.has(row.id)}
          onChange={(event) => state.changeRow(row.id, event.target.checked)}
        />
      ))}
    </>
  );
}

describe("product-type configuration lifetimes", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    session.userId = "user_a";
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("does no I/O during SSR and collapses rapid changes to the last value", async () => {
    expect(renderToString(<Configuration />)).toContain('aria-label="Type 1"');
    expect(setProductTypePartOrAccessory).not.toHaveBeenCalled();
    vi.mocked(setProductTypePartOrAccessory).mockResolvedValue(firstRow);
    await act(async () => root.render(<Configuration />));
    const field = container.querySelector("input");
    await act(async () => field?.click());
    await act(async () => vi.advanceTimersByTimeAsync(200));
    await act(async () => field?.click());
    await act(async () => vi.advanceTimersByTimeAsync(200));
    expect(setProductTypePartOrAccessory).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(setProductTypePartOrAccessory).toHaveBeenCalledExactlyOnceWith({
      data: { productTypeId: 1, isPartOrAccessory: false },
    });
  });

  it("rolls back only the failed row and leaves other canonical saves intact", async () => {
    vi.mocked(setProductTypePartOrAccessory)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ...secondRow, isPartOrAccessory: true });
    await act(async () => root.render(<Configuration />));
    const fields = container.querySelectorAll("input");
    await act(async () => fields[0]?.click());
    await act(async () => fields[1]?.click());
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(fields[0]?.checked).toBe(false);
    expect(fields[1]?.checked).toBe(true);
    expect(fields[0]?.disabled).toBe(false);
    expect(fields[1]?.disabled).toBe(false);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    vi.mocked(setProductTypePartOrAccessory).mockResolvedValueOnce({
      ...firstRow,
      isPartOrAccessory: true,
    });
    await act(async () => fields[0]?.click());
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(fields[0]?.checked).toBe(true);
  });

  it("cancels hidden timers and reattaches one pending write across StrictMode/Activity", async () => {
    /** Completes the canonical row write.
     * @param value - Canonical row result.
     * @returns Nothing. */
    let complete: (
      value: Awaited<ReturnType<typeof setProductTypePartOrAccessory>>,
    ) => void = (value) => {
      void value;
    };
    vi.mocked(setProductTypePartOrAccessory).mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    /**
     * Preserves one row consumer across visibility changes.
     * @param mode - Activity visibility.
     * @returns Strict configuration consumer.
     */
    const tree = (mode: "visible" | "hidden") => (
      <StrictMode>
        <Activity mode={mode}>
          <Configuration />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(tree("visible")));
    await act(async () => container.querySelector("input")?.click());
    await act(async () => root.render(tree("hidden")));
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(setProductTypePartOrAccessory).not.toHaveBeenCalled();
    await act(async () => root.render(tree("visible")));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(container.querySelector("input")?.disabled).toBe(true);
    await act(async () => root.render(tree("hidden")));
    await act(async () => complete({ ...firstRow, isPartOrAccessory: true }));
    expect(toast.success).not.toHaveBeenCalled();
    await act(async () => root.render(tree("visible")));
    expect(setProductTypePartOrAccessory).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    await act(async () => root.render(tree("hidden")));
    await act(async () => root.render(tree("visible")));
    expect(setProductTypePartOrAccessory).toHaveBeenCalledTimes(1);
  });

  it("receives refreshed loader rows while preserving pending intent and updating rollback snapshots", async () => {
    vi.mocked(setProductTypePartOrAccessory).mockRejectedValueOnce(
      new Error("offline"),
    );
    await act(async () => root.render(<Configuration />));
    const first = container.querySelector("input");
    await act(async () => first?.click());
    const refreshed = [
      { ...firstRow, isPartOrAccessory: true },
      { ...secondRow, isPartOrAccessory: true },
      { ...firstRow, id: 3, name: "Type 3" },
    ];
    await act(async () =>
      root.render(<Configuration initialRows={refreshed} />),
    );
    expect(container.querySelector("input")).toBe(first);
    expect(container.querySelectorAll("input")).toHaveLength(3);
    expect(container.querySelectorAll("input")[1]?.checked).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(first?.checked).toBe(true);
    expect(toast.error).toHaveBeenCalledTimes(1);
    await act(async () => container.querySelectorAll("input")[2]?.click());
    await act(async () =>
      root.render(<Configuration initialRows={refreshed.slice(0, 2)} />),
    );
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(setProductTypePartOrAccessory).toHaveBeenCalledTimes(1);
  });

  it("persists Trends inclusion immediately through its existing endpoint", async () => {
    /**
     * Drives the Trends configuration consumer.
     * @returns One Trends inclusion checkbox.
     */
    function Trends() {
      const state = useProductTypeConfiguration(
        [{ ...firstRow, isPartOrAccessory: true, includeInTrends: false }],
        "trends",
      );
      const row = state.rows[0];
      return (
        <input
          type="checkbox"
          checked={row?.includeInTrends ?? false}
          onChange={(event) => state.changeRow(1, event.target.checked)}
        />
      );
    }
    vi.mocked(setProductTypeTrendsInclusion).mockResolvedValue({
      ...firstRow,
      isPartOrAccessory: true,
      includeInTrends: true,
    });
    await act(async () => root.render(<Trends />));
    await act(async () => container.querySelector("input")?.click());
    expect(setProductTypeTrendsInclusion).toHaveBeenCalledExactlyOnceWith({
      data: { includeInTrends: true, productTypeId: 1 },
    });
    expect(container.querySelector("input")?.checked).toBe(true);
    expect(setProductTypePartOrAccessory).not.toHaveBeenCalled();
  });

  it("disposes prior-account row results and pending timers", async () => {
    /** Completes the old account write.
     * @param value - Old account canonical result.
     * @returns Nothing. */
    let complete: (
      value: Awaited<ReturnType<typeof setProductTypePartOrAccessory>>,
    ) => void = (value) => {
      void value;
    };
    vi.mocked(setProductTypePartOrAccessory).mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    await act(async () => root.render(<Configuration />));
    await act(async () => container.querySelector("input")?.click());
    await act(async () => vi.advanceTimersByTimeAsync(300));
    await act(async () => container.querySelectorAll("input")[1]?.click());
    session.userId = "user_b";
    await act(async () => root.render(<Configuration />));
    await act(async () => {
      complete({ ...firstRow, isPartOrAccessory: true });
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(setProductTypePartOrAccessory).toHaveBeenCalledTimes(1);
    expect(
      [...container.querySelectorAll("input")].every(
        (field) => !field.checked && !field.disabled,
      ),
    ).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
