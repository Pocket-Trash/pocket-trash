import { describe, expect, it, vi } from "vitest";
import { reconcileClerkUsers } from "./reconcile-clerk-users.js";

describe("reconcileClerkUsers", () => {
  it("pages users and safely counts reruns", async () => {
    const getUserList = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          { id: "user_1", updatedAt: 1, username: "one" },
          { id: "user_2", updatedAt: 2, username: "two" },
        ],
        totalCount: 3,
      })
      .mockResolvedValueOnce({
        data: [{ id: "user_3", updatedAt: 3, username: null }],
        totalCount: 3,
      });
    const syncFromClerk = vi
      .fn()
      .mockResolvedValueOnce("inserted")
      .mockResolvedValueOnce("unchanged");

    await expect(
      reconcileClerkUsers({ getUserList }, { syncFromClerk }),
    ).resolves.toEqual({
      examined: 3,
      failed: 1,
      inserted: 1,
      unchanged: 1,
      updated: 0,
    });
    expect(getUserList).toHaveBeenNthCalledWith(2, { limit: 100, offset: 2 });
  });
});
