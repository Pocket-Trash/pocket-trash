import { z } from "zod";

/** Positive identifiers used by fountain-pen references and owned items. */
const id = z.number().int().positive();
/** Unknown reference selections are null. */
const optionalId = id.nullable().default(null);
/** Unique reference selections at the public write boundary. */
const ids = z
  .array(id)
  .max(200)
  .default([])
  .refine(
    (values) => new Set(values).size === values.length,
    "Duplicate selections are not allowed.",
  );
/** Generic feed and housing materials; these never imply a mounting interface. */
export const nibComponentMaterials = [
  "plastic",
  "ebonite",
  "metal",
  "other",
  "unknown",
] as const;
/** Supported structured plating styles. */
export const nibPlatingStyles = [
  "unplated",
  "full",
  "partial",
  "two-tone",
  "reverse-two-tone",
] as const;
/** Model-owned grip-section input with explicit fit and included-nib facts. */
export const fountainPenSectionSchema = z.strictObject({
  id: id.optional(),
  name: z.string().trim().min(1).max(200),
  mountId: optionalId,
  defaultNibProductId: optionalId,
  compatibleNibProductIds: ids,
});
/** Complete fountain-pen subtype replacement; unknown capabilities remain null. */
export const fountainPenSchema = z.strictObject({
  postable: z.boolean().nullable().default(null),
  ownerReplaceableNib: z.boolean().nullable().default(null),
  hasClip: z.boolean().nullable().default(null),
  hasInkWindow: z.boolean().nullable().default(null),
  capabilityNotes: z.string().trim().max(5000).nullable().default(null),
  fillingMechanismIds: ids,
  connectorFamilyId: optionalId,
  cartridgeConverterLength: z
    .enum(["short", "long", "short-and-long"])
    .nullable()
    .default(null),
  nibConstructionId: optionalId,
  bodySilhouetteId: optionalId,
  crossSectionId: optionalId,
  facetCount: z.number().int().min(3).max(100).nullable().default(null),
  formFactorId: optionalId,
  capClosureId: optionalId,
  nibDeploymentId: optionalId,
  defaultNibProductId: optionalId,
  compatibleNibProductIds: ids,
  sectionOptions: z.array(fountainPenSectionSchema).max(100).default([]),
  finialOptions: z
    .array(
      z.strictObject({
        id: id.optional(),
        name: z.string().trim().min(1).max(200),
      }),
    )
    .max(100)
    .default([]),
});
/** Complete material-specific nib model replacement. */
export const nibSchema = z.strictObject({
  form: z.enum(["standard", "complete-unit"]).default("standard"),
  manufacturerSizeCode: z.string().trim().min(1).max(200),
  sizeFamilyId: optionalId,
  widthIds: ids,
  mountIds: ids,
  defaultFeedMaterial: z.enum(nibComponentMaterials).default("plastic"),
  defaultHousingMaterial: z.enum(nibComponentMaterials).default("plastic"),
  platingStyles: z
    .array(z.enum(nibPlatingStyles))
    .min(1)
    .max(5)
    .default(["unplated"])
    .refine(
      (values) => new Set(values).size === values.length,
      "Duplicate plating styles are not allowed.",
    ),
  platingMetalIds: ids,
});
/** Installed nib is a discriminated state, never an inferred owned nib. */
export const fountainPenNibStateSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("default"), defaultNibWidthId: optionalId }),
  z.strictObject({
    mode: z.literal("owned"),
    ownedNibCollectionItemId: id,
    customizationConfirmed: z.boolean().default(false),
  }),
  z.strictObject({ mode: z.literal("none") }),
]);
/** Owned fountain-pen choices without an installed-converter setting. */
export const fountainPenItemSchema = z.strictObject({
  sectionOptionId: optionalId,
  finialOptionId: optionalId,
  nib: fountainPenNibStateSchema.default({ mode: "none" }),
});
/** Owned nib fields whose omitted feed/housing defaults are copied from the model. */
export const nibItemSchema = z
  .strictObject({
    widthId: optionalId,
    feedMaterial: z.enum(nibComponentMaterials).optional(),
    housingMaterial: z.enum(nibComponentMaterials).optional(),
    platingStyle: z.enum(nibPlatingStyles).default("unplated"),
    coatingMetalId: optionalId,
    bodyCoatingMetalId: optionalId,
    tinesCoatingMetalId: optionalId,
  })
  .superRefine((value, context) => {
    const zones =
      value.bodyCoatingMetalId !== null || value.tinesCoatingMetalId !== null;
    const valid =
      value.platingStyle === "unplated"
        ? value.coatingMetalId === null && !zones
        : value.platingStyle === "full"
          ? value.coatingMetalId !== null && !zones
          : value.coatingMetalId === null &&
            zones &&
            (value.platingStyle === "partial" ||
              value.bodyCoatingMetalId !== value.tinesCoatingMetalId);
    if (!valid)
      context.addIssue({
        code: "custom",
        path: ["platingStyle"],
        message:
          value.platingStyle === "unplated"
            ? "web.nib.validation.unplated"
            : value.platingStyle === "full"
              ? "web.nib.validation.full"
              : "web.nib.validation.zones",
      });
  });
/** Authored fountain-pen facts accepted by catalog writes. */
export type FountainPenWrite = z.input<typeof fountainPenSchema>;
/** Normalized fountain-pen facts exposed through catalog reads. */
export type FountainPenDetails = z.output<typeof fountainPenSchema>;
/** Authored nib specifications accepted by catalog writes. */
export type NibWrite = z.input<typeof nibSchema>;
/** Normalized material-specific nib specifications. */
export type NibDetails = z.output<typeof nibSchema>;
/** Owned fountain-pen input with a discriminated installed-nib state. */
export type FountainPenItemWrite = z.input<typeof fountainPenItemSchema>;
/** Normalized owned fountain-pen choices. */
export type FountainPenItemDetails = z.output<typeof fountainPenItemSchema>;
/** Owned nib input with optional model-derived feed/housing defaults. */
export type NibItemWrite = z.input<typeof nibItemSchema>;
/** Normalized owned nib width and plating with copied feed/housing defaults. */
export type NibItemDetails = Omit<
  z.output<typeof nibItemSchema>,
  "feedMaterial" | "housingMaterial"
> & {
  /** Actual generic feed material, copied from the model on creation. */
  feedMaterial: (typeof nibComponentMaterials)[number];
  /** Actual generic housing material, copied from the model on creation. */
  housingMaterial: (typeof nibComponentMaterials)[number];
};
