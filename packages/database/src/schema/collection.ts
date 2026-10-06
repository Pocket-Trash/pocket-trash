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
} from "drizzle-orm/pg-core";
import { maker, material, productType } from "./scraper.js";
import { user } from "./users.js";

/** Roles allowed to soft-delete catalog images. */
export const catalogDeletionRoles = ["owner", "admin"] as const;
/** Catalog entity types that can own an image. */
export const catalogImageTargetTypes = [
  "product",
  "material",
  "collection",
  "collection_item",
] as const;
/** Review states shared by catalog products and collection items. */
export const productApprovalStatuses = [
  "pending",
  "approved",
  "rejected",
] as const;

/** Named collections owned by application users. */
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
    /** Canonical per-owner key used to prevent duplicate collection names. */
    normalizedName: text("normalized_name").notNull(),
    description: text("description"),
    summary: text("summary"),
    /** Whether public routes hide the collection and its items. */
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
      "user_collection_description_length_valid",
      sql`${table.description} is null or char_length(${table.description}) <= 5000`,
    ),
    check(
      "user_collection_summary_length_valid",
      sql`${table.summary} is null or char_length(${table.summary}) <= 200`,
    ),
    check(
      "user_collection_private_metadata_consistent",
      sql`(not ${table.isPrivate} and num_nonnulls(${table.privateReason}, ${table.privatedAt}, ${table.privatedByClerkId}) = 0) or (${table.isPrivate} and (num_nonnulls(${table.privateReason}, ${table.privatedAt}, ${table.privatedByClerkId}) = 0 or (${table.privateReason} is not null and ${table.privatedAt} is not null)))`,
    ),
  ],
);

/** Owned catalog items stored in user collections. */
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
    /** Optional owner-defined name shown instead of the product name. */
    displayName: text("display_name"),
    /** Optional Markdown description shown instead of the product description. */
    description: text("description"),
    materialId: bigint("material_id", { mode: "number" }).references(
      () => material.id,
      { onDelete: "restrict" },
    ),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    purchasedFromUserId: bigint("purchased_from_user_id", {
      mode: "number",
    }).references(() => user.id, { onDelete: "set null" }),
    /** Free-text seller name used when no application user row exists. */
    purchasedFromUser: text("purchased_from_user"),
    soldToUserId: bigint("sold_to_user_id", { mode: "number" }).references(
      () => user.id,
      { onDelete: "set null" },
    ),
    /** Free-text buyer name used when no application user row exists. */
    soldToUser: text("sold_to_user"),
    /** Whether the item is currently owned by its owner. */
    owned: boolean("owned").notNull().default(true),
    /** Administrative review state for public catalog visibility. */
    approvalStatus: text("approval_status", { enum: productApprovalStatuses })
      .default("pending")
      .notNull(),
    /** Nonblank reason for the latest administrative decision. */
    approvalDecisionReason: text("approval_decision_reason"),
    approvalDecidedAt: timestamp("approval_decided_at", {
      mode: "date",
      withTimezone: true,
    }),
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
      table.approvalStatus,
      table.isPrivate,
    ),
    index("collection_item_material_public_idx").on(
      table.materialId,
      table.owned,
      table.approvalStatus,
      table.isPrivate,
    ),
    check(
      "collection_item_approval_status_valid",
      sql`${table.approvalStatus} in ('pending', 'approved', 'rejected')`,
    ),
    check(
      "collection_item_approval_decision_metadata_consistent",
      sql`num_nonnulls(${table.approvalDecisionReason}, ${table.approvalDecidedAt}) in (0, 2)`,
    ),
    check(
      "collection_item_approval_reason_valid",
      sql`${table.approvalDecisionReason} is null or char_length(trim(${table.approvalDecisionReason})) between 1 and 1000`,
    ),
    check(
      "collection_item_private_metadata_consistent",
      sql`(not ${table.isPrivate} and num_nonnulls(${table.privateReason}, ${table.privatedAt}, ${table.privatedByClerkId}) = 0) or (${table.isPrivate} and (num_nonnulls(${table.privateReason}, ${table.privatedAt}, ${table.privatedByClerkId}) = 0 or (${table.privateReason} is not null and ${table.privatedAt} is not null)))`,
    ),
    check(
      "collection_item_description_length_valid",
      sql`${table.description} is null or char_length(${table.description}) <= 5000`,
    ),
  ],
);

/** Ordered, soft-deletable images attached to a shared material. */
export const materialImage = pgTable(
  "material_image",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    materialId: bigint("material_id", { mode: "number" })
      .notNull()
      .references(() => material.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256").notNull(),
    storageProvider: text("storage_provider").default("bunny").notNull(),
    objectPath: text("object_path").notNull(),
    url: text("url").notNull(),
    uploadedByClerkId: text("uploaded_by_clerk_id"),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
    deletedByClerkId: text("deleted_by_clerk_id"),
    deletedByRole: text("deleted_by_role", { enum: catalogDeletionRoles }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("material_image_material_id_idx").on(table.materialId),
    unique("material_image_object_path_unique").on(table.objectPath),
    unique("material_image_material_hash_unique").on(
      table.materialId,
      table.sha256,
    ),
    check("material_image_position_valid", sql`${table.position} >= 0`),
    check("material_image_size_positive", sql`${table.size} > 0`),
    check(
      "material_image_sha256_valid",
      sql`${table.sha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "material_image_deletion_metadata_consistent",
      sql`(${table.deletedAt} is null and ${table.deletedByClerkId} is null and ${table.deletedByRole} is null) or (${table.deletedAt} is not null and ${table.deletedByRole} is not null)`,
    ),
    check(
      "material_image_deleted_by_role_valid",
      sql`${table.deletedByRole} is null or ${table.deletedByRole} in ('owner', 'admin')`,
    ),
  ],
);

/** Ordered images attached to a user collection. */
export const collectionImage = pgTable(
  "collection_image",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    collectionId: bigint("collection_id", { mode: "number" })
      .notNull()
      .references(() => userCollection.id, { onDelete: "cascade" }),
    /** Whether this image is the collection's selected cover. */
    isCurrent: boolean("is_current").default(false).notNull(),
    /** Stable zero-based display order within the collection. */
    position: integer("position").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    /** Exact-byte duplicate-detection hash. */
    sha256: text("sha256").notNull(),
    storageProvider: text("storage_provider").default("bunny").notNull(),
    objectPath: text("object_path").notNull(),
    /** Unsigned CDN URL stored for the image. */
    url: text("url").notNull(),
    uploadedByClerkId: text("uploaded_by_clerk_id"),
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

/** Canonical catalog products associated with a maker and classified by product type. */
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
    ownerClerkId: text("owner_clerk_id"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    /** Optional product description stored as Markdown. */
    description: text("description"),
    /** Current administrative review state. */
    approvalStatus: text("approval_status", {
      enum: productApprovalStatuses,
    })
      .default("pending")
      .notNull(),
    /** Reason supplied for the latest administrative review transition. */
    approvalDecisionReason: text("approval_decision_reason"),
    approvalDecidedAt: timestamp("approval_decided_at", {
      mode: "date",
      withTimezone: true,
    }),
    makerProductUrl: text("maker_product_url"),
    /** Whether the maker product URL may be shown publicly. */
    makerProductUrlValid: boolean("maker_product_url_valid")
      .default(true)
      .notNull(),
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
    index("product_visibility_idx").on(table.approvalStatus, table.isPrivate),
    check(
      "product_approval_status_valid",
      sql`${table.approvalStatus} in ('pending', 'approved', 'rejected')`,
    ),
    check(
      "product_approval_decision_metadata_consistent",
      sql`num_nonnulls(${table.approvalDecisionReason}, ${table.approvalDecidedAt}) in (0, 2)`,
    ),
    check(
      "product_approval_reason_valid",
      sql`${table.approvalDecisionReason} is null or char_length(trim(${table.approvalDecisionReason})) between 1 and 1000`,
    ),
    check(
      "product_private_metadata_consistent",
      sql`(not ${table.isPrivate} and num_nonnulls(${table.privateReason}, ${table.privatedAt}, ${table.privatedByClerkId}) = 0) or (${table.isPrivate} and (num_nonnulls(${table.privateReason}, ${table.privatedAt}, ${table.privatedByClerkId}) = 0 or (${table.privateReason} is not null and ${table.privatedAt} is not null)))`,
    ),
    check(
      "product_description_length_valid",
      sql`${table.description} is null or char_length(${table.description}) <= 5000`,
    ),
  ],
);

/** Ordered images attached to a catalog product. */
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
    uploadedByClerkId: text("uploaded_by_clerk_id"),
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
      sql`(${table.deletedAt} is null and ${table.deletedByClerkId} is null and ${table.deletedByRole} is null) or (${table.deletedAt} is not null and ${table.deletedByRole} is not null)`,
    ),
    check(
      "product_image_deleted_by_role_valid",
      sql`${table.deletedByRole} is null or ${table.deletedByRole} in ('owner', 'admin')`,
    ),
  ],
);

/** Ordered images attached to one collection item. */
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
    uploadedByClerkId: text("uploaded_by_clerk_id"),
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
      sql`(${table.deletedAt} is null and ${table.deletedByClerkId} is null and ${table.deletedByRole} is null) or (${table.deletedAt} is not null and ${table.deletedByRole} is not null)`,
    ),
    check(
      "collection_item_image_deleted_by_role_valid",
      sql`${table.deletedByRole} is null or ${table.deletedByRole} in ('owner', 'admin')`,
    ),
  ],
);

/** Material assignments for catalog products. */
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
  (table) => [
    primaryKey({ columns: [table.productId, table.materialId] }),
    index("product_material_material_id_idx").on(table.materialId),
  ],
);

/**
 * Builds shared identity and timestamp columns for catalog lookup tables.
 *
 * @returns Drizzle column builders for a named, slugged lookup row.
 */
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

/** Canonical catalog finishes. */
export const finish = pgTable("finish", lookupColumns(), (table) => [
  uniqueIndex("finish_name_case_insensitive_unique").on(
    sql`lower(${table.name})`,
  ),
  uniqueIndex("finish_slug_unique").on(table.slug),
]);

/** Canonical catalog colors. */
export const color = pgTable(
  "color",
  {
    ...lookupColumns(),
    hex: text("hex").notNull(),
  },
  (table) => [
    uniqueIndex("color_name_case_insensitive_unique").on(
      sql`lower(${table.name})`,
    ),
    uniqueIndex("color_slug_unique").on(table.slug),
    check("color_hex_check", sql`${table.hex} ~ '^#[0-9A-Fa-f]{6}$'`),
  ],
);

/** Canonical catalog color effects. */
export const colorEffect = pgTable("color_effect", lookupColumns(), (table) => [
  uniqueIndex("color_effect_slug_unique").on(table.slug),
]);

/** Named finish combinations for a catalog product or collection item. */
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
    /** Catalog option copied into this collection-item snapshot. */
    sourceProductFinishOptionId: bigint("source_product_finish_option_id", {
      mode: "number",
    }).references((): AnyPgColumn => finishOption.id, { onDelete: "set null" }),
    /** Optional relationship between the selected colors. */
    colorEffectId: bigint("color_effect_id", { mode: "number" }).references(
      () => colorEffect.id,
      { onDelete: "restrict" },
    ),
    /** Zero-based option display order. */
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

/** Finish membership in a finish option. */
export const finishOptionFinish = pgTable(
  "finish_option_finish",
  {
    finishOptionId: bigint("finish_option_id", { mode: "number" })
      .notNull()
      .references(() => finishOption.id, { onDelete: "cascade" }),
    finishId: bigint("finish_id", { mode: "number" })
      .notNull()
      .references(() => finish.id, { onDelete: "restrict" }),
    /** Zero-based finish display order. */
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

/** Color membership in a finish option. */
export const finishOptionColor = pgTable(
  "finish_option_color",
  {
    finishOptionId: bigint("finish_option_id", { mode: "number" })
      .notNull()
      .references(() => finishOption.id, { onDelete: "cascade" }),
    colorId: bigint("color_id", { mode: "number" })
      .notNull()
      .references(() => color.id, { onDelete: "restrict" }),
    /** Zero-based color display order. */
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

/** Spinner-specific measurements for catalog products. */
export const productSpinner = pgTable(
  "product_spinner",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .references(() => product.id, { onDelete: "cascade" }),
    weightG: decimal("weight_g"),
    lengthMm: decimal("length_mm"),
    widthMm: decimal("width_mm"),
    thicknessMm: decimal("thickness_mm"),
    thicknessWithButtonMm: decimal("thickness_with_button_mm"),
    buttonDiameterMm: decimal("button_diameter_mm"),
    spinDiameterMm: decimal("spin_diameter_mm"),
    bearing: text("bearing"),
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
  },
  (table) => [
    check(
      "product_spinner_measurements_positive",
      sql`${table.weightG} > 0 and ${table.lengthMm} > 0 and ${table.widthMm} > 0 and ${table.thicknessMm} > 0 and ${table.thicknessWithButtonMm} > 0 and ${table.buttonDiameterMm} > 0 and ${table.spinDiameterMm} > 0`,
    ),
    check(
      "product_spinner_bearing_length_valid",
      sql`${table.bearing} is null or char_length(${table.bearing}) <= 200`,
    ),
  ],
);

/** Spinner-button measurements for catalog products. */
export const productSpinnerButton = pgTable(
  "product_spinner_button",
  {
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
  },
  (table) => [
    check(
      "product_spinner_button_measurements_positive",
      sql`${table.weightG} > 0 and ${table.diameterMm} > 0 and ${table.thicknessMm} > 0`,
    ),
  ],
);

/** Catalog spinner-button mappings selected for collection items. */
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

/** Catalog spinner mappings and installed-button overrides for collection items. */
export const collectionSpinner = pgTable(
  "collection_spinner",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .references(() => collectionItem.id, { onDelete: "cascade" }),
    productSpinnerId: bigint("product_spinner_id", { mode: "number" })
      .notNull()
      .references(() => productSpinner.id, { onDelete: "restrict" }),
    /** Owned spinner button currently installed on this spinner. */
    installedButtonId: bigint("installed_button_id", {
      mode: "number",
    }).references(() => collectionSpinnerButton.id, { onDelete: "set null" }),
    /** Optional bearing override for this owned spinner. */
    bearing: text("bearing"),
  },
  (table) => [
    uniqueIndex("collection_spinner_installed_button_unique")
      .on(table.installedButtonId)
      .where(sql`${table.installedButtonId} is not null`),
    check(
      "collection_spinner_bearing_length_valid",
      sql`${table.bearing} is null or char_length(${table.bearing}) <= 200`,
    ),
  ],
);

/** Stored collection item row. */
export type CollectionItem = typeof collectionItem.$inferSelect;
/** Values accepted when creating a collection item row. */
export type NewCollectionItem = typeof collectionItem.$inferInsert;
/** Stored collection image row. */
export type CollectionImage = typeof collectionImage.$inferSelect;
/** Values accepted when creating a collection image row. */
export type NewCollectionImage = typeof collectionImage.$inferInsert;
/** Stored user collection row. */
export type UserCollection = typeof userCollection.$inferSelect;
/** Values accepted when creating a user collection row. */
export type NewUserCollection = typeof userCollection.$inferInsert;
/** Stored product row. */
export type Product = typeof product.$inferSelect;
/** Values accepted when creating a product row. */
export type NewProduct = typeof product.$inferInsert;
/** Stored product image row. */
export type ProductImage = typeof productImage.$inferSelect;
/** Values accepted when creating a product image row. */
export type NewProductImage = typeof productImage.$inferInsert;
/** Stored collection item image row. */
export type CollectionItemImage = typeof collectionItemImage.$inferSelect;
/** Values accepted when creating a collection item image row. */
export type NewCollectionItemImage = typeof collectionItemImage.$inferInsert;
/** Stored product material row. */
export type ProductMaterial = typeof productMaterial.$inferSelect;
/** Values accepted when creating a product material row. */
export type NewProductMaterial = typeof productMaterial.$inferInsert;
/** Stored finish row. */
export type Finish = typeof finish.$inferSelect;
/** Values accepted when creating a finish row. */
export type NewFinish = typeof finish.$inferInsert;
/** Stored color row. */
export type Color = typeof color.$inferSelect;
/** Values accepted when creating a color row. */
export type NewColor = typeof color.$inferInsert;
/** Stored color effect row. */
export type ColorEffect = typeof colorEffect.$inferSelect;
/** Values accepted when creating a color effect row. */
export type NewColorEffect = typeof colorEffect.$inferInsert;
/** Stored finish option row. */
export type FinishOption = typeof finishOption.$inferSelect;
/** Values accepted when creating a finish option row. */
export type NewFinishOption = typeof finishOption.$inferInsert;
/** Stored finish option finish row. */
export type FinishOptionFinish = typeof finishOptionFinish.$inferSelect;
/** Values accepted when creating a finish option finish row. */
export type NewFinishOptionFinish = typeof finishOptionFinish.$inferInsert;
/** Stored finish option color row. */
export type FinishOptionColor = typeof finishOptionColor.$inferSelect;
/** Values accepted when creating a finish option color row. */
export type NewFinishOptionColor = typeof finishOptionColor.$inferInsert;
/** Stored product spinner row. */
export type ProductSpinner = typeof productSpinner.$inferSelect;
/** Values accepted when creating a product spinner row. */
export type NewProductSpinner = typeof productSpinner.$inferInsert;
/** Stored product spinner button row. */
export type ProductSpinnerButton = typeof productSpinnerButton.$inferSelect;
/** Values accepted when creating a product spinner button row. */
export type NewProductSpinnerButton = typeof productSpinnerButton.$inferInsert;
/** Stored collection spinner row. */
export type CollectionSpinner = typeof collectionSpinner.$inferSelect;
/** Values accepted when creating a collection spinner row. */
export type NewCollectionSpinner = typeof collectionSpinner.$inferInsert;
/** Stored collection spinner button row. */
export type CollectionSpinnerButton =
  typeof collectionSpinnerButton.$inferSelect;
/** Values accepted when creating a collection spinner button row. */
export type NewCollectionSpinnerButton =
  typeof collectionSpinnerButton.$inferInsert;
