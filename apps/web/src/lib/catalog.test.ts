import { describe, expect, it } from "vitest";
import {
  filterButtonsByDiameter,
  nextAvailableSlug,
  normalizeOptionalUrl,
  positiveDecimalSchema,
  slugify,
  sortMaterials,
} from "./catalog";

describe("catalog helpers", () => {
  it("normalizes catalog input and resolves slug collisions", () => {
    expect(slugify("  Magnus  Mini / Spinner ")).toBe("magnus-mini-spinner");
    expect(nextAvailableSlug("Magnus Mini", ["magnus-mini"])).toBe(
      "magnus-mini-2",
    );
    expect(normalizeOptionalUrl(" https://example.com/ ")).toBe(
      "https://example.com",
    );
    expect(normalizeOptionalUrl("  ")).toBeNull();
  });

  it("validates optional positive decimal fields", () => {
    expect(positiveDecimalSchema.parse("")).toBeNull();
    expect(positiveDecimalSchema.parse("1.25")).toBe("1.25");
    expect(positiveDecimalSchema.safeParse("0").success).toBe(false);
    expect(positiveDecimalSchema.safeParse("-1").success).toBe(false);
    expect(positiveDecimalSchema.safeParse("Infinity").success).toBe(false);
  });

  it("sorts materials and filters compatible buttons", () => {
    expect(
      sortMaterials([
        { id: 3, name: "Zirconium" },
        { id: 1, name: "Aluminum" },
        { id: 2, name: "Titanium" },
      ]).map(({ name }) => name),
    ).toEqual(["Aluminum", "Titanium", "Zirconium"]);

    const buttons = [
      { diameterMm: "22.5", id: 2, name: "Large" },
      { diameterMm: "20.0", id: 1, name: "Small" },
      { diameterMm: null, id: 3, name: "Unknown" },
    ];
    expect(filterButtonsByDiameter(buttons, "20").map(({ id }) => id)).toEqual([
      1,
    ]);
    expect(filterButtonsByDiameter(buttons, null)).toHaveLength(3);
  });
});
