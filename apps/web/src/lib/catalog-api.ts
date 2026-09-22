import { auth } from "@clerk/tanstack-react-start/server";
import type {
  CatalogColor,
  CatalogImage,
  CatalogLookup,
  CatalogProduct,
  CatalogProductType,
  ProductWriteInput,
  UserCollectionSummary,
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
import { getResourceViewer } from "./resources";
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
const colorSchema = z.object({
  hex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "web.catalog.error.form")
    .transform((value) => value.toUpperCase()),
  name: slugNameSchema,
});

const collectionWriteSchema = z.object({
  description: z
    .string()
    .trim()
    .refine(
      (value) => !value || value.split(/\s+/u).length <= 200,
      requiredMessage,
    )
    .transform((value) => value || null),
  isPrivate: z.boolean(),
  name: z.string().trim().min(2, requiredMessage).max(80, requiredMessage),
});

type CatalogLookupMutationResult<
  K extends string,
  T extends CatalogLookup = CatalogLookup,
> =
  | ({ ok: true } & Record<K, T>)
  | {
      fieldErrors: Record<string, string[] | undefined>;
      formError: string;
      ok: false;
    };

const collectionAddSchema = z
  .object({
    buttonCustomFinish: finishOptionSchema.nullable(),
    buttonFinishOptionId: idSchema.nullable(),
    buttonMaterialId: idSchema.nullable(),
    buttonProductId: idSchema.nullable(),
    collectionId: idSchema.nullable().optional().default(null),
    confirmed: z.boolean(),
    customFinish: finishOptionSchema.nullable(),
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
  });

const collectionEditSchema = z
  .object({
    collectionId: idSchema.optional(),
    collectionItemId: idSchema,
    customFinish: finishOptionSchema.nullable(),
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

export const createCatalogMaker = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const parsed = makerSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);

    const { s } = await import("@/lib/services");
    try {
      const maker = await s.db.catalog.createMaker({
        actorClerkId: actor.clerkId,
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
    const actor = await requireActor();
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
        actorClerkId: actor.clerkId,
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
    const actor = await requireActor();
    const parsed = finishSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);

    const { s } = await import("@/lib/services");
    const finishes = await s.db.catalog.listFinishes();
    try {
      const finish = await s.db.catalog.createFinish({
        actorClerkId: actor.clerkId,
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
  .handler(
    async ({
      data,
    }): Promise<CatalogLookupMutationResult<"color", CatalogColor>> => {
      const actor = await requireActor();
      const parsed = colorSchema.safeParse(data);
      if (!parsed.success) return validationFailure(parsed.error);

      const { s } = await import("@/lib/services");
      const colors = await s.db.catalog.listColors();
      try {
        const color = await s.db.catalog.createColor({
          actorClerkId: actor.clerkId,
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
      actorClerkId: actor.clerkId,
      actorIsAdmin: actor.isAdmin,
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
                actorClerkId: actor.clerkId,
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
                newCollection: parsed.data.newCollection,
              })
            ).spinnerItemId
          : await s.db.collections.addSpinnerButton({
              actorClerkId: actor.clerkId,
              customFinish: parsed.data.customFinish
                ? toFinishWriteOption(parsed.data.customFinish)
                : null,
              finishOptionId: parsed.data.finishOptionId,
              materialId: parsed.data.materialId,
              collectionId: parsed.data.collectionId,
              newCollection: parsed.data.newCollection,
              productId: parsed.data.productId,
            });
      const item = await s.db.collections.getOwnedItem(
        actor.clerkId,
        collectionItemId,
        actor.isAdmin,
      );
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

export const getPublicCollectionOwners = createServerFn({
  method: "GET",
}).handler(async () => {
  const { s } = await import("@/lib/services");
  return await signCollectionOwners(
    await s.db.collections.listOwners(await getResourceViewer()),
  );
});

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
    const item = await s.db.collections.getPublicItem({
      collectionId: data.collectionId,
      collectionItemId: data.collectionItemId,
      ownerUserId: data.userId,
      viewer: await getResourceViewer(),
    });
    return item ? await signCollectionItem(item) : null;
  });

export const getUserCollection = createServerFn({ method: "GET" }).handler(
  async () => {
    const actorClerkId = await requireActor();
    const { s } = await import("@/lib/services");
    return await Promise.all(
      (
        await s.db.collections.listOwned(
          actorClerkId.clerkId,
          actorClerkId.isAdmin,
        )
      ).map(signCollectionItem),
    );
  },
);

export const getUserCollections = createServerFn({ method: "GET" }).handler(
  async () => {
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    return await signCollectionSummaries(
      await s.db.collections.listOwnedCollections(actor.clerkId, actor.isAdmin),
    );
  },
);

export const getCollectionAddContext = createServerFn({
  method: "GET",
}).handler(async () => {
  const actor = await requireActor();
  const { s } = await import("@/lib/services");
  const collections = await s.db.collections.listOwnedCollections(
    actor.clerkId,
    actor.isAdmin,
  );
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

export const getUserCollectionById = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ collectionId: idSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    const [collection, items] = await Promise.all([
      s.db.collections.getOwnedCollection(
        actor.clerkId,
        data.collectionId,
        actor.isAdmin,
      ),
      s.db.collections.listOwned(
        actor.clerkId,
        actor.isAdmin,
        data.collectionId,
      ),
    ]);
    if (!collection) return null;
    const [signedCollection] = await signCollectionSummaries([collection]);
    if (!signedCollection) return null;
    return {
      collection: signedCollection,
      items: await Promise.all(items.map(signCollectionItem)),
    };
  });

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
    const items =
      matchingOwner?.items.filter(
        ({ collectionId }) => collectionId === data.collectionId,
      ) ?? [];
    const [signedCollection] = await signCollectionSummaries([collection]);
    if (!signedCollection) return null;
    return {
      collection: signedCollection,
      items: await Promise.all(items.map(signCollectionItem)),
      ownerUsername: matchingOwner?.username,
    };
  });

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
            actorClerkId: actor.clerkId,
            actorIsAdmin: actor.isAdmin,
            collectionId: parsed.data.collectionId,
          })
        : await s.db.collections.createCollection({
            ...parsed.data,
            actorClerkId: actor.clerkId,
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

export const getUserCollectionSummary = createServerFn({
  method: "GET",
})
  .validator((input: unknown) =>
    z.object({ collectionId: idSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    return await s.db.collections.getOwnedCollection(
      actor.clerkId,
      data.collectionId,
      actor.isAdmin,
    );
  });

export const getCollectionEditData = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ collectionItemId: idSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const actorClerkId = await requireActor();
    const { s } = await import("@/lib/services");
    const item = await s.db.collections.getOwnedItem(
      actorClerkId.clerkId,
      data.collectionItemId,
      actorClerkId.isAdmin,
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
      s.db.collections.listOwned(actorClerkId.clerkId, actorClerkId.isAdmin),
      s.db.catalog.listProducts(item.productTypeSlug, actorClerkId),
      item.productTypeSlug === "spinner"
        ? s.db.catalog.listProducts("spinner-button", actorClerkId)
        : Promise.resolve([]),
      s.db.collections.listOwnedCollections(
        actorClerkId.clerkId,
        actorClerkId.isAdmin,
      ),
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

export const updateCollectionItem = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const actorClerkId = await requireActor();
    const parsed = collectionEditSchema.safeParse(data);
    if (!parsed.success) return validationFailure(parsed.error);

    const { s } = await import("@/lib/services");
    try {
      await s.db.collections.updateItem({
        actorClerkId: actorClerkId.clerkId,
        actorIsAdmin: actorClerkId.isAdmin,
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

export const softDeleteCatalogImage = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        imageId: idSchema,
        targetType: z.enum(["product", "collection_item"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    await s.db.catalog.softDeleteImage({
      actorClerkId: actor.clerkId,
      actorIsAdmin: actor.isAdmin,
      ...data,
    });
  });

export const restoreCatalogImage = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        imageId: idSchema,
        targetType: z.enum(["product", "collection_item"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    await s.db.catalog.restoreImage({
      actorClerkId: actor.clerkId,
      actorIsAdmin: actor.isAdmin,
      ...data,
    });
  });

export const listCatalogImageTrash = createServerFn({ method: "GET" }).handler(
  async () => {
    const actor = await requireActor();
    const { s } = await import("@/lib/services");
    return await signCatalogImages(
      await s.db.catalog.listImageTrash({
        actorClerkId: actor.clerkId,
        actorIsAdmin: actor.isAdmin,
      }),
    );
  },
);

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
      actorClerkId: actor.clerkId,
      actorIsAdmin: actor.isAdmin,
      ...data,
    });
  });

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
      actorClerkId: actor.clerkId,
      actorIsAdmin: actor.isAdmin,
      ...data,
    });
  });

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
      actorClerkId: actor.clerkId,
      actorIsAdmin: actor.isAdmin,
      ...data,
    });
  });

function toFinishWriteOption(
  option: z.infer<typeof finishOptionSchema>,
): ProductWriteInput["finishOptions"][number] {
  return {
    colorEffectId: option.colorEffectId,
    colorIds: option.colorIds,
    finishIds: option.finishIds,
  };
}

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

async function requireActor(): Promise<{ clerkId: string; isAdmin: boolean }> {
  const { isAuthenticated, sessionClaims, userId } = await auth();
  if (!isAuthenticated || !userId) throw localizedServerError("error.generic");
  return {
    clerkId: userId,
    isAdmin: (sessionClaims as { role?: unknown } | null)?.role === "admin",
  };
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

async function signCatalogProducts(products: CatalogProduct[]) {
  return await Promise.all(
    products.map(async (product) => ({
      ...product,
      images: await signCatalogImages(product.images),
    })),
  );
}

async function signCollectionItem<
  T extends { images: CatalogImage[]; productImages: CatalogImage[] },
>(item: T): Promise<T> {
  const [images, productImages] = await Promise.all([
    signCatalogImages(item.images),
    signCatalogImages(item.productImages),
  ]);
  return { ...item, images, productImages };
}

async function signCollectionSummaries(
  collections: UserCollectionSummary[],
): Promise<UserCollectionSummary[]> {
  return await Promise.all(
    collections.map(async (collection) => {
      const [coverImage] = collection.coverImage
        ? await signCatalogImages([collection.coverImage])
        : [];
      return {
        ...collection,
        coverImage: coverImage ?? null,
        coverImages: await signCatalogImages(collection.coverImages),
      };
    }),
  );
}

async function signCollectionOwners<
  T extends {
    collections: UserCollectionSummary[];
    items: Array<{ images: CatalogImage[]; productImages: CatalogImage[] }>;
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

async function signCatalogImages<T extends CatalogImage>(
  images: T[],
): Promise<T[]> {
  const [{ signResourceUrl }, { serverEnv }] = await Promise.all([
    import("@package/resources"),
    import("@/env/server"),
  ]);
  if (!serverEnv.BUNNY_CDN_BASE_URL || !serverEnv.BUNNY_CDN_TOKEN_KEY)
    return images;
  return await Promise.all(
    images.map(async (image) => ({
      ...image,
      url: await signResourceUrl({
        cdnBaseUrl: serverEnv.BUNNY_CDN_BASE_URL,
        objectPath: image.objectPath,
        tokenKey: serverEnv.BUNNY_CDN_TOKEN_KEY,
      }),
    })),
  );
}

export function productTypeIsSupported(
  value: string,
): value is CatalogProductType {
  return productTypeSchema.safeParse(value).success;
}

export function productSlugPreview(name: string): string {
  return slugify(name);
}
