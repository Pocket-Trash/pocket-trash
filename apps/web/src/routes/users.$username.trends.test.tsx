import { beforeEach, describe, expect, it, vi } from "vitest";

/** Published Trends lookup controlled by route tests. */
const getPublishedUserTrends = vi.hoisted(() => vi.fn());

vi.mock("@/lib/catalog-api", () => ({ getPublishedUserTrends }));
vi.mock("@/pages/user-trends-page", () => ({
  /**
   * Renders a stable public Trends marker.
   *
   * @returns Public Trends marker.
   */
  UserTrendsPage: () => <div>published-user-trends</div>,
}));

import { Route } from "./users.$username.trends";

describe("published user Trends route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads the exact shareable username and emits noindex", async () => {
    const owner = { collections: [], items: [], username: "collector" };
    getPublishedUserTrends.mockResolvedValueOnce(owner);
    const loader = Route.options.loader;
    if (!loader) throw new Error("Published Trends route loader is missing.");

    await expect(
      (loader as (context: unknown) => Promise<unknown>)({
        params: { username: "collector" },
      }),
    ).resolves.toEqual(owner);
    expect(getPublishedUserTrends).toHaveBeenCalledWith({
      data: { username: "collector" },
    });
    expect(Route.options.head?.({} as never)).toEqual(
      expect.objectContaining({
        meta: expect.arrayContaining([
          { content: "noindex,follow", name: "robots" },
        ]),
      }),
    );
  });

  it("uses the same not-found response after publication is revoked", async () => {
    const loader = Route.options.loader;
    if (!loader) throw new Error("Published Trends route loader is missing.");
    getPublishedUserTrends
      .mockResolvedValueOnce({
        collections: [],
        items: [],
        username: "collector",
      })
      .mockResolvedValueOnce(null);

    await expect(
      (loader as (context: unknown) => Promise<unknown>)({
        params: { username: "collector" },
      }),
    ).resolves.toBeTruthy();
    await expect(
      (loader as (context: unknown) => Promise<unknown>)({
        params: { username: "collector" },
      }),
    ).rejects.toEqual(expect.objectContaining({ isNotFound: true }));
    expect(getPublishedUserTrends).toHaveBeenCalledTimes(2);
  });
});
