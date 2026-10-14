import { beforeEach, describe, expect, it, vi } from "vitest";

/** Controls Trends-configuration authorization in route tests. */
const canManageProductConfiguration = vi.hoisted(() => vi.fn());
/** Provides product types to the Trends configuration loader. */
const listTrendsProductTypeConfigurations = vi.hoisted(() => vi.fn());

vi.mock("@/lib/catalog-api", () => ({
  canManageProductConfiguration,
  listTrendsProductTypeConfigurations,
}));

import { Route } from "./admin.config.trends";

describe("Trends configuration route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthorized requests before loading configuration", async () => {
    const beforeLoad = Route.options.beforeLoad;
    const loader = Route.options.loader;
    if (!beforeLoad || !loader)
      throw new Error("Trends configuration route guards are missing.");

    canManageProductConfiguration.mockResolvedValueOnce(false);
    await expect(beforeLoad({} as never)).rejects.toBeDefined();
    expect(listTrendsProductTypeConfigurations).not.toHaveBeenCalled();

    canManageProductConfiguration.mockResolvedValueOnce(true);
    listTrendsProductTypeConfigurations.mockResolvedValueOnce([]);
    await expect(beforeLoad({} as never)).resolves.toBeUndefined();
    await expect(
      (loader as (context: unknown) => Promise<unknown>)({}),
    ).resolves.toEqual([]);
  });
});
