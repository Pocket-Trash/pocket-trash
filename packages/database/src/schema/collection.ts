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
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { maker, material, productType } from "./scraper.js";
import { dimensionUnitEnum, weightUnitEnum } from "./user-settings.js";
import { user } from "./users.js";

/** Roles allowed to soft-delete catalog images. */
export const catalogDeletionRoles = ["owner", "admin"] as const;
/** Roles allowed to soft-delete maker images. */
export const makerImageDeletionRoles = ["admin"] as const;
/** Catalog entity types that can own an image. */
export const catalogImageTargetTypes = [
  "maker",
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

/** Ordered images attached to a maker profile. */
export const makerImage = pgTable(
  "maker_image",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    makerId: bigint("maker_id", { mode: "number" })
      .notNull()
      .references(() => maker.id, { onDelete: "cascade" }),
    /** Stable zero-based display order within the maker profile. */
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
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
    deletedByClerkId: text("deleted_by_clerk_id"),
    deletedByRole: text("deleted_by_role", { enum: makerImageDeletionRoles }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("maker_image_maker_id_idx").on(table.makerId),
    unique("maker_image_object_path_unique").on(table.objectPath),
    unique("maker_image_maker_hash_unique").on(table.makerId, table.sha256),
    check("maker_image_position_valid", sql`${table.position} >= 0`),
    check("maker_image_size_positive", sql`${table.size} > 0`),
    check("maker_image_sha256_valid", sql`${table.sha256} ~ '^[0-9a-f]{64}$'`),
    check(
      "maker_image_deletion_metadata_consistent",
      sql`(${table.deletedAt} is null and ${table.deletedByClerkId} is null and ${table.deletedByRole} is null) or (${table.deletedAt} is not null and ${table.deletedByRole} is not null)`,
    ),
    check(
      "maker_image_deleted_by_role_valid",
      sql`${table.deletedByRole} is null or ${table.deletedByRole} = 'admin'`,
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
    /** Whether this database owns the underlying object lifecycle. */
    storageOwned: boolean("storage_owned").default(true).notNull(),
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

/** Maker-scoped catalog terminology mapped to a registered canonical concept. */
export const catalogTerminologyAlias = pgTable(
  "catalog_terminology_alias",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    makerId: bigint("maker_id", { mode: "number" })
      .notNull()
      .references(() => maker.id, { onDelete: "restrict" }),
    canonicalNamespace: text("canonical_namespace").notNull(),
    canonicalKey: text("canonical_key")
      .notNull()
      .references(() => productType.slug, { onDelete: "restrict" }),
    label: text("label").notNull(),
    normalizedValue: text("normalized_value").notNull(),
    isPreferred: boolean("is_preferred").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("catalog_terminology_alias_maker_concept_value_unique").on(
      table.makerId,
      table.canonicalNamespace,
      table.canonicalKey,
      table.normalizedValue,
    ),
    uniqueIndex("catalog_terminology_alias_preferred_unique")
      .on(table.makerId, table.canonicalNamespace, table.canonicalKey)
      .where(sql`${table.isPreferred}`),
    index("catalog_terminology_alias_concept_idx").on(
      table.canonicalNamespace,
      table.canonicalKey,
    ),
    check(
      "catalog_terminology_alias_namespace_valid",
      sql`${table.canonicalNamespace} = 'product-type'`,
    ),
    check(
      "catalog_terminology_alias_label_valid",
      sql`char_length(trim(${table.label})) between 1 and 80`,
    ),
    check(
      "catalog_terminology_alias_normalized_value_valid",
      sql`char_length(${table.normalizedValue}) between 1 and 80 and ${table.normalizedValue} = lower(trim(${table.normalizedValue}))`,
    ),
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

/** Canonical catalog surface patterns. */
export const pattern = pgTable("pattern", lookupColumns(), (table) => [
  uniqueIndex("pattern_name_case_insensitive_unique").on(
    sql`lower(${table.name})`,
  ),
  uniqueIndex("pattern_slug_unique").on(table.slug),
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
    /** Optional reusable surface pattern included in this appearance. */
    patternId: bigint("pattern_id", { mode: "number" }).references(
      () => pattern.id,
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
export const productDetailSpinner = pgTable(
  "product_detail_spinner",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .references(() => product.id, { onDelete: "cascade" }),
    weight: decimal("weight_value"),
    weightUnit: weightUnitEnum("weight_unit"),
    length: decimal("length_value"),
    lengthUnit: dimensionUnitEnum("length_unit"),
    width: decimal("width_value"),
    widthUnit: dimensionUnitEnum("width_unit"),
    thickness: decimal("thickness_value"),
    thicknessUnit: dimensionUnitEnum("thickness_unit"),
    thicknessWithButton: decimal("thickness_with_button_value"),
    thicknessWithButtonUnit: dimensionUnitEnum("thickness_with_button_unit"),
    buttonDiameter: decimal("button_diameter_value"),
    buttonDiameterUnit: dimensionUnitEnum("button_diameter_unit"),
    spinDiameter: decimal("spin_diameter_value"),
    spinDiameterUnit: dimensionUnitEnum("spin_diameter_unit"),
    bearing: text("bearing"),
    compatibleButtonId: bigint("compatible_button_id", {
      mode: "number",
    }).references((): AnyPgColumn => productDetailSpinnerButton.id, {
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
      "product_detail_spinner_weight_consistent",
      sql`(${table.weight} is null and ${table.weightUnit} is null) or (${table.weight} > 0 and ${table.weightUnit} is not null)`,
    ),
    check(
      "product_detail_spinner_length_consistent",
      sql`(${table.length} is null and ${table.lengthUnit} is null) or (${table.length} > 0 and ${table.lengthUnit} is not null)`,
    ),
    check(
      "product_detail_spinner_width_consistent",
      sql`(${table.width} is null and ${table.widthUnit} is null) or (${table.width} > 0 and ${table.widthUnit} is not null)`,
    ),
    check(
      "product_detail_spinner_thickness_consistent",
      sql`(${table.thickness} is null and ${table.thicknessUnit} is null) or (${table.thickness} > 0 and ${table.thicknessUnit} is not null)`,
    ),
    check(
      "product_detail_spinner_thickness_with_button_consistent",
      sql`(${table.thicknessWithButton} is null and ${table.thicknessWithButtonUnit} is null) or (${table.thicknessWithButton} > 0 and ${table.thicknessWithButtonUnit} is not null)`,
    ),
    check(
      "product_detail_spinner_button_diameter_consistent",
      sql`(${table.buttonDiameter} is null and ${table.buttonDiameterUnit} is null) or (${table.buttonDiameter} > 0 and ${table.buttonDiameterUnit} is not null)`,
    ),
    check(
      "product_detail_spinner_spin_diameter_consistent",
      sql`(${table.spinDiameter} is null and ${table.spinDiameterUnit} is null) or (${table.spinDiameter} > 0 and ${table.spinDiameterUnit} is not null)`,
    ),
    check(
      "product_detail_spinner_bearing_length_valid",
      sql`${table.bearing} is null or char_length(${table.bearing}) <= 200`,
    ),
  ],
);

/** Spinner-button measurements for catalog products. */
export const productDetailSpinnerButton = pgTable(
  "product_detail_spinner_button",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .references(() => product.id, { onDelete: "cascade" }),
    weight: decimal("weight_value"),
    weightUnit: weightUnitEnum("weight_unit"),
    diameter: decimal("diameter_value"),
    diameterUnit: dimensionUnitEnum("diameter_unit"),
    thickness: decimal("thickness_value"),
    thicknessUnit: dimensionUnitEnum("thickness_unit"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "product_detail_spinner_button_weight_consistent",
      sql`(${table.weight} is null and ${table.weightUnit} is null) or (${table.weight} > 0 and ${table.weightUnit} is not null)`,
    ),
    check(
      "product_detail_spinner_button_diameter_consistent",
      sql`(${table.diameter} is null and ${table.diameterUnit} is null) or (${table.diameter} > 0 and ${table.diameterUnit} is not null)`,
    ),
    check(
      "product_detail_spinner_button_thickness_consistent",
      sql`(${table.thickness} is null and ${table.thicknessUnit} is null) or (${table.thickness} > 0 and ${table.thicknessUnit} is not null)`,
    ),
  ],
);

/** Compact row-major slider magnet snapshot; `null` side B reuses side A. */
export type SliderMagnetConfigurationValue = {
  /** First side, and both sides when `sideB` is `null`. */
  sideA: Array<
    "N52" | "N48" | "N45" | "N42" | "N40" | "N38" | "N35" | "N30" | null
  >;
  /** Optional distinct second side. */
  sideB: SliderMagnetConfigurationValue["sideA"] | null;
};

/** Slider body measurements and catalog component choices. */
export const productDetailSlider = pgTable(
  "product_detail_slider",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .references(() => product.id, { onDelete: "cascade" }),
    /** Exact catalog plate supplied with the slider; null means unnamed included plates. */
    includedPlateProductId: bigint("included_plate_product_id", {
      mode: "number",
    }).references(() => product.id, { onDelete: "restrict" }),
    /** Whether this slider uses an insert to configure and hold magnets. */
    usesInserts: boolean("uses_inserts").notNull(),
    /** Exact catalog insert supplied with the slider; null means an unnamed included insert when inserts are used. */
    includedInsertProductId: bigint("included_insert_product_id", {
      mode: "number",
    }).references(() => product.id, { onDelete: "restrict" }),
    /** Immutable physical layout owned by the slider or its unnamed included insert. */
    magnetLayout: text("magnet_layout", { enum: ["2x2", "2x3", "2x4"] }),
    /** Optional catalog-default magnet snapshot for the effective layout. */
    magnetConfiguration: jsonb(
      "magnet_configuration",
    ).$type<SliderMagnetConfigurationValue>(),
    weight: decimal("weight_value"),
    weightUnit: weightUnitEnum("weight_unit"),
    length: decimal("length_value"),
    lengthUnit: dimensionUnitEnum("length_unit"),
    width: decimal("width_value"),
    widthUnit: dimensionUnitEnum("width_unit"),
    thickness: decimal("thickness_value"),
    thicknessUnit: dimensionUnitEnum("thickness_unit"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "product_detail_slider_insert_choice_consistent",
      sql`${table.usesInserts} or ${table.includedInsertProductId} is null`,
    ),
    check(
      "product_detail_slider_magnet_layout_consistent",
      sql`(${table.includedInsertProductId} is null and ${table.magnetLayout} is not null) or (${table.includedInsertProductId} is not null and ${table.magnetLayout} is null)`,
    ),
    check(
      "product_detail_slider_magnet_layout_valid",
      sql`${table.magnetLayout} is null or ${table.magnetLayout} in ('2x2', '2x3', '2x4')`,
    ),
    check(
      "product_detail_slider_weight_consistent",
      sql`(${table.weight} is null and ${table.weightUnit} is null) or (${table.weight} > 0 and ${table.weightUnit} is not null)`,
    ),
    check(
      "product_detail_slider_length_consistent",
      sql`(${table.length} is null and ${table.lengthUnit} is null) or (${table.length} > 0 and ${table.lengthUnit} is not null)`,
    ),
    check(
      "product_detail_slider_width_consistent",
      sql`(${table.width} is null and ${table.widthUnit} is null) or (${table.width} > 0 and ${table.widthUnit} is not null)`,
    ),
    check(
      "product_detail_slider_thickness_consistent",
      sql`(${table.thickness} is null and ${table.thicknessUnit} is null) or (${table.thickness} > 0 and ${table.thicknessUnit} is not null)`,
    ),
    check(
      "product_detail_slider_included_plate_distinct",
      sql`${table.includedPlateProductId} is null or ${table.includedPlateProductId} <> ${table.id}`,
    ),
    check(
      "product_detail_slider_included_insert_distinct",
      sql`${table.includedInsertProductId} is null or ${table.includedInsertProductId} <> ${table.id}`,
    ),
    index("product_detail_slider_included_insert_idx").on(
      table.includedInsertProductId,
    ),
    index("product_detail_slider_included_plate_idx").on(
      table.includedPlateProductId,
    ),
  ],
);

/** Reusable magnet snapshot copied into catalog or collection records. */
export const sliderMagnetPreset = pgTable(
  "slider_magnet_preset",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    magnetLayout: text("magnet_layout", {
      enum: ["2x2", "2x3", "2x4"],
    }).notNull(),
    configuration: jsonb("configuration")
      .$type<SliderMagnetConfigurationValue>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("slider_magnet_preset_normalized_name_unique").on(
      table.normalizedName,
    ),
    check(
      "slider_magnet_preset_name_valid",
      sql`char_length(trim(${table.name})) between 1 and 100`,
    ),
    check(
      "slider_magnet_preset_layout_valid",
      sql`${table.magnetLayout} in ('2x2', '2x3', '2x4')`,
    ),
  ],
);

/** Catalog subtype marker for one matched slider plate pair or set. */
export const productDetailSliderPlate = pgTable("product_detail_slider_plate", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .references(() => product.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Catalog subtype marker for one slider insert or cassette set. */
export const productDetailSliderInsert = pgTable(
  "product_detail_slider_insert",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .references(() => product.id, { onDelete: "cascade" }),
    /** Immutable physical layout supplied by this insert. */
    magnetLayout: text("magnet_layout", {
      enum: ["2x2", "2x3", "2x4"],
    })
      .default("2x4")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

/** Catalog spinner-button mappings selected for collection items. */
export const collectionDetailSpinnerButton = pgTable(
  "collection_detail_spinner_button",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .references(() => collectionItem.id, { onDelete: "cascade" }),
    productSpinnerButtonId: bigint("product_spinner_button_id", {
      mode: "number",
    })
      .notNull()
      .references(() => productDetailSpinnerButton.id, {
        onDelete: "restrict",
      }),
  },
);

/** Catalog spinner mappings and installed-button overrides for collection items. */
export const collectionDetailSpinner = pgTable(
  "collection_detail_spinner",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .references(() => collectionItem.id, { onDelete: "cascade" }),
    productSpinnerId: bigint("product_spinner_id", { mode: "number" })
      .notNull()
      .references(() => productDetailSpinner.id, { onDelete: "restrict" }),
    /** Owned spinner button currently installed on this spinner. */
    installedButtonId: bigint("installed_button_id", {
      mode: "number",
    }).references(() => collectionDetailSpinnerButton.id, {
      onDelete: "set null",
    }),
    /** Optional bearing override for this owned spinner. */
    bearing: text("bearing"),
  },
  (table) => [
    uniqueIndex("collection_detail_spinner_installed_button_unique")
      .on(table.installedButtonId)
      .where(sql`${table.installedButtonId} is not null`),
    check(
      "collection_detail_spinner_bearing_length_valid",
      sql`${table.bearing} is null or char_length(${table.bearing}) <= 200`,
    ),
  ],
);

/** Catalog slider plate-set mapping selected for a standalone collection item. */
export const collectionDetailSliderPlate = pgTable(
  "collection_detail_slider_plate",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .references(() => collectionItem.id, { onDelete: "cascade" }),
    productSliderPlateId: bigint("product_slider_plate_id", { mode: "number" })
      .notNull()
      .references(() => productDetailSliderPlate.id, { onDelete: "restrict" }),
  },
);

/** Catalog slider insert-set mapping selected for a standalone collection item. */
export const collectionDetailSliderInsert = pgTable(
  "collection_detail_slider_insert",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .references(() => collectionItem.id, { onDelete: "cascade" }),
    productSliderInsertId: bigint("product_slider_insert_id", {
      mode: "number",
    })
      .notNull()
      .references(() => productDetailSliderInsert.id, { onDelete: "restrict" }),
  },
);

/** Catalog slider mapping and installed component relationships for collection items. */
export const collectionDetailSlider = pgTable(
  "collection_detail_slider",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .references(() => collectionItem.id, { onDelete: "cascade" }),
    productSliderId: bigint("product_slider_id", { mode: "number" })
      .notNull()
      .references(() => productDetailSlider.id, { onDelete: "restrict" }),
    /** Owned plate set currently installed on this slider. */
    installedPlateId: bigint("installed_plate_id", {
      mode: "number",
    }).references(() => collectionDetailSliderPlate.id, {
      onDelete: "set null",
    }),
    /** Owned insert set currently installed on this slider. */
    installedInsertId: bigint("installed_insert_id", {
      mode: "number",
    }).references(() => collectionDetailSliderInsert.id, {
      onDelete: "set null",
    }),
    /** Durable owned snapshot; null means no recorded configuration. */
    magnetConfiguration: jsonb(
      "magnet_configuration",
    ).$type<SliderMagnetConfigurationValue>(),
  },
  (table) => [
    uniqueIndex("collection_detail_slider_installed_plate_unique")
      .on(table.installedPlateId)
      .where(sql`${table.installedPlateId} is not null`),
    uniqueIndex("collection_detail_slider_installed_insert_unique")
      .on(table.installedInsertId)
      .where(sql`${table.installedInsertId} is not null`),
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
/** Stored maker-scoped catalog terminology alias. */
export type CatalogTerminologyAlias =
  typeof catalogTerminologyAlias.$inferSelect;
/** Values accepted when creating a catalog terminology alias. */
export type NewCatalogTerminologyAlias =
  typeof catalogTerminologyAlias.$inferInsert;
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
export type ProductDetailSpinner = typeof productDetailSpinner.$inferSelect;
/** Values accepted when creating a product spinner row. */
export type NewProductDetailSpinner = typeof productDetailSpinner.$inferInsert;
/** Stored product spinner button row. */
export type ProductDetailSpinnerButton =
  typeof productDetailSpinnerButton.$inferSelect;
/** Values accepted when creating a product spinner button row. */
export type NewProductDetailSpinnerButton =
  typeof productDetailSpinnerButton.$inferInsert;
/** Stored slider body row. */
export type ProductDetailSlider = typeof productDetailSlider.$inferSelect;
/** Values accepted when creating a slider body row. */
export type NewProductDetailSlider = typeof productDetailSlider.$inferInsert;
/** Stored reusable slider magnet preset. */
export type SliderMagnetPreset = typeof sliderMagnetPreset.$inferSelect;
/** Values accepted for a reusable slider magnet preset. */
export type NewSliderMagnetPreset = typeof sliderMagnetPreset.$inferInsert;
/** Stored slider plate-set row. */
export type ProductDetailSliderPlate =
  typeof productDetailSliderPlate.$inferSelect;
/** Values accepted when creating a slider plate-set row. */
export type NewProductDetailSliderPlate =
  typeof productDetailSliderPlate.$inferInsert;
/** Stored slider insert-set row. */
export type ProductDetailSliderInsert =
  typeof productDetailSliderInsert.$inferSelect;
/** Values accepted when creating a slider insert-set row. */
export type NewProductDetailSliderInsert =
  typeof productDetailSliderInsert.$inferInsert;
/** Stored collection spinner row. */
export type CollectionDetailSpinner =
  typeof collectionDetailSpinner.$inferSelect;
/** Values accepted when creating a collection spinner row. */
export type NewCollectionDetailSpinner =
  typeof collectionDetailSpinner.$inferInsert;
/** Stored collection spinner button row. */
export type CollectionDetailSpinnerButton =
  typeof collectionDetailSpinnerButton.$inferSelect;
/** Values accepted when creating a collection spinner button row. */
export type NewCollectionDetailSpinnerButton =
  typeof collectionDetailSpinnerButton.$inferInsert;
/** Stored collection slider row. */
export type CollectionDetailSlider = typeof collectionDetailSlider.$inferSelect;
/** Values accepted when creating a collection slider row. */
export type NewCollectionDetailSlider =
  typeof collectionDetailSlider.$inferInsert;
/** Stored collection slider plate-set row. */
export type CollectionDetailSliderPlate =
  typeof collectionDetailSliderPlate.$inferSelect;
/** Values accepted when creating a collection slider plate-set row. */
export type NewCollectionDetailSliderPlate =
  typeof collectionDetailSliderPlate.$inferInsert;
/** Stored collection slider insert-set row. */
export type CollectionDetailSliderInsert =
  typeof collectionDetailSliderInsert.$inferSelect;
/** Values accepted when creating a collection slider insert-set row. */
export type NewCollectionDetailSliderInsert =
  typeof collectionDetailSliderInsert.$inferInsert;
