import type { AuditJsonObject, Database } from "@package/database";
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
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { type Actor, hasPermission } from "../../authorization.js";
import { hashLogIdentifier, loggedMutation } from "../../logging.js";
import {
  attachImages as attachStoredImages,
  lockTarget,
  selectCollectionCover as selectStoredCover,
} from "../../storage/image-records.js";
import type {
  UploadActor,
  UploadedFile,
  UploadTarget,
} from "../../storage/types.js";
import { collectionAudit, writeCollectionAudit } from "../audit/collections.js";
import type { AuditService } from "../audit/index.js";
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

export type CatalogViewer = Actor;

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
  ownerClerkId: string | null;
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
  bearing: string | null;
  buttonDiameterMm: string | null;
  compatibleButtonId: number | null;
  compatibleButtonName: string | null;
  canAdminister: boolean;
  canEdit: boolean;
  createdAt: Date;
  description: string | null;
  diameterMm: string | null;
  finishOptions: CatalogFinishOption[];
  imageCount: number;
  images: CatalogImage[];
  id: number;
  lengthMm: string | null;
  makerId: number;
  makerName: string;
  makerProductUrl: string | null;
  makerProductUrlValid: boolean;
  makerUrl: string | null;
  materials: Array<{ id: number; name: string; slug: string }>;
  name: string;
  ownerClerkId: string | null;
  isPrivate: boolean;
  isAdminPrivate: boolean;
  isOwner?: boolean;
  productTypeId: number;
  productTypeName: string;
  productTypeSlug: string;
  slug: string;
  spinDiameterMm: string | null;
  thicknessMm: string | null;
  thicknessWithButtonMm: string | null;
  updatedAt: Date;
  weightG: string | null;
  widthMm: string | null;
};

export type ProductWriteInput = {
  actor: Actor;
  description?: string | null;
  makerId: number;
  makerProductUrl?: string | null;
  finishOptions: ProductWriteFinishOption[];
  materialIds: number[];
  name: string;
  productTypeSlug: CatalogProductType;
  slug: string;
  specs: {
    bearing?: string | null;
    buttonDiameterMm?: string | null;
    compatibleButtonId?: number | null;
    diameterMm?: string | null;
    lengthMm?: string | null;
    spinDiameterMm?: string | null;
    thicknessMm?: string | null;
    thicknessWithButtonMm?: string | null;
    weightG?: string | null;
    widthMm?: string | null;
  };
};

export type CatalogService = {
  attachImages(input: {
    target: UploadTarget;
    files: UploadedFile[];
    actor: UploadActor;
    reason?: string;
  }): Promise<void>;
  selectCollectionCover(input: {
    collectionId: number;
    imageId: number | null;
    actor: UploadActor;
    reason?: string;
  }): Promise<void>;
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
  listImageTrash(input: { actor: Actor }): Promise<CatalogImageTrashItem[]>;
  restoreImage(input: {
    actor: Actor;
    imageId: number;
    reason?: string;
    targetType: CatalogImageTargetType;
  }): Promise<void>;
  softDeleteImage(input: {
    actor: Actor;
    imageId: number;
    reason?: string;
    targetType: CatalogImageTargetType;
  }): Promise<void>;
  setVisibility(input: {
    actor: Actor;
    isPrivate: boolean;
    productId: number;
    reason?: string;
  }): Promise<void>;
  setMakerProductUrlValidity(input: {
    makerProductUrlValid: boolean;
    productId: number;
  }): Promise<void>;
  updateProduct(
    input: ProductWriteInput & { productId: number },
  ): Promise<CatalogProduct>;
};

export type UserCollectionItem = {
  bearing: string | null;
  bearingOverride: string | null;
  canAdminister: boolean;
  canEdit: boolean;
  collectionIsPrivate: boolean;
  collectionId: number;
  collectionName: string;
  collectionItemId: number;
  displayName: string;
  description: string | null;
  descriptionOverride: string | null;
  finishOption: CatalogFinishOption | null;
  imageCount: number;
  images: CatalogImage[];
  isPrivate: boolean;
  isAdminPrivate: boolean;
  isOwner?: boolean;
  installedButtonId: number | null;
  makerId: number;
  makerName: string;
  makerUrl: string | null;
  material: CatalogLookup | null;
  name: string;
  ownerClerkId: string;
  ownerUsername: string | null;
  ownerUserId: number;
  productId: number;
  productSlug: string;
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
  canAdminister?: boolean;
  canEdit?: boolean;
  coverImage: CatalogImage | null;
  coverImages: CatalogImage[];
  createdAt: Date;
  description: string | null;
  id: number;
  isAdminPrivate: boolean;
  isOwner?: boolean;
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
    actor: Actor;
    bearing?: string | null;
    buttonCustomFinish: ProductWriteFinishOption | null;
    buttonFinishOptionId: number | null;
    buttonMaterialId: number | null;
    buttonProductId: number | null;
    spinnerFinishOptionId: number | null;
    spinnerCustomFinish: ProductWriteFinishOption | null;
    spinnerMaterialId: number;
    spinnerProductId: number;
    collectionId?: number | null;
    displayName: string;
    description?: string | null;
    newCollection?: CollectionWriteInput | null;
  }): Promise<{ buttonItemId: number | null; spinnerItemId: number }>;
  addSpinnerButton(input: {
    actor: Actor;
    customFinish: ProductWriteFinishOption | null;
    finishOptionId: number | null;
    materialId: number;
    productId: number;
    collectionId?: number | null;
    displayName: string;
    description?: string | null;
    newCollection?: CollectionWriteInput | null;
  }): Promise<number>;
  createCollection(
    input: CollectionWriteInput & {
      actor: Actor;
    },
  ): Promise<UserCollectionSummary>;
  countOwnedProducts(input: {
    actorClerkId: string;
    productIds: number[];
  }): Promise<Record<number, number>>;
  getOwnedItem(
    actor: Actor,
    collectionItemId: number,
  ): Promise<UserCollectionItem | null>;
  getDefaultCollectionName(actorClerkId: string): Promise<string>;
  getOwnedCollection(
    actor: Actor,
    collectionId: number,
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
  listOwned(actor: Actor, collectionId?: number): Promise<UserCollectionItem[]>;
  listOwnedCollections(actor: Actor): Promise<UserCollectionSummary[]>;
  listProductItems(
    productId: number,
    viewer?: CatalogViewer,
  ): Promise<UserCollectionItem[]>;
  listOwners(viewer?: CatalogViewer): Promise<PublicCollectionOwner[]>;
  setCollectionVisibility(input: {
    actor: Actor;
    collectionId: number;
    isPrivate: boolean;
    reason?: string;
  }): Promise<void>;
  setItemVisibility(input: {
    actor: Actor;
    collectionItemId: number;
    isPrivate: boolean;
    reason?: string;
  }): Promise<void>;
  updateItem(input: {
    actor: Actor;
    bearing?: string | null;
    collectionId?: number;
    collectionItemId: number;
    customFinish: ProductWriteFinishOption | null;
    finishOptionId: number | null;
    displayName: string;
    description?: string | null;
    installedButton?: {
      collectionItemId: number;
      customFinish: ProductWriteFinishOption | null;
      finishOptionId: number | null;
      materialId: number;
    } | null;
    materialId: number;
    reason?: string;
  }): Promise<void>;
  updateCollection(
    input: CollectionWriteInput & {
      actor: Actor;
      collectionId: number;
    },
  ): Promise<UserCollectionSummary>;
};

export function createCatalogService(
  db: Database,
  logger: Logger,
  users?: UsersService,
  audit?: AuditService,
): CatalogService {
  return {
    async attachImages(input) {
      const dependencies = requireCollectionAudit(
        users,
        audit,
        input.target.type,
      );
      const actorUser = dependencies
        ? await dependencies.users.getByClerkId(input.actor.clerkId)
        : null;
      if (dependencies && !actorUser)
        throw new Error("Image target does not exist.");
      await loggedMutation(
        logger,
        loggerMessages.database.catalog.attachImages,
        () =>
          db.transaction(async (tx) => {
            await lockTarget(tx, input.target);
            const context = await collectionImageTargetContext(
              tx,
              input.target,
            );
            const before = await collectionImageState(tx, input.target);
            await attachStoredImages(tx, input);
            if (context) {
              const after = await collectionImageState(tx, input.target);
              if (!dependencies || !actorUser)
                throw new Error("Collection audit is not configured.");
              await writeCollectionAudit(dependencies.audit, tx, {
                actor: input.actor,
                actorUser,
                after,
                before,
                definition:
                  input.target.type === "collection_item"
                    ? collectionAudit.imageAdded
                    : before.currentImageId === null
                      ? collectionAudit.coverAdded
                      : collectionAudit.coverReplaced,
                ownerUserId: context.ownerUserId,
                reason: input.reason,
                targetId: input.target.id,
              });
            }
          }),
        actorAttributes(input.actor.clerkId),
      );
    },
    async selectCollectionCover(input) {
      const dependencies = requireCollectionAudit(users, audit, "collection");
      if (!dependencies) throw new Error("Collection audit is not configured.");
      const actorUser = await dependencies.users.getByClerkId(
        input.actor.clerkId,
      );
      if (!actorUser) throw new Error("Collection does not exist.");
      await loggedMutation(
        logger,
        loggerMessages.database.catalog.selectCollectionCover,
        () =>
          db.transaction(async (tx) => {
            const context = await collectionImageTargetContext(tx, {
              id: input.collectionId,
              type: "collection",
            });
            if (!context) throw new Error("Collection does not exist.");
            const before = await collectionImageState(tx, {
              id: input.collectionId,
              type: "collection",
            });
            await selectStoredCover(tx, input);
            await writeCollectionAudit(dependencies.audit, tx, {
              actor: input.actor,
              actorUser,
              after: await collectionImageState(tx, {
                id: input.collectionId,
                type: "collection",
              }),
              before,
              definition:
                input.imageId === null
                  ? collectionAudit.coverCleared
                  : collectionAudit.coverSelected,
              ownerUserId: context.ownerUserId,
              reason: input.reason,
              targetId: input.collectionId,
            });
          }),
        actorAttributes(input.actor.clerkId),
      );
    },
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
                ...(input.description !== undefined
                  ? {
                      description: normalizeOptionalDescription(
                        input.description,
                      ),
                    }
                  : {}),
                makerId: input.makerId,
                ...(input.makerProductUrl !== undefined
                  ? {
                      makerProductUrl: normalizeOptionalUrl(
                        input.makerProductUrl,
                      ),
                      makerProductUrlValid: true,
                    }
                  : {}),
                name: input.name,
                ownerClerkId: input.actor.clerkId,
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
            input.actor,
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
      if (input.targetType === "product") {
        await restoreCatalogImage(db, input);
        return;
      }
      const dependencies = requireCollectionAudit(
        users,
        audit,
        "collection_item",
      );
      if (!dependencies) throw new Error("Collection audit is not configured.");
      const actorUser = await dependencies.users.getByClerkId(
        input.actor.clerkId,
      );
      if (!actorUser) throw new Error("Image does not exist.");
      await db.transaction(async (tx) => {
        const context = await collectionItemImageContext(tx, input.imageId);
        await restoreCatalogImage(tx, input);
        if (!context) throw new Error("Image does not exist.");
        await writeCollectionAudit(dependencies.audit, tx, {
          actor: input.actor,
          actorUser,
          after: { deleted: false, imageId: input.imageId },
          before: { deleted: true, imageId: input.imageId },
          definition: collectionAudit.imageRestored,
          ownerUserId: context.ownerUserId,
          reason: input.reason,
          targetId: context.collectionItemId,
        });
      });
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
        (product.ownerClerkId !== input.actor.clerkId &&
          !hasPermission(input.actor, "products.manage"))
      ) {
        throw new Error("Product does not exist.");
      }
      const actorIsModerating =
        product.ownerClerkId !== input.actor.clerkId &&
        hasPermission(input.actor, "products.manage");
      if (
        !input.isPrivate &&
        product.privatedByClerkId &&
        product.privatedByClerkId !== input.actor.clerkId &&
        !actorIsModerating
      ) {
        throw new Error("Product is private by an administrator.");
      }
      if (actorIsModerating && input.isPrivate && !input.reason?.trim()) {
        throw new Error("A privacy reason is required.");
      }
      await db
        .update(schema.product)
        .set(
          privacyUpdate({
            actorClerkId: input.actor.clerkId,
            actorIsModerating,
            isPrivate: input.isPrivate,
            reason: input.reason,
          }),
        )
        .where(eq(schema.product.id, input.productId));
    },
    async setMakerProductUrlValidity(input) {
      await logger.operation(
        loggerMessages.database.catalog.setMakerProductUrlValidity,
        async () => {
          await db
            .update(schema.product)
            .set({ makerProductUrlValid: input.makerProductUrlValid })
            .where(eq(schema.product.id, input.productId));
        },
        {
          attributes: {
            makerProductUrlValid: input.makerProductUrlValid,
            productId: input.productId,
          },
        },
      );
    },
    async softDeleteImage(input) {
      if (input.targetType === "product") {
        await softDeleteCatalogImage(db, input);
        return;
      }
      const dependencies = requireCollectionAudit(
        users,
        audit,
        "collection_item",
      );
      if (!dependencies) throw new Error("Collection audit is not configured.");
      const actorUser = await dependencies.users.getByClerkId(
        input.actor.clerkId,
      );
      if (!actorUser) throw new Error("Image does not exist.");
      await db.transaction(async (tx) => {
        if (!(await softDeleteCatalogImage(tx, input))) return;
        const context = await collectionItemImageContext(tx, input.imageId);
        if (!context) throw new Error("Image does not exist.");
        await writeCollectionAudit(dependencies.audit, tx, {
          actor: input.actor,
          actorUser,
          after: { deleted: true, imageId: input.imageId },
          before: { deleted: false, imageId: input.imageId },
          definition: collectionAudit.imageDeleted,
          ownerUserId: context.ownerUserId,
          reason: input.reason,
          targetId: context.collectionItemId,
        });
      });
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
                makerProductUrl: schema.product.makerProductUrl,
                makerProductUrlValid: schema.product.makerProductUrlValid,
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
              existing.ownerClerkId !== input.actor.clerkId &&
              !hasPermission(input.actor, "products.manage")
            ) {
              throw new Error("Product does not exist.");
            }
            const makerProductUrl =
              input.makerProductUrl === undefined
                ? undefined
                : normalizeOptionalUrl(input.makerProductUrl);

            await tx
              .update(schema.product)
              .set({
                ...(input.description !== undefined
                  ? {
                      description: normalizeOptionalDescription(
                        input.description,
                      ),
                    }
                  : {}),
                makerId: input.makerId,
                ...(makerProductUrl !== undefined
                  ? {
                      makerProductUrl,
                      makerProductUrlValid:
                        makerProductUrl !==
                        normalizeOptionalUrl(existing.makerProductUrl)
                          ? true
                          : existing.makerProductUrlValid,
                    }
                  : {}),
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
            input.actor,
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
  audit: AuditService,
  logger: Logger,
): CollectionsService {
  return {
    async createCollection(input) {
      return await logger.operation(
        loggerMessages.database.collections.create,
        async () => {
          const owner = await users.ensure({ clerkId: input.actor.clerkId });
          const collectionId = await db.transaction(async (tx) => {
            const id = await insertCollection(tx, owner.id, input);
            await writeCollectionAudit(audit, tx, {
              actor: input.actor,
              actorUser: owner,
              after: {
                id,
                isPrivate: input.isPrivate,
                ...validatedCollectionValues(input),
              },
              definition: collectionAudit.collectionCreated,
              ownerUserId: owner.id,
              targetId: id,
            });
            return id;
          });
          const collection = (
            await queryCollections(db, {
              collectionId,
              includePrivate: true,
              ownerUserId: owner.id,
              viewerClerkId: input.actor.clerkId,
              viewerCanManage: false,
            })
          )[0];
          if (!collection) throw new Error("Failed to load collection.");
          return collection;
        },
        actorAttributes(input.actor.clerkId),
      );
    },
    async addSpinner(input) {
      return await logger.operation(
        loggerMessages.database.collections.addSpinner,
        async () => {
          const owner = await users.ensure({ clerkId: input.actor.clerkId });
          return await db.transaction(async (tx) => {
            const resolvedCollection = await resolveCollectionForWrite(tx, {
              collectionId: input.collectionId ?? null,
              newCollection: input.newCollection ?? null,
              ownerId: owner.id,
            });
            const collectionId = resolvedCollection.id;
            if (resolvedCollection.created) {
              await writeCollectionAudit(audit, tx, {
                actor: input.actor,
                actorUser: owner,
                after: {
                  id: collectionId,
                  isPrivate: resolvedCollection.created.isPrivate,
                  ...validatedCollectionValues(resolvedCollection.created),
                },
                definition: collectionAudit.collectionCreated,
                ownerUserId: owner.id,
                targetId: collectionId,
              });
            }
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
              await writeCollectionAudit(audit, tx, {
                actor: input.actor,
                actorUser: owner,
                after: {
                  collectionId,
                  id: buttonItem.id,
                  materialId: input.buttonMaterialId,
                },
                definition: collectionAudit.itemCreated,
                ownerUserId: owner.id,
                targetId: buttonItem.id,
              });
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
                ...(input.description !== undefined
                  ? {
                      description: normalizeOptionalDescription(
                        input.description,
                      ),
                    }
                  : {}),
                displayName: input.displayName,
                materialId: input.spinnerMaterialId,
                ownerId: owner.id,
              })
              .returning({ id: schema.collectionItem.id });
            if (!spinnerItem) throw new Error("Failed to create spinner item.");
            await tx.insert(schema.collectionSpinner).values({
              ...(input.bearing !== undefined
                ? { bearing: normalizeOptionalText(input.bearing) }
                : {}),
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
            await writeCollectionAudit(audit, tx, {
              actor: input.actor,
              actorUser: owner,
              after: {
                collectionId,
                description: normalizeOptionalDescription(input.description),
                displayName: input.displayName,
                id: spinnerItem.id,
                installedButtonId: buttonItemId,
                materialId: input.spinnerMaterialId,
              },
              definition: collectionAudit.itemCreated,
              ownerUserId: owner.id,
              targetId: spinnerItem.id,
            });
            return { buttonItemId, spinnerItemId: spinnerItem.id };
          });
        },
        actorAttributes(input.actor.clerkId, {
          buttonProductId: input.buttonProductId,
          spinnerProductId: input.spinnerProductId,
        }),
      );
    },
    async addSpinnerButton(input) {
      return await logger.operation(
        loggerMessages.database.collections.addSpinnerButton,
        async () => {
          const owner = await users.ensure({ clerkId: input.actor.clerkId });
          return await db.transaction(async (tx) => {
            const resolvedCollection = await resolveCollectionForWrite(tx, {
              collectionId: input.collectionId ?? null,
              newCollection: input.newCollection ?? null,
              ownerId: owner.id,
            });
            const collectionId = resolvedCollection.id;
            if (resolvedCollection.created) {
              await writeCollectionAudit(audit, tx, {
                actor: input.actor,
                actorUser: owner,
                after: {
                  id: collectionId,
                  isPrivate: resolvedCollection.created.isPrivate,
                  ...validatedCollectionValues(resolvedCollection.created),
                },
                definition: collectionAudit.collectionCreated,
                ownerUserId: owner.id,
                targetId: collectionId,
              });
            }
            await assertProductMaterial(tx, input.productId, input.materialId);
            const [item] = await tx
              .insert(schema.collectionItem)
              .values({
                collectionId,
                ...(input.description !== undefined
                  ? {
                      description: normalizeOptionalDescription(
                        input.description,
                      ),
                    }
                  : {}),
                displayName: input.displayName,
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
            await writeCollectionAudit(audit, tx, {
              actor: input.actor,
              actorUser: owner,
              after: {
                collectionId,
                description: normalizeOptionalDescription(input.description),
                displayName: input.displayName,
                id: item.id,
                materialId: input.materialId,
              },
              definition: collectionAudit.itemCreated,
              ownerUserId: owner.id,
              targetId: item.id,
            });
            return item.id;
          });
        },
        actorAttributes(input.actor.clerkId, { productId: input.productId }),
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
    async getOwnedItem(actor, collectionItemId) {
      const canManage = hasPermission(actor, "collections.manage");
      return (
        (
          await queryOwnedItems(
            db,
            canManage ? undefined : actor.clerkId,
            collectionItemId,
            {
              includePrivate: true,
              viewerClerkId: actor.clerkId,
              viewerCanManage: canManage,
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
    async getOwnedCollection(actor, collectionId) {
      const canManage = hasPermission(actor, "collections.manage");
      const owner = await users.getByClerkId(actor.clerkId);
      if (!owner && !canManage) return null;
      return (
        (
          await queryCollections(db, {
            collectionId,
            includePrivate: true,
            ownerUserId: canManage ? undefined : owner?.id,
            viewerClerkId: actor.clerkId,
            viewerCanManage: canManage,
          })
        )[0] ?? null
      );
    },
    async getPublicCollection({ collectionId, ownerUserId, viewer }) {
      return (
        (
          await queryCollections(db, {
            collectionId,
            includePrivate: hasPermission(viewer, "collections.manage"),
            ownerUserId,
            viewerClerkId: viewer?.clerkId,
            viewerCanManage: hasPermission(viewer, "collections.manage"),
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
            includePrivate: hasPermission(viewer, "collections.manage"),
            ownerUserId,
            viewerClerkId: viewer?.clerkId,
            viewerCanManage: hasPermission(viewer, "collections.manage"),
          })
        )[0] ?? null
      );
    },
    async listOwned(actor, collectionId) {
      return await queryOwnedItems(db, actor.clerkId, undefined, {
        collectionId,
        includePrivate: true,
        viewerClerkId: actor.clerkId,
        viewerCanManage: hasPermission(actor, "collections.manage"),
      });
    },
    async listOwnedCollections(actor) {
      const owner = await users.getByClerkId(actor.clerkId);
      if (!owner) return [];
      return await queryCollections(db, {
        includePrivate: true,
        ownerUserId: owner.id,
        viewerClerkId: actor.clerkId,
        viewerCanManage: hasPermission(actor, "collections.manage"),
      });
    },
    async listProductItems(productId, viewer) {
      return await queryOwnedItems(db, undefined, undefined, {
        productId,
        publicOnly: true,
        viewerClerkId: viewer?.clerkId,
        viewerCanManage: hasPermission(viewer, "collections.manage"),
      });
    },
    async listOwners(viewer) {
      const [items, collections] = await Promise.all([
        queryOwnedItems(db, undefined, undefined, {
          publicOnly: true,
          viewerClerkId: viewer?.clerkId,
          viewerCanManage: hasPermission(viewer, "collections.manage"),
        }),
        queryCollections(db, {
          publicOnly: true,
          viewerClerkId: viewer?.clerkId,
          viewerCanManage: hasPermission(viewer, "collections.manage"),
        }),
      ]);
      const ownerIds = [
        ...new Set(collections.map(({ ownerUserId }) => ownerUserId)),
      ];
      if (!ownerIds.length) return [];
      const owners = await db
        .select({
          clerkId: schema.user.clerkId,
          userId: schema.user.id,
          username: schema.user.username,
        })
        .from(schema.user)
        .where(inArray(schema.user.id, ownerIds));
      return owners
        .map((owner) => {
          const ownerItems = items.filter(
            ({ ownerUserId }) => ownerUserId === owner.userId,
          );
          return {
            collections: collections.filter(
              ({ ownerUserId }) => ownerUserId === owner.userId,
            ),
            itemCount: ownerItems.length,
            items: ownerItems,
            userId: owner.userId,
            username: owner.username ?? owner.clerkId,
          };
        })
        .sort((left, right) => left.username.localeCompare(right.username));
    },
    async setCollectionVisibility(input) {
      const canManage = hasPermission(input.actor, "collections.manage");
      const actorUser = await users.getByClerkId(input.actor.clerkId);
      if (!actorUser) throw new Error("Collection does not exist.");
      await db.transaction(async (tx) => {
        const [collection] = await tx
          .select({
            description: schema.userCollection.description,
            isPrivate: schema.userCollection.isPrivate,
            name: schema.userCollection.name,
            ownerId: schema.userCollection.ownerId,
            privatedByClerkId: schema.userCollection.privatedByClerkId,
          })
          .from(schema.userCollection)
          .where(eq(schema.userCollection.id, input.collectionId))
          .limit(1);
        if (
          !collection ||
          (collection.ownerId !== actorUser.id && !canManage)
        ) {
          throw new Error("Collection does not exist.");
        }
        const actorIsModerating = collection.ownerId !== actorUser.id;
        if (
          !input.isPrivate &&
          collection.privatedByClerkId &&
          collection.privatedByClerkId !== input.actor.clerkId &&
          !actorIsModerating
        ) {
          throw new Error("Collection is private by an administrator.");
        }
        const before = {
          description: collection.description,
          id: input.collectionId,
          isPrivate: collection.isPrivate,
          name: collection.name,
        };
        await tx
          .update(schema.userCollection)
          .set(
            privacyUpdate({
              actorClerkId: input.actor.clerkId,
              actorIsModerating,
              isPrivate: input.isPrivate,
              reason: input.reason,
            }),
          )
          .where(eq(schema.userCollection.id, input.collectionId));
        await writeCollectionAudit(audit, tx, {
          actor: input.actor,
          actorUser,
          after: { ...before, isPrivate: input.isPrivate },
          before,
          definition: collectionAudit.collectionVisibilityChanged,
          ownerUserId: collection.ownerId,
          reason: input.reason,
          targetId: input.collectionId,
        });
      });
    },
    async updateCollection(input) {
      return await logger.operation(
        loggerMessages.database.collections.update,
        async () => {
          const canManage = hasPermission(input.actor, "collections.manage");
          const actorUser = await users.getByClerkId(input.actor.clerkId);
          if (!actorUser) throw new Error("Collection does not exist.");
          const current = await db.transaction(async (tx) => {
            const [row] = await tx
              .select({
                description: schema.userCollection.description,
                isPrivate: schema.userCollection.isPrivate,
                name: schema.userCollection.name,
                ownerId: schema.userCollection.ownerId,
                privatedByClerkId: schema.userCollection.privatedByClerkId,
              })
              .from(schema.userCollection)
              .where(eq(schema.userCollection.id, input.collectionId))
              .limit(1);
            if (!row || (row.ownerId !== actorUser.id && !canManage)) {
              throw new Error("Collection does not exist.");
            }
            const actorIsModerating = row.ownerId !== actorUser.id;
            if (
              !input.isPrivate &&
              row.privatedByClerkId &&
              row.privatedByClerkId !== input.actor.clerkId &&
              !actorIsModerating
            ) {
              throw new Error("Collection is private by an administrator.");
            }
            const values = validatedCollectionValues(input);
            const before = {
              description: row.description,
              id: input.collectionId,
              isPrivate: row.isPrivate,
              name: row.name,
            };
            await tx
              .update(schema.userCollection)
              .set({
                ...values,
                ...(input.isPrivate === row.isPrivate
                  ? { updatedAt: new Date() }
                  : privacyUpdate({
                      actorClerkId: input.actor.clerkId,
                      actorIsModerating,
                      isPrivate: input.isPrivate,
                      reason: input.reason,
                    })),
              })
              .where(eq(schema.userCollection.id, input.collectionId));
            const after = {
              description: values.description,
              id: input.collectionId,
              isPrivate: input.isPrivate,
              name: values.name,
            };
            await writeCollectionAudit(audit, tx, {
              actor: input.actor,
              actorUser,
              after,
              before,
              definition: collectionAudit.collectionUpdated,
              ownerUserId: row.ownerId,
              reason: input.reason,
              targetId: input.collectionId,
            });
            if (input.isPrivate !== row.isPrivate) {
              await writeCollectionAudit(audit, tx, {
                actor: input.actor,
                actorUser,
                after,
                before,
                definition: collectionAudit.collectionVisibilityChanged,
                ownerUserId: row.ownerId,
                reason: input.reason,
                targetId: input.collectionId,
              });
            }
            return row;
          });
          const collection = (
            await queryCollections(db, {
              collectionId: input.collectionId,
              includePrivate: true,
              ownerUserId: current.ownerId,
              viewerClerkId: input.actor.clerkId,
              viewerCanManage: canManage,
            })
          )[0];
          if (!collection) throw new Error("Failed to load collection.");
          return collection;
        },
        actorAttributes(input.actor.clerkId, {
          collectionId: input.collectionId,
        }),
      );
    },
    async setItemVisibility(input) {
      const canManage = hasPermission(input.actor, "collections.manage");
      const actorUser = await users.getByClerkId(input.actor.clerkId);
      if (!actorUser) throw new Error("Collection item does not exist.");
      await db.transaction(async (tx) => {
        const [item] = await tx
          .select({
            isPrivate: schema.collectionItem.isPrivate,
            ownerId: schema.collectionItem.ownerId,
            privatedByClerkId: schema.collectionItem.privatedByClerkId,
          })
          .from(schema.collectionItem)
          .where(eq(schema.collectionItem.id, input.collectionItemId))
          .limit(1);
        if (!item || (item.ownerId !== actorUser.id && !canManage))
          throw new Error("Collection item does not exist.");
        const actorIsModerating = item.ownerId !== actorUser.id;
        if (
          !input.isPrivate &&
          item.privatedByClerkId &&
          item.privatedByClerkId !== input.actor.clerkId &&
          !actorIsModerating
        ) {
          throw new Error("Collection item is private by an administrator.");
        }
        const before = {
          id: input.collectionItemId,
          isPrivate: item.isPrivate,
        };
        await tx
          .update(schema.collectionItem)
          .set(
            privacyUpdate({
              actorClerkId: input.actor.clerkId,
              actorIsModerating,
              isPrivate: input.isPrivate,
              reason: input.reason,
            }),
          )
          .where(eq(schema.collectionItem.id, input.collectionItemId));
        await writeCollectionAudit(audit, tx, {
          actor: input.actor,
          actorUser,
          after: { ...before, isPrivate: input.isPrivate },
          before,
          definition: collectionAudit.itemVisibilityChanged,
          ownerUserId: item.ownerId,
          reason: input.reason,
          targetId: input.collectionItemId,
        });
      });
    },
    async updateItem(input) {
      await logger.operation(
        loggerMessages.database.collections.updateItem,
        async () => {
          const canManage = hasPermission(input.actor, "collections.manage");
          const owner = await users.getByClerkId(input.actor.clerkId);
          if (!owner) throw new Error("Collection item does not exist.");
          await db.transaction(async (tx) => {
            const [item] = await tx
              .select({
                buttonProductId:
                  schema.collectionSpinnerButton.productSpinnerButtonId,
                collectionId: schema.collectionItem.collectionId,
                description: schema.collectionItem.description,
                displayName: schema.collectionItem.displayName,
                installedButtonId: schema.collectionSpinner.installedButtonId,
                isPrivate: schema.collectionItem.isPrivate,
                materialId: schema.collectionItem.materialId,
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
                  canManage
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
            const before = {
              collectionId: item.collectionId,
              description: item.description,
              displayName: item.displayName,
              id: input.collectionItemId,
              installedButtonId: item.installedButtonId,
              isPrivate: item.isPrivate,
              materialId: item.materialId,
            };

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
            await tx
              .update(schema.collectionItem)
              .set({
                ...(input.description !== undefined
                  ? {
                      description: normalizeOptionalDescription(
                        input.description,
                      ),
                    }
                  : {}),
                displayName: input.displayName.trim(),
              })
              .where(eq(schema.collectionItem.id, input.collectionItemId));

            if (item.spinnerProductId !== null && input.bearing !== undefined) {
              await tx
                .update(schema.collectionSpinner)
                .set({ bearing: normalizeOptionalText(input.bearing) })
                .where(eq(schema.collectionSpinner.id, input.collectionItemId));
            }

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
                      canManage
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
            const after = {
              ...before,
              collectionId: targetCollectionId,
              description:
                input.description === undefined
                  ? item.description
                  : normalizeOptionalDescription(input.description),
              displayName: input.displayName.trim(),
              installedButtonId:
                input.installedButton === undefined
                  ? item.installedButtonId
                  : (input.installedButton?.collectionItemId ?? null),
              materialId: input.materialId,
            };
            await writeCollectionAudit(audit, tx, {
              actor: input.actor,
              actorUser: owner,
              after,
              before,
              definition: collectionAudit.itemUpdated,
              ownerUserId: item.ownerId,
              reason: input.reason,
              targetId: input.collectionItemId,
            });
            if (item.collectionId !== targetCollectionId) {
              await writeCollectionAudit(audit, tx, {
                actor: input.actor,
                actorUser: owner,
                after: { collectionId: targetCollectionId },
                before: { collectionId: item.collectionId },
                definition: collectionAudit.itemMoved,
                ownerUserId: item.ownerId,
                reason: input.reason,
                targetId: input.collectionItemId,
              });
            }
          });
        },
        actorAttributes(input.actor.clerkId, {
          collectionItemId: input.collectionItemId,
          installedButtonId: input.installedButton?.collectionItemId,
          materialId: input.materialId,
        }),
      );
    },
  };
}

async function collectionImageTargetContext(
  db: Pick<Database, "select">,
  target: UploadTarget,
): Promise<{ ownerUserId: number } | null> {
  if (target.type === "collection") {
    const [row] = await db
      .select({ ownerUserId: schema.userCollection.ownerId })
      .from(schema.userCollection)
      .where(eq(schema.userCollection.id, target.id))
      .limit(1);
    return row ?? null;
  }
  if (target.type === "collection_item") {
    const [row] = await db
      .select({ ownerUserId: schema.collectionItem.ownerId })
      .from(schema.collectionItem)
      .where(eq(schema.collectionItem.id, target.id))
      .limit(1);
    return row ?? null;
  }
  return null;
}

async function collectionImageState(
  db: Pick<Database, "select">,
  target: UploadTarget,
): Promise<AuditJsonObject> {
  if (target.type === "collection") {
    const images = await db
      .select({
        id: schema.collectionImage.id,
        isCurrent: schema.collectionImage.isCurrent,
      })
      .from(schema.collectionImage)
      .where(eq(schema.collectionImage.collectionId, target.id));
    return {
      currentImageId: images.find(({ isCurrent }) => isCurrent)?.id ?? null,
      imageIds: images.map(({ id }) => id),
    };
  }
  if (target.type === "collection_item") {
    const images = await db
      .select({ id: schema.collectionItemImage.id })
      .from(schema.collectionItemImage)
      .where(eq(schema.collectionItemImage.collectionItemId, target.id));
    return { imageIds: images.map(({ id }) => id) };
  }
  return {};
}

async function collectionItemImageContext(
  db: Pick<Database, "select">,
  imageId: number,
) {
  const [row] = await db
    .select({
      collectionItemId: schema.collectionItemImage.collectionItemId,
      ownerUserId: schema.collectionItem.ownerId,
    })
    .from(schema.collectionItemImage)
    .innerJoin(
      schema.collectionItem,
      eq(schema.collectionItemImage.collectionItemId, schema.collectionItem.id),
    )
    .where(eq(schema.collectionItemImage.id, imageId))
    .limit(1);
  return row ?? null;
}

function requireCollectionAudit(
  users: UsersService | undefined,
  audit: AuditService | undefined,
  targetType: UploadTarget["type"],
) {
  if (targetType === "product" || targetType === "resource") return null;
  if (!users || !audit) throw new Error("Collection audit is not configured.");
  return { audit, users };
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
    return {
      created: input.newCollection,
      id: await insertCollection(tx, input.ownerId, input.newCollection),
    };
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
    return { created: null, id: collection.id };
  }

  const collections = await tx
    .select({ id: schema.userCollection.id })
    .from(schema.userCollection)
    .where(eq(schema.userCollection.ownerId, input.ownerId))
    .limit(2);
  if (collections.length > 1) throw new Error("Choose a collection.");
  const existingCollection = collections[0];
  if (existingCollection) return { created: null, id: existingCollection.id };

  const [owner] = await tx
    .select({ username: schema.user.username })
    .from(schema.user)
    .where(eq(schema.user.id, input.ownerId))
    .limit(1);
  if (!owner?.username) {
    throw new Error("User profile sync is incomplete. Please retry.");
  }
  const created = {
    description: null,
    isPrivate: true,
    name: `${owner.username}'s Collection`,
  };
  return {
    created,
    id: await insertCollection(tx, input.ownerId, created),
  };
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
    publicOnly?: boolean;
    viewerClerkId?: string;
    viewerCanManage?: boolean;
  } = {},
): Promise<UserCollectionSummary[]> {
  const conditions = [];
  if (options.collectionId !== undefined) {
    conditions.push(eq(schema.userCollection.id, options.collectionId));
  }
  if (options.ownerUserId !== undefined) {
    conditions.push(eq(schema.userCollection.ownerId, options.ownerUserId));
  }
  if (options.publicOnly) {
    conditions.push(eq(schema.userCollection.isPrivate, false));
  } else if (!options.includePrivate) {
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
  const visibleRows = rows.filter(
    ({ isPrivate, ownerUserId }) =>
      (!options.publicOnly || !isPrivate) &&
      (options.ownerUserId === undefined ||
        ownerUserId === options.ownerUserId),
  );
  if (!visibleRows.length) return [];
  const collectionIds = visibleRows.map(({ id }) => id);
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
  return visibleRows.map((row) => ({
    canAdminister: Boolean(options.viewerCanManage),
    canEdit: Boolean(
      options.viewerCanManage || options.viewerClerkId === row.ownerClerkId,
    ),
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
    isOwner: options.viewerClerkId === row.ownerClerkId,
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
  if (!hasPermission(viewer, "products.manage")) {
    conditions.push(
      viewer?.clerkId
        ? sql`(${schema.product.isPrivate} = false or ${schema.product.ownerClerkId} = ${viewer.clerkId})`
        : eq(schema.product.isPrivate, false),
    );
  }

  const rows = await db
    .select({
      bearing: schema.productSpinner.bearing,
      buttonDiameterMm: schema.productSpinner.buttonDiameterMm,
      compatibleButtonId: schema.productSpinner.compatibleButtonId,
      compatibleButtonName: compatibleButtonProduct.name,
      createdAt: sql<Date>`coalesce(${schema.productSpinner.createdAt}, ${schema.productSpinnerButton.createdAt})`,
      description: schema.product.description,
      diameterMm: schema.productSpinnerButton.diameterMm,
      id: schema.product.id,
      isPrivate: schema.product.isPrivate,
      privatedByClerkId: schema.product.privatedByClerkId,
      lengthMm: schema.productSpinner.lengthMm,
      makerId: schema.maker.id,
      makerName: schema.maker.name,
      makerProductUrl: schema.product.makerProductUrl,
      makerProductUrlValid: schema.product.makerProductUrlValid,
      makerUrl: schema.maker.rootUrl,
      materialId: schema.material.id,
      materialName: schema.material.name,
      materialSlug: schema.material.slug,
      name: schema.product.name,
      ownerClerkId: schema.product.ownerClerkId,
      productTypeId: schema.productType.id,
      productTypeName: schema.productType.name,
      productTypeSlug: schema.productType.slug,
      slug: schema.product.slug,
      spinDiameterMm: schema.productSpinner.spinDiameterMm,
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
      bearing: row.bearing,
      buttonDiameterMm: row.buttonDiameterMm,
      compatibleButtonId: row.compatibleButtonId,
      compatibleButtonName: row.compatibleButtonName,
      canAdminister: hasPermission(viewer, "products.manage"),
      canEdit: Boolean(
        viewer?.clerkId === row.ownerClerkId ||
          hasPermission(viewer, "products.manage"),
      ),
      createdAt: row.createdAt,
      description: row.description,
      diameterMm: row.diameterMm,
      finishOptions: [],
      imageCount: 0,
      images: [],
      id: row.id,
      lengthMm: row.lengthMm,
      makerId: row.makerId,
      makerName: row.makerName,
      makerProductUrl: row.makerProductUrl,
      makerProductUrlValid: row.makerProductUrlValid,
      makerUrl: row.makerUrl,
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
      isOwner: viewer?.clerkId === row.ownerClerkId,
      productTypeId: row.productTypeId,
      productTypeName: row.productTypeName,
      productTypeSlug: row.productTypeSlug,
      slug: row.slug,
      spinDiameterMm: row.spinDiameterMm,
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
      hasPermission(viewer, "products.manage") ||
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
    productId?: number;
    publicOnly?: boolean;
    viewerClerkId?: string;
    viewerCanManage?: boolean;
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
  if (options.productId !== undefined) {
    conditions.push(eq(schema.product.id, options.productId));
  }
  const publicItem = sql`(${schema.userCollection.isPrivate} = false and ${schema.collectionItem.isPrivate} = false)`;
  if (options.publicOnly) {
    conditions.push(publicItem);
  } else if (!options.includePrivate) {
    conditions.push(
      options.viewerClerkId
        ? sql`(${publicItem} or ${schema.user.clerkId} = ${options.viewerClerkId})`
        : publicItem,
    );
  }
  const rows = await db
    .select({
      bearingOverride: schema.collectionSpinner.bearing,
      productBearing: schema.productSpinner.bearing,
      collectionId: schema.userCollection.id,
      collectionItemId: schema.collectionItem.id,
      collectionIsPrivate: schema.userCollection.isPrivate,
      collectionName: schema.userCollection.name,
      displayName: sql<string>`coalesce(${schema.collectionItem.displayName}, ${schema.product.name})`,
      descriptionOverride: schema.collectionItem.description,
      productDescription: schema.product.description,
      colorEffectId: schema.colorEffect.id,
      colorEffectName: schema.colorEffect.name,
      colorEffectSlug: schema.colorEffect.slug,
      finishOptionId: schema.finishOption.id,
      installedButtonId: schema.collectionSpinner.installedButtonId,
      isPrivate: schema.collectionItem.isPrivate,
      privatedByClerkId: schema.collectionItem.privatedByClerkId,
      makerId: schema.maker.id,
      makerName: schema.maker.name,
      makerUrl: schema.maker.rootUrl,
      materialId: schema.material.id,
      materialName: schema.material.name,
      materialSlug: schema.material.slug,
      name: schema.product.name,
      ownerClerkId: schema.user.clerkId,
      ownerUsername: schema.user.username,
      ownerUserId: schema.user.id,
      productId: schema.product.id,
      productSlug: schema.product.slug,
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
    .leftJoin(
      schema.productSpinner,
      eq(schema.product.id, schema.productSpinner.id),
    )
    .innerJoin(
      schema.productType,
      eq(schema.product.productTypeId, schema.productType.id),
    )
    .where(and(...conditions))
    .orderBy(desc(schema.collectionItem.updatedAt));
  const visibleRows = rows.filter(
    ({ collectionIsPrivate, isPrivate, ownerClerkId, ownerUserId }) =>
      (!options.publicOnly || (!collectionIsPrivate && !isPrivate)) &&
      (actorClerkId === undefined || ownerClerkId === actorClerkId) &&
      (options.ownerUserId === undefined ||
        ownerUserId === options.ownerUserId),
  );
  const finishOptions = await loadFinishOptionComponents(
    db,
    visibleRows.flatMap((row) =>
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
  const items: UserCollectionItem[] = visibleRows.map((row) => ({
    bearing: row.bearingOverride ?? row.productBearing,
    bearingOverride: row.bearingOverride,
    canAdminister: Boolean(options.viewerCanManage),
    canEdit: Boolean(
      options.viewerCanManage || options.viewerClerkId === row.ownerClerkId,
    ),
    collectionIsPrivate: row.collectionIsPrivate,
    collectionId: row.collectionId,
    collectionItemId: row.collectionItemId,
    collectionName: row.collectionName,
    displayName: row.displayName,
    description: row.descriptionOverride ?? row.productDescription,
    descriptionOverride: row.descriptionOverride,
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
    isOwner: options.viewerClerkId === row.ownerClerkId,
    makerId: row.makerId,
    makerName: row.makerName,
    makerUrl: row.makerUrl,
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
    ownerUsername: row.ownerUsername,
    ownerUserId: row.ownerUserId,
    productId: row.productId,
    productSlug: row.productSlug,
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
  actorIsModerating: boolean;
  isPrivate: boolean;
  reason?: string;
}) {
  return input.isPrivate
    ? {
        isPrivate: true,
        privateReason: input.actorIsModerating ? input.reason?.trim() : "",
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
  db: Pick<Database, "select" | "update">,
  input: {
    actor: Actor;
    imageId: number;
    targetType: CatalogImageTargetType;
  },
) {
  const deletedAt = new Date();
  if (input.targetType === "product") {
    const canManage = hasPermission(input.actor, "products.manage");
    const [image] = await db
      .select({
        deletedAt: schema.productImage.deletedAt,
        ownerClerkId: schema.product.ownerClerkId,
      })
      .from(schema.productImage)
      .innerJoin(
        schema.product,
        eq(schema.productImage.productId, schema.product.id),
      )
      .where(eq(schema.productImage.id, input.imageId))
      .limit(1);
    if (!image || (image.ownerClerkId !== input.actor.clerkId && !canManage))
      throw new Error("Image does not exist.");
    if (image.deletedAt) return false;
    const actorIsModerating =
      canManage && image.ownerClerkId !== input.actor.clerkId;
    await db
      .update(schema.productImage)
      .set({
        deletedAt,
        deletedByClerkId: input.actor.clerkId,
        deletedByRole: actorIsModerating ? "admin" : "owner",
      })
      .where(eq(schema.productImage.id, input.imageId));
    return true;
  }
  const [image] = await db
    .select({
      deletedAt: schema.collectionItemImage.deletedAt,
      ownerClerkId: schema.user.clerkId,
    })
    .from(schema.collectionItemImage)
    .innerJoin(
      schema.collectionItem,
      eq(schema.collectionItemImage.collectionItemId, schema.collectionItem.id),
    )
    .innerJoin(schema.user, eq(schema.collectionItem.ownerId, schema.user.id))
    .where(eq(schema.collectionItemImage.id, input.imageId))
    .limit(1);
  const canManage = hasPermission(input.actor, "collections.manage");
  if (!image || (image.ownerClerkId !== input.actor.clerkId && !canManage))
    throw new Error("Image does not exist.");
  if (image.deletedAt) return false;
  const actorIsModerating =
    canManage && image.ownerClerkId !== input.actor.clerkId;
  await db
    .update(schema.collectionItemImage)
    .set({
      deletedAt,
      deletedByClerkId: input.actor.clerkId,
      deletedByRole: actorIsModerating ? "admin" : "owner",
    })
    .where(eq(schema.collectionItemImage.id, input.imageId));
  return true;
}

async function restoreCatalogImage(
  db: Pick<Database, "select" | "update">,
  input: {
    actor: Actor;
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
    assertCanRestoreImage(image, input.actor, "products.manage");
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
  assertCanRestoreImage(image, input.actor, "collections.manage");
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
        ownerClerkId: string | null;
      }
    | undefined,
  actor: Actor,
  permission: "products.manage" | "collections.manage",
) {
  const isOwner = image?.ownerClerkId === actor.clerkId;
  const actorIsModerating = hasPermission(actor, permission) && !isOwner;
  if (
    !image ||
    (!actorIsModerating &&
      (!isOwner ||
        image.deletedByRole === "admin" ||
        image.deletedByClerkId !== actor.clerkId))
  ) {
    throw new Error("Image does not exist.");
  }
}

async function listCatalogImageTrash(
  db: Database,
  input: { actor: Actor },
): Promise<CatalogImageTrashItem[]> {
  const { actor } = input;
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
          hasPermission(actor, "products.manage")
            ? undefined
            : and(
                eq(schema.product.ownerClerkId, actor.clerkId),
                eq(schema.productImage.deletedByRole, "owner"),
                eq(schema.productImage.deletedByClerkId, actor.clerkId),
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
          hasPermission(actor, "collections.manage")
            ? undefined
            : and(
                eq(schema.user.clerkId, actor.clerkId),
                eq(schema.collectionItemImage.deletedByRole, "owner"),
                eq(schema.collectionItemImage.deletedByClerkId, actor.clerkId),
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
    ...(specs.bearing !== undefined
      ? { bearing: normalizeOptionalText(specs.bearing) }
      : {}),
    buttonDiameterMm: specs.buttonDiameterMm ?? null,
    compatibleButtonId: specs.compatibleButtonId ?? null,
    lengthMm: specs.lengthMm ?? null,
    ...(specs.spinDiameterMm !== undefined
      ? { spinDiameterMm: specs.spinDiameterMm }
      : {}),
    thicknessMm: specs.thicknessMm ?? null,
    thicknessWithButtonMm: specs.thicknessWithButtonMm ?? null,
    weightG: specs.weightG ?? null,
    widthMm: specs.widthMm ?? null,
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  return value?.trim() || null;
}

function normalizeOptionalUrl(value: string | null | undefined) {
  return value?.trim().replace(/\/+$/, "") || null;
}

function normalizeOptionalDescription(value: string | null | undefined) {
  return value?.trim() ? value : null;
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
  return actorAttributes(input.actor.clerkId, {
    finishOptionCount: input.finishOptions.length,
    materialIds: input.materialIds,
    productTypeSlug: input.productTypeSlug,
    slug: input.slug,
  });
}
