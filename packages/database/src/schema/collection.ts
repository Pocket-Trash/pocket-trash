import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  decimal,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { maker, material, productType } from "./scraper.js";
import { user } from "./users.js";

export const catalogDeletionRoles = ["owner", "admin"] as const;
export const catalogImageTargetTypes = [
  "product",
  "collection",
  "collection_item",
] as const;

export const userCollection = pgTable(
  "user_collection",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    ownerId: bigint("owner_id", { mode: "number" })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    description: text("description"),
    isPrivate: boolean("is_private").default(true).notNull(),
    privateReason: text("private_reason"),
    privatedAt: timestamp("privated_at", { mode: "date", withTimezone: true }),
    privatedByClerkId: text("privated_by_clerk_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("user_collection_id_owner_unique").on(table.id, table.ownerId),
    unique("user_collection_owner_name_unique").on(
      table.ownerId,
      table.normalizedName,
    ),
    index("user_collection_owner_visibility_idx").on(
      table.ownerId,
      table.isPrivate,
    ),
    check(
      "user_collection_name_length_valid",
      sql`char_length(trim(${table.name})) between 2 and 80`,
    ),
    check(
      "user_collection_private_metadata_consistent",
      sql`(${table.isPrivate} and num_nonnulls(${table.privateReason}, ${table.privatedAt}, ${table.privatedByClerkId}) in (0, 3)) or (not ${table.isPrivate} and num_nonnulls(${table.privateReason}, ${table.privatedAt}, ${table.privatedByClerkId}) = 0)`,
    ),
  ],
);

export const collectionItem = pgTable(
  "collection_item",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    ownerId: bigint("owner_id", { mode: "number" })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    collectionId: bigint("collection_id", { mode: "number" }).notNull(),
    materialId: bigint("material_id", { mode: "number" }).references(
      () => material.id,
      { onDelete: "restrict" },
    ),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    purchasedFromUserId: bigint("purchased_from_user_id", {
      mode: "number",
    }).references(() => user.id, { onDelete: "set null" }),
    purchasedFromUser: text("purchased_from_user"),
    soldToUserId: bigint("sold_to_user_id", { mode: "number" }).references(
      () => user.id,
      { onDelete: "set null" },
    ),
    soldToUser: text("sold_to_user"),
    owned: boolean("owned").notNull().default(true),
    isPrivate: boolean("is_private").default(false).notNull(),
    privateReason: text("private_reason"),
    privatedAt: timestamp("privated_at", { mode: "date", withTimezone: true }),
    privatedByClerkId: text("privated_by_clerk_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.collectionId, table.ownerId],
      foreignColumns: [userCollection.id, userCollection.ownerId],
      name: "collection_item_collection_owner_fk",
    }).onDelete("cascade"),
    index("collection_item_collection_visibility_idx").on(
      table.collectionId,
      table.ownerId,
      table.isPrivate,
    ),
    check(
      "collection_item_private_metadata_consistent",
      sql`(${table.isPrivate} and num_nonnulls(${table.privateReason}, ${table.privatedAt}, ${table.privatedByClerkId}) in (0, 3)) or (not ${table.isPrivate} and num_nonnulls(${table.privateReason}, ${table.privatedAt}, ${table.privatedByClerkId}) = 0)`,
    ),
  ],
);

export const collectionImage = pgTable(
  "collection_image",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    collectionId: bigint("collection_id", { mode: "number" })
      .notNull()
      .references(() => userCollection.id, { onDelete: "cascade" }),
    isCurrent: boolean("is_current").default(false).notNull(),
    position: integer("position").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256").notNull(),
    storageProvider: text("storage_provider").default("bunny").notNull(),
    objectPath: text("object_path").notNull(),
    url: text("url").notNull(),
    uploadedByClerkId: text("uploaded_by_clerk_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("collection_image_collection_id_idx").on(table.collectionId),
    uniqueIndex("collection_image_current_unique")
      .on(table.collectionId)
      .where(sql`${table.isCurrent}`),
    unique("collection_image_object_path_unique").on(table.objectPath),
    unique("collection_image_collection_hash_unique").on(
      table.collectionId,
      table.sha256,
    ),
    check("collection_image_position_valid", sql`${table.position} >= 0`),
    check("collection_image_size_positive", sql`${table.size} > 0`),
    check(
      "collection_image_sha256_valid",
      sql`${table.sha256} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const product = pgTable(
  "product",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    productTypeId: bigint("product_type_id", { mode: "number" })
      .notNull()
      .references(() => productType.id, { onDelete: "restrict" }),
    makerId: bigint("maker_id", { mode: "number" })
      .notNull()
      .references(() => maker.id, { onDelete: "restrict" }),
    ownerClerkId: text("owner_clerk_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    isPrivate: boolean("is_private").default(false).notNull(),
    privateReason: text("private_reason"),
    privatedAt: timestamp("privated_at", { mode: "date", withTimezone: true }),
    privatedByClerkId: text("privated_by_clerk_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("product_type_slug_unique").on(table.productTypeId, table.slug),
    index("product_owner_clerk_id_idx").on(table.ownerClerkId),
    index("product_visibility_idx").on(table.isPrivate),
    check(
      "product_private_metadata_consistent",
      sql`(${table.isPrivate} and num_nonnulls(${table.privateReason}, ${table.privatedAt}, ${table.privatedByClerkId}) in (0, 3)) or (not ${table.isPrivate} and num_nonnulls(${table.privateReason}, ${table.privatedAt}, ${table.privatedByClerkId}) = 0)`,
    ),
  ],
);

export const productImage = pgTable(
  "product_image",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256").notNull(),
    storageProvider: text("storage_provider").default("bunny").notNull(),
    objectPath: text("object_path").notNull(),
    url: text("url").notNull(),
    uploadedByClerkId: text("uploaded_by_clerk_id").notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
    deletedByClerkId: text("deleted_by_clerk_id"),
    deletedByRole: text("deleted_by_role", { enum: catalogDeletionRoles }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("product_image_product_id_idx").on(table.productId),
    unique("product_image_object_path_unique").on(table.objectPath),
    unique("product_image_product_hash_unique").on(
      table.productId,
      table.sha256,
    ),
    check("product_image_position_valid", sql`${table.position} >= 0`),
    check("product_image_size_positive", sql`${table.size} > 0`),
    check(
      "product_image_sha256_valid",
      sql`${table.sha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "product_image_deletion_metadata_consistent",
      sql`num_nonnulls(${table.deletedAt}, ${table.deletedByClerkId}, ${table.deletedByRole}) in (0, 3)`,
    ),
    check(
      "product_image_deleted_by_role_valid",
      sql`${table.deletedByRole} is null or ${table.deletedByRole} in ('owner', 'admin')`,
    ),
  ],
);

export const collectionItemImage = pgTable(
  "collection_item_image",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    collectionItemId: bigint("collection_item_id", { mode: "number" })
      .notNull()
      .references(() => collectionItem.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256").notNull(),
    storageProvider: text("storage_provider").default("bunny").notNull(),
    objectPath: text("object_path").notNull(),
    url: text("url").notNull(),
    uploadedByClerkId: text("uploaded_by_clerk_id").notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
    deletedByClerkId: text("deleted_by_clerk_id"),
    deletedByRole: text("deleted_by_role", { enum: catalogDeletionRoles }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("collection_item_image_item_id_idx").on(table.collectionItemId),
    unique("collection_item_image_object_path_unique").on(table.objectPath),
    unique("collection_item_image_item_hash_unique").on(
      table.collectionItemId,
      table.sha256,
    ),
    check("collection_item_image_position_valid", sql`${table.position} >= 0`),
    check("collection_item_image_size_positive", sql`${table.size} > 0`),
    check(
      "collection_item_image_sha256_valid",
      sql`${table.sha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "collection_item_image_deletion_metadata_consistent",
      sql`num_nonnulls(${table.deletedAt}, ${table.deletedByClerkId}, ${table.deletedByRole}) in (0, 3)`,
    ),
    check(
      "collection_item_image_deleted_by_role_valid",
      sql`${table.deletedByRole} is null or ${table.deletedByRole} in ('owner', 'admin')`,
    ),
  ],
);

export const catalogImageUploadSession = pgTable(
  "catalog_image_upload_session",
  {
    id: uuid("id").primaryKey(),
    uploaderClerkId: text("uploader_clerk_id").notNull(),
    targetType: text("target_type", {
      enum: catalogImageTargetTypes,
    }).notNull(),
    productId: bigint("product_id", { mode: "number" }).references(
      () => product.id,
      { onDelete: "cascade" },
    ),
    collectionItemId: bigint("collection_item_id", {
      mode: "number",
    }).references(() => collectionItem.id, { onDelete: "cascade" }),
    collectionId: bigint("collection_id", { mode: "number" }).references(
      () => userCollection.id,
      { onDelete: "cascade" },
    ),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("catalog_image_upload_session_expires_at_idx").on(table.expiresAt),
    check(
      "catalog_image_upload_session_target_consistent",
      sql`(${table.targetType} = 'product' and ${table.productId} is not null and ${table.collectionId} is null and ${table.collectionItemId} is null) or (${table.targetType} = 'collection' and ${table.productId} is null and ${table.collectionId} is not null and ${table.collectionItemId} is null) or (${table.targetType} = 'collection_item' and ${table.productId} is null and ${table.collectionId} is null and ${table.collectionItemId} is not null)`,
    ),
  ],
);

export const catalogImageUploadFile = pgTable(
  "catalog_image_upload_file",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => catalogImageUploadSession.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256").notNull(),
    objectPath: text("object_path").notNull(),
    url: text("url").notNull(),
    uploadedAt: timestamp("uploaded_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("catalog_image_upload_file_session_id_idx").on(table.sessionId),
    unique("catalog_image_upload_file_object_path_unique").on(table.objectPath),
    unique("catalog_image_upload_file_session_position_unique").on(
      table.sessionId,
      table.position,
    ),
    unique("catalog_image_upload_file_session_hash_unique").on(
      table.sessionId,
      table.sha256,
    ),
    check(
      "catalog_image_upload_file_position_valid",
      sql`${table.position} >= 0`,
    ),
    check("catalog_image_upload_file_size_positive", sql`${table.size} > 0`),
    check(
      "catalog_image_upload_file_sha256_valid",
      sql`${table.sha256} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const productMaterial = pgTable(
  "product_material",
  {
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    materialId: bigint("material_id", { mode: "number" })
      .notNull()
      .references(() => material.id, { onDelete: "restrict" }),
  },
  (table) => [primaryKey({ columns: [table.productId, table.materialId] })],
);

const lookupColumns = () => ({
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity({ startWith: 1000 }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const finish = pgTable("finish", lookupColumns(), (table) => [
  uniqueIndex("finish_slug_unique").on(table.slug),
]);

export const color = pgTable(
  "color",
  {
    ...lookupColumns(),
    hex: text("hex").notNull(),
  },
  (table) => [
    uniqueIndex("color_slug_unique").on(table.slug),
    check("color_hex_check", sql`${table.hex} ~ '^#[0-9A-Fa-f]{6}$'`),
  ],
);

export const colorEffect = pgTable("color_effect", lookupColumns(), (table) => [
  uniqueIndex("color_effect_slug_unique").on(table.slug),
]);

export const finishOption = pgTable(
  "finish_option",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    productId: bigint("product_id", { mode: "number" }).references(
      () => product.id,
      { onDelete: "cascade" },
    ),
    collectionItemId: bigint("collection_item_id", {
      mode: "number",
    }).references(() => collectionItem.id, { onDelete: "cascade" }),
    sourceProductFinishOptionId: bigint("source_product_finish_option_id", {
      mode: "number",
    }).references((): AnyPgColumn => finishOption.id, { onDelete: "set null" }),
    colorEffectId: bigint("color_effect_id", { mode: "number" }).references(
      () => colorEffect.id,
      { onDelete: "restrict" },
    ),
    position: integer("position").notNull(),
  },
  (table) => [
    check(
      "finish_option_owner_check",
      sql`(${table.productId} is not null) <> (${table.collectionItemId} is not null)`,
    ),
    check("finish_option_position_check", sql`${table.position} >= 0`),
    uniqueIndex("finish_option_collection_item_unique").on(
      table.collectionItemId,
    ),
    uniqueIndex("finish_option_product_position_unique").on(
      table.productId,
      table.position,
    ),
  ],
);

export const finishOptionFinish = pgTable(
  "finish_option_finish",
  {
    finishOptionId: bigint("finish_option_id", { mode: "number" })
      .notNull()
      .references(() => finishOption.id, { onDelete: "cascade" }),
    finishId: bigint("finish_id", { mode: "number" })
      .notNull()
      .references(() => finish.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.finishOptionId, table.finishId] }),
    uniqueIndex("finish_option_finish_position_unique").on(
      table.finishOptionId,
      table.position,
    ),
    check("finish_option_finish_position_check", sql`${table.position} >= 0`),
  ],
);

export const finishOptionColor = pgTable(
  "finish_option_color",
  {
    finishOptionId: bigint("finish_option_id", { mode: "number" })
      .notNull()
      .references(() => finishOption.id, { onDelete: "cascade" }),
    colorId: bigint("color_id", { mode: "number" })
      .notNull()
      .references(() => color.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.finishOptionId, table.colorId] }),
    uniqueIndex("finish_option_color_position_unique").on(
      table.finishOptionId,
      table.position,
    ),
    check("finish_option_color_position_check", sql`${table.position} >= 0`),
  ],
);

export const productSpinner = pgTable("product_spinner", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .references(() => product.id, { onDelete: "cascade" }),
  weightG: decimal("weight_g"),
  lengthMm: decimal("length_mm"),
  widthMm: decimal("width_mm"),
  thicknessMm: decimal("thickness_mm"),
  thicknessWithButtonMm: decimal("thickness_with_button_mm"),
  buttonDiameterMm: decimal("button_diameter_mm"),
  compatibleButtonId: bigint("compatible_button_id", {
    mode: "number",
  }).references((): AnyPgColumn => productSpinnerButton.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const productSpinnerButton = pgTable("product_spinner_button", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .references(() => product.id, { onDelete: "cascade" }),
  weightG: decimal("weight_g"),
  diameterMm: decimal("diameter_mm"),
  thicknessMm: decimal("thickness_mm"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const collectionSpinnerButton = pgTable("collection_spinner_button", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .references(() => collectionItem.id, { onDelete: "cascade" }),
  productSpinnerButtonId: bigint("product_spinner_button_id", {
    mode: "number",
  })
    .notNull()
    .references(() => productSpinnerButton.id, { onDelete: "restrict" }),
});

export const collectionSpinner = pgTable("collection_spinner", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .references(() => collectionItem.id, { onDelete: "cascade" }),
  productSpinnerId: bigint("product_spinner_id", { mode: "number" })
    .notNull()
    .references(() => productSpinner.id, { onDelete: "restrict" }),
  installedButtonId: bigint("installed_button_id", {
    mode: "number",
  }).references(() => collectionSpinnerButton.id, { onDelete: "set null" }),
});

export type CollectionItem = typeof collectionItem.$inferSelect;
export type NewCollectionItem = typeof collectionItem.$inferInsert;
export type CollectionImage = typeof collectionImage.$inferSelect;
export type NewCollectionImage = typeof collectionImage.$inferInsert;
export type UserCollection = typeof userCollection.$inferSelect;
export type NewUserCollection = typeof userCollection.$inferInsert;
export type Product = typeof product.$inferSelect;
export type NewProduct = typeof product.$inferInsert;
export type ProductImage = typeof productImage.$inferSelect;
export type NewProductImage = typeof productImage.$inferInsert;
export type CollectionItemImage = typeof collectionItemImage.$inferSelect;
export type NewCollectionItemImage = typeof collectionItemImage.$inferInsert;
export type ProductMaterial = typeof productMaterial.$inferSelect;
export type NewProductMaterial = typeof productMaterial.$inferInsert;
export type Finish = typeof finish.$inferSelect;
export type NewFinish = typeof finish.$inferInsert;
export type Color = typeof color.$inferSelect;
export type NewColor = typeof color.$inferInsert;
export type ColorEffect = typeof colorEffect.$inferSelect;
export type NewColorEffect = typeof colorEffect.$inferInsert;
export type FinishOption = typeof finishOption.$inferSelect;
export type NewFinishOption = typeof finishOption.$inferInsert;
export type FinishOptionFinish = typeof finishOptionFinish.$inferSelect;
export type NewFinishOptionFinish = typeof finishOptionFinish.$inferInsert;
export type FinishOptionColor = typeof finishOptionColor.$inferSelect;
export type NewFinishOptionColor = typeof finishOptionColor.$inferInsert;
export type ProductSpinner = typeof productSpinner.$inferSelect;
export type NewProductSpinner = typeof productSpinner.$inferInsert;
export type ProductSpinnerButton = typeof productSpinnerButton.$inferSelect;
export type NewProductSpinnerButton = typeof productSpinnerButton.$inferInsert;
export type CollectionSpinner = typeof collectionSpinner.$inferSelect;
export type NewCollectionSpinner = typeof collectionSpinner.$inferInsert;
export type CollectionSpinnerButton =
  typeof collectionSpinnerButton.$inferSelect;
export type NewCollectionSpinnerButton =
  typeof collectionSpinnerButton.$inferInsert;
