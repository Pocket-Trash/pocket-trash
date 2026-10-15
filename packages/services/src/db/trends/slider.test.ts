import { describe, expect, it } from "vitest";
import {
  SLIDER_TRENDS_COVERAGE_THRESHOLD,
  type SliderTrendSourceRecord,
  summarizeSliderTrends,
} from "./slider.js";

/**
 * Builds one complete Slider source record for focused aggregation tests.
 *
 * @param id - Stable record identifier.
 * @param ownerId - Collection owner, or null for catalog products.
 * @returns Complete Slider source record.
 */
function sliderRecord(
  id: number,
  ownerId: number | null,
): SliderTrendSourceRecord {
  return {
    bodyMaterials: [{ id: 20, name: "Titanium" }],
    id,
    length: { unit: "mm", value: "50.8" },
    magnetLayout: "2x4",
    maker: { id: 10, name: "Maker" },
    ownerId,
    plateMaterials: [{ id: 21, name: "Zirconium" }],
    thickness: { unit: "mm", value: "10" },
    weight: { unit: "g", value: "100" },
    width: { unit: "mm", value: "50.8" },
  };
}

describe("Slider Trends aggregation", () => {
  it("includes the 70 percent boundary and hides lower-coverage fields", () => {
    const catalog = Array.from({ length: 10 }, (_, index) => {
      const record = sliderRecord(index + 1, null);
      return {
        ...record,
        length: index < 7 ? record.length : null,
        width: index < 6 ? record.width : null,
      };
    });

    const trends = summarizeSliderTrends(catalog, []);

    expect(SLIDER_TRENDS_COVERAGE_THRESHOLD).toBe(70);
    expect(trends).toContainEqual(
      expect.objectContaining({ coveragePercent: 70, metric: "length" }),
    );
    expect(trends).not.toContainEqual(
      expect.objectContaining({ metric: "width" }),
    );
  });

  it("normalizes units and derives positions without exposing magnet JSON", () => {
    const metric = summarizeSliderTrends(
      [
        sliderRecord(1, null),
        {
          ...sliderRecord(2, null),
          magnetLayout: "2x3",
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
      metric.find(({ metric }) => metric === "positionCount")?.values,
    ).toEqual([
      expect.objectContaining({ label: "2" }),
      expect.objectContaining({ label: "3" }),
    ]);
    expect(
      metric.find(({ metric }) => metric === "magnetLayout")?.values,
    ).toEqual([
      expect.objectContaining({ label: "2×3" }),
      expect.objectContaining({ label: "2×4" }),
    ]);
  });

  it("suppresses four contributors and rounds five-contributor values", () => {
    const catalog = [sliderRecord(1, null)];
    const collection = [
      ...Array.from({ length: 4 }, (_, index) => ({
        ...sliderRecord(index + 100, index + 1),
        maker: { id: 11, name: "Small Maker" },
      })),
      ...Array.from({ length: 7 }, (_, index) => ({
        ...sliderRecord(index + 200, (index % 5) + 10),
        maker: { id: 10, name: "Maker" },
      })),
    ];

    const maker = summarizeSliderTrends(catalog, collection).find(
      ({ metric }) => metric === "maker",
    );

    expect(maker).toMatchObject({ hasSuppressedCollectionValues: true });
    expect(maker?.values).toContainEqual(
      expect.objectContaining({ key: "11", collectionCount: null }),
    );
    expect(maker?.values).toContainEqual(
      expect.objectContaining({ key: "10", collectionCount: 5 }),
    );
  });

  it("keeps parent body and effective plate materials separate", () => {
    const materialTrends = summarizeSliderTrends([sliderRecord(1, null)], []);

    expect(
      materialTrends.find(({ metric }) => metric === "bodyMaterial")?.values,
    ).toEqual([expect.objectContaining({ label: "Titanium" })]);
    expect(
      materialTrends.find(({ metric }) => metric === "plateMaterial")?.values,
    ).toEqual([expect.objectContaining({ label: "Zirconium" })]);
  });
});
