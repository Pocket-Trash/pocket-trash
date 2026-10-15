import { describe, expect, it } from "vitest";
import {
  SPINNER_TRENDS_COVERAGE_THRESHOLD,
  type SpinnerTrendSourceRecord,
  summarizeSpinnerTrends,
} from "./spinner.js";

/**
 * Builds one complete Spinner source record for focused aggregation tests.
 *
 * @param id - Stable record identifier.
 * @param ownerId - Collection owner, or null for catalog products.
 * @returns Complete Spinner source record.
 */
function spinnerRecord(
  id: number,
  ownerId: number | null,
): SpinnerTrendSourceRecord {
  return {
    bearing: "R188",
    buttonDiameter: { unit: "mm", value: "22" },
    id,
    length: { unit: "mm", value: "50.8" },
    maker: { id: 10, name: "Maker" },
    materials: [{ id: 20, name: "Titanium" }],
    ownerId,
    spinDiameter: { unit: "mm", value: "60" },
    thickness: { unit: "mm", value: "10" },
    thicknessWithButton: { unit: "mm", value: "14" },
    weight: { unit: "g", value: "100" },
    width: { unit: "mm", value: "50.8" },
  };
}

describe("Spinner Trends aggregation", () => {
  it("includes the 70 percent boundary and hides lower-coverage fields", () => {
    const catalog = Array.from({ length: 10 }, (_, index) => {
      const record = spinnerRecord(index + 1, null);
      return {
        ...record,
        length: index < 7 ? record.length : null,
        width: index < 6 ? record.width : null,
      };
    });

    const trends = summarizeSpinnerTrends(catalog, []);

    expect(SPINNER_TRENDS_COVERAGE_THRESHOLD).toBe(70);
    expect(trends).toContainEqual(
      expect.objectContaining({ coveragePercent: 70, metric: "length" }),
    );
    expect(trends).not.toContainEqual(
      expect.objectContaining({ metric: "width" }),
    );
  });

  it("groups equivalent source units by exact canonical values", () => {
    const metric = summarizeSpinnerTrends(
      [
        spinnerRecord(1, null),
        {
          ...spinnerRecord(2, null),
          weight: { unit: "oz", value: "1" },
          width: { unit: "in", value: "2" },
        },
      ],
      [],
    );

    expect(metric.find(({ metric }) => metric === "width")?.values).toEqual([
      expect.objectContaining({ catalogCount: 2, numericValue: 50.8 }),
    ]);
    expect(
      metric
        .find(({ metric }) => metric === "weight")
        ?.values.map(({ numericValue }) => numericValue),
    ).toEqual([28.349523, 100]);
  });

  it("suppresses four contributors and rounds five-contributor values", () => {
    const catalog = [spinnerRecord(1, null)];
    const collection = [
      ...Array.from({ length: 4 }, (_, index) => ({
        ...spinnerRecord(index + 100, index + 1),
        bearing: "608",
      })),
      ...Array.from({ length: 7 }, (_, index) => ({
        ...spinnerRecord(index + 200, (index % 5) + 10),
        bearing: "R188",
      })),
    ];

    const bearing = summarizeSpinnerTrends(catalog, collection).find(
      ({ metric }) => metric === "bearing",
    );

    expect(bearing).toMatchObject({ hasSuppressedCollectionValues: true });
    expect(bearing?.values).toContainEqual(
      expect.objectContaining({ key: "608", collectionCount: null }),
    );
    expect(bearing?.values).toContainEqual(
      expect.objectContaining({ key: "r188", collectionCount: 5 }),
    );
  });

  it("keeps body materials on the parent Spinner record", () => {
    const record = spinnerRecord(1, null);
    record.materials.push({ id: 21, name: "Zirconium" });

    const material = summarizeSpinnerTrends([record], []).find(
      ({ metric }) => metric === "bodyMaterial",
    );

    expect(material?.values).toEqual([
      expect.objectContaining({ label: "Titanium" }),
      expect.objectContaining({ label: "Zirconium" }),
    ]);
  });
});
