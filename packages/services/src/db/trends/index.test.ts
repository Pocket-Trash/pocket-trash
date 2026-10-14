import type { Database } from "@package/database";
import { describe, expect, it, vi } from "vitest";
import { createTrendsService, getActivityTrendRange } from "./index.js";

describe("getActivityTrendRange", () => {
  const now = new Date("2026-10-14T16:42:30.000Z");

  it.each([
    ["week", "day", "2026-10-08T00:00:00.000Z"],
    ["30-days", "day", "2026-09-15T00:00:00.000Z"],
    ["6-months", "week", "2026-04-14T00:00:00.000Z"],
    ["year", "month", "2025-10-14T00:00:00.000Z"],
  ] as const)("uses UTC boundaries for %s", (range, granularity, start) => {
    expect(getActivityTrendRange(range, now)).toEqual({
      granularity,
      start: new Date(start),
    });
  });

  it("uses monthly buckets without a lower boundary for all time", () => {
    expect(getActivityTrendRange("all", now)).toEqual({
      granularity: "month",
      start: null,
    });
  });

  it("clamps calendar ranges at the end of a shorter month", () => {
    expect(
      getActivityTrendRange("6-months", new Date("2024-08-31T23:00:00Z")).start,
    ).toEqual(new Date("2024-02-29T00:00:00.000Z"));
  });
});

describe("recorded activity", () => {
  it("preserves a suppressed public point as a null gap", async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [
        {
          bucketStart: "2026-10-01T00:00:00.000Z",
          catalogCount: "3",
          collectionCount: null,
        },
      ],
    });
    const service = createTrendsService({ execute } as unknown as Database);

    await expect(
      service.getPublicActivityTrends(
        "year",
        new Date("2026-10-14T00:00:00.000Z"),
      ),
    ).resolves.toEqual({
      granularity: "month",
      range: "year",
      values: [
        {
          bucketStart: new Date("2026-10-01T00:00:00.000Z"),
          catalogCount: 3,
          collectionCount: null,
        },
      ],
    });
  });
});
