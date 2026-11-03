/** @vitest-environment jsdom */
import { Activity, act, type ReactNode, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getChangelogEntries } from "@/lib/changelog-content";
import { markHydrated } from "@/lib/hydration-marker";
import { ChangelogEntryPage } from "@/pages/changelog-pages";
import { RouteErrorView } from "@/pages/route-error-page";
import { ActivityTrendsChart } from "./activity-trends-chart";
import { CatalogTrendsChart } from "./catalog-trends-chart";

/** Controlled chart resources, clipboard, and current locale. */
const mocks = vi.hoisted(() => ({
  chart: vi.fn(),
  destroys: [] as ReturnType<typeof vi.fn>[],
  clipboard: vi.fn(),
  locale: "en-US" as "en-US" | "es-MX",
}));
vi.mock("highcharts/es-modules/masters/highcharts.src.js", () => ({
  default: { chart: mocks.chart },
}));
vi.mock(
  "highcharts/es-modules/masters/modules/accessibility.src.js",
  () => ({}),
);
vi.mock("highcharts/es-modules/masters/modules/drilldown.src.js", () => ({}));
vi.mock("@/providers/locale-provider", () => ({
  /** Supplies current localized presentation copy.
   * @returns Current locale. */
  useLocale: () => ({ locale: mocks.locale }),
}));
vi.mock("@/components/app-shell", () => ({
  /** Omits unrelated provider and shell lifetimes.
   * @param props - Current presentation contents.
   * @returns Current presentation contents. */
  AppShell: ({
    children,
  }: {
    /** Current presentation contents. */ children: ReactNode;
  }) => children,
}));
vi.mock("@/components/markdown-content", () => ({
  /** Omits unrelated Markdown parsing.
   * @returns No additional presentation lifetimes. */
  MarkdownContent: () => null,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
/** Creates an explicitly settled browser operation.
 * @template T - Browser acknowledgement value.
 * @returns Deferred operation and its completion command. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
/** Stable activity data avoids artificial resource recreation. */
const series = [
  {
    name: "Recorded items",
    values: [{ bucketStart: new Date("2026-10-01T00:00:00Z"), count: 3 }],
  },
];
/** Stable catalog composition data. */
const trends = [{ productTypeId: 1, productTypeName: "Pen", count: 3 }];

describe("presentation DOM and async lifetimes", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.destroys = [];
    mocks.locale = "en-US";
    mocks.chart.mockImplementation(() => {
      const destroy = vi.fn();
      mocks.destroys.push(destroy);
      return { destroy };
    });
    mocks.clipboard.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mocks.clipboard },
    });
    delete document.documentElement.dataset.hydrated;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  /** Clicks the existing presentation command.
   * @param text - Existing visible command.
   * @rejects When the expected command is absent. */
  async function click(text: string) {
    const button = [...container.querySelectorAll("button")].find(
      (node) => node.textContent?.trim() === text,
    );
    if (!button) throw new Error(`Expected command: ${text}`);
    await act(async () => button.click());
  }

  it("creates no charts during SSR and disposes/recreates exact DOM resources in StrictMode and Activity", async () => {
    const selected = vi.fn();
    /** Renders both chart resources with stable inputs.
     * @param hidden - Whether their DOM lifetimes are disconnected.
     * @param label - Current chart label.
     * @returns Current chart fixtures. */
    const view = (hidden: boolean, label = "Activity") => (
      <StrictMode>
        <Activity mode={hidden ? "hidden" : "visible"}>
          <ActivityTrendsChart
            chartLabel={label}
            dateLabel="Period"
            locale="en-US"
            series={series}
          />
          <CatalogTrendsChart
            chartLabel="Composition"
            catalogProductsLabel="Products"
            otherLabel="Other"
            trends={trends}
            onProductTypeSelect={selected}
          />
        </Activity>
      </StrictMode>
    );
    expect(renderToString(view(false))).toContain("<table");
    expect(mocks.chart).not.toHaveBeenCalled();
    await act(async () => root.render(view(false)));
    const mounted = mocks.chart.mock.calls.length;
    expect(mounted).toBeGreaterThanOrEqual(2);
    await act(async () => root.render(view(false)));
    expect(mocks.chart).toHaveBeenCalledTimes(mounted);
    await act(async () => root.render(view(false, "Updated activity")));
    expect(mocks.chart).toHaveBeenCalledTimes(mounted + 1);
    await act(async () => root.render(view(true, "Updated activity")));
    expect(
      mocks.destroys.every((destroy) => destroy.mock.calls.length === 1),
    ).toBe(true);
    await act(async () => root.render(view(false, "Updated activity")));
    expect(mocks.chart.mock.calls.length).toBeGreaterThanOrEqual(mounted + 3);
    expect(
      mocks.destroys.filter((destroy) => destroy.mock.calls.length === 0),
    ).toHaveLength(2);
    const catalog = mocks.chart.mock.calls.at(-1)?.[1];
    catalog?.series?.[0]?.data?.[0]?.events?.click();
    expect(selected).toHaveBeenCalledExactlyOnceWith(1);
    await act(async () => root.render(null));
    expect(
      mocks.destroys.every((destroy) => destroy.mock.calls.length === 1),
    ).toBe(true);
  });

  it("marks readiness only at DOM commit and removes/restores it with the owned surface", async () => {
    const clicked = vi.fn();
    /** Renders the real readiness callback on an interactive surface.
     * @param hidden - Whether its DOM lifetime is disconnected.
     * @returns Current readiness fixture. */
    const view = (hidden: boolean) => (
      <StrictMode>
        <Activity mode={hidden ? "hidden" : "visible"}>
          <main ref={markHydrated}>
            <button onClick={clicked} type="button">
              Fixture action
            </button>
          </main>
        </Activity>
      </StrictMode>
    );
    renderToString(view(false));
    expect(document.documentElement.dataset.hydrated).toBeUndefined();
    await act(async () => root.render(view(false)));
    expect(document.documentElement.dataset.hydrated).toBe("true");
    await click("Fixture action");
    expect(clicked).toHaveBeenCalledOnce();
    await act(async () => root.render(view(true)));
    expect(document.documentElement.dataset.hydrated).toBeUndefined();
    await act(async () => root.render(view(false)));
    expect(document.documentElement.dataset.hydrated).toBe("true");
    await act(async () => root.render(null));
    expect(document.documentElement.dataset.hydrated).toBeUndefined();
  });

  it("retains a pending clipboard write across Activity and ignores a replaced entry's late feedback", async () => {
    const entry = getChangelogEntries("en-US")[0];
    if (!entry) throw new Error("Expected changelog fixture");
    const old = deferred<void>();
    mocks.clipboard.mockReturnValueOnce(old.promise);
    /** Renders the current copy source through Activity.
     * @param hidden - Whether its copy observer is disconnected.
     * @returns Current changelog fixture. */
    const view = (hidden: boolean) => (
      <StrictMode>
        <Activity mode={hidden ? "hidden" : "visible"}>
          <ChangelogEntryPage entry={entry} />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(view(false)));
    await click("Copy link");
    await act(async () => root.render(view(true)));
    await act(async () => old.resolve());
    await act(async () => root.render(view(false)));
    expect(mocks.clipboard).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Link copied",
    );
    const late = deferred<void>();
    mocks.clipboard.mockReturnValueOnce(late.promise);
    await click("Copy link");
    await act(async () =>
      root.render(
        <ChangelogEntryPage
          entry={{ ...entry, slug: "next-entry", title: "Next entry" }}
        />,
      ),
    );
    await act(async () => late.resolve());
    expect(container.querySelector('[role="status"]')?.textContent).toBe("");
    mocks.clipboard.mockRejectedValueOnce(new Error("denied"));
    await click("Copy link");
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Couldn’t copy link",
    );
    await click("Copy link");
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Link copied",
    );
  });

  it("retains retry acknowledgement while hidden and stops stale retry/copy observers on a new error", async () => {
    const error = new Error("offline");
    const refresh = deferred<void>();
    const retry = vi
      .fn()
      .mockReturnValueOnce(refresh.promise)
      .mockResolvedValue(undefined);
    /** Renders a stable boundary identity through Activity.
     * @param hidden - Whether its observers are disconnected.
     * @returns Current recovery fixture. */
    const view = (hidden: boolean) => (
      <StrictMode>
        <Activity mode={hidden ? "hidden" : "visible"}>
          <RouteErrorView
            development
            error={error}
            locale="en-US"
            pathname="/products"
            onRetry={retry}
          />
        </Activity>
      </StrictMode>
    );
    await act(async () => root.render(view(false)));
    await click("Retry");
    await act(async () => root.render(view(true)));
    await act(async () => refresh.resolve());
    await act(async () => root.render(view(false)));
    expect(retry).toHaveBeenCalledOnce();
    expect(container.querySelector('button[aria-busy="false"]')).not.toBeNull();
    await click("Copy error details");
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Copied",
    );
    await act(async () =>
      root.render(
        <RouteErrorView
          development
          error={new Error("new boundary")}
          locale="en-US"
          pathname="/makers"
          onRetry={retry}
        />,
      ),
    );
    expect(container.querySelector('[role="status"]')?.textContent).toBe("");
    retry.mockRejectedValueOnce(new Error("still offline"));
    await click("Retry");
    expect(container.querySelector('button[aria-busy="false"]')).not.toBeNull();
  });
});
