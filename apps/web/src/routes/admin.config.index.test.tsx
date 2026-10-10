import { describe, expect, it, vi } from "vitest";

/** Controls configuration-hub authorization in route tests. */
const canManageProductConfiguration = vi.hoisted(() => vi.fn());

vi.mock("@/lib/catalog-api", () => ({ canManageProductConfiguration }));

import { Route } from "./admin.config.index";

describe("administrator configuration route", () => {
  it("requires product-management permission", async () => {
    const beforeLoad = Route.options.beforeLoad;
    if (!beforeLoad) throw new Error("Configuration route guard is missing.");

    canManageProductConfiguration.mockResolvedValueOnce(false);
    await expect(beforeLoad({} as never)).rejects.toBeDefined();

    canManageProductConfiguration.mockResolvedValueOnce(true);
    await expect(beforeLoad({} as never)).resolves.toBeUndefined();
  });
});
