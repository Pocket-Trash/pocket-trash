import { auth } from "@clerk/tanstack-react-start/server";
import type {
  CatalogLookup,
  CatalogProduct,
  CatalogProductType,
  ProductWriteInput,
} from "@package/services";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  nextAvailableSlug,
  normalizeOptionalUrl,
  positiveDecimalSchema,
  slugify,
  slugPattern,
} from "./catalog";
import { localizedServerError } from "./server-errors";

const requiredMessage = "web.catalog.error.required";
const urlMessage = "web.catalog.error.url";

const productTypeSchema = z.enum(["spinner", "spinner-button"]);
const idSchema = z
  .number(requiredMessage)
  .int(requiredMessage)
  .positive(requiredMessage);
const numericSpecSchema = positiveDecimalSchema;
const slugNameSchema = z
  .string()
  .trim()
  .min(1, requiredMessage)
  .refine((value) => slugify(value).length > 0, requiredMessage);

const finishOptionSchema = z
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
  });

export const productFormSchema = z
  .object({
    buttonDiameterMm: numericSpecSchema,
    compatibleButtonId: idSchema.nullable(),
    diameterMm: numericSpecSchema,
    finishOptions: z
      .array(finishOptionSchema)
      .min(1, "web.catalog.error.finishOptionRequired"),
    lengthMm: numericSpecSchema,
    makerId: idSchema,
    materialIds: z.array(idSchema).min(1, requiredMessage),
    name: slugNameSchema,
    productId: idSchema.nullable(),
    productTypeSlug: productTypeSchema,
    thicknessMm: numericSpecSchema,
    thicknessWithButtonMm: numericSpecSchema,
    weightG: numericSpecSchema,
    widthMm: numericSpecSchema,
  })
  .superRefine(({ finishOptions }, context) => {
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
  });

const productLookupSchema = z.object({
  productSlug: z.string().regex(slugPattern),
  productTypeSlug: z.string().regex(slugPattern),
});

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

const materialSchema = z.object({
  name: slugNameSchema,
});

const finishSchema = z.object({ name: slugNameSchema });
const colorSchema = z.object({ name: slugNameSchema });

type CatalogLookupMutationResult<K extends string> =
  | ({ ok: true } & Record<K, CatalogLookup>)
  | {
      fieldErrors: Record<string, string[] | undefined>;
      formError: string;
      ok: false;
    };

const collectionAddSchema = z.object({
  buttonProductId: idSchema.nullable(),
  confirmed: z.boolean(),
  productId: idSchema,
  productTypeSlug: productTypeSchema,
});

const collectionEditSchema = z.object({
  collectionItemId: idSchema,
  installedButtonId: idSchema.nullable(),
});

export type ProductFormInput = z.input<typeof productFormSchema>;

export type CatalogOptions = {
  colorEffects: Awaited<ReturnType<typeof listColorEffects>>;
  colors: Awaited<ReturnType<typeof listColors>>;
  finishes: Awaited<ReturnType<typeof listFinishes>>;
  makers: Awaited<ReturnType<typeof listMakers>>;
  materials: Awaited<ReturnType<typeof listMaterials>>;
  productTypes: Awaited<ReturnType<typeof listProductTypes>>;
  spinnerButtons: CatalogProduct[];
};

export const getCatalogOptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogOptions> => {
    const { s } = await import("@/lib/services");
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
      s.db.catalog.listProducts("spinner-button"),
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

export const listCatalogProducts = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({ productTypeSlug: productTypeSchema.optional() })
      .optional()
      .parse(input),
  )
  .handler(async ({ data }): Promise<CatalogProduct[]> => {
    const { s } = await import("@/lib/services");
    if (data?.productTypeSlug) {
      return await s.db.catalog.listProducts(data.productTypeSlug);
    }
    const products = await Promise.all(
      productTypeSchema.options.map((type) => s.db.catalog.listProducts(type)),
    );
    return products.flat().sort((a, b) => a.name.localeCompare(b.name));
  });

export const getCatalogProduct = createServerFn({ method: "GET" })
  .validator((input: unknown) => productLookupSchema.parse(input))
  .handler(async ({ data }): Promise<CatalogProduct | null> => {
    const { s } = await import("@/lib/services");
    return await s.db.catalog.getProduct(
      data.productTypeSlug,
      data.productSlug,
    );
  });

export const createCatalogMaker = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actorClerkId = await requireActor();
    const parsed = makerSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);

    const { s } = await import("@/lib/services");
    try {
      const maker = await s.db.catalog.createMaker({
        actorClerkId,
        name: parsed.data.name,
        rootUrl: normalizeOptionalUrl(parsed.data.rootUrl),
      });
      return { maker, ok: true as const };
    } catch (error) {
      return mutationFailure(error);
    }
  });

export const createCatalogMaterial = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actorClerkId = await requireActor();
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
        actorClerkId,
        name: parsed.data.name,
        slug,
      });
      return { material, ok: true as const };
    } catch (error) {
      return mutationFailure(error);
    }
  });

export const createCatalogFinish = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }): Promise<CatalogLookupMutationResult<"finish">> => {
    const actorClerkId = await requireActor();
    const parsed = finishSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);

    const { s } = await import("@/lib/services");
    const finishes = await s.db.catalog.listFinishes();
    try {
      const finish = await s.db.catalog.createFinish({
        actorClerkId,
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

export const createCatalogColor = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }): Promise<CatalogLookupMutationResult<"color">> => {
    const actorClerkId = await requireActor();
    const parsed = colorSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);

    const { s } = await import("@/lib/services");
    const colors = await s.db.catalog.listColors();
    try {
      const color = await s.db.catalog.createColor({
        actorClerkId,
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
  });

export const saveCatalogProduct = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actorClerkId = await requireActor();
    const parsed = productFormSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);

    const { s } = await import("@/lib/services");
    if (parsed.data.compatibleButtonId) {
      const compatibleButton = (
        await s.db.catalog.listProducts("spinner-button")
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
      actorClerkId,
      finishOptions: parsed.data.finishOptions.map(
        ({ colorEffectId, colorIds, finishIds }) => ({
          colorEffectId,
          colorIds,
          finishIds,
        }),
      ),
      makerId: parsed.data.makerId,
      materialIds: parsed.data.materialIds,
      name: parsed.data.name,
      productTypeSlug: parsed.data.productTypeSlug,
      slug,
      specs: {
        buttonDiameterMm: parsed.data.buttonDiameterMm,
        compatibleButtonId: parsed.data.compatibleButtonId,
        diameterMm: parsed.data.diameterMm,
        lengthMm: parsed.data.lengthMm,
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

export const addCollectionProduct = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actorClerkId = await requireActor();
    const parsed = collectionAddSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);

    const { s } = await import("@/lib/services");
    try {
      const productIds = [
        parsed.data.productId,
        ...(parsed.data.buttonProductId ? [parsed.data.buttonProductId] : []),
      ];
      const duplicateCounts = await s.db.collections.countOwnedProducts({
        actorClerkId,
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
                actorClerkId,
                buttonProductId: parsed.data.buttonProductId,
                spinnerProductId: parsed.data.productId,
              })
            ).spinnerItemId
          : await s.db.collections.addSpinnerButton({
              actorClerkId,
              productId: parsed.data.productId,
            });
      return { collectionItemId, ok: true as const };
    } catch (error) {
      return mutationFailure(error);
    }
  });

export const getPublicCollectionOwners = createServerFn({
  method: "GET",
}).handler(async () => {
  const { s } = await import("@/lib/services");
  return await s.db.collections.listOwners();
});

export const getUserCollection = createServerFn({ method: "GET" }).handler(
  async () => {
    const actorClerkId = await requireActor();
    const { s } = await import("@/lib/services");
    return await s.db.collections.listOwned(actorClerkId);
  },
);

export const getCollectionEditData = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ collectionItemId: idSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const actorClerkId = await requireActor();
    const { s } = await import("@/lib/services");
    const [item, items] = await Promise.all([
      s.db.collections.getOwnedItem(actorClerkId, data.collectionItemId),
      s.db.collections.listOwned(actorClerkId),
    ]);
    return {
      item,
      ownedButtons: items.filter(
        (candidate) => candidate.productTypeSlug === "spinner-button",
      ),
    };
  });

export const updateCollectionSpinner = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actorClerkId = await requireActor();
    const parsed = collectionEditSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);

    const { s } = await import("@/lib/services");
    try {
      await s.db.collections.updateSpinner({ actorClerkId, ...parsed.data });
      return { ok: true as const };
    } catch (error) {
      return mutationFailure(error);
    }
  });

async function listMakers() {
  const { s } = await import("@/lib/services");
  return await s.db.catalog.listMakers();
}

async function listColorEffects(): Promise<CatalogLookup[]> {
  const { s } = await import("@/lib/services");
  return await s.db.catalog.listColorEffects();
}

async function listColors(): Promise<CatalogLookup[]> {
  const { s } = await import("@/lib/services");
  return await s.db.catalog.listColors();
}

async function listFinishes(): Promise<CatalogLookup[]> {
  const { s } = await import("@/lib/services");
  return await s.db.catalog.listFinishes();
}

async function listMaterials() {
  const { s } = await import("@/lib/services");
  return await s.db.catalog.listMaterials();
}

async function listProductTypes() {
  const { s } = await import("@/lib/services");
  return await s.db.catalog.listProductTypes();
}

async function requireActor(): Promise<string> {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) throw localizedServerError("error.generic");
  return userId;
}

function validationFailure(error: z.ZodError) {
  return {
    fieldErrors: z.flattenError(error).fieldErrors,
    formError: "web.catalog.error.form",
    ok: false as const,
    requiresConfirmation: false as const,
  };
}

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

export function productTypeIsSupported(
  value: string,
): value is CatalogProductType {
  return productTypeSchema.safeParse(value).success;
}

export function productSlugPreview(name: string): string {
  return slugify(name);
}
