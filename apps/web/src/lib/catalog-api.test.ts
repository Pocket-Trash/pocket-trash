import { describe, expect, it } from "vitest";
import { productFormSchema } from "./catalog-api";

const base = {
  buttonDiameterMm: null,
  compatibleButtonId: null,
  diameterMm: null,
  lengthMm: null,
  makerId: 1000,
  materialIds: [1000],
  name: "Spinner",
  productId: null,
  productTypeSlug: "spinner" as const,
  thicknessMm: null,
  thicknessWithButtonMm: null,
  weightG: null,
  widthMm: null,
};

describe("product finish options", () => {
  it("requires one option with at least one finish", () => {
    expect(
      productFormSchema.safeParse({ ...base, finishOptions: [] }).success,
    ).toBe(false);
    expect(
      productFormSchema.safeParse({
        ...base,
        finishOptions: [
          {
            colorEffectId: null,
            colorEffectSlug: null,
            colorIds: [],
            finishIds: [],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("requires colors for an effect and two colors for a fade", () => {
    expect(
      productFormSchema.safeParse({
        ...base,
        finishOptions: [
          {
            colorEffectId: 1001,
            colorEffectSlug: "fade",
            colorIds: [],
            finishIds: [1000],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      productFormSchema.safeParse({
        ...base,
        finishOptions: [
          {
            colorEffectId: 1001,
            colorEffectSlug: "fade",
            colorIds: [1000],
            finishIds: [1000],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate components and duplicate options", () => {
    expect(
      productFormSchema.safeParse({
        ...base,
        finishOptions: [
          {
            colorEffectId: null,
            colorEffectSlug: null,
            colorIds: [],
            finishIds: [1000, 1000],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      productFormSchema.safeParse({
        ...base,
        finishOptions: [
          {
            colorEffectId: null,
            colorEffectSlug: null,
            colorIds: [],
            finishIds: [1000],
          },
          {
            colorEffectId: null,
            colorEffectSlug: null,
            colorIds: [],
            finishIds: [1000],
          },
        ],
      }).success,
    ).toBe(false);
  });
});
