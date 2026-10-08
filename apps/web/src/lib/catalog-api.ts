import type {
  AdminMaterial,
  AdminMaterialSummary,
  CatalogColor,
  CatalogImage,
  CatalogLookup,
  CatalogMaker,
  CatalogProduct,
  CatalogProductType,
  CatalogTerminologyAlias,
  ProductWriteInput,
  PublicMakerDetail,
  PublicMakerSummary,
  PublicMaterial,
  PublicMaterialSummary,
  SliderMagnetPreset,
  UserCollectionItem,
  UserCollectionSummary,
} from "@package/services";
import {
  CollectionAssemblyPrivacyBlockedError,
  CollectionItemPrivacyInheritedError,
} from "@package/services";
import { hasPermission } from "@package/services/authorization";
import {
  type SliderMagnetConfiguration,
  type SliderMagnetLayout,
  sliderMagnetGrades,
  sliderMagnetLayoutDetails,
  sliderMagnetLayouts,
} from "@package/services/constants";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getActor, requireActor, requirePermission } from "@/lib/authorization";
import {
  nextAvailableSlug,
  normalizeOptionalUrl,
  positiveDecimalSchema,
  slugify,
  slugPattern,
} from "./catalog";
import { getResourceViewer } from "./resources";

/**
 * Localization key used for missing required catalog input.
 */
const requiredMessage = "web.catalog.error.required";

/** Compact row-major slider magnet snapshot accepted by forms. */
export const sliderMagnetConfigurationSchema = z.object({
  sideA: z.array(z.enum(sliderMagnetGrades).nullable()),
  sideB: z.array(z.enum(sliderMagnetGrades).nullable()).nullable(),
});

/**
 * Reports whether the current actor may manage products or collections.
 *
 * @returns Whether the current actor has either management permission.
 * @rejects If actor lookup fails.
 */
export const isCatalogAdmin = createServerFn().handler(async () => {
  const actor = await getActor();
  return (
    hasPermission(actor, "products.manage") ||
    hasPermission(actor, "collections.manage")
  );
});

/**
 * Reports whether the current actor may manage materials.
 *
 * @returns Whether the current actor has product-management permission.
 * @rejects If actor lookup fails.
 */
export const canManageMaterials = createServerFn().handler(async () =>
  hasPermission(await getActor(), "products.manage"),
);
/**
 * Localization key used for invalid catalog URLs.
 */
const urlMessage = "web.catalog.error.url";

/**
 * Schema for supported catalog product-type slugs.
 */
const productTypeSchema = z.enum([
  "slider",
  "slider-insert",
  "slider-plate",
  "spinner",
  "spinner-button",
]);
/** Product types supported by the standalone collection-item editor. */
const collectionProductTypeSchema = productTypeSchema;
/**
 * Schema for positive integer identifiers.
 */
const idSchema = z
  .number(requiredMessage)
  .int(requiredMessage)
  .positive(requiredMessage);

/** Validated reusable slider magnet preset write. */
const sliderMagnetPresetSchema = z
  .object({
    configuration: sliderMagnetConfigurationSchema,
    magnetLayout: z.enum(sliderMagnetLayouts),
    name: z.string().trim().min(1, requiredMessage).max(100),
    presetId: idSchema.optional(),
  })
  .superRefine(({ configuration, magnetLayout }, context) => {
    const slots = sliderMagnetLayoutDetails[magnetLayout].slotsPerSide;
    if (
      configuration.sideA.length !== slots ||
      (configuration.sideB !== null && configuration.sideB.length !== slots)
    ) {
      context.addIssue({
        code: "custom",
        message: "web.slider.validation.completeConfiguration",
        path: ["configuration"],
      });
    }
  });
/** Schema for an optional entered dimension and its declared unit. */
const dimensionMeasurementSchema = z
  .object({
    unit: z.enum(["mm", "in"]),
    value: positiveDecimalSchema,
  })
  .strict()
  .transform(({ unit, value }) => (value === null ? null : { unit, value }))
  .nullable();
/** Schema for an optional entered weight and its declared unit. */
const weightMeasurementSchema = z
  .object({
    unit: z.enum(["g", "oz"]),
    value: positiveDecimalSchema,
  })
  .strict()
  .transform(({ unit, value }) => (value === null ? null : { unit, value }))
  .nullable();
/**
 * Schema for non-empty names that produce a usable slug.
 */
const slugNameSchema = z
  .string()
  .trim()
  .min(1, requiredMessage)
  .refine((value) => slugify(value).length > 0, requiredMessage);
/**
 * Schema for a non-empty trimmed display name.
 */
const displayNameSchema = z.string().trim().min(1, requiredMessage);
/** Schema for a maker-scoped alias of a registered product type. */
const terminologyAliasSchema = z.object({
  canonicalKey: productTypeSchema,
  canonicalNamespace: z.literal("product-type"),
  isPreferred: z.boolean(),
  label: z.string().trim().min(1, requiredMessage).max(80),
  makerId: idSchema,
});
/**
 * Schema that preserves nonblank descriptions, limits them to 5,000 characters, and maps whitespace-only values to `null`.
 */
const optionalDescriptionSchema = z
  .string()
  .max(5000, "web.catalog.error.descriptionLength")
  .transform((value) => (value.trim() ? value : null));
/**
 * Schema that trims bearing descriptions, limits them to 200 characters, and maps blanks to `null`.
 */
const optionalBearingSchema = z
  .string()
  .trim()
  .max(200, "web.catalog.error.bearingLength")
  .transform((value) => value || null);
/**
 * Schema that accepts blank or HTTP(S) URLs and normalizes blanks to `null`.
 */
const optionalUrlSchema = z
  .string()
  .trim()
  .refine((value) => isWebUrl(normalizeOptionalUrl(value)), urlMessage)
  .transform((value) => normalizeOptionalUrl(value) || null);

/**
 * Checks whether an optional URL uses HTTP or HTTPS.
 *
 * @param value - Optional URL text to validate.
 * @returns `true` for `null` or a parseable HTTP(S) URL.
 */
function isWebUrl(value: string | null) {
  if (value === null) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/**
 * Schema that validates finish, color, and color-effect combinations.
 */
export const finishOptionSchema = z
  .object({
    colorEffectId: idSchema.nullable(),
    colorEffectSlug: z.enum(["solid", "fade"]).nullable(),
    colorIds: z.array(idSchema),
    finishIds: z.array(idSchema),
    patternId: idSchema.nullable(),
  })
  .superRefine((option, context) => {
    if (
      option.finishIds.length === 0 &&
      option.colorIds.length === 0 &&
      option.patternId === null
    ) {
      context.addIssue({
        code: "custom",
        message: "web.catalog.error.form",
        path: ["finishIds"],
      });
    }
    if (new Set(option.finishIds).size !== option.finishIds.length) {
      context.addIssue({
        code: "custom",
        message: "web.catalog.error.duplicateFinishOption",
        path: ["finishIds"],
      });
    }
    if (new Set(option.colorIds).size !== option.colorIds.length) {
      context.addIssue({
        code: "custom",
        message: "web.catalog.error.duplicateFinishOption",
        path: ["colorIds"],
      });
    }
    if (
      option.colorIds.length === 0 &&
      (option.colorEffectId !== null || option.colorEffectSlug !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "web.catalog.error.colorEffectWithoutColors",
        path: ["colorEffectId"],
      });
    }
    if (
      option.colorIds.length > 0 &&
      (option.colorEffectId === null || option.colorEffectSlug === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "web.catalog.error.colorEffectRequired",
        path: ["colorEffectId"],
      });
    }
    if (option.colorEffectSlug === "fade" && option.colorIds.length < 2) {
      context.addIssue({
        code: "custom",
        message: "web.catalog.error.fadeColors",
        path: ["colorIds"],
      });
    }
    if (option.colorEffectSlug === "solid" && option.colorIds.length !== 1) {
      context.addIssue({
        code: "custom",
        message: "web.catalog.error.form",
        path: ["colorIds"],
      });
    }
  });

/**
 * Schema that validates product form values and product-type-specific specifications.
 */
export const productFormSchema = z
  .object({
    bearing: optionalBearingSchema,
    buttonDiameter: dimensionMeasurementSchema,
    compatibleButtonId: idSchema.nullable(),
    description: optionalDescriptionSchema,
    diameter: dimensionMeasurementSchema,
    finishOptions: z.array(finishOptionSchema),
    includedInsertProductId: idSchema.nullable(),
    includedPlateProductId: idSchema.nullable(),
    length: dimensionMeasurementSchema,
    makerId: idSchema,
    makerProductUrl: optionalUrlSchema,
    magnetConfiguration: sliderMagnetConfigurationSchema
      .nullable()
      .default(null),
    magnetLayout: z.enum(sliderMagnetLayouts).nullable(),
    materialIds: z.array(idSchema).min(1, requiredMessage),
    name: slugNameSchema,
    productId: idSchema.nullable(),
    productTypeSlug: productTypeSchema,
    reason: z.string().trim().max(1000).optional(),
    spinDiameter: dimensionMeasurementSchema,
    thickness: dimensionMeasurementSchema,
    thicknessWithButton: dimensionMeasurementSchema,
    weight: weightMeasurementSchema,
    width: dimensionMeasurementSchema,
    usesInserts: z.boolean().nullable(),
  })
  .strict()
  .superRefine(
    (
      {
        bearing,
        finishOptions,
        includedInsertProductId,
        includedPlateProductId,
        length,
        materialIds,
        magnetConfiguration,
        magnetLayout,
        productTypeSlug,
        spinDiameter,
        thickness,
        weight,
        width,
        usesInserts,
      },
      context,
    ) => {
      if (
        productTypeSlug !== "spinner" &&
        (bearing !== null || spinDiameter !== null)
      ) {
        context.addIssue({
          code: "custom",
          message: "web.catalog.error.form",
          path: [bearing !== null ? "bearing" : "spinDiameter"],
        });
      }
      if (productTypeSlug === "slider" && usesInserts === null) {
        context.addIssue({
          code: "custom",
          message: "web.slider.validation.capabilityRequired",
          path: ["usesInserts"],
        });
      }
      if (productTypeSlug !== "slider" && usesInserts !== null) {
        context.addIssue({
          code: "custom",
          message: "web.catalog.error.form",
          path: ["usesInserts"],
        });
      }
      if (
        productTypeSlug !== "slider" &&
        productTypeSlug !== "slider-insert" &&
        magnetLayout !== null
      ) {
        context.addIssue({
          code: "custom",
          message: "web.catalog.error.form",
          path: ["magnetLayout"],
        });
      }
      if (productTypeSlug === "slider-insert" && magnetLayout === null) {
        context.addIssue({
          code: "custom",
          message: "web.slider.validation.layoutRequired",
          path: ["magnetLayout"],
        });
      }
      if (productTypeSlug !== "slider" && magnetConfiguration !== null) {
        context.addIssue({
          code: "custom",
          message: "web.catalog.error.form",
          path: ["magnetConfiguration"],
        });
      }
      if (magnetConfiguration && magnetLayout) {
        const slots = sliderMagnetLayoutDetails[magnetLayout].slotsPerSide;
        if (
          magnetConfiguration.sideA.length !== slots ||
          (magnetConfiguration.sideB !== null &&
            magnetConfiguration.sideB.length !== slots)
        ) {
          context.addIssue({
            code: "custom",
            message: "web.slider.validation.completeConfiguration",
            path: ["magnetConfiguration"],
          });
        }
      }
      if (productTypeSlug !== "slider" && includedInsertProductId !== null) {
        context.addIssue({
          code: "custom",
          message: "web.catalog.error.form",
          path: ["includedInsertProductId"],
        });
      }
      if (usesInserts !== true && includedInsertProductId !== null) {
        context.addIssue({
          code: "custom",
          message: "web.catalog.error.form",
          path: ["includedInsertProductId"],
        });
      }
      if (
        productTypeSlug === "slider" &&
        (includedInsertProductId === null) !== (magnetLayout !== null)
      ) {
        context.addIssue({
          code: "custom",
          message: "web.slider.validation.layoutRequired",
          path: ["magnetLayout"],
        });
      }
      if (productTypeSlug !== "slider" && includedPlateProductId !== null) {
        context.addIssue({
          code: "custom",
          message: "web.catalog.error.form",
          path: ["includedPlateProductId"],
        });
      }
      if (
        (productTypeSlug === "slider-plate" ||
          productTypeSlug === "slider-insert") &&
        [weight, length, width, thickness].some(
          (measurement) => measurement !== null,
        )
      ) {
        context.addIssue({
          code: "custom",
          message: "web.catalog.error.form",
          path: ["weight"],
        });
      }
      if (productTypeSlug === "slider-insert" && materialIds.length !== 1) {
        context.addIssue({
          code: "custom",
          message: "web.slider.validation.insertMaterial",
          path: ["materialIds"],
        });
      }
      if (productTypeSlug === "slider-insert" && finishOptions.length) {
        context.addIssue({
          code: "custom",
          message: "web.catalog.error.form",
          path: ["finishOptions"],
        });
      }
      const signatures = finishOptions.map(
        ({ colorEffectId, colorIds, finishIds, patternId }) =>
          `${finishIds.join(",")}|${colorEffectId ?? ""}|${colorIds.join(",")}|${patternId ?? ""}`,
      );
      if (new Set(signatures).size !== signatures.length) {
        context.addIssue({
          code: "custom",
          message: "web.catalog.error.duplicateFinishOption",
          path: ["finishOptions"],
        });
      }
    },
  );

/**
 * Schema for product-type and product route slugs.
 */
const productLookupSchema = z.object({
  productSlug: z.string().regex(slugPattern),
  productTypeSlug: z.string().regex(slugPattern),
});

/**
 * Schema for maker names and optional root URLs.
 */
const makerSchema = z.object({
  name: slugNameSchema,
  rootUrl: optionalUrlSchema,
});

/** Schema for creating or updating one administrated maker profile. */
export const makerProfileSchema = z.object({
  description: optionalDescriptionSchema,
  makerId: idSchema.nullable(),
  name: slugNameSchema,
  rootUrl: optionalUrlSchema,
});

/**
 * Schema for material names.
 */
const materialSchema = z.object({
  description: optionalDescriptionSchema.optional().default(""),
  name: slugNameSchema,
});

/** Schema for creating or updating an administrator-managed material. */
const materialWriteSchema = materialSchema.extend({
  materialId: idSchema.nullable(),
});

/**
 * Schema for finish names.
 */
const finishSchema = z.object({ name: slugNameSchema });
/** Schema for pattern names. */
const patternSchema = z.object({ name: slugNameSchema });
/**
 * Schema for color names and six-digit uppercase hexadecimal values.
 */
const colorSchema = z.object({
  hex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "web.catalog.error.form")
    .transform((value) => value.toUpperCase()),
  name: slugNameSchema,
});

/**
 * Schema for collection names, privacy, summaries, descriptions, and audit reasons.
 */
export const collectionWriteSchema = z.object({
  description: optionalDescriptionSchema.nullable(),
  isPrivate: z.boolean(),
  name: z.string().trim().min(2, requiredMessage).max(80, requiredMessage),
  reason: z.string().trim().max(1000).optional(),
  summary: z
    .string()
    .trim()
    .max(200, requiredMessage)
    .nullable()
    .optional()
    .default(null)
    .transform((value) => value || null),
});

/** Validates one administrative product approval decision. */
export const productApprovalSchema = z.object({
  action: z.enum(["approve", "reject", "reverse"]),
  productId: idSchema,
  reason: z.string().trim().min(1, requiredMessage).max(1000),
});

/** Validates one administrative collection-item approval decision. */
export const collectionItemApprovalSchema = productApprovalSchema
  .omit({ productId: true })
  .extend({ collectionItemId: idSchema });

/** Validates an explicit whole-product deletion acknowledgement and optional staff reason. */
export const productDeletionSchema = z.object({
  confirmed: z.literal(true),
  productId: idSchema,
  reason: z.string().trim().max(1000, requiredMessage).optional(),
});

/** Validates confirmed collection deletion with an optional same-owner move destination. */
export const collectionDeletionSchema = productDeletionSchema
  .omit({ productId: true })
  .extend({
    collectionId: idSchema,
    destinationCollectionId: idSchema.nullable(),
  });

/** Validates explicit acknowledgement of permanent collection-item deletion. */
export const collectionItemDeletionSchema = productDeletionSchema
  .omit({ productId: true })
  .extend({
    collectionItemId: idSchema,
  });

/**
 * Success or validation-aware failure returned by catalog lookup mutations.
 *
 * @template K - Success payload property name.
 * @template T - Catalog lookup returned on success.
 */
type CatalogLookupMutationResult<
  K extends string,
  T extends CatalogLookup = CatalogLookup,
> =
  | ({
      /**
       * Whether the mutation succeeded.
       */
      ok: true;
    } & Record<K, T>)
  | {
      /**
       * Localized validation messages keyed by form field.
       */
      fieldErrors: Record<string, string[] | undefined>;
      /**
       * Localized form-level failure message.
       */
      formError: string;
      /**
       * Whether the mutation succeeded.
       */
      ok: false;
    };

/**
 * Schema for adding a configured product and optional button to a collection.
 */
const collectionAddSchema = z
  .object({
    bearing: optionalBearingSchema,
    buttonCustomFinish: finishOptionSchema.nullable(),
    buttonFinishOptionId: idSchema.nullable(),
    buttonMaterialId: idSchema.nullable(),
    buttonProductId: idSchema.nullable(),
    collectionId: idSchema.nullable().optional().default(null),
    confirmed: z.boolean(),
    customFinish: finishOptionSchema.nullable(),
    displayName: displayNameSchema,
    description: optionalDescriptionSchema,
    finishOptionId: idSchema.nullable(),
    materialId: idSchema,
    newCollection: collectionWriteSchema.nullable().optional().default(null),
    productId: idSchema,
    productTypeSlug: collectionProductTypeSchema,
  })
  .superRefine((input, context) => {
    const finishCount = [input.finishOptionId, input.customFinish].filter(
      (value) => value !== null,
    ).length;
    if (finishCount > 1) {
      context.addIssue({
        code: "custom",
        message: "web.catalog.error.productFinishRequired",
        path: ["finishOptionId"],
      });
    }
    const buttonFinishCount = [
      input.buttonFinishOptionId,
      input.buttonCustomFinish,
    ].filter((value) => value !== null).length;
    if (
      buttonFinishCount > 1 ||
      (input.productTypeSlug !== "spinner" &&
        (input.buttonProductId !== null ||
          input.buttonMaterialId !== null ||
          buttonFinishCount > 0)) ||
      (input.buttonProductId === null &&
        (input.buttonMaterialId !== null || buttonFinishCount > 0)) ||
      (input.buttonProductId !== null && input.buttonMaterialId === null)
    ) {
      context.addIssue({
        code: "custom",
        message: requiredMessage,
        path: ["buttonProductId"],
      });
    }
    if (input.productTypeSlug !== "spinner" && input.bearing !== null) {
      context.addIssue({
        code: "custom",
        message: "web.catalog.error.form",
        path: ["bearing"],
      });
    }
  });

/**
 * Schema for editing a collection item and its optional installed components.
 */
const collectionEditSchema = z
  .object({
    bearing: optionalBearingSchema,
    collectionId: idSchema.optional(),
    collectionItemId: idSchema,
    customFinish: finishOptionSchema.nullable(),
    displayName: displayNameSchema,
    description: optionalDescriptionSchema,
    finishOptionId: idSchema.nullable(),
    installedButton: z
      .object({
        collectionItemId: idSchema,
        customFinish: finishOptionSchema.nullable(),
        finishOptionId: idSchema.nullable(),
        materialId: idSchema,
      })
      .nullable()
      .optional(),
    installedInsert: z
      .object({ collectionItemId: idSchema })
      .nullable()
      .optional(),
    installedPlate: z
      .object({ collectionItemId: idSchema })
      .nullable()
      .optional(),
    magnetConfiguration: sliderMagnetConfigurationSchema.nullable().optional(),
    materialId: idSchema,
    reason: z.string().trim().max(1000).optional(),
  })
  .superRefine((input, context) => {
    if (input.finishOptionId !== null && input.customFinish !== null) {
      context.addIssue({
        code: "custom",
        message: "web.catalog.error.productFinishRequired",
        path: ["finishOptionId"],
      });
    }
    if (
      input.installedButton?.finishOptionId !== null &&
      input.installedButton?.finishOptionId !== undefined &&
      input.installedButton.customFinish !== null
    ) {
      context.addIssue({
        code: "custom",
        message: "web.catalog.error.productFinishRequired",
        path: ["installedButton", "finishOptionId"],
      });
    }
  });

/**
 * Unparsed input accepted by the product form schema.
 */
export type ProductFormInput = z.input<typeof productFormSchema>;

/** Fully parsed product form value used by controlled editors. */
export type ProductFormValue = z.output<typeof productFormSchema>;

/**
 * Lookup values and spinner buttons required by catalog forms.
 */
export type CatalogOptions = {
  /** Maker-scoped registered catalog terminology aliases. */
  terminologyAliases?: CatalogTerminologyAlias[];
  /**
   * Available color effects.
   */
  colorEffects: Awaited<ReturnType<typeof listColorEffects>>;
  /**
   * Available catalog colors.
   */
  colors: Awaited<ReturnType<typeof listColors>>;
  /**
   * Available finishes.
   */
  finishes: Awaited<ReturnType<typeof listFinishes>>;
  /**
   * Available makers.
   */
  makers: Awaited<ReturnType<typeof listMakers>>;
  /**
   * Available materials.
   */
  materials: Awaited<ReturnType<typeof listMaterials>>;
  /** Reusable slider magnet presets. */
  magnetPresets?: SliderMagnetPreset[];
  /**
   * Available patterns.
   */
  patterns: Awaited<ReturnType<typeof listPatterns>>;
  /**
   * Available product types.
   */
  productTypes: Awaited<ReturnType<typeof listProductTypes>>;
  /** Visible products available for exact relationship selection. */
  relationshipProducts: CatalogProduct[];
  /**
   * Visible spinner-button products.
   */
  spinnerButtons: CatalogProduct[];
};

/**
 * Loads catalog lookups and visible spinner buttons.
 *
 * @returns Catalog form options.
 * @rejects If service loading, viewer lookup, or a catalog query fails.
 */
export const getCatalogOptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogOptions> => {
    const { s } = await import("@/lib/services");
    const viewer = await getResourceViewer();
    const [
      colorEffects,
      colors,
      finishes,
      makers,
      magnetPresets,
      materials,
      patterns,
      productTypes,
      relationshipProducts,
      spinnerButtons,
      terminologyAliases,
    ] = await Promise.all([
      listColorEffects(),
      listColors(),
      listFinishes(),
      listMakers(),
      s.db.catalog.listSliderMagnetPresets(),
      listMaterials(),
      listPatterns(),
      listProductTypes(),
      s.db.catalog.listProducts(undefined, viewer),
      s.db.catalog.listProducts("spinner-button", viewer),
      s.db.catalog.listTerminologyAliases(),
    ]);
    return {
      colorEffects,
      colors,
      finishes,
      makers,
      magnetPresets,
      materials,
      patterns,
      productTypes,
      relationshipProducts,
      spinnerButtons,
      terminologyAliases,
    };
  },
);

/** Lists reusable slider magnet presets for product managers. */
export const listSliderMagnetPresets = createServerFn({
  method: "GET",
}).handler(async (): Promise<SliderMagnetPreset[]> => {
  await requirePermission("products.manage");
  const { s } = await import("@/lib/services");
  return await s.db.catalog.listSliderMagnetPresets();
});

/** Creates a reusable slider magnet preset. */
export const createSliderMagnetPreset = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actor = await requirePermission("products.manage");
    const parsed = sliderMagnetPresetSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);
    const { s } = await import("@/lib/services");
    try {
      const preset = await s.db.catalog.createSliderMagnetPreset({
        actor,
        configuration: parsed.data.configuration,
        magnetLayout: parsed.data.magnetLayout,
        name: parsed.data.name,
      });
      return { ok: true as const, preset };
    } catch (error) {
      return mutationFailure(error);
    }
  });

/** Updates a reusable slider magnet preset. */
export const updateSliderMagnetPreset = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actor = await requirePermission("products.manage");
    const parsed = sliderMagnetPresetSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);
    if (parsed.data.presetId === undefined)
      return {
        fieldErrors: { presetId: [requiredMessage] },
        formError: "web.catalog.error.form",
        ok: false as const,
        requiresConfirmation: false as const,
      };
    const { s } = await import("@/lib/services");
    try {
      const preset = await s.db.catalog.updateSliderMagnetPreset({
        actor,
        configuration: parsed.data.configuration,
        magnetLayout: parsed.data.magnetLayout,
        name: parsed.data.name,
        presetId: parsed.data.presetId,
      });
      return { ok: true as const, preset };
    } catch (error) {
      return mutationFailure(error);
    }
  });

/** Deletes a reusable slider magnet preset. */
export const deleteSliderMagnetPreset = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ presetId: idSchema }).parse(input))
  .handler(async ({ data }) => {
    const actor = await requirePermission("products.manage");
    const { s } = await import("@/lib/services");
    try {
      await s.db.catalog.deleteSliderMagnetPreset({ actor, ...data });
      return { ok: true as const };
    } catch (error) {
      return mutationFailure(error);
    }
  });

/** Lists registered catalog terminology aliases for shared client-side search. */
export const listCatalogTerminologyAliases = createServerFn({
  method: "GET",
}).handler(async (): Promise<CatalogTerminologyAlias[]> => {
  const { s } = await import("@/lib/services");
  return await s.db.catalog.listTerminologyAliases();
});

/**
 * Lists visible products, optionally limited to one product type.
 *
 * @returns Visible products sorted by name when all product types are requested.
 * @rejects If input validation, service loading, viewer lookup, a catalog query, or image signing fails.
 */
export const listCatalogProducts = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({ productTypeSlug: productTypeSchema.optional() })
      .optional()
      .parse(input),
  )
  .handler(async ({ data }): Promise<CatalogProduct[]> => {
    const { s } = await import("@/lib/services");
    const viewer = await getResourceViewer();
    if (data?.productTypeSlug) {
      return await signCatalogProducts(
        await s.db.catalog.listProducts(data.productTypeSlug, viewer),
      );
    }
    const products = await Promise.all(
      productTypeSchema.options.map((type) =>
        s.db.catalog.listProducts(type, viewer),
      ),
    );
    return await signCatalogProducts(
      products.flat().sort((a, b) => a.name.localeCompare(b.name)),
    );
  });

/**
 * Loads one visible catalog product by route slugs.
 *
 * @returns The product, with signed images when configured, or `null` when it is unavailable.
 * @rejects If input validation, service loading, viewer lookup, the catalog query, or image signing fails.
 */
export const getCatalogProduct = createServerFn({ method: "GET" })
  .validator((input: unknown) => productLookupSchema.parse(input))
  .handler(async ({ data }): Promise<CatalogProduct | null> => {
    const { s } = await import("@/lib/services");
    const viewer = await getResourceViewer();
    const product = await s.db.catalog.getProduct(
      data.productTypeSlug,
      data.productSlug,
      viewer,
    );
    return product ? ((await signCatalogProducts([product]))[0] ?? null) : null;
  });

/**
 * Loads a visible product and the collection items that contain it.
 *
 * @returns The product and items, with signed images when configured, or `null` when unavailable.
 * @rejects If input validation, service loading, viewer lookup, a catalog query, or image signing fails.
 */
export const getCatalogProductDetail = createServerFn({ method: "GET" })
  .validator((input: unknown) => productLookupSchema.parse(input))
  .handler(
    async ({
      data,
    }): Promise<{
      /**
       * Visible collection items containing the product.
       */
      collectionItems: UserCollectionItem[];
      /**
       * Requested catalog product.
       */
      product: CatalogProduct;
    } | null> => {
      const { s } = await import("@/lib/services");
      const viewer = await getResourceViewer();
      const product = await s.db.catalog.getProduct(
        data.productTypeSlug,
        data.productSlug,
        viewer,
      );
      if (!product) return null;
      const [signedProduct, collectionItems] = await Promise.all([
        signCatalogProducts([product]),
        s.db.collections.listProductItems(product.id, viewer),
      ]);
      if (!signedProduct[0]) return null;
      return {
        collectionItems: await Promise.all(
          collectionItems.map(signCollectionItem),
        ),
        product: signedProduct[0],
      };
    },
  );

/**
 * Validates and creates a maker for an authorized product manager.
 *
 * @returns The created maker or a validation-aware mutation failure.
 * @rejects If permission checking or service loading fails.
 */
export const createCatalogMaker = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actor = await requirePermission("products.manage");
    const parsed = makerSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);

    const { s } = await import("@/lib/services");
    try {
      const maker = await s.db.catalog.createMaker({
        actor,
        name: parsed.data.name,
        rootUrl: parsed.data.rootUrl,
      });
      return { maker, ok: true as const };
    } catch (error) {
      return mutationFailure(error);
    }
  });

/**
 * Reports whether the current actor may administer maker profiles.
 *
 * @returns Whether the actor has product-management permission.
 * @rejects If actor lookup fails.
 */
export const canManageMakers = createServerFn().handler(async () => {
  const actor = await getActor();
  return hasPermission(actor, "products.manage");
});

/**
 * Lists maker profiles for the current product administrator.
 *
 * @returns Name-sorted maker profiles.
 * @rejects If authorization, service loading, or persistence fails.
 */
export const listAdminMakers = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogMaker[]> => {
    const actor = await requirePermission("products.manage");
    const { s } = await import("@/lib/services");
    const makers = await s.db.catalog.listMakersForAdmin(actor);
    return await Promise.all(
      makers.map(async (maker) => ({
        ...maker,
        images: await signCatalogImageUrls(maker.images),
      })),
    );
  },
);

/**
 * Lists public maker directory entries with signed lead images.
 *
 * @returns Public maker summaries.
 * @rejects If service loading, aggregation, or image signing fails.
 */
export const listPublicMakers = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicMakerSummary[]> => {
    const { s } = await import("@/lib/services");
    const makers = await s.db.catalog.listPublicMakers();
    return await Promise.all(
      makers.map(async (maker) => ({
        ...maker,
        images: await signCatalogImageUrls(maker.images),
      })),
    );
  },
);

/**
 * Loads one public maker profile with signed related catalog images.
 *
 * @returns The matching maker detail, or `null` when absent.
 * @rejects If validation, service loading, persistence, or image signing fails.
 */
export const getPublicMakerDetail = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ slug: z.string().regex(slugPattern) }).parse(input),
  )
  .handler(async ({ data }): Promise<PublicMakerDetail | null> => {
    const { s } = await import("@/lib/services");
    const maker = await s.db.catalog.getPublicMakerDetail(data.slug);
    if (!maker) return null;
    const [images, products, collectionItems] = await Promise.all([
      signCatalogImageUrls(maker.images),
      signCatalogProducts(maker.products),
      Promise.all(maker.collectionItems.map(signCollectionItem)),
    ]);
    return { ...maker, collectionItems, images, products };
  });

/**
 * Loads one maker profile for the current product administrator.
 *
 * @returns The matching maker profile, or `null` when absent.
 * @rejects If input validation, authorization, service loading, or persistence fails.
 */
export const getAdminMaker = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ makerId: idSchema }).parse(input))
  .handler(async ({ data }): Promise<CatalogMaker | null> => {
    const actor = await requirePermission("products.manage");
    const { s } = await import("@/lib/services");
    const maker = await s.db.catalog.getMakerForAdmin({
      actor,
      makerId: data.makerId,
    });
    return maker
      ? { ...maker, images: await signCatalogImageUrls(maker.images) }
      : null;
  });

/**
 * Validates and saves one maker profile for the current product administrator.
 *
 * @returns The saved maker or a validation-aware mutation failure.
 * @rejects If authorization or service loading fails.
 */
export const saveAdminMaker = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actor = await requirePermission("products.manage");
    const parsed = makerProfileSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);

    const { s } = await import("@/lib/services");
    try {
      const maker =
        parsed.data.makerId !== null
          ? await s.db.catalog.updateMaker({
              actor,
              description: parsed.data.description,
              makerId: parsed.data.makerId,
              name: parsed.data.name,
              rootUrl: parsed.data.rootUrl,
            })
          : await s.db.catalog.createMaker({
              actor,
              description: parsed.data.description,
              name: parsed.data.name,
              rootUrl: parsed.data.rootUrl,
            });
      return { maker, ok: true as const };
    } catch (error) {
      return mutationFailure(error);
    }
  });

/**
 * Validates and creates a uniquely slugged material for an authorized product manager.
 *
 * @returns The created material or a validation-aware mutation failure.
 * @rejects If permission checking, service loading, or existing-material lookup fails.
 */
export const createCatalogMaterial = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actor = await requirePermission("products.manage");
    const parsed = materialSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);

    const { s } = await import("@/lib/services");
    try {
      const material = await s.db.catalog.createMaterial({
        actor,
        description: parsed.data.description,
        name: parsed.data.name,
      });
      return { material, ok: true as const };
    } catch (error) {
      return mutationFailure(error);
    }
  });

/**
 * Lists every material with administrator-only content.
 *
 * @returns All materials ordered by name.
 * @rejects If permission checking, service loading, or querying fails.
 */
export const listAdminMaterials = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminMaterialSummary[]> => {
    const actor = await requirePermission("products.manage");
    const { s } = await import("@/lib/services");
    return await s.db.catalog.listAdminMaterials(actor);
  },
);

/**
 * Lists all public materials with signed lead images and public usage counts.
 *
 * @returns Name-sorted material summaries.
 * @rejects If service loading, querying, or image signing fails.
 */
export const listPublicMaterials = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicMaterialSummary[]> => {
    const { s } = await import("@/lib/services");
    return await Promise.all(
      (await s.db.catalog.listPublicMaterials()).map(async (material) => {
        const [leadImage] = material.leadImage
          ? await signCatalogImageUrls([material.leadImage])
          : [];
        return { ...material, leadImage: leadImage ?? null };
      }),
    );
  },
);

/**
 * Loads one public material with signed gallery, product, and collection-item images.
 *
 * @returns Public material detail, or `null` for an unknown slug.
 * @rejects If validation, service loading, querying, or image signing fails.
 */
export const getPublicMaterial = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ materialSlug: z.string().regex(slugPattern) }).parse(input),
  )
  .handler(async ({ data }): Promise<PublicMaterial | null> => {
    const { s } = await import("@/lib/services");
    const material = await s.db.catalog.getPublicMaterial(data.materialSlug);
    if (!material) return null;
    const [images, products, collectionItems] = await Promise.all([
      signCatalogImageUrls(material.images),
      signCatalogProducts(material.products),
      Promise.all(material.collectionItems.map(signCollectionItem)),
    ]);
    return {
      ...material,
      collectionItems,
      images,
      leadImage: images[0] ?? null,
      products,
    };
  });

/**
 * Loads one material for the administrator editor.
 *
 * @returns The requested material with signed image URLs, or `null` when absent.
 * @rejects If input validation, permission checking, service loading, querying, or image signing fails.
 */
export const getAdminMaterial = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ materialId: idSchema }).parse(input),
  )
  .handler(async ({ data }): Promise<AdminMaterial | null> => {
    const actor = await requirePermission("products.manage");
    const { s } = await import("@/lib/services");
    const material = await s.db.catalog.getAdminMaterial(
      data.materialId,
      actor,
    );
    return material
      ? { ...material, images: await signCatalogImageUrls(material.images) }
      : null;
  });

/**
 * Validates and creates or updates an administrator-managed material.
 *
 * @returns The saved material or a validation-aware mutation failure.
 * @rejects If permission checking or service loading fails.
 */
export const saveAdminMaterial = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actor = await requirePermission("products.manage");
    const parsed = materialWriteSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);

    const { s } = await import("@/lib/services");
    try {
      const material = parsed.data.materialId
        ? await s.db.catalog.updateMaterial({
            actor,
            description: parsed.data.description,
            materialId: parsed.data.materialId,
            name: parsed.data.name,
          })
        : await s.db.catalog.createMaterial({
            actor,
            description: parsed.data.description,
            name: parsed.data.name,
          });
      return { material, ok: true as const };
    } catch (error) {
      return mutationFailure(error);
    }
  });

/** Validates and creates an audited maker-scoped catalog terminology alias. */
export const createCatalogTerminologyAlias = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actor = await requirePermission("products.manage");
    const parsed = terminologyAliasSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);
    const { s } = await import("@/lib/services");
    try {
      const terminologyAlias = await s.db.catalog.createTerminologyAlias({
        actor,
        ...parsed.data,
      });
      return { ok: true as const, terminologyAlias };
    } catch (error) {
      return mutationFailure(error);
    }
  });

/**
 * Validates and creates a uniquely slugged finish for an authorized product manager.
 *
 * @returns The created finish or a validation-aware mutation failure.
 * @rejects If permission checking, service loading, or existing-finish lookup fails.
 */
export const createCatalogFinish = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }): Promise<CatalogLookupMutationResult<"finish">> => {
    const actor = await requirePermission("products.manage");
    const parsed = finishSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);

    const { s } = await import("@/lib/services");
    const finishes = await s.db.catalog.listFinishes();
    try {
      const finish = await s.db.catalog.createFinish({
        actor,
        name: parsed.data.name,
        slug: nextAvailableSlug(
          parsed.data.name,
          finishes.map(({ slug }) => slug),
        ),
      });
      return { finish, ok: true as const };
    } catch (error) {
      return mutationFailure(error);
    }
  });

/**
 * Validates and creates a uniquely slugged pattern for an authorized product manager.
 *
 * @returns The created pattern or a validation-aware mutation failure.
 * @rejects If permission checking, service loading, or existing-pattern lookup fails.
 */
export const createCatalogPattern = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(
    async ({ data }): Promise<CatalogLookupMutationResult<"pattern">> => {
      const actor = await requirePermission("products.manage");
      const parsed = patternSchema.safeParse(data);
      if (!parsed.success) return validationFailure(parsed.error);

      const { s } = await import("@/lib/services");
      const patterns = await s.db.catalog.listPatterns();
      try {
        const pattern = await s.db.catalog.createPattern({
          actor,
          name: parsed.data.name,
          slug: nextAvailableSlug(
            parsed.data.name,
            patterns.map(({ slug }) => slug),
          ),
        });
        return { ok: true as const, pattern };
      } catch (error) {
        return mutationFailure(error);
      }
    },
  );

/**
 * Validates and creates a uniquely slugged color for an authorized product manager.
 *
 * @returns The created color or a validation-aware mutation failure.
 * @rejects If permission checking, service loading, or existing-color lookup fails.
 */
export const createCatalogColor = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(
    async ({
      data,
    }): Promise<CatalogLookupMutationResult<"color", CatalogColor>> => {
      const actor = await requirePermission("products.manage");
      const parsed = colorSchema.safeParse(data);
      if (!parsed.success) return validationFailure(parsed.error);

      const { s } = await import("@/lib/services");
      const colors = await s.db.catalog.listColors();
      try {
        const color = await s.db.catalog.createColor({
          actor,
          hex: parsed.data.hex,
          name: parsed.data.name,
          slug: nextAvailableSlug(
            parsed.data.name,
            colors.map(({ slug }) => slug),
          ),
        });
        return { color, ok: true as const };
      } catch (error) {
        return mutationFailure(error);
      }
    },
  );

/**
 * Validates and creates or updates a catalog product for the current actor.
 *
 * @returns The saved product or a validation-aware mutation failure.
 * @rejects If authentication, service loading, or a prerequisite catalog query fails.
 */
export const saveCatalogProduct = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const parsed = productFormSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);

    const { s } = await import("@/lib/services");
    if (parsed.data.compatibleButtonId) {
      const compatibleButton = (
        await s.db.catalog.listProducts("spinner-button", actor)
      ).find(({ id }) => id === parsed.data.compatibleButtonId);
      if (
        !compatibleButton ||
        (parsed.data.buttonDiameter !== null &&
          Number(compatibleButton.diameter) !==
            Number(parsed.data.buttonDiameter))
      ) {
        return {
          fieldErrors: {
            compatibleButtonId: ["web.catalog.error.form"],
          },
          formError: "web.catalog.error.form",
          ok: false as const,
          requiresConfirmation: false as const,
        };
      }
    }
    const slugs = await s.db.catalog.listSlugs(
      parsed.data.productTypeSlug,
      parsed.data.productId ?? undefined,
    );
    const slug = nextAvailableSlug(parsed.data.name, slugs);
    const input: ProductWriteInput = {
      actor,
      description: parsed.data.description,
      finishOptions: parsed.data.finishOptions.map(
        ({ colorEffectId, colorIds, finishIds, patternId }) => ({
          colorEffectId,
          colorIds,
          finishIds,
          patternId,
        }),
      ),
      makerId: parsed.data.makerId,
      makerProductUrl: parsed.data.makerProductUrl,
      magnetConfiguration: parsed.data
        .magnetConfiguration as SliderMagnetConfiguration | null,
      magnetLayout: parsed.data.magnetLayout as SliderMagnetLayout | null,
      materialIds: parsed.data.materialIds,
      includedInsertProductId: parsed.data.includedInsertProductId,
      includedPlateProductId: parsed.data.includedPlateProductId,
      name: parsed.data.name,
      productTypeSlug: parsed.data.productTypeSlug,
      reason: parsed.data.reason,
      slug,
      specs: {
        bearing: parsed.data.bearing,
        buttonDiameter: parsed.data.buttonDiameter,
        compatibleButtonId: parsed.data.compatibleButtonId,
        diameter: parsed.data.diameter,
        length: parsed.data.length,
        spinDiameter: parsed.data.spinDiameter,
        thickness: parsed.data.thickness,
        thicknessWithButton: parsed.data.thicknessWithButton,
        weight: parsed.data.weight,
        width: parsed.data.width,
        usesInserts: parsed.data.usesInserts,
      },
    };

    try {
      const product = parsed.data.productId
        ? await s.db.catalog.updateProduct({
            ...input,
            productId: parsed.data.productId,
          })
        : await s.db.catalog.createProduct(input);
      return { ok: true as const, product };
    } catch (error) {
      return mutationFailure(error);
    }
  });

/**
 * Validates and adds a product to a collection, requesting confirmation for duplicates.
 *
 * @returns The created item identifiers, a duplicate-confirmation result, or a validation-aware failure.
 * @rejects If authentication or service loading fails.
 */
export const addCollectionProduct = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const parsed = collectionAddSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);

    const { s } = await import("@/lib/services");
    try {
      const productIds = [
        parsed.data.productId,
        ...(parsed.data.buttonProductId ? [parsed.data.buttonProductId] : []),
      ];
      const duplicateCounts = await s.db.collections.countOwnedProducts({
        actorClerkId: actor.clerkId,
        productIds,
      });
      if (!parsed.data.confirmed && Object.keys(duplicateCounts).length) {
        return {
          duplicateCounts,
          ok: false as const,
          requiresConfirmation: true,
        };
      }

      let collectionItemId: number;
      if (parsed.data.productTypeSlug === "spinner") {
        collectionItemId = (
          await s.db.collections.addSpinner({
            actor,
            bearing: parsed.data.bearing,
            buttonCustomFinish: parsed.data.buttonCustomFinish
              ? toFinishWriteOption(parsed.data.buttonCustomFinish)
              : null,
            buttonFinishOptionId: parsed.data.buttonFinishOptionId,
            buttonMaterialId: parsed.data.buttonMaterialId,
            buttonProductId: parsed.data.buttonProductId,
            spinnerFinishOptionId: parsed.data.finishOptionId,
            spinnerCustomFinish: parsed.data.customFinish
              ? toFinishWriteOption(parsed.data.customFinish)
              : null,
            spinnerMaterialId: parsed.data.materialId,
            spinnerProductId: parsed.data.productId,
            collectionId: parsed.data.collectionId,
            displayName: parsed.data.displayName,
            description: parsed.data.description,
            newCollection: parsed.data.newCollection,
          })
        ).spinnerItemId;
      } else if (parsed.data.productTypeSlug === "spinner-button") {
        collectionItemId = await s.db.collections.addSpinnerButton({
          actor,
          customFinish: parsed.data.customFinish
            ? toFinishWriteOption(parsed.data.customFinish)
            : null,
          finishOptionId: parsed.data.finishOptionId,
          materialId: parsed.data.materialId,
          collectionId: parsed.data.collectionId,
          displayName: parsed.data.displayName,
          description: parsed.data.description,
          newCollection: parsed.data.newCollection,
          productId: parsed.data.productId,
        });
      } else {
        collectionItemId = await s.db.collections.addSliderProduct({
          actor,
          collectionId: parsed.data.collectionId,
          customFinish: parsed.data.customFinish
            ? toFinishWriteOption(parsed.data.customFinish)
            : null,
          description: parsed.data.description,
          displayName: parsed.data.displayName,
          finishOptionId: parsed.data.finishOptionId,
          materialId: parsed.data.materialId,
          newCollection: parsed.data.newCollection,
          productId: parsed.data.productId,
          productTypeSlug: parsed.data.productTypeSlug,
        });
      }
      const item = await s.db.collections.getOwnedItem(actor, collectionItemId);
      if (!item) throw new Error("Failed to load collection item.");
      return {
        collectionId: item.collectionId,
        collectionItemId,
        ok: true as const,
      };
    } catch (error) {
      return mutationFailure(error);
    }
  });

/**
 * Lists public collection owners, signing image URLs when configured.
 *
 * @returns Public owners with conditionally signed collection and item images.
 * @rejects If service loading, viewer lookup, the owner query, or image signing fails.
 */
export const getPublicCollectionOwners = createServerFn({
  method: "GET",
}).handler(async () => {
  const { s } = await import("@/lib/services");
  return await signCollectionOwners(
    await s.db.collections.listOwners(await getResourceViewer()),
  );
});

/**
 * Loads one public collection owner by user ID.
 *
 * @returns The owner, with signed images when configured, or `null` when no visible owner matches.
 * @rejects If input validation, service loading, viewer lookup, the owner query, or image signing fails.
 */
export const getPublicCollectionOwner = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ userId: idSchema }).parse(input))
  .handler(async ({ data }) => {
    const { s } = await import("@/lib/services");
    const viewer = await getResourceViewer();
    const owner =
      (await s.db.collections.listOwners(viewer)).find(
        ({ userId }) => userId === data.userId,
      ) ?? null;
    return owner ? ((await signCollectionOwners([owner]))[0] ?? null) : null;
  });

/**
 * Loads a public collection item and its optional installed components.
 *
 * @returns The item and installed components, with signed images when configured, or `null` when unavailable.
 * @rejects If input validation, service loading, viewer lookup, an item query, or image signing fails.
 */
export const getPublicCollectionItem = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        collectionId: idSchema,
        collectionItemId: idSchema,
        userId: idSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { s } = await import("@/lib/services");
    const viewer = await getResourceViewer();
    const item = await s.db.collections.getPublicItem({
      collectionId: data.collectionId,
      collectionItemId: data.collectionItemId,
      ownerUserId: data.userId,
      viewer,
    });
    if (!item) return null;
    const installedButton = item.installedButtonId
      ? await s.db.collections.getPublicItem({
          collectionId: data.collectionId,
          collectionItemId: item.installedButtonId,
          ownerUserId: data.userId,
          viewer,
        })
      : null;
    const [installedPlate, installedInsert] = await Promise.all([
      item.installedPlateId
        ? s.db.collections.getPublicItem({
            collectionId: data.collectionId,
            collectionItemId: item.installedPlateId,
            ownerUserId: data.userId,
            viewer,
          })
        : null,
      item.installedInsertId
        ? s.db.collections.getPublicItem({
            collectionId: data.collectionId,
            collectionItemId: item.installedInsertId,
            ownerUserId: data.userId,
            viewer,
          })
        : null,
    ]);
    const product = (
      await s.db.catalog.listProducts(item.productTypeSlug, viewer)
    ).find(({ id }) => id === item.productId);
    return {
      installedButton: installedButton
        ? await signCollectionItem(installedButton)
        : null,
      installedInsert: installedInsert
        ? await signCollectionItem(installedInsert)
        : null,
      installedPlate: installedPlate
        ? await signCollectionItem(installedPlate)
        : null,
      item: await signCollectionItem(item),
      product: product
        ? ((await signCatalogProducts([product]))[0] ?? null)
        : null,
    };
  });

/**
 * Lists the current user's collection items.
 *
 * @returns The actor's collection items, with signed images when configured.
 * @rejects If authentication, service loading, the item query, or image signing fails.
 */
export const getUserCollection = createServerFn({ method: "GET" }).handler(
  async () => {
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    return await Promise.all(
      (await s.db.collections.listOwned(actor)).map(signCollectionItem),
    );
  },
);

/**
 * Lists the current user's collection summaries.
 *
 * @returns The actor's collection summaries, with signed cover images when configured.
 * @rejects If authentication, service loading, the collection query, or image signing fails.
 */
export const getUserCollections = createServerFn({ method: "GET" }).handler(
  async () => {
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    return await signCollectionSummaries(
      await s.db.collections.listOwnedCollections(actor),
    );
  },
);

/**
 * Loads collection choices and a best-effort default collection name.
 *
 * @returns Collection choices with conditionally signed covers, the optional default name, and sync status.
 * @rejects If authentication, service loading, collection lookup, or image signing fails.
 */
export const getCollectionAddContext = createServerFn({
  method: "GET",
}).handler(async () => {
  const actor = await requireActor();
  const { s } = await import("@/lib/services");
  const collections = await s.db.collections.listOwnedCollections(actor);
  let defaultCollectionName: string | null = null;
  let syncIncomplete = false;
  if (collections.length === 0) {
    try {
      defaultCollectionName = await s.db.collections.getDefaultCollectionName(
        actor.clerkId,
      );
    } catch {
      syncIncomplete = true;
    }
  }
  return {
    collections: await signCollectionSummaries(collections),
    defaultCollectionName,
    syncIncomplete,
  };
});

/**
 * Loads one owned collection and its items.
 *
 * @returns The collection and items, with signed images when configured, or `null` when unavailable.
 * @rejects If input validation, authentication, service loading, a collection query, or image signing fails.
 */
export const getUserCollectionById = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ collectionId: idSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    const [collection, items] = await Promise.all([
      s.db.collections.getOwnedCollection(actor, data.collectionId),
      s.db.collections.listOwned(actor, data.collectionId),
    ]);
    if (!collection) return null;
    const [signedCollection] = await signCollectionSummaries([collection]);
    if (!signedCollection) return null;
    return {
      collection: signedCollection,
      items: await Promise.all(items.map(signCollectionItem)),
    };
  });

/**
 * Loads collection deletion choices and the affected item count.
 *
 * @returns Destinations with conditionally signed covers and the item count, or `null` when unavailable.
 * @rejects If input validation, authentication, service loading, the context query, or image signing fails.
 */
export const getCollectionDeletionContext = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ collectionId: idSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    const context = await s.db.collections.getDeletionContext(
      actor,
      data.collectionId,
    );
    if (!context) return null;
    return {
      destinations: await signCollectionSummaries(context.destinations),
      itemCount: context.itemCount,
    };
  });

/**
 * Moves or permanently deletes a collection and its contents.
 *
 * @rejects If input validation, authentication, service loading, service authorization, auditing, operation logging, or persistence fails.
 */
export const deleteUserCollection = createServerFn({ method: "POST" })
  .validator((input: unknown) => collectionDeletionSchema.parse(input))
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    await s.db.collections.deleteCollection({ actor, ...data });
  });

/**
 * Permanently deletes one authorized collection item and sanitizes service failures.
 *
 * @returns Whether deletion committed, or a localized generic failure key.
 * @rejects When input validation or authentication fails.
 */
export const deleteCollectionItem = createServerFn({ method: "POST" })
  .validator((input: unknown) => collectionItemDeletionSchema.parse(input))
  .handler(async ({ data }) => {
    const actor = await requireActor();
    try {
      const { s } = await import("@/lib/services");
      await s.db.collections.deleteItem({ actor, ...data });
      return { ok: true as const };
    } catch {
      return { ok: false as const, formError: "error.generic" };
    }
  });

/**
 * Loads a public collection, its owner, and items, signing images when configured.
 *
 * @returns The collection, items, and optional owner username, or `null` when unavailable.
 * @rejects If input validation, service loading, viewer lookup, a collection query, or image signing fails.
 */
export const getPublicCollection = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ collectionId: idSchema, userId: idSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const { s } = await import("@/lib/services");
    const viewer = await getResourceViewer();
    const [collection, owner] = await Promise.all([
      s.db.collections.getPublicCollection({
        collectionId: data.collectionId,
        ownerUserId: data.userId,
        viewer,
      }),
      s.db.collections.listOwners(viewer),
    ]);
    if (!collection) return null;
    const matchingOwner = owner.find(({ userId }) => userId === data.userId);
    const items = await s.db.collections.listCollectionItems({
      collectionId: data.collectionId,
      ownerUserId: data.userId,
      viewer,
    });
    const [signedCollection] = await signCollectionSummaries([collection]);
    if (!signedCollection) return null;
    return {
      collection: signedCollection,
      items: await Promise.all(items.map(signCollectionItem)),
      ownerImageUrl: matchingOwner?.imageUrl ?? null,
      ownerUsername: matchingOwner?.username,
    };
  });

/**
 * Selects or clears an owned collection's cover image.
 *
 * @rejects If input validation, authentication, service loading, service authorization, auditing, operation logging, or persistence fails.
 */
export const selectCollectionCover = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        collectionId: idSchema,
        imageId: idSchema.nullable(),
        reason: z.string().trim().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    await s.db.catalog.selectCollectionCover({ ...data, actor });
  });

/**
 * Validates and creates or updates a collection.
 *
 * @returns The collection, with signed images when configured, or a validation-aware mutation failure.
 * @rejects If authentication or service loading fails.
 */
export const saveCollection = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    collectionWriteSchema
      .and(z.object({ collectionId: idSchema.nullable() }))
      .safeParse(input),
  )
  .handler(async ({ data: parsed }) => {
    if (!parsed.success) return validationFailure(parsed.error);
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    try {
      const collection = parsed.data.collectionId
        ? await s.db.collections.updateCollection({
            ...parsed.data,
            actor,
            collectionId: parsed.data.collectionId,
          })
        : await s.db.collections.createCollection({
            ...parsed.data,
            actor,
          });
      const [signedCollection] = await signCollectionSummaries([collection]);
      if (!signedCollection) throw new Error("Failed to sign collection.");
      return {
        collection: signedCollection,
        ok: true as const,
      };
    } catch (error) {
      return mutationFailure(error);
    }
  });

/**
 * Loads one owned collection summary.
 *
 * @returns The owned collection summary, or `null` when it is unavailable.
 * @rejects If input validation, authentication, service loading, or the collection query fails.
 */
export const getUserCollectionSummary = createServerFn({
  method: "GET",
})
  .validator((input: unknown) =>
    z.object({ collectionId: idSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    return await s.db.collections.getOwnedCollection(actor, data.collectionId);
  });

/**
 * Loads an owned item and its collection-edit choices.
 *
 * @returns Edit data, or empty choices with a `null` item and product when the item is unavailable.
 * @rejects If input validation, authentication, service loading, a catalog query, or image signing fails.
 */
export const getCollectionEditData = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ collectionItemId: idSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    const item = await s.db.collections.getOwnedItem(
      actor,
      data.collectionItemId,
    );
    if (!item) {
      return {
        buttonProducts: [],
        assemblyMoveItemCount: 1,
        collections: [],
        item: null,
        ownedButtons: [],
        ownedSliderComponents: [],
        product: null,
      };
    }
    const [items, products, buttonProducts, collections] = await Promise.all([
      s.db.collections.listOwned(actor),
      s.db.catalog.listProducts(item.productTypeSlug, actor),
      item.productTypeSlug === "spinner"
        ? s.db.catalog.listProducts("spinner-button", actor)
        : Promise.resolve([]),
      s.db.collections.listOwnedCollections(actor),
    ]);
    return {
      assemblyMoveItemCount: (() => {
        const parent =
          item.productTypeSlug === "slider"
            ? item
            : items.find(
                ({ collectionItemId }) =>
                  collectionItemId === item.installedOnSliderId,
              );
        return parent
          ? 1 +
              Number(parent.installedPlateId !== null) +
              Number(parent.installedInsertId !== null)
          : 1;
      })(),
      buttonProducts,
      collections: await signCollectionSummaries(collections),
      item: await signCollectionItem(item),
      ownedButtons: items.filter(
        (candidate) => candidate.productTypeSlug === "spinner-button",
      ),
      ownedSliderComponents: items.filter(
        (candidate) =>
          candidate.productTypeSlug === "slider-plate" ||
          candidate.productTypeSlug === "slider-insert",
      ),
      product: await (async () => {
        const product = products.find(({ id }) => id === item.productId);
        return product
          ? ((await signCatalogProducts([product]))[0] ?? null)
          : null;
      })(),
    };
  });

/**
 * Validates and updates a collection item.
 *
 * @returns A success marker or a validation-aware mutation failure.
 * @rejects If authentication or service loading fails.
 */
export const updateCollectionItem = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const parsed = collectionEditSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);

    const { s } = await import("@/lib/services");
    try {
      await s.db.collections.updateItem({
        actor,
        ...parsed.data,
        customFinish: parsed.data.customFinish
          ? toFinishWriteOption(parsed.data.customFinish)
          : null,
        installedButton: parsed.data.installedButton
          ? {
              ...parsed.data.installedButton,
              customFinish: parsed.data.installedButton.customFinish
                ? toFinishWriteOption(parsed.data.installedButton.customFinish)
                : null,
            }
          : parsed.data.installedButton,
      });
      return { ok: true as const };
    } catch (error) {
      return sliderAssemblyMutationFailure(error) ?? mutationFailure(error);
    }
  });

/**
 * Moves a product or collection-item image to trash.
 *
 * @rejects If input validation, authentication, service loading, service authorization, auditing, operation logging, or persistence fails.
 */
export const softDeleteCatalogImage = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        imageId: idSchema,
        reason: z.string().trim().max(1000).optional(),
        targetType: z.enum(["maker", "material", "product", "collection_item"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    await s.db.catalog.softDeleteImage({
      actor,
      ...data,
    });
  });

/**
 * Restores a trashed product or collection-item image.
 *
 * @rejects If input validation, authentication, service loading, service authorization, auditing, operation logging, or persistence fails.
 */
export const restoreCatalogImage = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        imageId: idSchema,
        reason: z.string().trim().max(1000).optional(),
        targetType: z.enum(["maker", "material", "product", "collection_item"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    await s.db.catalog.restoreImage({
      actor,
      ...data,
    });
  });

/**
 * Lists trashed catalog images, signing URLs when configured.
 *
 * @returns Trashed catalog images with conditionally signed URLs.
 * @rejects If authentication, service loading, the trash query, or image signing fails.
 */
export const listCatalogImageTrash = createServerFn({ method: "GET" }).handler(
  async () => {
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    return await signCatalogImageUrls(
      await s.db.catalog.listImageTrash({ actor }),
    );
  },
);

/**
 * Changes product visibility.
 *
 * @rejects If input validation, authentication, service loading, service authorization, auditing, operation logging, or persistence fails.
 */
export const setProductVisibility = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        isPrivate: z.boolean(),
        productId: idSchema,
        reason: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    await s.db.catalog.setVisibility({
      actor,
      ...data,
    });
  });

/** Applies an authorized product approval transition. */
export const decideCatalogProductApproval = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actor = await requirePermission("products.manage");
    const parsed = productApprovalSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);

    const { s } = await import("@/lib/services");
    try {
      const approvalStatus = await s.db.catalog.decideProductApproval({
        ...parsed.data,
        actor,
      });
      return { approvalStatus, ok: true as const };
    } catch (error) {
      return mutationFailure(error);
    }
  });

/** Deletes an eligible product through the owner or staff authorization path. */
export const deleteCatalogProduct = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const parsed = productDeletionSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);
    const { s } = await import("@/lib/services");
    try {
      const deleted = await s.db.catalog.deleteProduct({
        actor,
        ...parsed.data,
      });
      return deleted
        ? { ok: true as const }
        : { ok: false as const, formError: "web.catalog.deletion.blocked" };
    } catch {
      return { ok: false as const, formError: "web.catalog.deletion.failed" };
    }
  });

/** Applies an authorized collection-item approval transition. */
export const decideCollectionItemApproval = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actor = await requirePermission("collections.manage");
    const parsed = collectionItemApprovalSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);

    const { s } = await import("@/lib/services");
    try {
      const approvalStatus = await s.db.collections.decideItemApproval({
        ...parsed.data,
        actor,
      });
      return { approvalStatus, ok: true as const };
    } catch (error) {
      return mutationFailure(error);
    }
  });

/**
 * Changes collection visibility.
 *
 * @rejects If input validation, authentication, service loading, service authorization, auditing, operation logging, or persistence fails.
 */
export const setCollectionVisibility = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        isPrivate: z.boolean(),
        collectionId: idSchema,
        reason: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    await s.db.collections.setCollectionVisibility({
      actor,
      ...data,
    });
  });

/**
 * Changes collection-item visibility.
 *
 * @rejects If input validation, authentication, service loading, service authorization, auditing, operation logging, or persistence fails.
 */
export const setCollectionItemVisibility = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        collectionItemId: idSchema,
        isPrivate: z.boolean(),
        reason: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    try {
      await s.db.collections.setItemVisibility({
        actor,
        ...data,
      });
      return { ok: true as const };
    } catch (error) {
      return sliderAssemblyMutationFailure(error) ?? mutationFailure(error);
    }
  });

/**
 * Removes validation-only color-effect metadata from a finish option.
 *
 * @param option - Validated finish option to convert.
 * @returns The database write shape for the finish option.
 */
function toFinishWriteOption(
  option: z.infer<typeof finishOptionSchema>,
): ProductWriteInput["finishOptions"][number] {
  return {
    colorEffectId: option.colorEffectId,
    colorIds: option.colorIds,
    finishIds: option.finishIds,
    patternId: option.patternId,
  };
}

/**
 * Loads catalog makers.
 *
 * @returns A promise resolving to catalog makers.
 * @rejects If the service module or maker query fails.
 */
async function listMakers() {
  const { s } = await import("@/lib/services");
  return await s.db.catalog.listMakers();
}

/**
 * Loads catalog color effects.
 *
 * @returns A promise resolving to catalog color effects.
 * @rejects If the service module or color-effect query fails.
 */
async function listColorEffects(): Promise<CatalogLookup[]> {
  const { s } = await import("@/lib/services");
  return await s.db.catalog.listColorEffects();
}

/**
 * Loads catalog colors.
 *
 * @returns A promise resolving to catalog colors.
 * @rejects If the service module or color query fails.
 */
async function listColors(): Promise<CatalogLookup[]> {
  const { s } = await import("@/lib/services");
  return await s.db.catalog.listColors();
}

/**
 * Loads catalog finishes.
 *
 * @returns A promise resolving to catalog finishes.
 * @rejects If the service module or finish query fails.
 */
async function listFinishes(): Promise<CatalogLookup[]> {
  const { s } = await import("@/lib/services");
  return await s.db.catalog.listFinishes();
}

/**
 * Loads catalog materials.
 *
 * @returns A promise resolving to catalog materials.
 * @rejects If the service module or material query fails.
 */
async function listMaterials() {
  const { s } = await import("@/lib/services");
  return await s.db.catalog.listMaterials();
}

/**
 * Loads catalog patterns.
 *
 * @returns A promise resolving to catalog patterns.
 * @rejects If the service module or pattern query fails.
 */
async function listPatterns(): Promise<CatalogLookup[]> {
  const { s } = await import("@/lib/services");
  return await s.db.catalog.listPatterns();
}

/**
 * Loads catalog product types.
 *
 * @returns A promise resolving to catalog product types.
 * @rejects If the service module or product-type query fails.
 */
async function listProductTypes() {
  const { s } = await import("@/lib/services");
  return await s.db.catalog.listProductTypes();
}

/**
 * Converts a Zod error into the standard form failure shape.
 *
 * @param error - Validation or mutation error to normalize.
 * @returns The standard validation failure payload.
 */
function validationFailure(error: z.ZodError) {
  return {
    fieldErrors: z.flattenError(error).fieldErrors,
    formError: "web.catalog.error.form",
    ok: false as const,
    requiresConfirmation: false as const,
  };
}

/**
 * Converts a caught mutation error into a duplicate or generic form failure.
 *
 * @param error - Validation or mutation error to normalize.
 * @returns The standard mutation failure payload.
 */
function mutationFailure(error: unknown) {
  return {
    fieldErrors: {},
    formError:
      error instanceof Error && /already exists/i.test(error.message)
        ? "web.catalog.error.duplicate"
        : "web.catalog.error.form",
    ok: false as const,
    requiresConfirmation: false as const,
  };
}

/**
 * Converts slider assembly domain failures into localized form errors.
 *
 * @param error - Candidate service error.
 * @returns A localized mutation failure, or `null` for unrelated failures.
 */
function sliderAssemblyMutationFailure(error: unknown) {
  if (error instanceof CollectionAssemblyPrivacyBlockedError) {
    return {
      fieldErrors: {},
      formError:
        error.operation === "install"
          ? "web.slider.moderation.installBlocked"
          : "web.slider.moderation.publicBlocked",
      formErrorDetail: "web.slider.privacy.blockingComponent",
      formErrorValues: { component: error.blockerName },
      ok: false as const,
      requiresConfirmation: false as const,
    };
  }
  if (error instanceof CollectionItemPrivacyInheritedError) {
    return {
      fieldErrors: {},
      formError: "web.slider.privacy.inheritedDescription",
      ok: false as const,
      requiresConfirmation: false as const,
    };
  }
  if (!(error instanceof Error)) return null;
  const formError = error.message.includes("Body-hosted")
    ? "web.slider.validation.bodyHostedInsert"
    : error.message.includes("already installed")
      ? "web.slider.validation.alreadyInstalled"
      : error.message.includes("slider plate does not exist") ||
          error.message.includes("slider insert does not exist")
        ? "web.slider.validation.exactProduct"
        : null;
  return formError
    ? {
        fieldErrors: {},
        formError,
        ok: false as const,
        requiresConfirmation: false as const,
      }
    : null;
}

/**
 * Returns product copies with image URLs signed when configured.
 *
 * @param products - Catalog products whose images should be signed.
 * @returns Product copies with conditionally signed image URLs.
 * @rejects If image URL signing fails.
 */
async function signCatalogProducts(products: CatalogProduct[]) {
  return await Promise.all(
    products.map(async (product) => ({
      ...product,
      images: await signCatalogImageUrls(product.images),
    })),
  );
}

/**
 * Returns a collection-item copy with item and product image URLs signed when configured.
 *
 * @param item - Collection item whose image URLs should be signed.
 * @returns The collection item with conditionally signed image URLs.
 * @rejects If image URL signing fails.
 * @template T - Collection-item shape preserved by the operation.
 */
async function signCollectionItem<
  T extends {
    /**
     * Images owned by the collection item.
     */
    images: CatalogImage[];
    /** Images inherited from the catalog product. */
    productImages: CatalogImage[];
  },
>(item: T): Promise<T> {
  const [images, productImages] = await Promise.all([
    signCatalogImageUrls(item.images),
    signCatalogImageUrls(item.productImages),
  ]);
  return { ...item, images, productImages };
}

/**
 * Returns collection-summary copies with cover image URLs signed when configured.
 *
 * @param collections - Collection summaries to sign.
 * @returns Collection copies with conditionally signed cover URLs.
 * @rejects If cover image URL signing fails.
 */
async function signCollectionSummaries(
  collections: UserCollectionSummary[],
): Promise<UserCollectionSummary[]> {
  return await Promise.all(
    collections.map(async (collection) => {
      const [coverImage] = collection.coverImage
        ? await signCatalogImageUrls([collection.coverImage])
        : [];
      return {
        ...collection,
        coverImage: coverImage ?? null,
        coverImages: await signCatalogImageUrls(collection.coverImages),
      };
    }),
  );
}

/**
 * Returns owner copies with collection and item image URLs signed when configured.
 *
 * @param owners - Public collection owners to sign.
 * @returns Owner copies with conditionally signed nested image URLs.
 * @rejects If nested collection or item image signing fails.
 * @template T - Collection-owner shape preserved by the operation.
 */
async function signCollectionOwners<
  T extends {
    /**
     * Collection summaries owned by the user.
     */
    collections: UserCollectionSummary[];
    /**
     * Collection items owned by the user.
     */
    items: Array<{
      /**
       * Images owned by the collection item.
       */
      images: CatalogImage[];
      /** Images inherited from the catalog product. */
      productImages: CatalogImage[];
    }>;
  },
>(owners: T[]): Promise<T[]> {
  return await Promise.all(
    owners.map(async (owner) => ({
      ...owner,
      collections: await signCollectionSummaries(owner.collections),
      items: await Promise.all(owner.items.map(signCollectionItem)),
    })),
  );
}

/**
 * Signs catalog image URLs when Bunny CDN credentials are configured.
 *
 * @param images - Catalog images whose URLs may need signing.
 * @returns A promise resolving to signed image copies, or the original array when signing is disabled.
 * @rejects If the signing modules fail to load or sign an image.
 * @template T - Catalog image subtype preserved by the operation.
 */
async function signCatalogImageUrls<T extends CatalogImage>(
  images: T[],
): Promise<T[]> {
  const [{ signResourceUrl, signImages }, { serverEnv }] = await Promise.all([
    import("@package/services"),
    import("@/env/server"),
  ]);
  if (!serverEnv.BUNNY_CDN_BASE_URL || !serverEnv.BUNNY_CDN_TOKEN_KEY)
    return images;
  return signImages(images, (objectPath) =>
    signResourceUrl({
      cdnBaseUrl: serverEnv.BUNNY_CDN_BASE_URL,
      tokenKey: serverEnv.BUNNY_CDN_TOKEN_KEY,
      objectPath,
    }),
  );
}

/**
 * Checks and narrows a string to a supported catalog product type.
 *
 * @param value - Candidate product-type slug.
 * @returns Whether the value is a supported catalog product type.
 */
export function productTypeIsSupported(
  value: string,
): value is CatalogProductType {
  return productTypeSchema.safeParse(value).success;
}

/**
 * Checks whether a product type is supported by the current collection editor.
 *
 * @param value - Candidate product-type slug.
 * @returns Whether the collection editor can safely create an owned item.
 */
export function collectionProductTypeIsSupported(
  value: string,
): value is CatalogProductType {
  return collectionProductTypeSchema.safeParse(value).success;
}

/**
 * Builds the normalized slug preview for a product name.
 *
 * @param name - Human-readable name.
 * @returns The normalized product slug preview.
 */
export function productSlugPreview(name: string): string {
  return slugify(name);
}
