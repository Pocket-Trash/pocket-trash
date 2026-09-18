import { describe, expect, it, vi } from "vitest";

vi.mock("@/env/client", () => ({
  clientEnv: { VITE_RESOURCE_API_BASE_URL: "https://api.example.test" },
}));

import { getRouter } from "./router";

describe("resource management routes", () => {
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
});
