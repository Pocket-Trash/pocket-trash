import { describe, expect, it } from "vitest";
import { aspectRatioDiffers } from "./resource-file-input";

describe("image aspect-ratio guidance", () => {
  it("accepts 4:3 images and flags other ratios", () => {
    expect(aspectRatioDiffers(1200, 900, 4 / 3)).toBe(false);
    expect(aspectRatioDiffers(1200, 1200, 4 / 3)).toBe(true);
  });
});
