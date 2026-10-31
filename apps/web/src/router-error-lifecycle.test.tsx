/** @vitest-environment jsdom */
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRouter } from "./router";

/** Router-owned reporting observer. */
const report = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({ logger: { error: report } }));
vi.mock("@/pages/route-error-page", () => ({
  /** Displays the router boundary without mounting unrelated providers.
   * @returns Current recovery marker. */
  RouteErrorPage: () => <main role="alert">Fixture recovery</main>,
}));
vi.mock("./routeTree.gen", async () => {
  const { createRootRoute, createRoute, Outlet } = await import(
    "@tanstack/react-router"
  );
  /** Fixture root retains the real router error boundary behavior. */
  const root = createRootRoute({ component: Outlet });
  /** Render failure under the production router-wide error boundary. */
  const render = createRoute({
    /** Supplies the fixture parent route.
     * @returns Fixture root route. */
    getParentRoute: () => root,
    path: "/products",
    /** Throws an ordinary component failure.
     * @throws The controlled render failure. */
    component: () => {
      throw new Error("fixture render failure");
    },
  });
  /** Loader failure rethrown through the same router-wide boundary. */
  const loader = createRoute({
    /** Supplies the fixture parent route.
     * @returns Fixture root route. */
    getParentRoute: () => root,
    path: "/makers",
    /** Rejects a fixture loader.
     * @rejects The controlled loader failure. */
    loader: async () => {
      throw new Error("fixture loader failure");
    },
  });
  return { routeTree: root.addChildren([render, loader]) };
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("router error reporting callbacks", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    report.mockClear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container, {
      /** Leaves caught fixture errors to the production router reporting callback. */
      onCaughtError: () => {},
    });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  it.each([
    "/products",
    "/makers",
  ] as const)("reports %s failures through the actual boundary once with only the pathname", async (pathname) => {
    const router = getRouter();
    router.update({
      history: createMemoryHistory({
        initialEntries: [`${pathname}?token=secret#fragment`],
      }),
    });
    await router.load();
    await act(async () =>
      root.render(
        <StrictMode>
          <RouterProvider router={router} />
        </StrictMode>,
      ),
    );
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(report).toHaveBeenCalledExactlyOnceWith("web.route.error", {
      attributes: { route: pathname },
      error: expect.any(Error),
    });
    await act(async () =>
      root.render(
        <StrictMode>
          <RouterProvider router={router} />
        </StrictMode>,
      ),
    );
    expect(report).toHaveBeenCalledOnce();
  });
});
