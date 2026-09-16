import type { Database } from "@package/database";
import { schema } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import { and, asc, count, eq, isNotNull, or, sql } from "drizzle-orm";
import { hashLogIdentifier } from "../../logging.js";
import type { UsersService } from "../users/index.js";

export type CatalogProductType = "spinner" | "spinner-button";

export type CatalogProduct = {
  buttonDiameterMm: string | null;
  createdAt: Date;
  diameterMm: string | null;
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
  materialIds: number[];
  name: string;
  productTypeSlug: CatalogProductType;
  slug: string;
  specs: {
    buttonDiameterMm?: string | null;
    diameterMm?: string | null;
    lengthMm?: string | null;
    thicknessMm?: string | null;
    thicknessWithButtonMm?: string | null;
    weightG?: string | null;
    widthMm?: string | null;
  };
};

export type CatalogService = {
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
  installedButtonId: number | null;
  name: string;
  productId: number;
  productTypeSlug: CatalogProductType;
};

export type CollectionsService = {
  addSpinner(input: {
    actorClerkId: string;
    buttonProductId: number | null;
    spinnerProductId: number;
  }): Promise<{ buttonItemId: number | null; spinnerItemId: number }>;
  addSpinnerButton(input: {
    actorClerkId: string;
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
  updateSpinner(input: {
    actorClerkId: string;
    collectionItemId: number;
    installedButtonId: number | null;
  }): Promise<void>;
};

export function createCatalogService(
  db: Database,
  logger: Logger,
): CatalogService {
  return {
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
    async addSpinner({ actorClerkId, buttonProductId, spinnerProductId }) {
      return await logger.operation(
        loggerMessages.database.collections.addSpinner,
        async () => {
          const owner = await users.ensure({ clerkId: actorClerkId });
          return await db.transaction(async (tx) => {
            let buttonItemId: number | null = null;
            if (buttonProductId !== null) {
              const [buttonItem] = await tx
                .insert(schema.collectionItem)
                .values({ ownerId: owner.id })
                .returning({ id: schema.collectionItem.id });
              if (!buttonItem) throw new Error("Failed to create button item.");
              await tx.insert(schema.collectionSpinnerButton).values({
                id: buttonItem.id,
                productSpinnerButtonId: buttonProductId,
              });
              buttonItemId = buttonItem.id;
            }

            const [spinnerItem] = await tx
              .insert(schema.collectionItem)
              .values({ ownerId: owner.id })
              .returning({ id: schema.collectionItem.id });
            if (!spinnerItem) throw new Error("Failed to create spinner item.");
            await tx.insert(schema.collectionSpinner).values({
              id: spinnerItem.id,
              installedButtonId: buttonItemId,
              productSpinnerId: spinnerProductId,
            });
            return { buttonItemId, spinnerItemId: spinnerItem.id };
          });
        },
        actorAttributes(actorClerkId, {
          buttonProductId,
          spinnerProductId,
        }),
      );
    },
    async addSpinnerButton({ actorClerkId, productId }) {
      return await logger.operation(
        loggerMessages.database.collections.addSpinnerButton,
        async () => {
          const owner = await users.ensure({ clerkId: actorClerkId });
          return await db.transaction(async (tx) => {
            const [item] = await tx
              .insert(schema.collectionItem)
              .values({ ownerId: owner.id })
              .returning({ id: schema.collectionItem.id });
            if (!item) throw new Error("Failed to create collection item.");
            await tx.insert(schema.collectionSpinnerButton).values({
              id: item.id,
              productSpinnerButtonId: productId,
            });
            return item.id;
          });
        },
        actorAttributes(actorClerkId, { productId }),
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
    async updateSpinner({ actorClerkId, collectionItemId, installedButtonId }) {
      await logger.operation(
        loggerMessages.database.collections.updateSpinner,
        async () => {
          const owner = await users.getByClerkId(actorClerkId);
          if (!owner) throw new Error("Collection item does not exist.");

          if (installedButtonId !== null) {
            const [button] = await db
              .select({ id: schema.collectionSpinnerButton.id })
              .from(schema.collectionSpinnerButton)
              .innerJoin(
                schema.collectionItem,
                eq(schema.collectionSpinnerButton.id, schema.collectionItem.id),
              )
              .where(
                and(
                  eq(schema.collectionSpinnerButton.id, installedButtonId),
                  eq(schema.collectionItem.ownerId, owner.id),
                  eq(schema.collectionItem.owned, true),
                ),
              )
              .limit(1);
            if (!button) throw new Error("Installed button does not exist.");
          }

          const [item] = await db
            .select({ id: schema.collectionSpinner.id })
            .from(schema.collectionSpinner)
            .innerJoin(
              schema.collectionItem,
              eq(schema.collectionSpinner.id, schema.collectionItem.id),
            )
            .where(
              and(
                eq(schema.collectionSpinner.id, collectionItemId),
                eq(schema.collectionItem.ownerId, owner.id),
                eq(schema.collectionItem.owned, true),
              ),
            )
            .limit(1);
          if (!item) throw new Error("Collection item does not exist.");

          await db
            .update(schema.collectionSpinner)
            .set({ installedButtonId })
            .where(eq(schema.collectionSpinner.id, collectionItemId));
        },
        actorAttributes(actorClerkId, {
          collectionItemId,
          installedButtonId,
        }),
      );
    },
  };
}

async function queryProducts(
  db: Database,
  productTypeSlug?: string,
  productSlug?: string,
): Promise<CatalogProduct[]> {
  const conditions = [];
  if (productTypeSlug) {
    conditions.push(eq(schema.productType.slug, productTypeSlug));
  }
  if (productSlug) conditions.push(eq(schema.product.slug, productSlug));

  const rows = await db
    .select({
      buttonDiameterMm: schema.productSpinner.buttonDiameterMm,
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
      createdAt: row.createdAt,
      diameterMm: row.diameterMm,
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
  return [...products.values()];
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
      installedButtonId: schema.collectionSpinner.installedButtonId,
      name: schema.product.name,
      productId: schema.product.id,
      spinnerId: schema.collectionSpinner.id,
      buttonId: schema.collectionSpinnerButton.id,
    })
    .from(schema.collectionItem)
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
    .where(and(...conditions))
    .orderBy(asc(schema.product.name));
  return rows.map((row) => ({
    collectionItemId: row.collectionItemId,
    installedButtonId: row.installedButtonId,
    name: row.name,
    productId: row.productId,
    productTypeSlug: row.spinnerId ? "spinner" : "spinner-button",
  }));
}

function spinnerSpecs(specs: ProductWriteInput["specs"]) {
  return {
    buttonDiameterMm: specs.buttonDiameterMm ?? null,
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
    materialIds: input.materialIds,
    productTypeSlug: input.productTypeSlug,
    slug: input.slug,
  });
}
