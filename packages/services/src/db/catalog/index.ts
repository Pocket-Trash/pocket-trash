import type { Database } from "@package/database";
import { schema } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import { and, asc, count, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { hashLogIdentifier } from "../../logging.js";
import type { UsersService } from "../users/index.js";

export type CatalogProductType = "spinner" | "spinner-button";

export type CatalogLookup = { id: number; name: string; slug: string };

export type CatalogFinishOption = {
  colorEffect: CatalogLookup | null;
  colors: CatalogLookup[];
  finishes: CatalogLookup[];
  id: number;
};

export type ProductWriteFinishOption = {
  colorEffectId: number | null;
  colorIds: number[];
  finishIds: number[];
};

export type CatalogProduct = {
  buttonDiameterMm: string | null;
  compatibleButtonId: number | null;
  compatibleButtonName: string | null;
  createdAt: Date;
  diameterMm: string | null;
  finishOptions: CatalogFinishOption[];
  id: number;
  lengthMm: string | null;
  makerId: number;
  makerName: string;
  materials: Array<{ id: number; name: string; slug: string }>;
  name: string;
  productTypeId: number;
  productTypeName: string;
  productTypeSlug: string;
  slug: string;
  thicknessMm: string | null;
  thicknessWithButtonMm: string | null;
  updatedAt: Date;
  weightG: string | null;
  widthMm: string | null;
};

export type ProductWriteInput = {
  actorClerkId: string;
  makerId: number;
  finishOptions: ProductWriteFinishOption[];
  materialIds: number[];
  name: string;
  productTypeSlug: CatalogProductType;
  slug: string;
  specs: {
    buttonDiameterMm?: string | null;
    compatibleButtonId?: number | null;
    diameterMm?: string | null;
    lengthMm?: string | null;
    thicknessMm?: string | null;
    thicknessWithButtonMm?: string | null;
    weightG?: string | null;
    widthMm?: string | null;
  };
};

export type CatalogService = {
  createColor(input: {
    actorClerkId: string;
    name: string;
    slug: string;
  }): Promise<CatalogLookup>;
  createFinish(input: {
    actorClerkId: string;
    name: string;
    slug: string;
  }): Promise<CatalogLookup>;
  createMaker(input: {
    actorClerkId: string;
    name: string;
    rootUrl: string | null;
  }): Promise<{ id: number; name: string; rootUrl: string | null }>;
  createMaterial(input: {
    actorClerkId: string;
    name: string;
    slug: string;
  }): Promise<{ id: number; name: string; slug: string }>;
  createProduct(input: ProductWriteInput): Promise<CatalogProduct>;
  getProduct(
    productTypeSlug: string,
    productSlug: string,
  ): Promise<CatalogProduct | null>;
  listColorEffects(): Promise<CatalogLookup[]>;
  listColors(): Promise<CatalogLookup[]>;
  listFinishes(): Promise<CatalogLookup[]>;
  listMakers(): Promise<
    Array<{ id: number; name: string; rootUrl: string | null }>
  >;
  listMaterials(): Promise<Array<{ id: number; name: string; slug: string }>>;
  listProducts(productTypeSlug?: string): Promise<CatalogProduct[]>;
  listProductTypes(): Promise<
    Array<{ id: number; name: string; slug: string }>
  >;
  listSlugs(
    productTypeSlug: string,
    exceptProductId?: number,
  ): Promise<string[]>;
  updateProduct(
    input: ProductWriteInput & { productId: number },
  ): Promise<CatalogProduct>;
};

export type UserCollectionItem = {
  collectionItemId: number;
  finishOption: CatalogFinishOption | null;
  installedButtonId: number | null;
  material: CatalogLookup | null;
  name: string;
  productId: number;
  productTypeSlug: CatalogProductType;
  sourceProductFinishOptionId: number | null;
};

export type CollectionsService = {
  addSpinner(input: {
    actorClerkId: string;
    buttonFinishOptionId: number | null;
    buttonMaterialId: number | null;
    buttonProductId: number | null;
    spinnerFinishOptionId: number;
    spinnerMaterialId: number;
    spinnerProductId: number;
  }): Promise<{ buttonItemId: number | null; spinnerItemId: number }>;
  addSpinnerButton(input: {
    actorClerkId: string;
    finishOptionId: number;
    materialId: number;
    productId: number;
  }): Promise<number>;
  countOwnedProducts(input: {
    actorClerkId: string;
    productIds: number[];
  }): Promise<Record<number, number>>;
  getOwnedItem(
    actorClerkId: string,
    collectionItemId: number,
  ): Promise<UserCollectionItem | null>;
  listOwned(actorClerkId: string): Promise<UserCollectionItem[]>;
  listOwners(): Promise<
    Array<{ clerkId: string; itemCount: number; userId: number }>
  >;
  updateItem(input: {
    actorClerkId: string;
    collectionItemId: number;
    finishOptionId: number | null;
    installedButton?: {
      collectionItemId: number;
      finishOptionId: number | null;
      materialId: number;
    } | null;
    materialId: number;
  }): Promise<void>;
};

export function createCatalogService(
  db: Database,
  logger: Logger,
): CatalogService {
  return {
    async createColor(input) {
      return await logger.operation(
        loggerMessages.database.catalog.createColor,
        async () => {
          const [duplicate] = await db
            .select({ id: schema.color.id })
            .from(schema.color)
            .where(
              eq(sql`lower(${schema.color.name})`, input.name.toLowerCase()),
            )
            .limit(1);
          if (duplicate) throw new Error("Color name already exists.");

          const [row] = await db
            .insert(schema.color)
            .values({ name: input.name, slug: input.slug })
            .returning({
              id: schema.color.id,
              name: schema.color.name,
              slug: schema.color.slug,
            });
          if (!row) throw new Error("Failed to create color.");
          return row;
        },
        actorAttributes(input.actorClerkId, { slug: input.slug }),
      );
    },
    async createFinish(input) {
      return await logger.operation(
        loggerMessages.database.catalog.createFinish,
        async () => {
          const [duplicate] = await db
            .select({ id: schema.finish.id })
            .from(schema.finish)
            .where(
              eq(sql`lower(${schema.finish.name})`, input.name.toLowerCase()),
            )
            .limit(1);
          if (duplicate) throw new Error("Finish name already exists.");

          const [row] = await db
            .insert(schema.finish)
            .values({ name: input.name, slug: input.slug })
            .returning({
              id: schema.finish.id,
              name: schema.finish.name,
              slug: schema.finish.slug,
            });
          if (!row) throw new Error("Failed to create finish.");
          return row;
        },
        actorAttributes(input.actorClerkId, { slug: input.slug }),
      );
    },
    async createMaker(input) {
      return await logger.operation(
        loggerMessages.database.catalog.createMaker,
        async () => {
          const [duplicate] = await db
            .select({ id: schema.maker.id })
            .from(schema.maker)
            .where(
              eq(sql`lower(${schema.maker.name})`, input.name.toLowerCase()),
            )
            .limit(1);
          if (duplicate) throw new Error("Maker name already exists.");

          const [row] = await db
            .insert(schema.maker)
            .values({ name: input.name, rootUrl: input.rootUrl })
            .returning({
              id: schema.maker.id,
              name: schema.maker.name,
              rootUrl: schema.maker.rootUrl,
            });
          if (!row) throw new Error("Failed to create maker.");
          return row;
        },
        actorAttributes(input.actorClerkId),
      );
    },
    async createMaterial(input) {
      return await logger.operation(
        loggerMessages.database.catalog.createMaterial,
        async () => {
          const [duplicate] = await db
            .select({ id: schema.material.id })
            .from(schema.material)
            .where(
              eq(sql`lower(${schema.material.name})`, input.name.toLowerCase()),
            )
            .limit(1);
          if (duplicate) throw new Error("Material name already exists.");

          const [row] = await db
            .insert(schema.material)
            .values({ name: input.name, slug: input.slug })
            .returning({
              id: schema.material.id,
              name: schema.material.name,
              slug: schema.material.slug,
            });
          if (!row) throw new Error("Failed to create material.");
          return row;
        },
        actorAttributes(input.actorClerkId, { slug: input.slug }),
      );
    },
    async createProduct(input) {
      return await logger.operation(
        loggerMessages.database.catalog.createProduct,
        async () => {
          const [type] = await db
            .select({ id: schema.productType.id })
            .from(schema.productType)
            .where(eq(schema.productType.slug, input.productTypeSlug))
            .limit(1);
          if (!type) throw new Error("Product type does not exist.");
          await validateFinishOptions(db, input.finishOptions);

          const productId = await db.transaction(async (tx) => {
            const [row] = await tx
              .insert(schema.product)
              .values({
                makerId: input.makerId,
                name: input.name,
                productTypeId: type.id,
                slug: input.slug,
              })
              .returning({ id: schema.product.id });
            if (!row) throw new Error("Failed to create product.");

            if (input.materialIds.length) {
              await tx.insert(schema.productMaterial).values(
                input.materialIds.map((materialId) => ({
                  materialId,
                  productId: row.id,
                })),
              );
            }

            await replaceProductFinishOptions(tx, row.id, input.finishOptions);

            if (input.productTypeSlug === "spinner") {
              await tx.insert(schema.productSpinner).values({
                id: row.id,
                ...spinnerSpecs(input.specs),
              });
            } else {
              await tx.insert(schema.productSpinnerButton).values({
                id: row.id,
                ...buttonSpecs(input.specs),
              });
            }
            return row.id;
          });

          const created = await this.getProduct(
            input.productTypeSlug,
            input.slug,
          );
          if (!created || created.id !== productId) {
            throw new Error("Failed to load created product.");
          }
          return created;
        },
        productAttributes(input),
      );
    },
    async getProduct(productTypeSlug, productSlug) {
      const products = await queryProducts(db, productTypeSlug, productSlug);
      return products[0] ?? null;
    },
    async listMakers() {
      return await db
        .select({
          id: schema.maker.id,
          name: schema.maker.name,
          rootUrl: schema.maker.rootUrl,
        })
        .from(schema.maker)
        .orderBy(asc(schema.maker.name));
    },
    async listColorEffects() {
      return await db
        .select({
          id: schema.colorEffect.id,
          name: schema.colorEffect.name,
          slug: schema.colorEffect.slug,
        })
        .from(schema.colorEffect)
        .orderBy(asc(schema.colorEffect.name));
    },
    async listColors() {
      return await db
        .select({
          id: schema.color.id,
          name: schema.color.name,
          slug: schema.color.slug,
        })
        .from(schema.color)
        .orderBy(asc(schema.color.name));
    },
    async listFinishes() {
      return await db
        .select({
          id: schema.finish.id,
          name: schema.finish.name,
          slug: schema.finish.slug,
        })
        .from(schema.finish)
        .orderBy(asc(schema.finish.name));
    },
    async listMaterials() {
      return await db
        .select({
          id: schema.material.id,
          name: schema.material.name,
          slug: schema.material.slug,
        })
        .from(schema.material)
        .orderBy(asc(schema.material.name));
    },
    async listProducts(productTypeSlug) {
      return await queryProducts(db, productTypeSlug);
    },
    async listProductTypes() {
      return await db
        .select({
          id: schema.productType.id,
          name: schema.productType.name,
          slug: schema.productType.slug,
        })
        .from(schema.productType)
        .orderBy(asc(schema.productType.name));
    },
    async listSlugs(productTypeSlug, exceptProductId) {
      const conditions = [eq(schema.productType.slug, productTypeSlug)];
      if (exceptProductId !== undefined) {
        conditions.push(sql`${schema.product.id} <> ${exceptProductId}`);
      }
      const rows = await db
        .select({ slug: schema.product.slug })
        .from(schema.product)
        .innerJoin(
          schema.productType,
          eq(schema.product.productTypeId, schema.productType.id),
        )
        .where(and(...conditions));
      return rows.map(({ slug }) => slug);
    },
    async updateProduct(input) {
      return await logger.operation(
        loggerMessages.database.catalog.updateProduct,
        async () => {
          await validateFinishOptions(db, input.finishOptions);
          await db.transaction(async (tx) => {
            const [existing] = await tx
              .select({ id: schema.product.id })
              .from(schema.product)
              .innerJoin(
                schema.productType,
                eq(schema.product.productTypeId, schema.productType.id),
              )
              .where(
                and(
                  eq(schema.product.id, input.productId),
                  eq(schema.productType.slug, input.productTypeSlug),
                ),
              )
              .limit(1);
            if (!existing) throw new Error("Product does not exist.");

            await tx
              .update(schema.product)
              .set({
                makerId: input.makerId,
                name: input.name,
                slug: input.slug,
              })
              .where(eq(schema.product.id, input.productId));
            await tx
              .delete(schema.productMaterial)
              .where(eq(schema.productMaterial.productId, input.productId));
            await tx.insert(schema.productMaterial).values(
              input.materialIds.map((materialId) => ({
                materialId,
                productId: input.productId,
              })),
            );
            await replaceProductFinishOptions(
              tx,
              input.productId,
              input.finishOptions,
            );

            if (input.productTypeSlug === "spinner") {
              await tx
                .update(schema.productSpinner)
                .set({ ...spinnerSpecs(input.specs), updatedAt: new Date() })
                .where(eq(schema.productSpinner.id, input.productId));
            } else {
              await tx
                .update(schema.productSpinnerButton)
                .set({ ...buttonSpecs(input.specs), updatedAt: new Date() })
                .where(eq(schema.productSpinnerButton.id, input.productId));
            }
          });

          const updated = await this.getProduct(
            input.productTypeSlug,
            input.slug,
          );
          if (!updated) throw new Error("Failed to load updated product.");
          return updated;
        },
        productAttributes(input),
      );
    },
  };
}

export function createCollectionsService(
  db: Database,
  users: UsersService,
  logger: Logger,
): CollectionsService {
  return {
    async addSpinner(input) {
      return await logger.operation(
        loggerMessages.database.collections.addSpinner,
        async () => {
          const owner = await users.ensure({ clerkId: input.actorClerkId });
          return await db.transaction(async (tx) => {
            let buttonItemId: number | null = null;
            if (
              input.buttonProductId === null &&
              (input.buttonMaterialId !== null ||
                input.buttonFinishOptionId !== null)
            ) {
              throw new Error("Button product is required.");
            }
            if (input.buttonProductId !== null) {
              if (
                input.buttonMaterialId === null ||
                input.buttonFinishOptionId === null
              ) {
                throw new Error("Button material and finish are required.");
              }
              await assertProductMaterial(
                tx,
                input.buttonProductId,
                input.buttonMaterialId,
              );
              const [buttonItem] = await tx
                .insert(schema.collectionItem)
                .values({
                  materialId: input.buttonMaterialId,
                  ownerId: owner.id,
                })
                .returning({ id: schema.collectionItem.id });
              if (!buttonItem) throw new Error("Failed to create button item.");
              await tx.insert(schema.collectionSpinnerButton).values({
                id: buttonItem.id,
                productSpinnerButtonId: input.buttonProductId,
              });
              await copyProductFinishOption(
                tx,
                input.buttonProductId,
                input.buttonFinishOptionId,
                buttonItem.id,
              );
              buttonItemId = buttonItem.id;
            }

            await assertProductMaterial(
              tx,
              input.spinnerProductId,
              input.spinnerMaterialId,
            );
            const [spinnerItem] = await tx
              .insert(schema.collectionItem)
              .values({
                materialId: input.spinnerMaterialId,
                ownerId: owner.id,
              })
              .returning({ id: schema.collectionItem.id });
            if (!spinnerItem) throw new Error("Failed to create spinner item.");
            await tx.insert(schema.collectionSpinner).values({
              id: spinnerItem.id,
              installedButtonId: buttonItemId,
              productSpinnerId: input.spinnerProductId,
            });
            await copyProductFinishOption(
              tx,
              input.spinnerProductId,
              input.spinnerFinishOptionId,
              spinnerItem.id,
            );
            return { buttonItemId, spinnerItemId: spinnerItem.id };
          });
        },
        actorAttributes(input.actorClerkId, {
          buttonProductId: input.buttonProductId,
          spinnerProductId: input.spinnerProductId,
        }),
      );
    },
    async addSpinnerButton(input) {
      return await logger.operation(
        loggerMessages.database.collections.addSpinnerButton,
        async () => {
          const owner = await users.ensure({ clerkId: input.actorClerkId });
          return await db.transaction(async (tx) => {
            await assertProductMaterial(tx, input.productId, input.materialId);
            const [item] = await tx
              .insert(schema.collectionItem)
              .values({ materialId: input.materialId, ownerId: owner.id })
              .returning({ id: schema.collectionItem.id });
            if (!item) throw new Error("Failed to create collection item.");
            await tx.insert(schema.collectionSpinnerButton).values({
              id: item.id,
              productSpinnerButtonId: input.productId,
            });
            await copyProductFinishOption(
              tx,
              input.productId,
              input.finishOptionId,
              item.id,
            );
            return item.id;
          });
        },
        actorAttributes(input.actorClerkId, { productId: input.productId }),
      );
    },
    async countOwnedProducts({ actorClerkId, productIds }) {
      if (!productIds.length) return {};
      const owner = await users.getByClerkId(actorClerkId);
      if (!owner) return {};
      const rows = await db
        .select({
          count: count(schema.collectionItem.id),
          spinnerId: schema.collectionSpinner.productSpinnerId,
          buttonId: schema.collectionSpinnerButton.productSpinnerButtonId,
        })
        .from(schema.collectionItem)
        .leftJoin(
          schema.collectionSpinner,
          eq(schema.collectionItem.id, schema.collectionSpinner.id),
        )
        .leftJoin(
          schema.collectionSpinnerButton,
          eq(schema.collectionItem.id, schema.collectionSpinnerButton.id),
        )
        .where(
          and(
            eq(schema.collectionItem.ownerId, owner.id),
            eq(schema.collectionItem.owned, true),
          ),
        )
        .groupBy(
          schema.collectionSpinner.productSpinnerId,
          schema.collectionSpinnerButton.productSpinnerButtonId,
        );
      const result: Record<number, number> = {};
      for (const row of rows) {
        const productId = row.spinnerId ?? row.buttonId;
        if (productId !== null && productIds.includes(productId)) {
          result[productId] = Number(row.count);
        }
      }
      return result;
    },
    async getOwnedItem(actorClerkId, collectionItemId) {
      return (
        (await queryOwnedItems(db, actorClerkId, collectionItemId))[0] ?? null
      );
    },
    async listOwned(actorClerkId) {
      return await queryOwnedItems(db, actorClerkId);
    },
    async listOwners() {
      return await db
        .select({
          clerkId: schema.user.clerkId,
          itemCount: count(schema.collectionItem.id),
          userId: schema.user.id,
        })
        .from(schema.user)
        .innerJoin(
          schema.collectionItem,
          eq(schema.user.id, schema.collectionItem.ownerId),
        )
        .leftJoin(
          schema.collectionSpinner,
          eq(schema.collectionItem.id, schema.collectionSpinner.id),
        )
        .leftJoin(
          schema.collectionSpinnerButton,
          eq(schema.collectionItem.id, schema.collectionSpinnerButton.id),
        )
        .where(
          and(
            eq(schema.collectionItem.owned, true),
            or(
              isNotNull(schema.collectionSpinner.id),
              isNotNull(schema.collectionSpinnerButton.id),
            ),
          ),
        )
        .groupBy(schema.user.id)
        .orderBy(asc(schema.user.clerkId));
    },
    async updateItem(input) {
      await logger.operation(
        loggerMessages.database.collections.updateItem,
        async () => {
          const owner = await users.getByClerkId(input.actorClerkId);
          if (!owner) throw new Error("Collection item does not exist.");
          await db.transaction(async (tx) => {
            const [item] = await tx
              .select({
                buttonProductId:
                  schema.collectionSpinnerButton.productSpinnerButtonId,
                spinnerProductId: schema.collectionSpinner.productSpinnerId,
              })
              .from(schema.collectionItem)
              .leftJoin(
                schema.collectionSpinner,
                eq(schema.collectionItem.id, schema.collectionSpinner.id),
              )
              .leftJoin(
                schema.collectionSpinnerButton,
                eq(schema.collectionItem.id, schema.collectionSpinnerButton.id),
              )
              .where(
                and(
                  eq(schema.collectionItem.id, input.collectionItemId),
                  eq(schema.collectionItem.ownerId, owner.id),
                  eq(schema.collectionItem.owned, true),
                ),
              )
              .limit(1);
            const productId =
              item?.spinnerProductId ?? item?.buttonProductId ?? null;
            if (!item || productId === null) {
              throw new Error("Collection item does not exist.");
            }

            await updateCollectionItemSnapshot(tx, {
              collectionItemId: input.collectionItemId,
              finishOptionId: input.finishOptionId,
              materialId: input.materialId,
              productId,
            });

            if (input.installedButton !== undefined) {
              if (item.spinnerProductId === null) {
                throw new Error("Collection item is not a spinner.");
              }
              if (input.installedButton !== null) {
                const [button] = await tx
                  .select({
                    id: schema.collectionSpinnerButton.id,
                    productId:
                      schema.collectionSpinnerButton.productSpinnerButtonId,
                  })
                  .from(schema.collectionSpinnerButton)
                  .innerJoin(
                    schema.collectionItem,
                    eq(
                      schema.collectionSpinnerButton.id,
                      schema.collectionItem.id,
                    ),
                  )
                  .where(
                    and(
                      eq(
                        schema.collectionSpinnerButton.id,
                        input.installedButton.collectionItemId,
                      ),
                      eq(schema.collectionItem.ownerId, owner.id),
                      eq(schema.collectionItem.owned, true),
                    ),
                  )
                  .limit(1);
                if (!button) {
                  throw new Error("Installed button does not exist.");
                }
                await updateCollectionItemSnapshot(tx, {
                  ...input.installedButton,
                  productId: button.productId,
                });
              }
              await tx
                .update(schema.collectionSpinner)
                .set({
                  installedButtonId:
                    input.installedButton?.collectionItemId ?? null,
                })
                .where(eq(schema.collectionSpinner.id, input.collectionItemId));
            }
          });
        },
        actorAttributes(input.actorClerkId, {
          collectionItemId: input.collectionItemId,
          installedButtonId: input.installedButton?.collectionItemId,
          materialId: input.materialId,
        }),
      );
    },
  };
}

async function updateCollectionItemSnapshot(
  tx: CatalogTransaction,
  input: {
    collectionItemId: number;
    finishOptionId: number | null;
    materialId: number;
    productId: number;
  },
) {
  await assertProductMaterial(tx, input.productId, input.materialId);
  await tx
    .update(schema.collectionItem)
    .set({ materialId: input.materialId })
    .where(eq(schema.collectionItem.id, input.collectionItemId));

  if (input.finishOptionId !== null) {
    await tx
      .delete(schema.finishOption)
      .where(eq(schema.finishOption.collectionItemId, input.collectionItemId));
    await copyProductFinishOption(
      tx,
      input.productId,
      input.finishOptionId,
      input.collectionItemId,
    );
    return;
  }

  const [finish] = await tx
    .select({ id: schema.finishOption.id })
    .from(schema.finishOption)
    .where(eq(schema.finishOption.collectionItemId, input.collectionItemId))
    .limit(1);
  if (!finish) throw new Error("A finish is required.");
}

async function queryProducts(
  db: Database,
  productTypeSlug?: string,
  productSlug?: string,
): Promise<CatalogProduct[]> {
  const compatibleButtonProduct = alias(
    schema.product,
    "compatible_button_product",
  );
  const conditions = [];
  if (productTypeSlug) {
    conditions.push(eq(schema.productType.slug, productTypeSlug));
  }
  if (productSlug) conditions.push(eq(schema.product.slug, productSlug));

  const rows = await db
    .select({
      buttonDiameterMm: schema.productSpinner.buttonDiameterMm,
      compatibleButtonId: schema.productSpinner.compatibleButtonId,
      compatibleButtonName: compatibleButtonProduct.name,
      createdAt: sql<Date>`coalesce(${schema.productSpinner.createdAt}, ${schema.productSpinnerButton.createdAt})`,
      diameterMm: schema.productSpinnerButton.diameterMm,
      id: schema.product.id,
      lengthMm: schema.productSpinner.lengthMm,
      makerId: schema.maker.id,
      makerName: schema.maker.name,
      materialId: schema.material.id,
      materialName: schema.material.name,
      materialSlug: schema.material.slug,
      name: schema.product.name,
      productTypeId: schema.productType.id,
      productTypeName: schema.productType.name,
      productTypeSlug: schema.productType.slug,
      slug: schema.product.slug,
      thicknessMm: sql<
        string | null
      >`coalesce(${schema.productSpinner.thicknessMm}, ${schema.productSpinnerButton.thicknessMm})`,
      thicknessWithButtonMm: schema.productSpinner.thicknessWithButtonMm,
      updatedAt: sql<Date>`coalesce(${schema.productSpinner.updatedAt}, ${schema.productSpinnerButton.updatedAt})`,
      weightG: sql<
        string | null
      >`coalesce(${schema.productSpinner.weightG}, ${schema.productSpinnerButton.weightG})`,
      widthMm: schema.productSpinner.widthMm,
    })
    .from(schema.product)
    .innerJoin(schema.maker, eq(schema.product.makerId, schema.maker.id))
    .innerJoin(
      schema.productType,
      eq(schema.product.productTypeId, schema.productType.id),
    )
    .leftJoin(
      schema.productMaterial,
      eq(schema.product.id, schema.productMaterial.productId),
    )
    .leftJoin(
      schema.material,
      eq(schema.productMaterial.materialId, schema.material.id),
    )
    .leftJoin(
      schema.productSpinner,
      eq(schema.product.id, schema.productSpinner.id),
    )
    .leftJoin(
      schema.productSpinnerButton,
      eq(schema.product.id, schema.productSpinnerButton.id),
    )
    .leftJoin(
      compatibleButtonProduct,
      eq(schema.productSpinner.compatibleButtonId, compatibleButtonProduct.id),
    )
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(schema.product.name), asc(schema.material.name));

  const products = new Map<number, CatalogProduct>();
  for (const row of rows) {
    const existing = products.get(row.id);
    if (existing) {
      if (row.materialId && row.materialName && row.materialSlug) {
        existing.materials.push({
          id: row.materialId,
          name: row.materialName,
          slug: row.materialSlug,
        });
      }
      continue;
    }
    products.set(row.id, {
      buttonDiameterMm: row.buttonDiameterMm,
      compatibleButtonId: row.compatibleButtonId,
      compatibleButtonName: row.compatibleButtonName,
      createdAt: row.createdAt,
      diameterMm: row.diameterMm,
      finishOptions: [],
      id: row.id,
      lengthMm: row.lengthMm,
      makerId: row.makerId,
      makerName: row.makerName,
      materials:
        row.materialId && row.materialName && row.materialSlug
          ? [
              {
                id: row.materialId,
                name: row.materialName,
                slug: row.materialSlug,
              },
            ]
          : [],
      name: row.name,
      productTypeId: row.productTypeId,
      productTypeName: row.productTypeName,
      productTypeSlug: row.productTypeSlug,
      slug: row.slug,
      thicknessMm: row.thicknessMm,
      thicknessWithButtonMm: row.thicknessWithButtonMm,
      updatedAt: row.updatedAt,
      weightG: row.weightG,
      widthMm: row.widthMm,
    });
  }
  const result = [...products.values()];
  await loadFinishOptions(db, result);
  return result;
}

async function loadFinishOptions(db: Database, products: CatalogProduct[]) {
  if (!products.length) return;

  const options = await db
    .select({
      colorEffectId: schema.colorEffect.id,
      colorEffectName: schema.colorEffect.name,
      colorEffectSlug: schema.colorEffect.slug,
      id: schema.finishOption.id,
      productId: schema.finishOption.productId,
    })
    .from(schema.finishOption)
    .leftJoin(
      schema.colorEffect,
      eq(schema.finishOption.colorEffectId, schema.colorEffect.id),
    )
    .where(
      inArray(
        schema.finishOption.productId,
        products.map(({ id }) => id),
      ),
    )
    .orderBy(asc(schema.finishOption.position));

  if (!options.length) return;
  const loadedOptions = await loadFinishOptionComponents(db, options);
  const productsById = new Map(
    products.map((product) => [product.id, product]),
  );

  for (const option of options) {
    const product = option.productId
      ? productsById.get(option.productId)
      : undefined;
    const loaded = loadedOptions.get(option.id);
    if (product && loaded) product.finishOptions.push(loaded);
  }
}

async function loadFinishOptionComponents(
  db: Database,
  options: Array<{
    colorEffectId: number | null;
    colorEffectName: string | null;
    colorEffectSlug: string | null;
    id: number;
  }>,
): Promise<Map<number, CatalogFinishOption>> {
  if (!options.length) return new Map();
  const optionIds = options.map(({ id }) => id);
  const [finishes, colors] = await Promise.all([
    db
      .select({
        finishOptionId: schema.finishOptionFinish.finishOptionId,
        id: schema.finish.id,
        name: schema.finish.name,
        slug: schema.finish.slug,
      })
      .from(schema.finishOptionFinish)
      .innerJoin(
        schema.finish,
        eq(schema.finishOptionFinish.finishId, schema.finish.id),
      )
      .where(inArray(schema.finishOptionFinish.finishOptionId, optionIds))
      .orderBy(asc(schema.finishOptionFinish.position)),
    db
      .select({
        finishOptionId: schema.finishOptionColor.finishOptionId,
        id: schema.color.id,
        name: schema.color.name,
        slug: schema.color.slug,
      })
      .from(schema.finishOptionColor)
      .innerJoin(
        schema.color,
        eq(schema.finishOptionColor.colorId, schema.color.id),
      )
      .where(inArray(schema.finishOptionColor.finishOptionId, optionIds))
      .orderBy(asc(schema.finishOptionColor.position)),
  ]);
  const result = new Map<number, CatalogFinishOption>();

  for (const option of options) {
    result.set(option.id, {
      colorEffect:
        option.colorEffectId && option.colorEffectName && option.colorEffectSlug
          ? {
              id: option.colorEffectId,
              name: option.colorEffectName,
              slug: option.colorEffectSlug,
            }
          : null,
      colors: colors
        .filter(({ finishOptionId }) => finishOptionId === option.id)
        .map(({ id, name, slug }) => ({ id, name, slug })),
      finishes: finishes
        .filter(({ finishOptionId }) => finishOptionId === option.id)
        .map(({ id, name, slug }) => ({ id, name, slug })),
      id: option.id,
    });
  }
  return result;
}

async function queryOwnedItems(
  db: Database,
  actorClerkId: string,
  collectionItemId?: number,
): Promise<UserCollectionItem[]> {
  const conditions = [
    eq(schema.user.clerkId, actorClerkId),
    eq(schema.collectionItem.owned, true),
  ];
  if (collectionItemId !== undefined) {
    conditions.push(eq(schema.collectionItem.id, collectionItemId));
  }
  const rows = await db
    .select({
      collectionItemId: schema.collectionItem.id,
      colorEffectId: schema.colorEffect.id,
      colorEffectName: schema.colorEffect.name,
      colorEffectSlug: schema.colorEffect.slug,
      finishOptionId: schema.finishOption.id,
      installedButtonId: schema.collectionSpinner.installedButtonId,
      materialId: schema.material.id,
      materialName: schema.material.name,
      materialSlug: schema.material.slug,
      name: schema.product.name,
      productId: schema.product.id,
      sourceProductFinishOptionId:
        schema.finishOption.sourceProductFinishOptionId,
      spinnerId: schema.collectionSpinner.id,
      buttonId: schema.collectionSpinnerButton.id,
    })
    .from(schema.collectionItem)
    .innerJoin(schema.user, eq(schema.collectionItem.ownerId, schema.user.id))
    .leftJoin(
      schema.material,
      eq(schema.collectionItem.materialId, schema.material.id),
    )
    .leftJoin(
      schema.finishOption,
      eq(schema.collectionItem.id, schema.finishOption.collectionItemId),
    )
    .leftJoin(
      schema.colorEffect,
      eq(schema.finishOption.colorEffectId, schema.colorEffect.id),
    )
    .leftJoin(
      schema.collectionSpinner,
      eq(schema.collectionItem.id, schema.collectionSpinner.id),
    )
    .leftJoin(
      schema.collectionSpinnerButton,
      eq(schema.collectionItem.id, schema.collectionSpinnerButton.id),
    )
    .innerJoin(
      schema.product,
      eq(
        schema.product.id,
        sql`coalesce(${schema.collectionSpinner.productSpinnerId}, ${schema.collectionSpinnerButton.productSpinnerButtonId})`,
      ),
    )
    .where(and(...conditions))
    .orderBy(asc(schema.product.name));
  const finishOptions = await loadFinishOptionComponents(
    db,
    rows.flatMap((row) =>
      row.finishOptionId
        ? [
            {
              colorEffectId: row.colorEffectId,
              colorEffectName: row.colorEffectName,
              colorEffectSlug: row.colorEffectSlug,
              id: row.finishOptionId,
            },
          ]
        : [],
    ),
  );
  return rows.map((row) => ({
    collectionItemId: row.collectionItemId,
    finishOption: row.finishOptionId
      ? (finishOptions.get(row.finishOptionId) ?? null)
      : null,
    installedButtonId: row.installedButtonId,
    material:
      row.materialId && row.materialName && row.materialSlug
        ? {
            id: row.materialId,
            name: row.materialName,
            slug: row.materialSlug,
          }
        : null,
    name: row.name,
    productId: row.productId,
    productTypeSlug: row.spinnerId ? "spinner" : "spinner-button",
    sourceProductFinishOptionId: row.sourceProductFinishOptionId,
  }));
}

type CatalogTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function assertProductMaterial(
  tx: CatalogTransaction,
  productId: number,
  materialId: number,
) {
  const [row] = await tx
    .select({ materialId: schema.productMaterial.materialId })
    .from(schema.productMaterial)
    .where(
      and(
        eq(schema.productMaterial.productId, productId),
        eq(schema.productMaterial.materialId, materialId),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Material is not available for this product.");
}

async function copyProductFinishOption(
  tx: CatalogTransaction,
  productId: number,
  sourceFinishOptionId: number,
  collectionItemId: number,
) {
  const [source] = await tx
    .select({ colorEffectId: schema.finishOption.colorEffectId })
    .from(schema.finishOption)
    .where(
      and(
        eq(schema.finishOption.id, sourceFinishOptionId),
        eq(schema.finishOption.productId, productId),
      ),
    )
    .limit(1);
  if (!source)
    throw new Error("Finish option is not available for this product.");

  const finishes = await tx
    .select({
      finishId: schema.finishOptionFinish.finishId,
      position: schema.finishOptionFinish.position,
    })
    .from(schema.finishOptionFinish)
    .where(eq(schema.finishOptionFinish.finishOptionId, sourceFinishOptionId))
    .orderBy(asc(schema.finishOptionFinish.position));
  const colors = await tx
    .select({
      colorId: schema.finishOptionColor.colorId,
      position: schema.finishOptionColor.position,
    })
    .from(schema.finishOptionColor)
    .where(eq(schema.finishOptionColor.finishOptionId, sourceFinishOptionId))
    .orderBy(asc(schema.finishOptionColor.position));
  if (!finishes.length) throw new Error("Finish option has no finishes.");

  const [snapshot] = await tx
    .insert(schema.finishOption)
    .values({
      collectionItemId,
      colorEffectId: source.colorEffectId,
      position: 0,
      sourceProductFinishOptionId: sourceFinishOptionId,
    })
    .returning({ id: schema.finishOption.id });
  if (!snapshot) throw new Error("Failed to create finish snapshot.");

  await tx.insert(schema.finishOptionFinish).values(
    finishes.map(({ finishId, position }) => ({
      finishId,
      finishOptionId: snapshot.id,
      position,
    })),
  );
  if (colors.length) {
    await tx.insert(schema.finishOptionColor).values(
      colors.map(({ colorId, position }) => ({
        colorId,
        finishOptionId: snapshot.id,
        position,
      })),
    );
  }
}

async function replaceProductFinishOptions(
  tx: CatalogTransaction,
  productId: number,
  options: ProductWriteFinishOption[],
) {
  await tx
    .delete(schema.finishOption)
    .where(eq(schema.finishOption.productId, productId));

  for (const [position, option] of options.entries()) {
    const [row] = await tx
      .insert(schema.finishOption)
      .values({
        colorEffectId: option.colorEffectId,
        position,
        productId,
      })
      .returning({ id: schema.finishOption.id });
    if (!row) throw new Error("Failed to create finish option.");

    await tx.insert(schema.finishOptionFinish).values(
      option.finishIds.map((finishId, componentPosition) => ({
        finishId,
        finishOptionId: row.id,
        position: componentPosition,
      })),
    );
    if (option.colorIds.length) {
      await tx.insert(schema.finishOptionColor).values(
        option.colorIds.map((colorId, componentPosition) => ({
          colorId,
          finishOptionId: row.id,
          position: componentPosition,
        })),
      );
    }
  }
}

async function validateFinishOptions(
  db: Database,
  options: ProductWriteFinishOption[],
) {
  if (!options.length)
    throw new Error("At least one finish option is required.");

  const effectIds = [
    ...new Set(
      options.flatMap(({ colorEffectId }) =>
        colorEffectId === null ? [] : [colorEffectId],
      ),
    ),
  ];
  const effects = effectIds.length
    ? await db
        .select({ id: schema.colorEffect.id, slug: schema.colorEffect.slug })
        .from(schema.colorEffect)
        .where(inArray(schema.colorEffect.id, effectIds))
    : [];
  assertValidFinishOptions(options, effects);
}

export function assertValidFinishOptions(
  options: ProductWriteFinishOption[],
  effects: Array<Pick<CatalogLookup, "id" | "slug">>,
) {
  if (!options.length)
    throw new Error("At least one finish option is required.");

  const effectsById = new Map(effects.map((effect) => [effect.id, effect]));
  const signatures = new Set<string>();

  for (const option of options) {
    if (!option.finishIds.length) throw new Error("A finish is required.");
    if (new Set(option.finishIds).size !== option.finishIds.length) {
      throw new Error("Duplicate finishes are not allowed.");
    }
    if (new Set(option.colorIds).size !== option.colorIds.length) {
      throw new Error("Duplicate colors are not allowed.");
    }
    if (!option.colorIds.length && option.colorEffectId !== null) {
      throw new Error("A color effect requires colors.");
    }
    if (option.colorIds.length && option.colorEffectId === null) {
      throw new Error("Colors require a color effect.");
    }
    const effect =
      option.colorEffectId === null
        ? null
        : effectsById.get(option.colorEffectId);
    if (option.colorEffectId !== null && !effect) {
      throw new Error("Color effect does not exist.");
    }
    if (effect?.slug === "fade" && option.colorIds.length < 2) {
      throw new Error("A fade requires at least two colors.");
    }

    const signature = `${option.finishIds.join(",")}|${option.colorEffectId ?? ""}|${option.colorIds.join(",")}`;
    if (signatures.has(signature)) {
      throw new Error("Duplicate finish options are not allowed.");
    }
    signatures.add(signature);
  }
}

function spinnerSpecs(specs: ProductWriteInput["specs"]) {
  return {
    buttonDiameterMm: specs.buttonDiameterMm ?? null,
    compatibleButtonId: specs.compatibleButtonId ?? null,
    lengthMm: specs.lengthMm ?? null,
    thicknessMm: specs.thicknessMm ?? null,
    thicknessWithButtonMm: specs.thicknessWithButtonMm ?? null,
    weightG: specs.weightG ?? null,
    widthMm: specs.widthMm ?? null,
  };
}

function buttonSpecs(specs: ProductWriteInput["specs"]) {
  return {
    diameterMm: specs.diameterMm ?? null,
    thicknessMm: specs.thicknessMm ?? null,
    weightG: specs.weightG ?? null,
  };
}

function actorAttributes(
  actorClerkId: string,
  attributes: Record<string, unknown> = {},
) {
  return {
    attributes: {
      ...attributes,
      clerkIdHash: hashLogIdentifier(actorClerkId),
    },
  };
}

function productAttributes(input: ProductWriteInput) {
  return actorAttributes(input.actorClerkId, {
    finishOptionCount: input.finishOptions.length,
    materialIds: input.materialIds,
    productTypeSlug: input.productTypeSlug,
    slug: input.slug,
  });
}
