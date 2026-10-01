import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Hoisted has admin access test mock.
 */
const hasAdminAccess = vi.hoisted(() => vi.fn());

vi.mock("@/lib/authorization", () => ({ hasAdminAccess }));

import { Route } from "./admin";

describe("admin route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("authorizes the admin route tree on the server", async () => {
    const beforeLoad = Route.options.beforeLoad;
    if (!beforeLoad) throw new Error("Admin authorization is missing.");

    hasAdminAccess.mockResolvedValueOnce(true);
    await expect(beforeLoad({} as never)).resolves.toBeUndefined();

    hasAdminAccess.mockResolvedValueOnce(false);
    await expect(beforeLoad({} as never)).rejects.toBeDefined();
  });
});
