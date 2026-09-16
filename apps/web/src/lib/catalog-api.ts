import { auth } from "@clerk/tanstack-react-start/server";
import type {
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

export const productFormSchema = z.object({
  buttonDiameterMm: numericSpecSchema,
  compatibleButtonId: idSchema.nullable(),
  diameterMm: numericSpecSchema,
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
  makers: Awaited<ReturnType<typeof listMakers>>;
  materials: Awaited<ReturnType<typeof listMaterials>>;
  productTypes: Awaited<ReturnType<typeof listProductTypes>>;
  spinnerButtons: CatalogProduct[];
};

export const getCatalogOptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogOptions> => {
    const { s } = await import("@/lib/services");
    const [makers, materials, productTypes, spinnerButtons] = await Promise.all(
      [
        listMakers(),
        listMaterials(),
        listProductTypes(),
        s.db.catalog.listProducts("spinner-button"),
      ],
    );
    return { makers, materials, productTypes, spinnerButtons };
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

export const saveCatalogProduct = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actorClerkId = await requireActor();
    const parsed = productFormSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);

    const { s } = await import("@/lib/services");
    const slugs = await s.db.catalog.listSlugs(
      parsed.data.productTypeSlug,
      parsed.data.productId ?? undefined,
    );
    const slug = nextAvailableSlug(parsed.data.name, slugs);
    const input: ProductWriteInput = {
      actorClerkId,
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
