import { describe, expect, it } from "vitest";
import {
  convertDimension,
  convertWeight,
  formatMeasurement,
  measurementsEqual,
} from "./measurements.js";

describe("measurement conversion and formatting", () => {
  it("converts dimensions and weights in both directions", () => {
    expect(convertDimension("2", "in", "mm")).toBe(50.8);
    expect(convertDimension("50.8", "mm", "in")).toBe(2);
    expect(convertWeight("1", "oz", "g")).toBe(28.349523125);
    expect(convertWeight("28.349523125", "g", "oz")).toBe(1);
  });

  it("keeps stored text primary and adds a trimmed two-decimal conversion", () => {
    expect(
      formatMeasurement({ unit: "g", value: "142" }, "imperial", "en-US"),
    ).toBe("142 g (5.01 oz)");
    expect(
      formatMeasurement({ unit: "mm", value: "50.8" }, "imperial", "en-US"),
    ).toBe("50.8 mm (2 in)");
  });

  it("does not add a redundant conversion for matching systems", () => {
    expect(
      formatMeasurement({ unit: "oz", value: "5.010000" }, "imperial", "en-US"),
    ).toBe("5.01 oz");
  });

  it("uses locale number separators while keeping unit symbols stable", () => {
    expect(
      formatMeasurement({ unit: "mm", value: "1234.5" }, "metric", "es-MX"),
    ).toBe("1,234.5 mm");
  });

  it("compares equivalent mixed-unit measurements physically", () => {
    expect(
      measurementsEqual(
        { unit: "mm", value: "25.4" },
        { unit: "in", value: "1" },
      ),
    ).toBe(true);
    expect(
      measurementsEqual(
        { unit: "mm", value: "25" },
        { unit: "in", value: "1" },
      ),
    ).toBe(false);
  });
});
