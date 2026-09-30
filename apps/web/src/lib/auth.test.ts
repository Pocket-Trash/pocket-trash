import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class AccountErasureInProgressError extends Error {}
  return {
    AccountErasureInProgressError,
    assertAccountActive: vi.fn(),
    clerkAuth: vi.fn(),
  };
});

vi.mock("@clerk/tanstack-react-start/server", () => ({
  auth: mocks.clerkAuth,
}));

vi.mock("@/lib/services", () => ({
  s: {
    db: { erasure: { assertAccountActive: mocks.assertAccountActive } },
  },
}));

vi.mock("@package/services", () => ({
  AccountErasureInProgressError: mocks.AccountErasureInProgressError,
}));

import { activeAuth, resolveAuthState } from "./auth";

describe("activeAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks authenticated accounts through the erasure guard", async () => {
    mocks.clerkAuth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_123",
    });

    await expect(activeAuth()).resolves.toMatchObject({ userId: "user_123" });
    expect(mocks.assertAccountActive).toHaveBeenCalledWith("user_123");
  });

  it("does not query the guard for anonymous requests", async () => {
    mocks.clerkAuth.mockResolvedValue({
      isAuthenticated: false,
      userId: null,
    });

    await activeAuth();
    expect(mocks.assertAccountActive).not.toHaveBeenCalled();
  });

  it("redirects an erasing account to its status page", async () => {
    mocks.clerkAuth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_123",
    });
    mocks.assertAccountActive.mockRejectedValue(
      new mocks.AccountErasureInProgressError(),
    );

    const error = await resolveAuthState().catch((caught: unknown) => caught);
    expect(error).toMatchObject({ options: { to: "/account-erasure" } });
  });
});
