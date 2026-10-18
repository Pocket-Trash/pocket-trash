import { beforeEach, describe, expect, it, vi } from "vitest";

/** Public profile lookup controlled by route tests. */
const getPublicUserProfile = vi.hoisted(() => vi.fn());

vi.mock("@/lib/user-profiles", () => ({ getPublicUserProfile }));
vi.mock("@/pages/public-user-page", () => ({
  /**
   * Renders the stable public user marker.
   *
   * @returns Stable public user marker.
   */
  PublicUserPage: () => <div>public-user</div>,
}));

import { Route } from "./users.$username_";

describe("public user route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads an exact username and uses it as the title", async () => {
    const user = { username: "collector" };
    getPublicUserProfile.mockResolvedValueOnce(user);
    const loader = Route.options.loader;
    if (!loader) throw new Error("Public user route loader is missing.");

    await expect(
      (loader as (context: unknown) => Promise<unknown>)({
        params: { username: "collector" },
      }),
    ).resolves.toEqual(user);
    expect(getPublicUserProfile).toHaveBeenCalledWith({
      data: { username: "collector" },
    });
    expect(Route.options.head?.({ loaderData: user } as never)).toEqual({
      meta: [{ title: "collector" }],
    });
  });

  it("uses the normal not-found state for an unknown username", async () => {
    getPublicUserProfile.mockResolvedValueOnce(null);
    const loader = Route.options.loader;
    if (!loader) throw new Error("Public user route loader is missing.");

    await expect(
      (loader as (context: unknown) => Promise<unknown>)({
        params: { username: "unknown" },
      }),
    ).rejects.toEqual(expect.objectContaining({ isNotFound: true }));
  });
});
