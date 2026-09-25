import { describe, expect, it } from "vitest";
import { collectionWriteSchema, productFormSchema } from "./catalog-api";

const base = {
  bearing: "",
  buttonDiameterMm: null,
  compatibleButtonId: null,
  description: "",
  diameterMm: null,
  lengthMm: null,
  makerId: 1000,
  makerProductUrl: "",
  materialIds: [1000],
  name: "Spinner",
  productId: null,
  productTypeSlug: "spinner" as const,
  spinDiameterMm: null,
  thicknessMm: null,
  thicknessWithButtonMm: null,
  weightG: null,
  widthMm: null,
};

const validFinishOptions = [
  {
    colorEffectId: null,
    colorEffectSlug: null,
    colorIds: [],
    finishIds: [1000],
  },
];

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
    expect(
      productFormSchema.safeParse({
        ...base,
        finishOptions: [
          {
            colorEffectId: 1000,
            colorEffectSlug: "solid",
            colorIds: [1000, 1001],
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

describe("product source details", () => {
  it("normalizes the maker URL and optional text", () => {
    const result = productFormSchema.parse({
      ...base,
      bearing: "  R188  ",
      description: "  **Fast**  ",
      finishOptions: validFinishOptions,
      makerProductUrl: " https://maker.example/products/spinner/ ",
      spinDiameterMm: "52",
    });

    expect(result).toEqual(
      expect.objectContaining({
        bearing: "R188",
        description: "  **Fast**  ",
        makerProductUrl: "https://maker.example/products/spinner",
        spinDiameterMm: "52",
      }),
    );
  });

  it("enforces description and bearing limits", () => {
    expect(
      productFormSchema.safeParse({
        ...base,
        description: "x".repeat(5001),
        finishOptions: validFinishOptions,
      }).success,
    ).toBe(false);
    expect(
      productFormSchema.safeParse({
        ...base,
        bearing: "x".repeat(201),
        finishOptions: validFinishOptions,
      }).success,
    ).toBe(false);
  });

  it("rejects spinner-only details for buttons", () => {
    expect(
      productFormSchema.safeParse({
        ...base,
        bearing: "R188",
        finishOptions: validFinishOptions,
        productTypeSlug: "spinner-button",
      }).success,
    ).toBe(false);
    expect(
      productFormSchema.safeParse({
        ...base,
        finishOptions: validFinishOptions,
        productTypeSlug: "spinner-button",
        spinDiameterMm: "22",
      }).success,
    ).toBe(false);
  });
});

describe("collection writes", () => {
  it("accepts the null description sent by the combined collection flow", () => {
    const result = collectionWriteSchema.safeParse({
      description: null,
      isPrivate: true,
      name: "New collection",
    });

    expect(result.success).toBe(true);
  });
});
