import { describe, expect, it } from "vitest";
import {
  collectionItemApprovalSchema,
  collectionWriteSchema,
  productApprovalSchema,
  productDeletionSchema,
  productFormSchema,
} from "./catalog-api";

/**
 * Baseline product-form fields combined with finish options by schema tests.
 */
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

/**
 * Valid finish-option fixtures reused by schema tests.
 */
const validFinishOptions = [
  {
    colorEffectId: null,
    colorEffectSlug: null,
    colorIds: [],
    finishIds: [1000],
  },
];

describe("collection-item approval decisions", () => {
  it("requires an item, a supported action, and a bounded nonblank reason", () => {
    const decision = {
      action: "approve",
      collectionItemId: 1000,
      reason: " Ready ",
    };
    expect(collectionItemApprovalSchema.parse(decision)).toEqual({
      ...decision,
      reason: "Ready",
    });
    for (const invalid of [
      { ...decision, reason: " " },
      { ...decision, reason: "x".repeat(1001) },
      { ...decision, action: "delete" },
      { ...decision, collectionItemId: 0 },
      { ...decision, collectionItemId: undefined, productId: 1000 },
    ]) {
      expect(collectionItemApprovalSchema.safeParse(invalid).success).toBe(
        false,
      );
    }
    expect(
      collectionItemApprovalSchema.parse({ ...decision, action: "reject" })
        .action,
    ).toBe("reject");
    expect(
      collectionItemApprovalSchema.parse({ ...decision, action: "reverse" })
        .action,
    ).toBe("reverse");
  });
});

describe("product deletion", () => {
  it("requires explicit confirmation and validates identifiers and bounded reasons", () => {
    const deletion = {
      confirmed: true,
      productId: 1000,
      reason: " Owner requested help ",
    };
    expect(productDeletionSchema.parse(deletion)).toEqual({
      ...deletion,
      reason: "Owner requested help",
    });
    for (const invalid of [
      { ...deletion, confirmed: false },
      { ...deletion, confirmed: undefined },
      { ...deletion, productId: 0 },
      { ...deletion, productId: "1000" },
      { ...deletion, reason: "x".repeat(1001) },
    ])
      expect(productDeletionSchema.safeParse(invalid).success).toBe(false);
  });
});

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
        description: "x".repeat(5000),
        finishOptions: validFinishOptions,
      }).success,
    ).toBe(true);
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

  it.each([
    "javascript:alert(1)",
    "ftp://maker.example/spinner",
  ])("rejects the non-web maker URL %s", (makerProductUrl) => {
    expect(
      productFormSchema.safeParse({
        ...base,
        finishOptions: validFinishOptions,
        makerProductUrl,
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

describe("product approval", () => {
  it("requires a bounded nonblank reason", () => {
    expect(
      productApprovalSchema.parse({
        action: "approve",
        productId: 1000,
        reason: "  Ready  ",
      }),
    ).toEqual({ action: "approve", productId: 1000, reason: "Ready" });
    expect(
      productApprovalSchema.safeParse({
        action: "reject",
        productId: 1000,
        reason: " ",
      }).success,
    ).toBe(false);
    expect(
      productApprovalSchema.safeParse({
        action: "reverse",
        productId: 1000,
        reason: "x".repeat(1001),
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

  it("accepts 200 description words and rejects 201", () => {
    const input = {
      isPrivate: true,
      name: "New collection",
    };

    expect(
      collectionWriteSchema.safeParse({
        ...input,
        description: Array.from({ length: 200 }, () => "word").join(" \n"),
      }).success,
    ).toBe(true);
    expect(
      collectionWriteSchema.safeParse({
        ...input,
        description: Array.from({ length: 201 }, () => "word").join("\t"),
      }).success,
    ).toBe(false);
  });
});
