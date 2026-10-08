import { describe, expect, it } from "vitest";
import {
  collectionDeletionSchema,
  collectionItemApprovalSchema,
  collectionItemDeletionSchema,
  collectionProductTypeIsSupported,
  collectionWriteSchema,
  productApprovalSchema,
  productDeletionSchema,
  productFormSchema,
} from "./catalog-api";

describe("collection product types", () => {
  it.each([
    "spinner",
    "spinner-button",
    "slider",
    "slider-plate",
    "slider-insert",
  ])("supports standalone %s items", (productType) => {
    expect(collectionProductTypeIsSupported(productType)).toBe(true);
  });
});

/**
 * Baseline product-form fields combined with finish options by schema tests.
 */
const base = {
  bearing: "",
  buttonDiameterMm: null,
  compatibleButtonId: null,
  description: "",
  diameterMm: null,
  finishOptions: [],
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
  includedInsertProductId: null,
  includedPlateProductId: null,
  usesInserts: null,
  weightBasis: null,
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
    patternId: null,
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

describe("product appearance options", () => {
  it("accepts no options and pattern-only options but rejects an empty option", () => {
    expect(
      productFormSchema.safeParse({ ...base, finishOptions: [] }).success,
    ).toBe(true);
    expect(
      productFormSchema.safeParse({
        ...base,
        finishOptions: [
          {
            colorEffectId: null,
            colorEffectSlug: null,
            colorIds: [],
            finishIds: [],
            patternId: 1000,
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      productFormSchema.safeParse({
        ...base,
        finishOptions: [
          {
            colorEffectId: null,
            colorEffectSlug: null,
            colorIds: [],
            finishIds: [],
            patternId: null,
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
            patternId: null,
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
            patternId: null,
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
            patternId: null,
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
            patternId: null,
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
            patternId: null,
          },
          {
            colorEffectId: null,
            colorEffectSlug: null,
            colorIds: [],
            finishIds: [1000],
            patternId: null,
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

describe("slider catalog product validation", () => {
  it.each([
    "slider",
    "slider-plate",
    "slider-insert",
  ] as const)("accepts the %s product type", (productTypeSlug) => {
    expect(
      productFormSchema.safeParse({
        ...base,
        usesInserts: productTypeSlug === "slider" ? false : null,
        productTypeSlug,
      }).success,
    ).toBe(true);
  });

  it("requires an explicit insert choice and paired slider weight basis", () => {
    expect(
      productFormSchema.safeParse({
        ...base,
        productTypeSlug: "slider",
      }).success,
    ).toBe(false);
    expect(
      productFormSchema.safeParse({
        ...base,
        usesInserts: true,
        productTypeSlug: "slider",
        weightG: "120",
      }).success,
    ).toBe(false);
    expect(
      productFormSchema.safeParse({
        ...base,
        usesInserts: true,
        productTypeSlug: "slider",
        weightBasis: "complete-build",
        weightG: "120",
      }).success,
    ).toBe(true);
  });

  it("accepts one exact included insert only for sliders that use inserts", () => {
    const parsed = productFormSchema.parse({
      ...base,
      includedInsertProductId: 2000,
      productTypeSlug: "slider",
      usesInserts: true,
    });

    expect(parsed.includedInsertProductId).toBe(2000);
    expect(
      productFormSchema.safeParse({
        ...base,
        includedInsertProductId: 2000,
        productTypeSlug: "slider",
        usesInserts: false,
      }).success,
    ).toBe(false);
  });

  it("accepts one included plate only for sliders", () => {
    expect(
      productFormSchema.safeParse({
        ...base,
        includedPlateProductId: 2000,
        productTypeSlug: "slider",
        usesInserts: false,
      }).success,
    ).toBe(true);
    expect(
      productFormSchema.safeParse({
        ...base,
        includedPlateProductId: 2000,
        productTypeSlug: "slider-plate",
      }).success,
    ).toBe(false);
  });

  it("rejects measurements for slider plates", () => {
    expect(
      productFormSchema.safeParse({
        ...base,
        productTypeSlug: "slider-plate",
        weightG: "12",
      }).success,
    ).toBe(false);
  });

  it("accepts complete exact body-hosted layouts and rejects incomplete slots", () => {
    const bodyHostedMagnetSetup = {
      clickCount: 4,
      configuration: {
        groups: [
          {
            diameterMm: "6.35",
            grade: "N52",
            key: "corners",
            label: "Corners",
            thicknessMm: "3.175",
          },
        ],
        label: "Medium",
        slots: [
          {
            documentedColumn: 1,
            documentedRow: 1,
            groupKey: "corners",
            half: "half-a" as const,
            key: "A1",
            state: "occupied" as const,
          },
        ],
        sourceLabel: null,
        sourceNotes: null,
      },
      sourceNote: null,
    };
    expect(
      productFormSchema.safeParse({
        ...base,
        bodyHostedMagnetSetup,
        productTypeSlug: "slider",
        usesInserts: false,
      }).success,
    ).toBe(true);
    expect(
      productFormSchema.safeParse({
        ...base,
        bodyHostedMagnetSetup: {
          ...bodyHostedMagnetSetup,
          configuration: {
            ...bodyHostedMagnetSetup.configuration,
            slots: [
              {
                ...bodyHostedMagnetSetup.configuration.slots[0],
                groupKey: null,
              },
            ],
          },
        },
        productTypeSlug: "slider",
        usesInserts: false,
      }).success,
    ).toBe(false);
  });

  it("requires exactly one material and no appearance or measurements for inserts", () => {
    expect(
      productFormSchema.safeParse({
        ...base,
        productTypeSlug: "slider-insert",
      }).success,
    ).toBe(true);
    expect(
      productFormSchema.safeParse({
        ...base,
        materialIds: [1000, 2000],
        productTypeSlug: "slider-insert",
      }).success,
    ).toBe(false);
    expect(
      productFormSchema.safeParse({
        ...base,
        finishOptions: validFinishOptions,
        productTypeSlug: "slider-insert",
      }).success,
    ).toBe(false);
    expect(
      productFormSchema.safeParse({
        ...base,
        productTypeSlug: "slider-insert",
        weightG: "12",
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
  it("requires explicit deletion acknowledgement and bounds staff reasons", () => {
    for (const [schema, ids] of [
      [
        collectionDeletionSchema,
        { collectionId: 1000, destinationCollectionId: null },
      ],
      [collectionItemDeletionSchema, { collectionItemId: 1000 }],
    ] as const) {
      expect(schema.safeParse(ids).success).toBe(false);
      expect(schema.safeParse({ ...ids, confirmed: false }).success).toBe(
        false,
      );
      expect(
        schema.safeParse({ ...ids, confirmed: true, reason: "x".repeat(1001) })
          .success,
      ).toBe(false);
      expect(
        schema.parse({ ...ids, confirmed: true, reason: "  Owner request  " })
          .reason,
      ).toBe("Owner request");
    }
  });
  it("accepts the null description sent by the combined collection flow", () => {
    const result = collectionWriteSchema.safeParse({
      description: null,
      isPrivate: true,
      name: "New collection",
      summary: null,
    });

    expect(result.success).toBe(true);
  });

  it("accepts bounded summaries and descriptions", () => {
    const input = {
      isPrivate: true,
      name: "New collection",
    };

    expect(
      collectionWriteSchema.safeParse({
        ...input,
        description: "d".repeat(5000),
        summary: "s".repeat(200),
      }).success,
    ).toBe(true);
    expect(
      collectionWriteSchema.safeParse({
        ...input,
        description: "d".repeat(5001),
        summary: "short",
      }).success,
    ).toBe(false);
    expect(
      collectionWriteSchema.safeParse({
        ...input,
        description: "short",
        summary: "s".repeat(201),
      }).success,
    ).toBe(false);
  });
});
