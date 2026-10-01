import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Hoisted can read audit test mock.
 */
const canReadAudit = vi.hoisted(() => vi.fn());
/**
 * Hoisted get admin audit export test mock.
 */
const getAdminAuditExport = vi.hoisted(() => vi.fn());
/**
 * Hoisted get audit delivery failures test mock.
 */
const getAuditDeliveryFailures = vi.hoisted(() => vi.fn());
/**
 * Hoisted list admin audit events test mock.
 */
const listAdminAuditEvents = vi.hoisted(() => vi.fn());

vi.mock("@/lib/audit", () => ({
  canReadAudit,
  getAdminAuditExport,
  getAuditDeliveryFailures,
  listAdminAuditEvents,
  /**
   * Returns audit search input unchanged for route tests.
   *
   * @param value - Candidate audit search state.
   * @returns The same search state.
   */
  parseAuditSearch: (value: unknown) => value,
}));
vi.mock("@/pages/admin-audit-page", () => ({
  /**
   * Renders an empty audit-page test double.
   *
   * @returns No rendered output.
   */
  AdminAuditPage: () => null,
}));

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
    getAdminAuditExport.mockResolvedValueOnce({
      activeExport: null,
      canDelete: false,
      canExport: true,
    });
    getAuditDeliveryFailures.mockResolvedValueOnce([]);
    await loader({ deps: search } as never);
    expect(listAdminAuditEvents).toHaveBeenCalledWith({ data: search });
    expect(getAdminAuditExport).toHaveBeenCalledOnce();
    expect(getAuditDeliveryFailures).toHaveBeenCalledOnce();
  });
});
