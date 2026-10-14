import { beforeEach, describe, expect, it, vi } from "vitest";

/** Provides public product-type Trends to the route loader. */
const listPublicProductTypeTrends = vi.hoisted(() => vi.fn());

vi.mock("@/lib/catalog-api", () => ({ listPublicProductTypeTrends }));
vi.mock("@/pages/trends-page", () => ({
  /**
   * Renders the stable Trends route test marker.
   *
   * @returns Trends route test marker.
   */
  TrendsPage: () => <div>trends-page</div>,
  /**
   * Renders the stable Trends pending test marker.
   *
   * @returns Trends pending test marker.
   */
  TrendsPendingPage: () => <div>trends-pending</div>,
}));

import { Route } from "./trends";

describe("Trends route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normalizes stable product-type IDs and loads public Trends", async () => {
    const validateSearch = Route.options.validateSearch;
    const loader = Route.options.loader;
    if (!validateSearch || !loader)
      throw new Error("Trends route search and loader contracts are missing.");

    const parseSearch = validateSearch as (
      search: Record<string, unknown>,
    ) => Record<string, unknown>;
    expect(parseSearch({ productTypeId: "1001" })).toEqual({
      productTypeId: 1001,
    });
    expect(parseSearch({ productTypeId: "invalid" })).toEqual({});

    const trends = [
      {
        count: 2,
        productTypeId: 1001,
        productTypeName: "Spinner",
        productTypeSlug: "spinner",
      },
    ];
    listPublicProductTypeTrends.mockResolvedValueOnce(trends);
    await expect(
      (loader as (context: unknown) => Promise<unknown>)({}),
    ).resolves.toEqual(trends);
  });
});
