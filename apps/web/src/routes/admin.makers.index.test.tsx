import { beforeEach, describe, expect, it, vi } from "vitest";

/** Controls maker administration authorization in route tests. */
const canManageMakers = vi.hoisted(() => vi.fn());
/** Provides maker profiles to the route loader. */
const listAdminMakers = vi.hoisted(() => vi.fn());

vi.mock("@/lib/catalog-api", () => ({ canManageMakers, listAdminMakers }));

import { Route } from "./admin.makers.index";

describe("maker administration route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthorized requests before loading protected maker data", async () => {
    const beforeLoad = Route.options.beforeLoad;
    const loader = Route.options.loader;
    if (!beforeLoad || !loader)
      throw new Error("Maker route guards are missing.");

    canManageMakers.mockResolvedValueOnce(false);
    await expect(beforeLoad({} as never)).rejects.toBeDefined();
    expect(listAdminMakers).not.toHaveBeenCalled();

    canManageMakers.mockResolvedValueOnce(true);
    listAdminMakers.mockResolvedValueOnce([]);
    await expect(beforeLoad({} as never)).resolves.toBeUndefined();
    await expect(
      (loader as (context: unknown) => Promise<unknown>)({}),
    ).resolves.toEqual([]);
  });
});
