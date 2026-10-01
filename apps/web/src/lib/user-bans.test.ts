import { describe, expect, it, vi } from "vitest";
import { parseUserBanInput, reconcileClerkBanState } from "./user-bans";

describe("user ban workflow", () => {
  it("requires a normalized bounded decision reason", () => {
    expect(
      parseUserBanInput({
        banned: true,
        reason: " Repeated abuse ",
        targetClerkId: " user_123 ",
      }),
    ).toEqual({
      banned: true,
      reason: "Repeated abuse",
      targetClerkId: "user_123",
    });
    expect(() =>
      parseUserBanInput({
        banned: true,
        reason: "   ",
        targetClerkId: "user_123",
      }),
    ).toThrow();
  });

  it("calls Clerk only when its state differs", async () => {
    const getUser = vi.fn(async () => ({ banned: true }));
    getUser
      .mockResolvedValueOnce({ banned: true })
      .mockResolvedValueOnce({ banned: true });
    const users = {
      banUser: vi.fn(async () => undefined),
      getUser,
      unbanUser: vi.fn(async () => undefined),
    };

    await reconcileClerkBanState(users, "user_123", true);
    await reconcileClerkBanState(users, "user_123", false);

    expect(users.banUser).not.toHaveBeenCalled();
    expect(users.unbanUser).toHaveBeenCalledWith("user_123");
  });
});
