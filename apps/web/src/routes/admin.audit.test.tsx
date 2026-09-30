import { beforeEach, describe, expect, it, vi } from "vitest";

const canReadAudit = vi.hoisted(() => vi.fn());
const listAdminAuditEvents = vi.hoisted(() => vi.fn());

vi.mock("@/lib/audit", () => ({
  canReadAudit,
  listAdminAuditEvents,
  parseAuditSearch: (value: unknown) => value,
}));
vi.mock("@/pages/admin-audit-page", () => ({ AdminAuditPage: () => null }));

import { Route } from "./admin.audit";

describe("admin audit route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("authorizes the route and loads its validated search", async () => {
    const beforeLoad = Route.options.beforeLoad;
    const loader = Route.options.loader;
    if (!beforeLoad || typeof loader !== "function") {
      throw new Error("Audit route guards are missing.");
    }

    canReadAudit.mockResolvedValueOnce(true);
    await expect(beforeLoad({} as never)).resolves.toBeUndefined();

    canReadAudit.mockResolvedValueOnce(false);
    await expect(beforeLoad({} as never)).rejects.toBeDefined();

    const search = { action: "product.updated", actor: 42 };
    listAdminAuditEvents.mockResolvedValueOnce({ items: [] });
    await loader({ deps: search } as never);
    expect(listAdminAuditEvents).toHaveBeenCalledWith({ data: search });
  });
});
