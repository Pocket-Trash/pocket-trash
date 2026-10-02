import type {
  CatalogColor,
  CatalogImage,
  CatalogLookup,
  CatalogProduct,
  CatalogProductType,
  ProductWriteInput,
  UserCollectionItem,
  UserCollectionSummary,
} from "@package/services";
import { hasPermission } from "@package/services/authorization";
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
 * Localization key used for invalid catalog URLs.
 */
const urlMessage = "web.catalog.error.url";

/**
 * Schema for supported catalog product-type slugs.
 */
const productTypeSchema = z.enum(["spinner", "spinner-button"]);
/**
 * Schema for positive integer identifiers.
 */
const idSchema = z
  .number(requiredMessage)
  .int(requiredMessage)
  .positive(requiredMessage);
/**
 * Schema for optional positive numeric specifications.
 */
const numericSpecSchema = positiveDecimalSchema;
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
    finishIds: z.array(idSchema).min(1, "web.catalog.error.finishRequired"),
  })
  .superRefine((option, context) => {
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
    buttonDiameterMm: numericSpecSchema,
    compatibleButtonId: idSchema.nullable(),
    description: optionalDescriptionSchema,
    diameterMm: numericSpecSchema,
    finishOptions: z
      .array(finishOptionSchema)
      .min(1, "web.catalog.error.finishOptionRequired"),
    lengthMm: numericSpecSchema,
    makerId: idSchema,
    makerProductUrl: optionalUrlSchema,
    materialIds: z.array(idSchema).min(1, requiredMessage),
    name: slugNameSchema,
    productId: idSchema.nullable(),
    productTypeSlug: productTypeSchema,
    reason: z.string().trim().max(1000).optional(),
    spinDiameterMm: numericSpecSchema,
    thicknessMm: numericSpecSchema,
    thicknessWithButtonMm: numericSpecSchema,
    weightG: numericSpecSchema,
    widthMm: numericSpecSchema,
  })
  .superRefine(
    ({ bearing, finishOptions, productTypeSlug, spinDiameterMm }, context) => {
      if (
        productTypeSlug !== "spinner" &&
        (bearing !== null || spinDiameterMm !== null)
      ) {
        context.addIssue({
          code: "custom",
          message: "web.catalog.error.form",
          path: [bearing !== null ? "bearing" : "spinDiameterMm"],
        });
      }
      const signatures = finishOptions.map(
        ({ colorEffectId, colorIds, finishIds }) =>
          `${finishIds.join(",")}|${colorEffectId ?? ""}|${colorIds.join(",")}`,
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
  name: z.string().trim().min(1, requiredMessage),
  rootUrl: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" || z.url().safeParse(normalizeOptionalUrl(value)).success,
      urlMessage,
    ),
});

/**
 * Schema for material names.
 */
const materialSchema = z.object({
  name: slugNameSchema,
});

/**
 * Schema for finish names.
 */
const finishSchema = z.object({ name: slugNameSchema });
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
    productTypeSlug: productTypeSchema,
  })
  .superRefine((input, context) => {
    const finishCount = [input.finishOptionId, input.customFinish].filter(
      (value) => value !== null,
    ).length;
    if (finishCount !== 1) {
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
    const selectedButtonValues = [
      input.buttonProductId,
      input.buttonMaterialId,
      buttonFinishCount === 1 ? true : null,
    ].filter((value) => value !== null).length;
    if (
      (selectedButtonValues !== 0 && selectedButtonValues !== 3) ||
      buttonFinishCount > 1 ||
      (input.productTypeSlug !== "spinner" && selectedButtonValues > 0) ||
      (input.buttonProductId === null && buttonFinishCount > 0)
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
 * Schema for editing a collection item and its optional installed button.
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

/**
 * Lookup values and spinner buttons required by catalog forms.
 */
export type CatalogOptions = {
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
  /**
   * Available product types.
   */
  productTypes: Awaited<ReturnType<typeof listProductTypes>>;
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
      materials,
      productTypes,
      spinnerButtons,
    ] = await Promise.all([
      listColorEffects(),
      listColors(),
      listFinishes(),
      listMakers(),
      listMaterials(),
      listProductTypes(),
      s.db.catalog.listProducts("spinner-button", viewer),
    ]);
    return {
      colorEffects,
      colors,
      finishes,
      makers,
      materials,
      productTypes,
      spinnerButtons,
    };
  },
);

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
        rootUrl: normalizeOptionalUrl(parsed.data.rootUrl),
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
    const materials = await s.db.catalog.listMaterials();
    const slug = nextAvailableSlug(
      parsed.data.name,
      materials.map((material) => material.slug),
    );
    try {
      const material = await s.db.catalog.createMaterial({
        actor,
        name: parsed.data.name,
        slug,
      });
      return { material, ok: true as const };
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
        (parsed.data.buttonDiameterMm !== null &&
          Number(compatibleButton.diameterMm) !==
            Number(parsed.data.buttonDiameterMm))
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
        ({ colorEffectId, colorIds, finishIds }) => ({
          colorEffectId,
          colorIds,
          finishIds,
        }),
      ),
      makerId: parsed.data.makerId,
      makerProductUrl: parsed.data.makerProductUrl,
      materialIds: parsed.data.materialIds,
      name: parsed.data.name,
      productTypeSlug: parsed.data.productTypeSlug,
      reason: parsed.data.reason,
      slug,
      specs: {
        bearing: parsed.data.bearing,
        buttonDiameterMm: parsed.data.buttonDiameterMm,
        compatibleButtonId: parsed.data.compatibleButtonId,
        diameterMm: parsed.data.diameterMm,
        lengthMm: parsed.data.lengthMm,
        spinDiameterMm: parsed.data.spinDiameterMm,
        thicknessMm: parsed.data.thicknessMm,
        thicknessWithButtonMm: parsed.data.thicknessWithButtonMm,
        weightG: parsed.data.weightG,
        widthMm: parsed.data.widthMm,
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

      const collectionItemId =
        parsed.data.productTypeSlug === "spinner"
          ? (
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
            ).spinnerItemId
          : await s.db.collections.addSpinnerButton({
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
 * Loads a public collection item and its optional installed button.
 *
 * @returns The item and installed button, with signed images when configured, or `null` when unavailable.
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
    return {
      installedButton: installedButton
        ? await signCollectionItem(installedButton)
        : null,
      item: await signCollectionItem(item),
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
        collections: [],
        item: null,
        ownedButtons: [],
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
      buttonProducts,
      collections: await signCollectionSummaries(collections),
      item: await signCollectionItem(item),
      ownedButtons: items.filter(
        (candidate) => candidate.productTypeSlug === "spinner-button",
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
      return mutationFailure(error);
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
        targetType: z.enum(["product", "collection_item"]),
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
        targetType: z.enum(["product", "collection_item"]),
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
    await s.db.collections.setItemVisibility({
      actor,
      ...data,
    });
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
 * Builds the normalized slug preview for a product name.
 *
 * @param name - Human-readable name.
 * @returns The normalized product slug preview.
 */
export function productSlugPreview(name: string): string {
  return slugify(name);
}
