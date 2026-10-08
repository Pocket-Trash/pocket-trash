import { describe, expect, it } from "vitest";
import {
  sliderMagnetConfigurationIsValid,
  sliderMagnetGrades,
} from "./constants.js";

describe("slider magnet configurations", () => {
  it("accepts supported grades with one side or two layout-sized sides", () => {
    expect(sliderMagnetGrades).toEqual([
      "N52",
      "N48",
      "N45",
      "N42",
      "N40",
      "N38",
      "N35",
      "N30",
    ]);
    expect(
      sliderMagnetConfigurationIsValid(
        { sideA: ["N52", null, "N48", "N42"], sideB: null },
        "2x2",
      ),
    ).toBe(true);
    expect(
      sliderMagnetConfigurationIsValid(
        {
          sideA: ["N52", "N52", "N35", "N35", "N52", "N52"],
          sideB: ["N42", "N42", null, null, "N42", "N42"],
        },
        "2x3",
      ),
    ).toBe(true);
  });

  it("rejects unsupported grades and sides that do not match the layout", () => {
    expect(
      sliderMagnetConfigurationIsValid(
        { sideA: ["N52", "N52", "N35"], sideB: null },
        "2x2",
      ),
    ).toBe(false);
    expect(
      sliderMagnetConfigurationIsValid(
        { sideA: ["N55", "N52", "N35", "N35"], sideB: null },
        "2x2",
      ),
    ).toBe(false);
  });
});
