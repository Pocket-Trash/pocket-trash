import { describe, expect, it, vi } from "vitest";

vi.mock("@/env/client", () => ({
  clientEnv: { VITE_API_URL: "https://api.example.test" },
}));

import { getRouter } from "./router";

describe("resource management routes", () => {
  it("uses one router-wide error component for every route", () => {
    const router = getRouter();

    expect(router.options.defaultErrorComponent).toBeDefined();
    expect(
      Object.values(router.routesById).every(
        (route) => route.options.errorComponent === undefined,
      ),
    ).toBe(true);
  });

  it("keeps the document shell outside the root route boundary", () => {
    const rootRoute = getRouter().routesById.__root__;
    const options = rootRoute.options as typeof rootRoute.options & {
      shellComponent?: unknown;
    };

    expect(options.shellComponent).toBeDefined();
  });

  it("uses the router not-found page without remounting root providers", () => {
    const rootRoute = getRouter().routesById.__root__;

    expect(rootRoute.options.notFoundComponent).toBeUndefined();
  });

  it.each([
    "/resources/$resourceId/edit",
    "/resources/$resourceId/versions/new",
  ])("renders %s outside the detail route", (fullPath) => {
    const route = Object.values(getRouter().routesById).find(
      (candidate) => candidate.fullPath === fullPath,
    );

    expect(route?.parentRoute.fullPath).toBe("/resources");
  });

  it.each([
    "/admin",
    "/admin/feedback/",
    "/admin/notifications/feedback",
    "/admin/notifications/resources",
    "/admin/trash/",
    "/admin/trash/catalog-images",
    "/admin/trash/resources",
    "/notifications",
    "/user/resources/trash",
  ])("registers %s", (fullPath) => {
    expect(
      Object.values(getRouter().routesById).some(
        (candidate) => candidate.fullPath === fullPath,
      ),
    ).toBe(true);
  });

  it("does not register the old resource notification route", () => {
    expect(
      Object.values(getRouter().routesById).some(
        (candidate) => candidate.fullPath === "/admin/resources/notifications",
      ),
    ).toBe(false);
  });

  it.each([
    "/admin/resources/trash",
    "/admin/catalog-images/trash",
  ])("does not register the moved route %s", (fullPath) => {
    expect(
      Object.values(getRouter().routesById).some(
        (candidate) => candidate.fullPath === fullPath,
      ),
    ).toBe(false);
  });
});
