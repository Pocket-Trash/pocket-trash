/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RouteErrorPage,
  RouteErrorView,
  resolveRouteErrorLocale,
} from "./route-error-page";

const mocks = vi.hoisted(() => ({
  activeLocale: null as "en-US" | "es-MX" | null,
  invalidate: vi.fn(),
  loggerError: vi.fn(),
  pathname: "/products",
  rootLocale: null as "en-US" | "es-MX" | null,
}));

vi.mock("@clerk/tanstack-react-start", () => ({
  /**
   * Rejects authentication access from error recovery UI.
   *
   * @throws When the recovery page attempts to read authentication.
   */
  useAuth: () => {
    throw new Error("Authentication provider unavailable");
  },
}));

vi.mock("@tanstack/react-router", () => ({
  /**
   * Renders navigation without requiring router context.
   *
   * @param props - Navigation link properties.
   * @returns The navigation anchor.
   */
  Link: ({ children }: { /** Link contents. */ children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),

  /**
   * Returns the router invalidation fixture.
   *
   * @returns The router invalidation fixture.
   */
  useRouter: () => ({ invalidate: mocks.invalidate }),
  /**
   * Applies a route-state selector to the fixture state.
   *
   * @param root0 - Router-state hook options.
   * @returns The selected fixture value.
   */
  useRouterState: ({
    select,
  }: {
    /**
     * Selects a value from the route-state fixture.
     *
     * @param state - Route state supplied by the hook.
     * @returns The selected fixture value.
     */
    select: (state: unknown) => unknown;
  }) =>
    select({
      location: { pathname: mocks.pathname },
      matches: [
        {
          loaderData: {
            settingsState: { settings: { locale: mocks.rootLocale } },
          },
          routeId: "__root__",
        },
      ],
    }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError },
}));

vi.mock("@/providers/locale-provider", () => ({
  /**
   * Returns the configured active locale fixture.
   *
   * @returns The active locale, or `null` when unconfigured.
   */
  useOptionalLocale: () => mocks.activeLocale,
}));

(
  globalThis as {
    /** Enables React act-environment checks for this suite. */
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("RouteErrorPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeLocale = null;
    mocks.pathname = "/products";
    mocks.rootLocale = null;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
  });

  it("resolves locale from the provider, root settings, then English", () => {
    expect(resolveRouteErrorLocale("es-MX", "en-US")).toBe("es-MX");
    expect(resolveRouteErrorLocale(null, "es-MX")).toBe("es-MX");
    expect(resolveRouteErrorLocale(null, null)).toBe("en-US");
  });

  it("logs one serialized boundary error without the query string", () => {
    const error = new TypeError("render failed");
    mocks.pathname = "/products";

    act(() => root.render(<RouteErrorPage error={error} reset={vi.fn()} />));

    expect(mocks.loggerError).toHaveBeenCalledOnce();
    expect(mocks.loggerError).toHaveBeenCalledWith("web.route.error", {
      attributes: { route: "/products" },
      error,
    });
  });

  it("hides technical details in production", () => {
    act(() =>
      root.render(
        <RouteErrorView
          development={false}
          error={new Error("private failure")}
          locale="en-US"
          onRetry={vi.fn()}
          pathname="/products"
        />,
      ),
    );

    expect(container.textContent).not.toContain("Technical details");
    expect(container.textContent).not.toContain("private failure");
  });

  it("disables Retry while invalidating and restores it on failure", async () => {
    /**
     * Rejects the pending router invalidation fixture.
     *
     * @param error - Rejection reason.
     */
    let rejectRetry: (error: Error) => void = (error) => {
      void error;
    };
    const onRetry = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectRetry = reject;
        }),
    );

    act(() =>
      root.render(
        <RouteErrorView
          development={false}
          error={new Error("offline")}
          locale="en-US"
          onRetry={onRetry}
          pathname="/products"
        />,
      ),
    );

    const retry = container.querySelector("button");
    await act(async () => retry?.click());
    expect(retry?.disabled).toBe(true);
    expect(retry?.textContent).toBe("Retrying…");

    await act(async () => rejectRetry(new Error("still offline")));
    expect(retry?.disabled).toBe(false);
    expect(retry?.textContent).toBe("Retry");
  });

  it("copies only safe development diagnostics with accessible feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const error = new TypeError("render failed");

    act(() =>
      root.render(
        <RouteErrorView
          development
          error={error}
          locale="en-US"
          onRetry={vi.fn()}
          pathname="/products?token=secret"
        />,
      ),
    );

    expect(container.querySelector("details")?.hasAttribute("open")).toBe(
      false,
    );
    const copy = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Copy error details",
    );
    await act(async () => copy?.click());

    const copied = writeText.mock.calls[0]?.[0];
    expect(copied).toContain('"pathname": "/products"');
    expect(copied).toContain('"name": "TypeError"');
    expect(copied).toContain('"message": "render failed"');
    expect(copied).toContain('"stack":');
    expect(copied).not.toContain("token=secret");
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Copied",
    );

    writeText.mockRejectedValue(new Error("clipboard denied"));
    await act(async () => copy?.click());
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Copy failed",
    );
  });

  it("keeps the shared header visible without authentication or settings providers", () => {
    act(() =>
      root.render(
        <RouteErrorView
          development={false}
          error={new Error("loader failed")}
          locale="en-US"
          onRetry={vi.fn()}
          pathname="/feedback"
        />,
      ),
    );
    expect(container.querySelector("header")?.textContent).toContain(
      "Pocket Trash",
    );
    expect(container.querySelector('header a[href="/"]')).not.toBeNull();
    expect(container.querySelector("header")?.textContent).not.toContain(
      "Sign in",
    );
    expect(container.querySelector("main")?.textContent).toContain(
      "Something went wrong",
    );
  });

  it("uses a native Return home link", () => {
    act(() =>
      root.render(
        <RouteErrorView
          development={false}
          error={new Error("offline")}
          locale="en-US"
          onRetry={vi.fn()}
          pathname="/products"
        />,
      ),
    );

    expect(container.querySelector('main a[href="/"]')?.textContent).toBe(
      "Return home",
    );
  });
});
