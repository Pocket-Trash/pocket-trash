import { describe, expect, it, vi } from "vitest";
import { reconcileClerkUsers } from "./reconcile-clerk-users.js";

describe("reconcileClerkUsers", () => {
  it("pages users and safely counts reruns", async () => {
    const getUserList = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            id: "user_1",
            updatedAt: 1,
            username: "one",
            hasImage: true,
            imageUrl: "https://img.clerk.com/selected",
          },
          {
            id: "user_2",
            updatedAt: 2,
            username: "two",
            hasImage: false,
            imageUrl: "https://img.clerk.com/generated",
          },
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
    expect(syncFromClerk).toHaveBeenNthCalledWith(1, {
      clerkId: "user_1",
      clerkUpdatedAt: new Date(1),
      username: "one",
      imageUrl: "https://img.clerk.com/selected",
    });
    expect(syncFromClerk).toHaveBeenNthCalledWith(2, {
      clerkId: "user_2",
      clerkUpdatedAt: new Date(2),
      username: "two",
      imageUrl: null,
    });
    expect(getUserList).toHaveBeenNthCalledWith(2, { limit: 100, offset: 2 });
  });
  it.each([
    [true, "https://img.clerk.com/replaced"],
    [false, null],
  ])("repairs changed or removed pictures (%s)", async (hasImage, imageUrl) => {
    const getUserList = vi.fn().mockResolvedValue({
      data: [
        {
          id: "user_1",
          updatedAt: 4,
          username: "one",
          hasImage,
          imageUrl: imageUrl ?? "https://img.clerk.com/generated",
        },
      ],
      totalCount: 1,
    });
    const syncFromClerk = vi.fn().mockResolvedValue("updated");
    const counts = await reconcileClerkUsers(
      { getUserList },
      { syncFromClerk },
    );
    expect(counts.updated).toBe(1);
    expect(syncFromClerk).toHaveBeenCalledWith({
      clerkId: "user_1",
      clerkUpdatedAt: new Date(4),
      username: "one",
      imageUrl,
    });
  });
});
