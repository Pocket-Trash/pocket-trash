import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route as AdminRoute } from "@/routes/admin.settings.feature-flags";
import { Route as BetaRoute } from "@/routes/user.settings.beta-features";
import {
  loadAdminFeatureFlagSettings,
  loadUserBetaFeatureFlagSettings,
} from "./feature-flags";

/** Authenticated account and guarded feature-flag data operations. */
const service = vi.hoisted(() => ({
  actor: vi.fn(),
  permission: vi.fn(),
  auth: vi.fn(),
  listAdmin: vi.fn(),
  listUserBeta: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ activeAuth: service.auth }));
vi.mock("@/lib/authorization", () => ({
  getActor: service.actor,
  requirePermission: service.permission,
}));
vi.mock("@/lib/services", () => ({
  s: {
    flags: { listAdmin: service.listAdmin, listUserBeta: service.listUserBeta },
  },
}));
vi.mock("@tanstack/react-start", () => ({
  /**
   * Exposes server callbacks directly while keeping transport out of service-boundary tests.
   * @returns Chainable server-function declaration fixture.
   */
  createServerFn: () => {
    /** Existing callback declaration chain. */
    const chain = {
      /** Retains the declaration chain after validator registration.
       * @returns Current declaration chain. */
      validator: () => chain,
      /**
       * Exposes the callback under test without client transport.
       * @param callback - Server callback.
       * @returns The existing callback.
       */
      handler: (callback: unknown) => callback,
    };
    return chain;
  },
}));

describe("feature-flag route data", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    service.actor.mockResolvedValue({ clerkId: "admin_a", role: "admin" });
    service.permission.mockResolvedValue({ clerkId: "admin_a", role: "admin" });
    service.auth.mockResolvedValue({ isAuthenticated: true, userId: "user_a" });
    service.listAdmin.mockResolvedValue([]);
    service.listUserBeta.mockResolvedValue([]);
  });

  it("binds each loader snapshot to the identity that authorized its exact server request", async () => {
    await expect(loadAdminFeatureFlagSettings()).resolves.toEqual({
      actorId: "admin_a",
      flags: [],
    });
    expect(service.permission).toHaveBeenCalledExactlyOnceWith(
      "feature_flags.manage",
    );
    await expect(loadUserBetaFeatureFlagSettings()).resolves.toEqual({
      actorId: "user_a",
      flags: [],
    });
    expect(service.listUserBeta).toHaveBeenCalledExactlyOnceWith("user_a");
  });

  it("rejects denied administrators and anonymous beta lookups before reading flags", async () => {
    service.permission.mockRejectedValueOnce(new Error("Denied"));
    await expect(loadAdminFeatureFlagSettings()).rejects.toThrow("Denied");
    expect(service.listAdmin).not.toHaveBeenCalled();
    service.auth.mockResolvedValue({ isAuthenticated: false, userId: null });
    await expect(loadUserBetaFeatureFlagSettings()).rejects.toBeDefined();
    expect(service.listUserBeta).not.toHaveBeenCalled();
  });

  it("propagates both loader failures to Router's existing error boundary", async () => {
    service.listAdmin.mockRejectedValueOnce(new Error("Admin load failed"));
    service.listUserBeta.mockRejectedValueOnce(new Error("Beta load failed"));
    const adminLoader = AdminRoute.options.loader;
    const betaLoader = BetaRoute.options.loader;
    if (typeof adminLoader !== "function" || typeof betaLoader !== "function")
      throw new Error("Expected route loaders");
    await expect(
      adminLoader({ abortController: new AbortController() } as never),
    ).rejects.toThrow("Admin load failed");
    await expect(
      betaLoader({ abortController: new AbortController() } as never),
    ).rejects.toThrow("Beta load failed");
  });

  it("keeps the administrator route permission gate ahead of loader data", async () => {
    const beforeLoad = AdminRoute.options.beforeLoad;
    if (!beforeLoad) throw new Error("Expected permission gate");
    service.actor.mockResolvedValueOnce(undefined);
    await expect(beforeLoad({} as never)).rejects.toBeDefined();
    expect(service.listAdmin).not.toHaveBeenCalled();
  });
});
