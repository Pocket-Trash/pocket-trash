import { beforeEach, describe, expect, it, vi } from "vitest";

/** Controls product-configuration authorization in route tests. */
const canManageProductConfiguration = vi.hoisted(() => vi.fn());
/** Provides product types to the route loader. */
const listCatalogProductTypes = vi.hoisted(() => vi.fn());

vi.mock("@/lib/catalog-api", () => ({
  canManageProductConfiguration,
  listCatalogProductTypes,
}));

import { Route } from "./admin.config.products";

describe("product configuration route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthorized requests before loading product types", async () => {
    const beforeLoad = Route.options.beforeLoad;
    const loader = Route.options.loader;
    if (!beforeLoad || !loader)
      throw new Error("Product configuration route guards are missing.");

    canManageProductConfiguration.mockResolvedValueOnce(false);
    await expect(beforeLoad({} as never)).rejects.toBeDefined();
    expect(listCatalogProductTypes).not.toHaveBeenCalled();

    canManageProductConfiguration.mockResolvedValueOnce(true);
    listCatalogProductTypes.mockResolvedValueOnce([]);
    await expect(beforeLoad({} as never)).resolves.toBeUndefined();
    await expect(
      (loader as (context: unknown) => Promise<unknown>)({}),
    ).resolves.toEqual([]);
  });
});
