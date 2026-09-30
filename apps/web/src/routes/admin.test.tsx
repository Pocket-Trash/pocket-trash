import { beforeEach, describe, expect, it, vi } from "vitest";

const isResourceAdmin = vi.hoisted(() => vi.fn());

vi.mock("@/lib/resources", () => ({ isResourceAdmin }));

import { Route } from "./admin";

describe("admin route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("authorizes the admin route tree on the server", async () => {
    const beforeLoad = Route.options.beforeLoad;
    if (!beforeLoad) throw new Error("Admin authorization is missing.");

    isResourceAdmin.mockResolvedValueOnce(true);
    await expect(beforeLoad({} as never)).resolves.toBeUndefined();

    isResourceAdmin.mockResolvedValueOnce(false);
    await expect(beforeLoad({} as never)).rejects.toBeDefined();
  });
});
