import { describe, expect, it } from "vitest";
import { uniformMagnetConfiguration } from "./slider-magnet-configuration-editor";

describe("slider magnet configuration editor", () => {
  it("creates complete uniform snapshots for every fixed layout", () => {
    expect(uniformMagnetConfiguration("2x2", "N52")).toEqual({
      sideA: ["N52", "N52", "N52", "N52"],
      sideB: null,
    });
    expect(uniformMagnetConfiguration("2x3", null).sideA).toHaveLength(6);
    expect(uniformMagnetConfiguration("2x4", "N35").sideA).toHaveLength(8);
  });
});
