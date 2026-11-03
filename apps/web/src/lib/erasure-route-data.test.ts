import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/account-erasure";
import {
  getSelfErasureStatus,
  getSelfErasureStatusSnapshot,
} from "./account-erasure";

/** Raw Clerk identity and private receipt lookup boundary. */
const service = vi.hoisted(() => ({ auth: vi.fn(), receipt: vi.fn() }));
vi.mock("@clerk/tanstack-react-start/server", () => ({ auth: service.auth }));
vi.mock("@/env/server", () => ({
  serverEnv: {
    ERASURE_HMAC_SECRET: "test-erasure-hmac-secret-at-least-32-characters",
  },
}));
vi.mock("@/lib/services", () => ({
  s: { db: { erasure: { getReceiptBySubject: service.receipt } } },
}));
vi.mock("@tanstack/react-start", () => ({
  /**
   * Exposes server callbacks directly for receipt/route boundary checks.
   * @returns Existing chainable callback declaration fixture.
   */
  createServerFn: () => {
    /** Existing server callback declaration chain. */
    const chain = {
      /** Retains the existing validator declaration chain.
       * @returns Current declaration chain. */
      validator: () => chain,
      /**
       * Exposes a server callback without client transport.
       * @param callback - Existing server callback.
       * @returns Original callback.
       */
      handler: (callback: unknown) => callback,
    };
    return chain;
  },
}));

describe("self-erasure receipt route data", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    service.auth.mockResolvedValue({ isAuthenticated: true, userId: "user_a" });
  });

  it.each([
    ["pending", "processing"],
    ["running", "processing"],
    ["completed", "completed"],
    ["needs_attention", "needs_support"],
  ])("preserves the existing %s protocol while binding snapshots to their authenticated account", async (internal, visible) => {
    service.receipt.mockResolvedValue({ id: "request_a", status: internal });
    await expect(getSelfErasureStatus()).resolves.toEqual({
      requestId: "request_a",
      status: visible,
    });
    await expect(getSelfErasureStatusSnapshot()).resolves.toEqual({
      actorId: "user_a",
      status: { requestId: "request_a", status: visible },
    });
    expect(service.receipt.mock.calls[0]?.[0]).not.toBe("user_a");
  });

  it("preserves signed-out/missing-receipt redirects without reading another account's receipt", async () => {
    service.auth.mockResolvedValue({ isAuthenticated: false, userId: null });
    await expect(getSelfErasureStatus()).resolves.toBe("signed_out");
    await expect(getSelfErasureStatusSnapshot()).resolves.toEqual({
      actorId: null,
      status: "signed_out",
    });
    expect(service.receipt).not.toHaveBeenCalled();
    const loader = Route.options.loader;
    if (typeof loader !== "function")
      throw new Error("Expected receipt loader");
    await expect(
      loader({ abortController: new AbortController() } as never),
    ).rejects.toMatchObject({ options: { to: "/account-erased" } });
    service.auth.mockResolvedValue({ isAuthenticated: true, userId: "user_a" });
    service.receipt.mockResolvedValue(null);
    await expect(
      loader({ abortController: new AbortController() } as never),
    ).rejects.toMatchObject({ options: { to: "/user/account" } });
  });

  it("propagates receipt load failures instead of treating them as completed/signed-out requests", async () => {
    service.receipt.mockRejectedValue(new Error("Receipt unavailable"));
    const loader = Route.options.loader;
    if (typeof loader !== "function")
      throw new Error("Expected receipt loader");
    await expect(
      loader({ abortController: new AbortController() } as never),
    ).rejects.toThrow("Receipt unavailable");
  });
});
