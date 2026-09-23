import type { Database } from "@package/database";
import { schema } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { hashLogIdentifier } from "../../logging.js";
import type { UsersService } from "../users/index.js";

export type CatalogProductType = "spinner" | "spinner-button";

export type CatalogLookup = { id: number; name: string; slug: string };

export type CatalogColor = CatalogLookup & { hex: string };

export type CatalogFinishOption = {
  colorEffect: CatalogLookup | null;
  colors: CatalogColor[];
  finishes: CatalogLookup[];
  id: number;
};

export type CatalogViewer = { clerkId?: string; isAdmin?: boolean };

export type CatalogImage = {
  contentType: string;
  createdAt: Date;
  deletedAt: Date | null;
  deletedByClerkId: string | null;
  deletedByRole: "admin" | "owner" | null;
  fileName: string;
  id: number;
  objectPath: string;
  position: number;
  size: number;
  url: string;
};

export type CatalogImageTargetType =
  | "collection"
  | "collection_item"
  | "product";
export type CatalogImageTrashItem = CatalogImage & {
  ownerClerkId: string;
  targetId: number;
  targetName: string;
  targetType: CatalogImageTargetType;
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
  canAdminister: boolean;
  canEdit: boolean;
  createdAt: Date;
  diameterMm: string | null;
  finishOptions: CatalogFinishOption[];
  imageCount: number;
  images: CatalogImage[];
  id: number;
  lengthMm: string | null;
  makerId: number;
  makerName: string;
  materials: Array<{ id: number; name: string; slug: string }>;
  name: string;
  ownerClerkId: string;
  isPrivate: boolean;
  isAdminPrivate: boolean;
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
  actorIsAdmin?: boolean;
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
    hex: string;
    name: string;
    slug: string;
  }): Promise<CatalogColor>;
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
    viewer?: CatalogViewer,
  ): Promise<CatalogProduct | null>;
  listColorEffects(): Promise<CatalogLookup[]>;
  listColors(): Promise<CatalogColor[]>;
  listFinishes(): Promise<CatalogLookup[]>;
  listMakers(): Promise<
    Array<{ id: number; name: string; rootUrl: string | null }>
  >;
  listMaterials(): Promise<Array<{ id: number; name: string; slug: string }>>;
  listProducts(
    productTypeSlug?: string,
    viewer?: CatalogViewer,
  ): Promise<CatalogProduct[]>;
  listProductTypes(): Promise<
    Array<{ id: number; name: string; slug: string }>
  >;
  listSlugs(
    productTypeSlug: string,
    exceptProductId?: number,
  ): Promise<string[]>;
  listImageTrash(input: {
    actorClerkId: string;
    actorIsAdmin: boolean;
  }): Promise<CatalogImageTrashItem[]>;
  restoreImage(input: {
    actorClerkId: string;
    actorIsAdmin: boolean;
    imageId: number;
    targetType: CatalogImageTargetType;
  }): Promise<void>;
  softDeleteImage(input: {
    actorClerkId: string;
    actorIsAdmin: boolean;
    imageId: number;
    targetType: CatalogImageTargetType;
  }): Promise<void>;
  setVisibility(input: {
    actorClerkId: string;
    actorIsAdmin: boolean;
    isPrivate: boolean;
    productId: number;
    reason?: string;
  }): Promise<void>;
  updateProduct(
    input: ProductWriteInput & { productId: number },
  ): Promise<CatalogProduct>;
};

export type UserCollectionItem = {
  canAdminister: boolean;
  canEdit: boolean;
  collectionIsPrivate: boolean;
  collectionId: number;
  collectionName: string;
  collectionItemId: number;
  finishOption: CatalogFinishOption | null;
  imageCount: number;
  images: CatalogImage[];
  isPrivate: boolean;
  isAdminPrivate: boolean;
  installedButtonId: number | null;
  makerId: number;
  makerName: string;
  material: CatalogLookup | null;
  name: string;
  ownerClerkId: string;
  ownerUserId: number;
  productId: number;
  productTypeName: string;
  productTypeSlug: CatalogProductType;
  sourceProductFinishOptionId: number | null;
  productImages: CatalogImage[];
};

export type PublicCollectionOwner = {
  collections: UserCollectionSummary[];
  itemCount: number;
  items: UserCollectionItem[];
  userId: number;
  username: string;
};

export type UserCollectionSummary = {
  coverImage: CatalogImage | null;
  coverImages: CatalogImage[];
  createdAt: Date;
  description: string | null;
  id: number;
  isAdminPrivate: boolean;
  isPrivate: boolean;
  itemCount: number;
  name: string;
  ownerUserId: number;
  updatedAt: Date;
};

export type CollectionWriteInput = {
  description: string | null;
  isPrivate: boolean;
  name: string;
  reason?: string;
};

export type CollectionsService = {
  addSpinner(input: {
    actorClerkId: string;
    buttonCustomFinish: ProductWriteFinishOption | null;
    buttonFinishOptionId: number | null;
    buttonMaterialId: number | null;
    buttonProductId: number | null;
    spinnerFinishOptionId: number | null;
    spinnerCustomFinish: ProductWriteFinishOption | null;
    spinnerMaterialId: number;
    spinnerProductId: number;
    collectionId?: number | null;
    newCollection?: CollectionWriteInput | null;
  }): Promise<{ buttonItemId: number | null; spinnerItemId: number }>;
  addSpinnerButton(input: {
    actorClerkId: string;
    customFinish: ProductWriteFinishOption | null;
    finishOptionId: number | null;
    materialId: number;
    productId: number;
    collectionId?: number | null;
    newCollection?: CollectionWriteInput | null;
  }): Promise<number>;
  createCollection(
    input: CollectionWriteInput & {
      actorClerkId: string;
    },
  ): Promise<UserCollectionSummary>;
  countOwnedProducts(input: {
    actorClerkId: string;
    productIds: number[];
  }): Promise<Record<number, number>>;
  getOwnedItem(
    actorClerkId: string,
    collectionItemId: number,
    actorIsAdmin?: boolean,
  ): Promise<UserCollectionItem | null>;
  getDefaultCollectionName(actorClerkId: string): Promise<string>;
  getOwnedCollection(
    actorClerkId: string,
    collectionId: number,
    actorIsAdmin?: boolean,
  ): Promise<UserCollectionSummary | null>;
  getPublicCollection(input: {
    collectionId: number;
    ownerUserId: number;
    viewer?: CatalogViewer;
  }): Promise<UserCollectionSummary | null>;
  getPublicItem(input: {
    collectionItemId: number;
    collectionId: number;
    ownerUserId: number;
    viewer?: CatalogViewer;
  }): Promise<UserCollectionItem | null>;
  listOwned(
    actorClerkId: string,
    actorIsAdmin?: boolean,
    collectionId?: number,
  ): Promise<UserCollectionItem[]>;
  listOwnedCollections(
    actorClerkId: string,
    actorIsAdmin?: boolean,
  ): Promise<UserCollectionSummary[]>;
  listOwners(viewer?: CatalogViewer): Promise<PublicCollectionOwner[]>;
  setCollectionVisibility(input: {
    actorClerkId: string;
    actorIsAdmin: boolean;
    collectionId: number;
    isPrivate: boolean;
    reason?: string;
  }): Promise<void>;
  setItemVisibility(input: {
    actorClerkId: string;
    actorIsAdmin: boolean;
    collectionItemId: number;
    isPrivate: boolean;
    reason?: string;
  }): Promise<void>;
  updateItem(input: {
    actorClerkId: string;
    actorIsAdmin?: boolean;
    collectionId?: number;
    collectionItemId: number;
    customFinish: ProductWriteFinishOption | null;
    finishOptionId: number | null;
    installedButton?: {
      collectionItemId: number;
      customFinish: ProductWriteFinishOption | null;
      finishOptionId: number | null;
      materialId: number;
    } | null;
    materialId: number;
  }): Promise<void>;
  updateCollection(
    input: CollectionWriteInput & {
      actorClerkId: string;
      actorIsAdmin: boolean;
      collectionId: number;
    },
  ): Promise<UserCollectionSummary>;
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
            .values({ hex: input.hex, name: input.name, slug: input.slug })
            .returning({
              hex: schema.color.hex,
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
                ownerClerkId: input.actorClerkId,
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
            { clerkId: input.actorClerkId, isAdmin: input.actorIsAdmin },
          );
          if (!created || created.id !== productId) {
            throw new Error("Failed to load created product.");
          }
          return created;
        },
        productAttributes(input),
      );
    },
    async getProduct(productTypeSlug, productSlug, viewer) {
      const products = await queryProducts(
        db,
        productTypeSlug,
        productSlug,
        viewer,
      );
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
      return await logger.operation(
        loggerMessages.database.catalog.listColorEffects,
        async () =>
          await db
            .select({
              id: schema.colorEffect.id,
              name: schema.colorEffect.name,
              slug: schema.colorEffect.slug,
            })
            .from(schema.colorEffect)
            .orderBy(asc(schema.colorEffect.name)),
      );
    },
    async listColors() {
      return await logger.operation(
        loggerMessages.database.catalog.listColors,
        async () =>
          await db
            .select({
              hex: schema.color.hex,
              id: schema.color.id,
              name: schema.color.name,
              slug: schema.color.slug,
            })
            .from(schema.color)
            .orderBy(asc(schema.color.name)),
      );
    },
    async listFinishes() {
      return await logger.operation(
        loggerMessages.database.catalog.listFinishes,
        async () =>
          await db
            .select({
              id: schema.finish.id,
              name: schema.finish.name,
              slug: schema.finish.slug,
            })
            .from(schema.finish)
            .orderBy(asc(schema.finish.name)),
      );
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
    async listProducts(productTypeSlug, viewer) {
      return await queryProducts(db, productTypeSlug, undefined, viewer);
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
    async listImageTrash(input) {
      return await listCatalogImageTrash(db, input);
    },
    async restoreImage(input) {
      await restoreCatalogImage(db, input);
    },
    async setVisibility(input) {
      const [product] = await db
        .select({
          ownerClerkId: schema.product.ownerClerkId,
          privatedByClerkId: schema.product.privatedByClerkId,
        })
        .from(schema.product)
        .where(eq(schema.product.id, input.productId))
        .limit(1);
      if (
        !product ||
        (!input.actorIsAdmin && product.ownerClerkId !== input.actorClerkId)
      ) {
        throw new Error("Product does not exist.");
      }
      if (
        !input.isPrivate &&
        product.privatedByClerkId &&
        product.privatedByClerkId !== input.actorClerkId &&
        !input.actorIsAdmin
      ) {
        throw new Error("Product is private by an administrator.");
      }
      if (input.actorIsAdmin && input.isPrivate && !input.reason?.trim()) {
        throw new Error("A privacy reason is required.");
      }
      await db
        .update(schema.product)
        .set(privacyUpdate(input))
        .where(eq(schema.product.id, input.productId));
    },
    async softDeleteImage(input) {
      await softDeleteCatalogImage(db, input);
    },
    async updateProduct(input) {
      return await logger.operation(
        loggerMessages.database.catalog.updateProduct,
        async () => {
          await validateFinishOptions(db, input.finishOptions);
          await db.transaction(async (tx) => {
            const [existing] = await tx
              .select({
                id: schema.product.id,
                ownerClerkId: schema.product.ownerClerkId,
              })
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
            if (
              !input.actorIsAdmin &&
              existing.ownerClerkId !== input.actorClerkId
            ) {
              throw new Error("Product does not exist.");
            }

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
            { clerkId: input.actorClerkId, isAdmin: input.actorIsAdmin },
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
    async createCollection(input) {
      return await logger.operation(
        loggerMessages.database.collections.create,
        async () => {
          const owner = await users.ensure({ clerkId: input.actorClerkId });
          const collectionId = await db.transaction(async (tx) =>
            insertCollection(tx, owner.id, input),
          );
          const collection = (
            await queryCollections(db, {
              collectionId,
              includePrivate: true,
              ownerUserId: owner.id,
              viewerClerkId: input.actorClerkId,
            })
          )[0];
          if (!collection) throw new Error("Failed to load collection.");
          return collection;
        },
        actorAttributes(input.actorClerkId),
      );
    },
    async addSpinner(input) {
      return await logger.operation(
        loggerMessages.database.collections.addSpinner,
        async () => {
          const owner = await users.ensure({ clerkId: input.actorClerkId });
          return await db.transaction(async (tx) => {
            const collectionId = await resolveCollectionForWrite(tx, {
              collectionId: input.collectionId ?? null,
              newCollection: input.newCollection ?? null,
              ownerId: owner.id,
            });
            let buttonItemId: number | null = null;
            if (
              input.buttonProductId === null &&
              (input.buttonMaterialId !== null ||
                input.buttonFinishOptionId !== null ||
                input.buttonCustomFinish !== null)
            ) {
              throw new Error("Button product is required.");
            }
            if (input.buttonProductId !== null) {
              if (
                input.buttonMaterialId === null ||
                (input.buttonFinishOptionId === null) ===
                  (input.buttonCustomFinish === null)
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
                  collectionId,
                  materialId: input.buttonMaterialId,
                  ownerId: owner.id,
                })
                .returning({ id: schema.collectionItem.id });
              if (!buttonItem) throw new Error("Failed to create button item.");
              await tx.insert(schema.collectionSpinnerButton).values({
                id: buttonItem.id,
                productSpinnerButtonId: input.buttonProductId,
              });
              await createCollectionFinishOption(tx, {
                collectionItemId: buttonItem.id,
                customFinish: input.buttonCustomFinish,
                productFinishOptionId: input.buttonFinishOptionId,
                productId: input.buttonProductId,
              });
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
                collectionId,
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
            await createCollectionFinishOption(tx, {
              collectionItemId: spinnerItem.id,
              customFinish: input.spinnerCustomFinish,
              productFinishOptionId: input.spinnerFinishOptionId,
              productId: input.spinnerProductId,
            });
            await touchCollection(tx, collectionId);
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
            const collectionId = await resolveCollectionForWrite(tx, {
              collectionId: input.collectionId ?? null,
              newCollection: input.newCollection ?? null,
              ownerId: owner.id,
            });
            await assertProductMaterial(tx, input.productId, input.materialId);
            const [item] = await tx
              .insert(schema.collectionItem)
              .values({
                collectionId,
                materialId: input.materialId,
                ownerId: owner.id,
              })
              .returning({ id: schema.collectionItem.id });
            if (!item) throw new Error("Failed to create collection item.");
            await tx.insert(schema.collectionSpinnerButton).values({
              id: item.id,
              productSpinnerButtonId: input.productId,
            });
            await createCollectionFinishOption(tx, {
              collectionItemId: item.id,
              customFinish: input.customFinish,
              productFinishOptionId: input.finishOptionId,
              productId: input.productId,
            });
            await touchCollection(tx, collectionId);
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
    async getOwnedItem(actorClerkId, collectionItemId, actorIsAdmin = false) {
      return (
        (
          await queryOwnedItems(
            db,
            actorIsAdmin ? undefined : actorClerkId,
            collectionItemId,
            {
              includePrivate: true,
            },
          )
        )[0] ?? null
      );
    },
    async getDefaultCollectionName(actorClerkId) {
      const [owner] = await db
        .select({ username: schema.user.username })
        .from(schema.user)
        .where(eq(schema.user.clerkId, actorClerkId))
        .limit(1);
      if (!owner?.username) {
        throw new Error("User profile sync is incomplete. Please retry.");
      }
      return `${owner.username}'s Collection`;
    },
    async getOwnedCollection(actorClerkId, collectionId, actorIsAdmin = false) {
      const owner = await users.getByClerkId(actorClerkId);
      if (!owner && !actorIsAdmin) return null;
      return (
        (
          await queryCollections(db, {
            collectionId,
            includePrivate: true,
            ownerUserId: actorIsAdmin ? undefined : owner?.id,
            viewerClerkId: actorClerkId,
          })
        )[0] ?? null
      );
    },
    async getPublicCollection({ collectionId, ownerUserId, viewer }) {
      return (
        (
          await queryCollections(db, {
            collectionId,
            includePrivate: Boolean(viewer?.isAdmin),
            ownerUserId,
            viewerClerkId: viewer?.clerkId,
          })
        )[0] ?? null
      );
    },
    async getPublicItem({
      collectionId,
      collectionItemId,
      ownerUserId,
      viewer,
    }) {
      return (
        (
          await queryOwnedItems(db, undefined, collectionItemId, {
            collectionId,
            includePrivate: Boolean(viewer?.isAdmin),
            ownerUserId,
            viewerClerkId: viewer?.clerkId,
          })
        )[0] ?? null
      );
    },
    async listOwned(actorClerkId, actorIsAdmin = false, collectionId) {
      return await queryOwnedItems(
        db,
        actorIsAdmin ? undefined : actorClerkId,
        undefined,
        {
          collectionId,
          includePrivate: true,
        },
      );
    },
    async listOwnedCollections(actorClerkId, actorIsAdmin = false) {
      const owner = await users.getByClerkId(actorClerkId);
      if (!owner && !actorIsAdmin) return [];
      return await queryCollections(db, {
        includePrivate: true,
        ownerUserId: actorIsAdmin ? undefined : owner?.id,
        viewerClerkId: actorClerkId,
      });
    },
    async listOwners(viewer) {
      const items = await queryOwnedItems(db, undefined, undefined, {
        includePrivate: Boolean(viewer?.isAdmin),
        viewerClerkId: viewer?.clerkId,
      });
      const ownerIds = [
        ...new Set(items.map(({ ownerUserId }) => ownerUserId)),
      ];
      if (!ownerIds.length) return [];
      const [owners, collections] = await Promise.all([
        db
          .select({
            userId: schema.user.id,
            username: schema.user.username,
          })
          .from(schema.user)
          .where(inArray(schema.user.id, ownerIds)),
        queryCollections(db, {
          includePrivate: Boolean(viewer?.isAdmin),
          viewerClerkId: viewer?.clerkId,
        }),
      ]);
      return owners
        .flatMap((owner) => {
          if (!owner.username) return [];
          const ownerItems = items.filter(
            ({ ownerUserId }) => ownerUserId === owner.userId,
          );
          return [
            {
              collections: collections.filter(
                ({ ownerUserId }) => ownerUserId === owner.userId,
              ),
              itemCount: ownerItems.length,
              items: ownerItems,
              userId: owner.userId,
              username: owner.username,
            },
          ];
        })
        .sort((left, right) => left.username.localeCompare(right.username));
    },
    async setCollectionVisibility(input) {
      const owner = await users.getByClerkId(input.actorClerkId);
      if (!owner && !input.actorIsAdmin)
        throw new Error("Collection does not exist.");
      const [collection] = await db
        .select({
          isPrivate: schema.userCollection.isPrivate,
          ownerId: schema.userCollection.ownerId,
          privatedByClerkId: schema.userCollection.privatedByClerkId,
        })
        .from(schema.userCollection)
        .where(eq(schema.userCollection.id, input.collectionId))
        .limit(1);
      if (
        !collection ||
        (!input.actorIsAdmin && collection.ownerId !== owner?.id)
      ) {
        throw new Error("Collection does not exist.");
      }
      if (
        !input.isPrivate &&
        collection.privatedByClerkId &&
        collection.privatedByClerkId !== input.actorClerkId &&
        !input.actorIsAdmin
      ) {
        throw new Error("Collection is private by an administrator.");
      }
      if (input.actorIsAdmin && input.isPrivate && !input.reason?.trim()) {
        throw new Error("A privacy reason is required.");
      }
      await db
        .update(schema.userCollection)
        .set(privacyUpdate(input))
        .where(eq(schema.userCollection.id, input.collectionId));
    },
    async updateCollection(input) {
      return await logger.operation(
        loggerMessages.database.collections.update,
        async () => {
          const owner = await users.getByClerkId(input.actorClerkId);
          const [current] = await db
            .select({
              isPrivate: schema.userCollection.isPrivate,
              ownerId: schema.userCollection.ownerId,
              privatedByClerkId: schema.userCollection.privatedByClerkId,
            })
            .from(schema.userCollection)
            .where(eq(schema.userCollection.id, input.collectionId))
            .limit(1);
          if (
            !current ||
            (!input.actorIsAdmin && current.ownerId !== owner?.id)
          ) {
            throw new Error("Collection does not exist.");
          }
          if (
            !input.isPrivate &&
            current.privatedByClerkId &&
            current.privatedByClerkId !== input.actorClerkId &&
            !input.actorIsAdmin
          ) {
            throw new Error("Collection is private by an administrator.");
          }
          if (
            input.actorIsAdmin &&
            input.isPrivate !== current.isPrivate &&
            input.isPrivate &&
            !input.reason?.trim()
          ) {
            throw new Error("A privacy reason is required.");
          }
          const values = validatedCollectionValues(input);
          await db
            .update(schema.userCollection)
            .set({
              ...values,
              ...(input.isPrivate === current.isPrivate
                ? { updatedAt: new Date() }
                : privacyUpdate(input)),
            })
            .where(eq(schema.userCollection.id, input.collectionId));
          const collection = (
            await queryCollections(db, {
              collectionId: input.collectionId,
              includePrivate: true,
              ownerUserId: current.ownerId,
              viewerClerkId: input.actorClerkId,
            })
          )[0];
          if (!collection) throw new Error("Failed to load collection.");
          return collection;
        },
        actorAttributes(input.actorClerkId, {
          collectionId: input.collectionId,
        }),
      );
    },
    async setItemVisibility(input) {
      const owner = await users.getByClerkId(input.actorClerkId);
      const [item] = await db
        .select({
          ownerId: schema.collectionItem.ownerId,
          privatedByClerkId: schema.collectionItem.privatedByClerkId,
        })
        .from(schema.collectionItem)
        .where(eq(schema.collectionItem.id, input.collectionItemId))
        .limit(1);
      if (!item || (!input.actorIsAdmin && item.ownerId !== owner?.id))
        throw new Error("Collection item does not exist.");
      if (
        !input.isPrivate &&
        item.privatedByClerkId &&
        item.privatedByClerkId !== input.actorClerkId &&
        !input.actorIsAdmin
      ) {
        throw new Error("Collection item is private by an administrator.");
      }
      if (input.actorIsAdmin && input.isPrivate && !input.reason?.trim())
        throw new Error("A privacy reason is required.");
      await db
        .update(schema.collectionItem)
        .set(privacyUpdate(input))
        .where(eq(schema.collectionItem.id, input.collectionItemId));
    },
    async updateItem(input) {
      await logger.operation(
        loggerMessages.database.collections.updateItem,
        async () => {
          const owner = await users.getByClerkId(input.actorClerkId);
          if (!owner && !input.actorIsAdmin)
            throw new Error("Collection item does not exist.");
          await db.transaction(async (tx) => {
            const [item] = await tx
              .select({
                buttonProductId:
                  schema.collectionSpinnerButton.productSpinnerButtonId,
                collectionId: schema.collectionItem.collectionId,
                installedButtonId: schema.collectionSpinner.installedButtonId,
                ownerId: schema.collectionItem.ownerId,
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
                  input.actorIsAdmin
                    ? undefined
                    : owner
                      ? eq(schema.collectionItem.ownerId, owner.id)
                      : sql`false`,
                  eq(schema.collectionItem.owned, true),
                ),
              )
              .limit(1);
            const productId =
              item?.spinnerProductId ?? item?.buttonProductId ?? null;
            if (!item || productId === null) {
              throw new Error("Collection item does not exist.");
            }

            const targetCollectionId = input.collectionId ?? item.collectionId;
            const [targetCollection] = await tx
              .select({ id: schema.userCollection.id })
              .from(schema.userCollection)
              .where(
                and(
                  eq(schema.userCollection.id, targetCollectionId),
                  eq(schema.userCollection.ownerId, item.ownerId),
                ),
              )
              .limit(1);
            if (!targetCollection)
              throw new Error("Collection does not exist.");

            if (item.collectionId !== targetCollectionId) {
              const linkedItemIds = [input.collectionItemId];
              if (item.installedButtonId !== null) {
                linkedItemIds.push(item.installedButtonId);
              }
              const linkedSpinners = await tx
                .select({ id: schema.collectionSpinner.id })
                .from(schema.collectionSpinner)
                .where(
                  eq(
                    schema.collectionSpinner.installedButtonId,
                    input.collectionItemId,
                  ),
                );
              linkedItemIds.push(...linkedSpinners.map(({ id }) => id));
              await tx
                .update(schema.collectionItem)
                .set({
                  collectionId: targetCollectionId,
                  updatedAt: new Date(),
                })
                .where(inArray(schema.collectionItem.id, linkedItemIds));
              await Promise.all([
                touchCollection(tx, item.collectionId),
                touchCollection(tx, targetCollectionId),
              ]);
            }

            await updateCollectionItemSnapshot(tx, {
              collectionItemId: input.collectionItemId,
              customFinish: input.customFinish,
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
                      input.actorIsAdmin
                        ? undefined
                        : owner
                          ? eq(schema.collectionItem.ownerId, owner.id)
                          : sql`false`,
                      eq(schema.collectionItem.owned, true),
                    ),
                  )
                  .limit(1);
                if (!button) {
                  throw new Error("Installed button does not exist.");
                }
                await tx
                  .update(schema.collectionItem)
                  .set({
                    collectionId: targetCollectionId,
                    updatedAt: new Date(),
                  })
                  .where(eq(schema.collectionItem.id, button.id));
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
            await touchCollection(tx, targetCollectionId);
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

export function normalizeCollectionName(name: string) {
  return name
    .trim()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function validatedCollectionValues(input: CollectionWriteInput) {
  const name = input.name.trim();
  const nameLength = [...name].length;
  if (nameLength < 2 || nameLength > 80) {
    throw new Error("Collection name must be between 2 and 80 characters.");
  }
  const normalizedName = normalizeCollectionName(name);
  if (!normalizedName) throw new Error("Collection name is invalid.");
  const description = input.description?.trim() || null;
  if (description && description.split(/\s+/u).length > 200) {
    throw new Error("Collection description must be 200 words or fewer.");
  }
  return { description, name, normalizedName };
}

async function insertCollection(
  tx: CatalogTransaction,
  ownerId: number,
  input: CollectionWriteInput,
) {
  const [collection] = await tx
    .insert(schema.userCollection)
    .values({
      ...validatedCollectionValues(input),
      isPrivate: input.isPrivate,
      ownerId,
    })
    .returning({ id: schema.userCollection.id });
  if (!collection) throw new Error("Failed to create collection.");
  return collection.id;
}

async function resolveCollectionForWrite(
  tx: CatalogTransaction,
  input: {
    collectionId: number | null;
    newCollection: CollectionWriteInput | null;
    ownerId: number;
  },
) {
  if (input.collectionId !== null && input.newCollection !== null) {
    throw new Error("Choose an existing or new collection, not both.");
  }
  if (input.newCollection !== null) {
    return await insertCollection(tx, input.ownerId, input.newCollection);
  }
  if (input.collectionId !== null) {
    const [collection] = await tx
      .select({ id: schema.userCollection.id })
      .from(schema.userCollection)
      .where(
        and(
          eq(schema.userCollection.id, input.collectionId),
          eq(schema.userCollection.ownerId, input.ownerId),
        ),
      )
      .limit(1);
    if (!collection) throw new Error("Collection does not exist.");
    return collection.id;
  }

  const collections = await tx
    .select({ id: schema.userCollection.id })
    .from(schema.userCollection)
    .where(eq(schema.userCollection.ownerId, input.ownerId))
    .limit(2);
  if (collections.length > 1) throw new Error("Choose a collection.");
  const existingCollection = collections[0];
  if (existingCollection) return existingCollection.id;

  const [owner] = await tx
    .select({ username: schema.user.username })
    .from(schema.user)
    .where(eq(schema.user.id, input.ownerId))
    .limit(1);
  if (!owner?.username) {
    throw new Error("User profile sync is incomplete. Please retry.");
  }
  return await insertCollection(tx, input.ownerId, {
    description: null,
    isPrivate: true,
    name: `${owner.username}'s Collection`,
  });
}

async function touchCollection(tx: CatalogTransaction, collectionId: number) {
  await tx
    .update(schema.userCollection)
    .set({ updatedAt: new Date() })
    .where(eq(schema.userCollection.id, collectionId));
}

async function queryCollections(
  db: Database,
  options: {
    collectionId?: number;
    includePrivate?: boolean;
    ownerUserId?: number;
    viewerClerkId?: string;
  } = {},
): Promise<UserCollectionSummary[]> {
  const conditions = [];
  if (options.collectionId !== undefined) {
    conditions.push(eq(schema.userCollection.id, options.collectionId));
  }
  if (options.ownerUserId !== undefined) {
    conditions.push(eq(schema.userCollection.ownerId, options.ownerUserId));
  }
  if (!options.includePrivate) {
    conditions.push(
      options.viewerClerkId
        ? sql`(${schema.userCollection.isPrivate} = false or ${schema.user.clerkId} = ${options.viewerClerkId})`
        : eq(schema.userCollection.isPrivate, false),
    );
  }
  const rows = await db
    .select({
      createdAt: schema.userCollection.createdAt,
      description: schema.userCollection.description,
      id: schema.userCollection.id,
      isPrivate: schema.userCollection.isPrivate,
      name: schema.userCollection.name,
      ownerClerkId: schema.user.clerkId,
      ownerUserId: schema.userCollection.ownerId,
      privatedByClerkId: schema.userCollection.privatedByClerkId,
      updatedAt: schema.userCollection.updatedAt,
    })
    .from(schema.userCollection)
    .innerJoin(schema.user, eq(schema.userCollection.ownerId, schema.user.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.userCollection.updatedAt));
  if (!rows.length) return [];
  const collectionIds = rows.map(({ id }) => id);
  const [counts, covers] = await Promise.all([
    db
      .select({
        collectionId: schema.collectionItem.collectionId,
        itemCount: count(schema.collectionItem.id),
      })
      .from(schema.collectionItem)
      .where(
        and(
          inArray(schema.collectionItem.collectionId, collectionIds),
          eq(schema.collectionItem.owned, true),
          options.includePrivate
            ? undefined
            : eq(schema.collectionItem.isPrivate, false),
        ),
      )
      .groupBy(schema.collectionItem.collectionId),
    db
      .select()
      .from(schema.collectionImage)
      .where(inArray(schema.collectionImage.collectionId, collectionIds))
      .orderBy(desc(schema.collectionImage.position)),
  ]);
  const countByCollection = new Map(
    counts.map(({ collectionId, itemCount }) => [
      collectionId,
      Number(itemCount),
    ]),
  );
  const coverByCollection = new Map(
    covers
      .filter(({ isCurrent }) => isCurrent)
      .map((cover) => [
        cover.collectionId,
        {
          contentType: cover.contentType,
          createdAt: cover.createdAt,
          deletedAt: null,
          deletedByClerkId: null,
          deletedByRole: null,
          fileName: cover.fileName,
          id: cover.id,
          objectPath: cover.objectPath,
          position: cover.position,
          size: cover.size,
          url: cover.url,
        } satisfies CatalogImage,
      ]),
  );
  return rows.map((row) => ({
    coverImage: coverByCollection.get(row.id) ?? null,
    coverImages: covers
      .filter(({ collectionId }) => collectionId === row.id)
      .map((cover) => ({
        contentType: cover.contentType,
        createdAt: cover.createdAt,
        deletedAt: null,
        deletedByClerkId: null,
        deletedByRole: null,
        fileName: cover.fileName,
        id: cover.id,
        objectPath: cover.objectPath,
        position: cover.position,
        size: cover.size,
        url: cover.url,
      })),
    createdAt: row.createdAt,
    description: row.description,
    id: row.id,
    isAdminPrivate:
      row.isPrivate &&
      row.privatedByClerkId !== null &&
      row.privatedByClerkId !== row.ownerClerkId,
    isPrivate: row.isPrivate,
    itemCount: countByCollection.get(row.id) ?? 0,
    name: row.name,
    ownerUserId: row.ownerUserId,
    updatedAt: row.updatedAt,
  }));
}

async function updateCollectionItemSnapshot(
  tx: CatalogTransaction,
  input: {
    collectionItemId: number;
    customFinish: ProductWriteFinishOption | null;
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

  if (input.customFinish !== null || input.finishOptionId !== null) {
    await tx
      .delete(schema.finishOption)
      .where(eq(schema.finishOption.collectionItemId, input.collectionItemId));
    await createCollectionFinishOption(tx, {
      collectionItemId: input.collectionItemId,
      customFinish: input.customFinish,
      productFinishOptionId: input.finishOptionId,
      productId: input.productId,
    });
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
  viewer?: CatalogViewer,
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
  if (!viewer?.isAdmin) {
    conditions.push(
      viewer?.clerkId
        ? sql`(${schema.product.isPrivate} = false or ${schema.product.ownerClerkId} = ${viewer.clerkId})`
        : eq(schema.product.isPrivate, false),
    );
  }

  const rows = await db
    .select({
      buttonDiameterMm: schema.productSpinner.buttonDiameterMm,
      compatibleButtonId: schema.productSpinner.compatibleButtonId,
      compatibleButtonName: compatibleButtonProduct.name,
      createdAt: sql<Date>`coalesce(${schema.productSpinner.createdAt}, ${schema.productSpinnerButton.createdAt})`,
      diameterMm: schema.productSpinnerButton.diameterMm,
      id: schema.product.id,
      isPrivate: schema.product.isPrivate,
      privatedByClerkId: schema.product.privatedByClerkId,
      lengthMm: schema.productSpinner.lengthMm,
      makerId: schema.maker.id,
      makerName: schema.maker.name,
      materialId: schema.material.id,
      materialName: schema.material.name,
      materialSlug: schema.material.slug,
      name: schema.product.name,
      ownerClerkId: schema.product.ownerClerkId,
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
      canAdminister: Boolean(viewer?.isAdmin),
      canEdit: Boolean(viewer?.isAdmin || viewer?.clerkId === row.ownerClerkId),
      createdAt: row.createdAt,
      diameterMm: row.diameterMm,
      finishOptions: [],
      imageCount: 0,
      images: [],
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
      ownerClerkId: row.ownerClerkId,
      isPrivate: row.isPrivate,
      isAdminPrivate:
        row.isPrivate &&
        row.privatedByClerkId !== null &&
        row.privatedByClerkId !== row.ownerClerkId,
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
  await Promise.all([
    loadFinishOptions(db, result),
    loadProductImages(db, result, viewer),
  ]);
  return result;
}

async function loadProductImages(
  db: Database,
  products: CatalogProduct[],
  viewer?: CatalogViewer,
) {
  if (!products.length) return;
  const productById = new Map(products.map((product) => [product.id, product]));
  const rows = await db
    .select({
      contentType: schema.productImage.contentType,
      createdAt: schema.productImage.createdAt,
      deletedAt: schema.productImage.deletedAt,
      deletedByClerkId: schema.productImage.deletedByClerkId,
      deletedByRole: schema.productImage.deletedByRole,
      fileName: schema.productImage.fileName,
      id: schema.productImage.id,
      objectPath: schema.productImage.objectPath,
      position: schema.productImage.position,
      productId: schema.productImage.productId,
      size: schema.productImage.size,
      url: schema.productImage.url,
    })
    .from(schema.productImage)
    .where(inArray(schema.productImage.productId, [...productById.keys()]))
    .orderBy(asc(schema.productImage.position), asc(schema.productImage.id));
  for (const row of rows) {
    const product = productById.get(row.productId);
    if (!product) continue;
    const canSeeDeleted =
      viewer?.isAdmin ||
      (viewer?.clerkId === product.ownerClerkId &&
        row.deletedByRole === "owner");
    if (row.deletedAt && !canSeeDeleted) continue;
    if (!row.deletedAt) product.imageCount += 1;
    product.images.push({
      contentType: row.contentType,
      createdAt: row.createdAt,
      deletedAt: row.deletedAt,
      deletedByClerkId: row.deletedByClerkId,
      deletedByRole: row.deletedByRole,
      fileName: row.fileName,
      id: row.id,
      objectPath: row.objectPath,
      position: row.position,
      size: row.size,
      url: row.url,
    });
  }
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
        hex: schema.color.hex,
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
        .map(({ hex, id, name, slug }) => ({ hex, id, name, slug })),
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
  actorClerkId?: string,
  collectionItemId?: number,
  options: {
    collectionId?: number;
    includePrivate?: boolean;
    ownerUserId?: number;
    viewerClerkId?: string;
  } = {},
): Promise<UserCollectionItem[]> {
  const conditions = [eq(schema.collectionItem.owned, true)];
  if (actorClerkId !== undefined) {
    conditions.push(eq(schema.user.clerkId, actorClerkId));
  }
  if (collectionItemId !== undefined) {
    conditions.push(eq(schema.collectionItem.id, collectionItemId));
  }
  if (options.collectionId !== undefined) {
    conditions.push(
      eq(schema.collectionItem.collectionId, options.collectionId),
    );
  }
  if (options.ownerUserId !== undefined) {
    conditions.push(eq(schema.collectionItem.ownerId, options.ownerUserId));
  }
  if (!options.includePrivate) {
    const publicItem = sql`(${schema.userCollection.isPrivate} = false and ${schema.collectionItem.isPrivate} = false)`;
    conditions.push(
      options.viewerClerkId
        ? sql`(${publicItem} or ${schema.user.clerkId} = ${options.viewerClerkId})`
        : publicItem,
    );
  }
  const rows = await db
    .select({
      collectionId: schema.userCollection.id,
      collectionItemId: schema.collectionItem.id,
      collectionIsPrivate: schema.userCollection.isPrivate,
      collectionName: schema.userCollection.name,
      colorEffectId: schema.colorEffect.id,
      colorEffectName: schema.colorEffect.name,
      colorEffectSlug: schema.colorEffect.slug,
      finishOptionId: schema.finishOption.id,
      installedButtonId: schema.collectionSpinner.installedButtonId,
      isPrivate: schema.collectionItem.isPrivate,
      privatedByClerkId: schema.collectionItem.privatedByClerkId,
      makerId: schema.maker.id,
      makerName: schema.maker.name,
      materialId: schema.material.id,
      materialName: schema.material.name,
      materialSlug: schema.material.slug,
      name: schema.product.name,
      ownerClerkId: schema.user.clerkId,
      ownerUserId: schema.user.id,
      productId: schema.product.id,
      productTypeName: schema.productType.name,
      sourceProductFinishOptionId:
        schema.finishOption.sourceProductFinishOptionId,
      spinnerId: schema.collectionSpinner.id,
      buttonId: schema.collectionSpinnerButton.id,
      updatedAt: schema.collectionItem.updatedAt,
    })
    .from(schema.collectionItem)
    .innerJoin(schema.user, eq(schema.collectionItem.ownerId, schema.user.id))
    .innerJoin(
      schema.userCollection,
      eq(schema.collectionItem.collectionId, schema.userCollection.id),
    )
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
    .innerJoin(schema.maker, eq(schema.product.makerId, schema.maker.id))
    .innerJoin(
      schema.productType,
      eq(schema.product.productTypeId, schema.productType.id),
    )
    .where(and(...conditions))
    .orderBy(desc(schema.collectionItem.updatedAt));
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
  const items: UserCollectionItem[] = rows.map((row) => ({
    canAdminister: Boolean(options.includePrivate),
    canEdit: Boolean(
      options.includePrivate || options.viewerClerkId === row.ownerClerkId,
    ),
    collectionIsPrivate: row.collectionIsPrivate,
    collectionId: row.collectionId,
    collectionItemId: row.collectionItemId,
    collectionName: row.collectionName,
    finishOption: row.finishOptionId
      ? (finishOptions.get(row.finishOptionId) ?? null)
      : null,
    imageCount: 0,
    images: [],
    isPrivate: row.isPrivate,
    isAdminPrivate:
      row.isPrivate &&
      row.privatedByClerkId !== null &&
      row.privatedByClerkId !== row.ownerClerkId,
    installedButtonId: row.installedButtonId,
    makerId: row.makerId,
    makerName: row.makerName,
    material:
      row.materialId && row.materialName && row.materialSlug
        ? {
            id: row.materialId,
            name: row.materialName,
            slug: row.materialSlug,
          }
        : null,
    name: row.name,
    ownerClerkId: row.ownerClerkId,
    ownerUserId: row.ownerUserId,
    productId: row.productId,
    productTypeName: row.productTypeName,
    productTypeSlug: row.spinnerId ? "spinner" : "spinner-button",
    productImages: [],
    sourceProductFinishOptionId: row.sourceProductFinishOptionId,
  }));
  await loadCollectionImages(
    db,
    items,
    options.viewerClerkId,
    options.includePrivate,
  );
  return items;
}

async function loadCollectionImages(
  db: Database,
  items: UserCollectionItem[],
  viewerClerkId?: string,
  includePrivate = false,
) {
  if (!items.length) return;
  const itemById = new Map(items.map((item) => [item.collectionItemId, item]));
  const productIds = [...new Set(items.map((item) => item.productId))];
  const [ownImages, productImages] = await Promise.all([
    db
      .select()
      .from(schema.collectionItemImage)
      .where(
        inArray(schema.collectionItemImage.collectionItemId, [
          ...itemById.keys(),
        ]),
      )
      .orderBy(
        asc(schema.collectionItemImage.position),
        asc(schema.collectionItemImage.id),
      ),
    db
      .select({
        contentType: schema.productImage.contentType,
        createdAt: schema.productImage.createdAt,
        deletedAt: schema.productImage.deletedAt,
        deletedByClerkId: schema.productImage.deletedByClerkId,
        deletedByRole: schema.productImage.deletedByRole,
        fileName: schema.productImage.fileName,
        id: schema.productImage.id,
        isPrivate: schema.product.isPrivate,
        ownerClerkId: schema.product.ownerClerkId,
        objectPath: schema.productImage.objectPath,
        position: schema.productImage.position,
        productId: schema.productImage.productId,
        size: schema.productImage.size,
        url: schema.productImage.url,
      })
      .from(schema.productImage)
      .innerJoin(
        schema.product,
        eq(schema.productImage.productId, schema.product.id),
      )
      .where(inArray(schema.productImage.productId, productIds))
      .orderBy(asc(schema.productImage.position), asc(schema.productImage.id)),
  ]);
  for (const row of ownImages) {
    const item = itemById.get(row.collectionItemId);
    if (!item) continue;
    const ownerCanSee = viewerClerkId === item.ownerClerkId;
    if (
      row.deletedAt &&
      !includePrivate &&
      (!ownerCanSee || row.deletedByRole === "admin")
    )
      continue;
    if (!row.deletedAt) item.imageCount += 1;
    item.images.push(toCatalogImage(row));
  }
  for (const row of productImages) {
    if (row.deletedAt) continue;
    if (row.isPrivate && !includePrivate && row.ownerClerkId !== viewerClerkId)
      continue;
    for (const item of items) {
      if (item.productId !== row.productId) continue;
      item.productImages.push(toCatalogImage(row));
      item.imageCount += 1;
    }
  }
}

function toCatalogImage(row: {
  contentType: string;
  createdAt: Date;
  deletedAt: Date | null;
  deletedByClerkId: string | null;
  deletedByRole: "admin" | "owner" | null;
  fileName: string;
  id: number;
  objectPath: string;
  position: number;
  size: number;
  url: string;
}): CatalogImage {
  return row;
}

function privacyUpdate(input: {
  actorClerkId: string;
  actorIsAdmin: boolean;
  isPrivate: boolean;
  reason?: string;
}) {
  return input.isPrivate
    ? {
        isPrivate: true,
        privateReason: input.actorIsAdmin ? input.reason?.trim() : "",
        privatedAt: new Date(),
        privatedByClerkId: input.actorClerkId,
        updatedAt: new Date(),
      }
    : {
        isPrivate: false,
        privateReason: null,
        privatedAt: null,
        privatedByClerkId: null,
        updatedAt: new Date(),
      };
}

async function softDeleteCatalogImage(
  db: Database,
  input: {
    actorClerkId: string;
    actorIsAdmin: boolean;
    imageId: number;
    targetType: CatalogImageTargetType;
  },
) {
  const deletedAt = new Date();
  if (input.targetType === "product") {
    const [image] = await db
      .select({ ownerClerkId: schema.product.ownerClerkId })
      .from(schema.productImage)
      .innerJoin(
        schema.product,
        eq(schema.productImage.productId, schema.product.id),
      )
      .where(
        and(
          eq(schema.productImage.id, input.imageId),
          isNull(schema.productImage.deletedAt),
        ),
      )
      .limit(1);
    if (
      !image ||
      (!input.actorIsAdmin && image.ownerClerkId !== input.actorClerkId)
    )
      throw new Error("Image does not exist.");
    await db
      .update(schema.productImage)
      .set({
        deletedAt,
        deletedByClerkId: input.actorClerkId,
        deletedByRole: input.actorIsAdmin ? "admin" : "owner",
      })
      .where(eq(schema.productImage.id, input.imageId));
    return;
  }
  const [image] = await db
    .select({ ownerClerkId: schema.user.clerkId })
    .from(schema.collectionItemImage)
    .innerJoin(
      schema.collectionItem,
      eq(schema.collectionItemImage.collectionItemId, schema.collectionItem.id),
    )
    .innerJoin(schema.user, eq(schema.collectionItem.ownerId, schema.user.id))
    .where(
      and(
        eq(schema.collectionItemImage.id, input.imageId),
        isNull(schema.collectionItemImage.deletedAt),
      ),
    )
    .limit(1);
  if (
    !image ||
    (!input.actorIsAdmin && image.ownerClerkId !== input.actorClerkId)
  )
    throw new Error("Image does not exist.");
  await db
    .update(schema.collectionItemImage)
    .set({
      deletedAt,
      deletedByClerkId: input.actorClerkId,
      deletedByRole: input.actorIsAdmin ? "admin" : "owner",
    })
    .where(eq(schema.collectionItemImage.id, input.imageId));
}

async function restoreCatalogImage(
  db: Database,
  input: {
    actorClerkId: string;
    actorIsAdmin: boolean;
    imageId: number;
    targetType: CatalogImageTargetType;
  },
) {
  if (input.targetType === "product") {
    const [image] = await db
      .select({
        deletedByClerkId: schema.productImage.deletedByClerkId,
        deletedByRole: schema.productImage.deletedByRole,
        ownerClerkId: schema.product.ownerClerkId,
      })
      .from(schema.productImage)
      .innerJoin(
        schema.product,
        eq(schema.productImage.productId, schema.product.id),
      )
      .where(
        and(
          eq(schema.productImage.id, input.imageId),
          isNotNull(schema.productImage.deletedAt),
        ),
      )
      .limit(1);
    assertCanRestoreImage(image, input);
    await db
      .update(schema.productImage)
      .set({ deletedAt: null, deletedByClerkId: null, deletedByRole: null })
      .where(eq(schema.productImage.id, input.imageId));
    return;
  }
  const [image] = await db
    .select({
      deletedByClerkId: schema.collectionItemImage.deletedByClerkId,
      deletedByRole: schema.collectionItemImage.deletedByRole,
      ownerClerkId: schema.user.clerkId,
    })
    .from(schema.collectionItemImage)
    .innerJoin(
      schema.collectionItem,
      eq(schema.collectionItemImage.collectionItemId, schema.collectionItem.id),
    )
    .innerJoin(schema.user, eq(schema.collectionItem.ownerId, schema.user.id))
    .where(
      and(
        eq(schema.collectionItemImage.id, input.imageId),
        isNotNull(schema.collectionItemImage.deletedAt),
      ),
    )
    .limit(1);
  assertCanRestoreImage(image, input);
  await db
    .update(schema.collectionItemImage)
    .set({ deletedAt: null, deletedByClerkId: null, deletedByRole: null })
    .where(eq(schema.collectionItemImage.id, input.imageId));
}

function assertCanRestoreImage(
  image:
    | {
        deletedByClerkId: string | null;
        deletedByRole: "admin" | "owner" | null;
        ownerClerkId: string;
      }
    | undefined,
  actor: { actorClerkId: string; actorIsAdmin: boolean },
) {
  if (
    !image ||
    (!actor.actorIsAdmin &&
      (image.ownerClerkId !== actor.actorClerkId ||
        image.deletedByRole === "admin" ||
        image.deletedByClerkId !== actor.actorClerkId))
  ) {
    throw new Error("Image does not exist.");
  }
}

async function listCatalogImageTrash(
  db: Database,
  actor: { actorClerkId: string; actorIsAdmin: boolean },
): Promise<CatalogImageTrashItem[]> {
  const [products, collectionItems] = await Promise.all([
    db
      .select({
        contentType: schema.productImage.contentType,
        createdAt: schema.productImage.createdAt,
        deletedAt: schema.productImage.deletedAt,
        deletedByClerkId: schema.productImage.deletedByClerkId,
        deletedByRole: schema.productImage.deletedByRole,
        fileName: schema.productImage.fileName,
        id: schema.productImage.id,
        objectPath: schema.productImage.objectPath,
        ownerClerkId: schema.product.ownerClerkId,
        position: schema.productImage.position,
        size: schema.productImage.size,
        targetId: schema.product.id,
        targetName: schema.product.name,
        url: schema.productImage.url,
      })
      .from(schema.productImage)
      .innerJoin(
        schema.product,
        eq(schema.productImage.productId, schema.product.id),
      )
      .where(
        and(
          isNotNull(schema.productImage.deletedAt),
          actor.actorIsAdmin
            ? undefined
            : and(
                eq(schema.product.ownerClerkId, actor.actorClerkId),
                eq(schema.productImage.deletedByRole, "owner"),
                eq(schema.productImage.deletedByClerkId, actor.actorClerkId),
              ),
        ),
      ),
    db
      .select({
        contentType: schema.collectionItemImage.contentType,
        createdAt: schema.collectionItemImage.createdAt,
        deletedAt: schema.collectionItemImage.deletedAt,
        deletedByClerkId: schema.collectionItemImage.deletedByClerkId,
        deletedByRole: schema.collectionItemImage.deletedByRole,
        fileName: schema.collectionItemImage.fileName,
        id: schema.collectionItemImage.id,
        objectPath: schema.collectionItemImage.objectPath,
        ownerClerkId: schema.user.clerkId,
        position: schema.collectionItemImage.position,
        size: schema.collectionItemImage.size,
        targetId: schema.collectionItem.id,
        targetName: schema.product.name,
        url: schema.collectionItemImage.url,
      })
      .from(schema.collectionItemImage)
      .innerJoin(
        schema.collectionItem,
        eq(
          schema.collectionItemImage.collectionItemId,
          schema.collectionItem.id,
        ),
      )
      .innerJoin(schema.user, eq(schema.collectionItem.ownerId, schema.user.id))
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
      .where(
        and(
          isNotNull(schema.collectionItemImage.deletedAt),
          actor.actorIsAdmin
            ? undefined
            : and(
                eq(schema.user.clerkId, actor.actorClerkId),
                eq(schema.collectionItemImage.deletedByRole, "owner"),
                eq(
                  schema.collectionItemImage.deletedByClerkId,
                  actor.actorClerkId,
                ),
              ),
        ),
      ),
  ]);
  return [
    ...products.map((image) => ({ ...image, targetType: "product" as const })),
    ...collectionItems.map((image) => ({
      ...image,
      targetType: "collection_item" as const,
    })),
  ].sort(
    (a, b) => (b.deletedAt?.getTime() ?? 0) - (a.deletedAt?.getTime() ?? 0),
  );
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

async function createCollectionFinishOption(
  tx: CatalogTransaction,
  input: {
    collectionItemId: number;
    customFinish: ProductWriteFinishOption | null;
    productFinishOptionId: number | null;
    productId: number;
  },
) {
  if (
    (input.productFinishOptionId === null) ===
    (input.customFinish === null)
  ) {
    throw new Error("Select one finish option.");
  }
  if (input.productFinishOptionId !== null) {
    await copyProductFinishOption(
      tx,
      input.productId,
      input.productFinishOptionId,
      input.collectionItemId,
    );
    return;
  }

  const customFinish = input.customFinish;
  if (!customFinish) throw new Error("A finish is required.");
  await validateFinishOptions(tx, [customFinish]);
  const [option] = await tx
    .insert(schema.finishOption)
    .values({
      collectionItemId: input.collectionItemId,
      colorEffectId: customFinish.colorEffectId,
      position: 0,
    })
    .returning({ id: schema.finishOption.id });
  if (!option) throw new Error("Failed to create finish snapshot.");

  await tx.insert(schema.finishOptionFinish).values(
    customFinish.finishIds.map((finishId, position) => ({
      finishId,
      finishOptionId: option.id,
      position,
    })),
  );
  if (customFinish.colorIds.length) {
    await tx.insert(schema.finishOptionColor).values(
      customFinish.colorIds.map((colorId, position) => ({
        colorId,
        finishOptionId: option.id,
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
  db: Pick<Database, "select">,
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
    if (effect?.slug === "solid" && option.colorIds.length !== 1) {
      throw new Error("A solid finish requires exactly one color.");
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
