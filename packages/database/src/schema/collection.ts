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

/** Slider body measurements and catalog component choices. */
export const productSlider = pgTable(
  "product_slider",
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
    inherentClickCount: integer("inherent_click_count"),
    /** Source text retained when a complete layout is not documented. */
    magnetSetupSourceNote: text("magnet_setup_source_note"),
    weightG: decimal("weight_g"),
    weightBasis: text("weight_basis", {
      enum: ["body-only", "complete-build"],
    }),
    lengthMm: decimal("length_mm"),
    widthMm: decimal("width_mm"),
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
      "product_slider_insert_choice_consistent",
      sql`${table.usesInserts} or ${table.includedInsertProductId} is null`,
    ),
    check(
      "product_slider_weight_basis_consistent",
      sql`num_nonnulls(${table.weightG}, ${table.weightBasis}) in (0, 2)`,
    ),
    check(
      "product_slider_weight_basis_valid",
      sql`${table.weightBasis} is null or ${table.weightBasis} in ('body-only', 'complete-build')`,
    ),
    check(
      "product_slider_measurements_positive",
      sql`${table.weightG} > 0 and ${table.lengthMm} > 0 and ${table.widthMm} > 0 and ${table.thicknessMm} > 0`,
    ),
    check(
      "product_slider_inherent_click_count_positive",
      sql`${table.inherentClickCount} is null or ${table.inherentClickCount} > 0`,
    ),
    check(
      "product_slider_setup_source_note_valid",
      sql`${table.magnetSetupSourceNote} is null or char_length(trim(${table.magnetSetupSourceNote})) between 1 and 5000`,
    ),
    check(
      "product_slider_included_plate_distinct",
      sql`${table.includedPlateProductId} is null or ${table.includedPlateProductId} <> ${table.id}`,
    ),
    check(
      "product_slider_included_insert_distinct",
      sql`${table.includedInsertProductId} is null or ${table.includedInsertProductId} <> ${table.id}`,
    ),
    index("product_slider_included_insert_idx").on(
      table.includedInsertProductId,
    ),
    index("product_slider_included_plate_idx").on(table.includedPlateProductId),
  ],
);

/** Global vocabulary used to name exact magnet configurations. */
export const magnetConfigurationLabel = pgTable(
  "magnet_configuration_label",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("magnet_configuration_label_normalized_name_unique").on(
      table.normalizedName,
    ),
    check(
      "magnet_configuration_label_name_valid",
      sql`char_length(trim(${table.name})) between 1 and 100`,
    ),
  ],
);

/** Global vocabulary used to name magnet groups within configurations. */
export const magnetGroupLabel = pgTable(
  "magnet_group_label",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("magnet_group_label_normalized_name_unique").on(
      table.normalizedName,
    ),
    check(
      "magnet_group_label_name_valid",
      sql`char_length(trim(${table.name})) between 1 and 100`,
    ),
  ],
);

/** The single inherent structured layout of one body-hosted slider. */
export const productMagnetConfiguration = pgTable(
  "product_magnet_configuration",
  {
    productId: bigint("product_id", { mode: "number" })
      .primaryKey()
      .references(() => productSlider.id, { onDelete: "cascade" }),
    configurationLabelId: bigint("configuration_label_id", {
      mode: "number",
    })
      .notNull()
      .references(() => magnetConfigurationLabel.id, {
        onDelete: "restrict",
      }),
    /** Optional source-relative layout name, without inferred semantics. */
    sourceLabel: text("source_label"),
    /** Optional notes attached to an otherwise complete sourced layout. */
    sourceNotes: text("source_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "product_magnet_configuration_source_label_valid",
      sql`${table.sourceLabel} is null or char_length(trim(${table.sourceLabel})) between 1 and 200`,
    ),
    check(
      "product_magnet_configuration_source_notes_valid",
      sql`${table.sourceNotes} is null or char_length(trim(${table.sourceNotes})) between 1 and 5000`,
    ),
  ],
);

/** Exact magnet dimensions and grade shared by one or more occupied slots. */
export const productMagnetGroup = pgTable(
  "product_magnet_group",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    configurationProductId: bigint("configuration_product_id", {
      mode: "number",
    })
      .notNull()
      .references(() => productMagnetConfiguration.productId, {
        onDelete: "cascade",
      }),
    groupKey: text("group_key").notNull(),
    groupLabelId: bigint("group_label_id", { mode: "number" })
      .notNull()
      .references(() => magnetGroupLabel.id, { onDelete: "restrict" }),
    /** Arbitrary-precision metric value preserves exact inch conversions. */
    diameterMm: decimal("diameter_mm").notNull(),
    /** Arbitrary-precision metric value preserves exact inch conversions. */
    thicknessMm: decimal("thickness_mm").notNull(),
    grade: text("grade").notNull(),
    displayOrder: integer("display_order").notNull(),
  },
  (table) => [
    unique("product_magnet_group_id_configuration_unique").on(
      table.id,
      table.configurationProductId,
    ),
    unique("product_magnet_group_configuration_key_unique").on(
      table.configurationProductId,
      table.groupKey,
    ),
    unique("product_magnet_group_configuration_order_unique").on(
      table.configurationProductId,
      table.displayOrder,
    ),
    check(
      "product_magnet_group_key_valid",
      sql`char_length(trim(${table.groupKey})) between 1 and 100`,
    ),
    check(
      "product_magnet_group_dimensions_positive",
      sql`${table.diameterMm} > 0 and ${table.thicknessMm} > 0`,
    ),
    check(
      "product_magnet_group_grade_normalized",
      sql`${table.grade} ~ '^[A-Z0-9][A-Z0-9+_-]{0,19}$'`,
    ),
    check(
      "product_magnet_group_display_order_nonnegative",
      sql`${table.displayOrder} >= 0`,
    ),
  ],
);

/** One exact, source-relative position in a complete catalog layout. */
export const productMagnetSlot = pgTable(
  "product_magnet_slot",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    configurationProductId: bigint("configuration_product_id", {
      mode: "number",
    })
      .notNull()
      .references(() => productMagnetConfiguration.productId, {
        onDelete: "cascade",
      }),
    slotKey: text("slot_key").notNull(),
    half: text("half", { enum: ["half-a", "half-b"] }).notNull(),
    state: text("state", { enum: ["occupied", "empty"] }).notNull(),
    groupId: bigint("group_id", { mode: "number" }),
    documentedRow: integer("documented_row"),
    documentedColumn: integer("documented_column"),
    displayOrder: integer("display_order").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.groupId, table.configurationProductId],
      foreignColumns: [
        productMagnetGroup.id,
        productMagnetGroup.configurationProductId,
      ],
      name: "product_magnet_slot_group_configuration_fk",
    }).onDelete("restrict"),
    unique("product_magnet_slot_configuration_key_unique").on(
      table.configurationProductId,
      table.slotKey,
    ),
    unique("product_magnet_slot_configuration_order_unique").on(
      table.configurationProductId,
      table.displayOrder,
    ),
    check(
      "product_magnet_slot_key_valid",
      sql`char_length(trim(${table.slotKey})) between 1 and 100`,
    ),
    check(
      "product_magnet_slot_half_valid",
      sql`${table.half} in ('half-a', 'half-b')`,
    ),
    check(
      "product_magnet_slot_state_valid",
      sql`${table.state} in ('occupied', 'empty')`,
    ),
    check(
      "product_magnet_slot_state_group_consistent",
      sql`(${table.state} = 'occupied' and ${table.groupId} is not null) or (${table.state} = 'empty' and ${table.groupId} is null)`,
    ),
    check(
      "product_magnet_slot_documented_position_positive",
      sql`(${table.documentedRow} is null or ${table.documentedRow} > 0) and (${table.documentedColumn} is null or ${table.documentedColumn} > 0)`,
    ),
    check(
      "product_magnet_slot_display_order_nonnegative",
      sql`${table.displayOrder} >= 0`,
    ),
  ],
);

/** Catalog subtype marker for one matched slider plate pair or set. */
export const productSliderPlate = pgTable("product_slider_plate", {
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
export const productSliderInsert = pgTable("product_slider_insert", {
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

/** Exact configuration JSON stored by a catalog-authoring template. */
export type MagnetConfigurationValue = {
  /** Ordered exact magnet groups. */
  groups: Array<{
    /** Exact diameter in millimetres. */
    diameterMm: string;
    /** Normalized magnet grade. */
    grade: string;
    /** Stable configuration-scoped group key. */
    key: string;
    /** Global group vocabulary label. */
    label: string;
    /** Exact thickness in millimetres. */
    thicknessMm: string;
  }>;
  /** Global configuration vocabulary label. */
  label: string;
  /** Ordered exact magnet slots. */
  slots: Array<{
    /** Source-documented column, when present. */
    documentedColumn: number | null;
    /** Source-documented row, when present. */
    documentedRow: number | null;
    /** Referenced group key for an occupied slot. */
    groupKey: string | null;
    /** Source-relative physical half. */
    half: "half-a" | "half-b";
    /** Stable configuration-scoped slot key. */
    key: string;
    /** Complete catalog position state. */
    state: "occupied" | "empty";
  }>;
  /** Optional source-relative layout name. */
  sourceLabel: string | null;
  /** Optional notes for the otherwise complete layout. */
  sourceNotes: string | null;
};

/** Owner-recorded insert setup snapshot that may retain unknown positions. */
export type OwnedSliderInsertSetupValue = {
  /** Positive selected click count snapshot, or `null` when not recorded. */
  clickCount: number | null;
  /** Owner-recorded layout snapshot, or `null` when not recorded. */
  configuration:
    | (Omit<MagnetConfigurationValue, "slots"> & {
        /** Ordered positions whose physical state may be unknown. */
        slots: Array<
          Omit<MagnetConfigurationValue["slots"][number], "state"> & {
            /** Owner-recorded position state. */
            state: "occupied" | "empty" | "unknown";
          }
        >;
      })
    | null;
  /** Catalog offer copied as the authoring source, when present. */
  sourceOfferId: number | null;
};

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

/** Catalog slider plate-set mapping selected for a standalone collection item. */
export const collectionSliderPlate = pgTable("collection_slider_plate", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .references(() => collectionItem.id, { onDelete: "cascade" }),
  productSliderPlateId: bigint("product_slider_plate_id", { mode: "number" })
    .notNull()
    .references(() => productSliderPlate.id, { onDelete: "restrict" }),
});

/** Catalog slider insert-set mapping selected for a standalone collection item. */
export const collectionSliderInsert = pgTable("collection_slider_insert", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .references(() => collectionItem.id, { onDelete: "cascade" }),
  productSliderInsertId: bigint("product_slider_insert_id", { mode: "number" })
    .notNull()
    .references(() => productSliderInsert.id, { onDelete: "restrict" }),
  /** Durable owner snapshot; `null` means resolve the live catalog default. */
  setup: jsonb("setup").$type<OwnedSliderInsertSetupValue>(),
});

/** Catalog slider mapping and installed component relationships for collection items. */
export const collectionSlider = pgTable(
  "collection_slider",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .references(() => collectionItem.id, { onDelete: "cascade" }),
    productSliderId: bigint("product_slider_id", { mode: "number" })
      .notNull()
      .references(() => productSlider.id, { onDelete: "restrict" }),
    /** Owned plate set currently installed on this slider. */
    installedPlateId: bigint("installed_plate_id", {
      mode: "number",
    }).references(() => collectionSliderPlate.id, { onDelete: "set null" }),
    /** Owned insert set currently installed on this slider. */
    installedInsertId: bigint("installed_insert_id", {
      mode: "number",
    }).references(() => collectionSliderInsert.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("collection_slider_installed_plate_unique")
      .on(table.installedPlateId)
      .where(sql`${table.installedPlateId} is not null`),
    uniqueIndex("collection_slider_installed_insert_unique")
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
export type ProductSpinner = typeof productSpinner.$inferSelect;
/** Values accepted when creating a product spinner row. */
export type NewProductSpinner = typeof productSpinner.$inferInsert;
/** Stored product spinner button row. */
export type ProductSpinnerButton = typeof productSpinnerButton.$inferSelect;
/** Values accepted when creating a product spinner button row. */
export type NewProductSpinnerButton = typeof productSpinnerButton.$inferInsert;
/** Stored slider body row. */
export type ProductSlider = typeof productSlider.$inferSelect;
/** Values accepted when creating a slider body row. */
export type NewProductSlider = typeof productSlider.$inferInsert;
/** Stored global magnet-configuration vocabulary label. */
export type MagnetConfigurationLabel =
  typeof magnetConfigurationLabel.$inferSelect;
/** Values accepted for a global magnet-configuration vocabulary label. */
export type NewMagnetConfigurationLabel =
  typeof magnetConfigurationLabel.$inferInsert;
/** Stored global magnet-group vocabulary label. */
export type MagnetGroupLabel = typeof magnetGroupLabel.$inferSelect;
/** Values accepted for a global magnet-group vocabulary label. */
export type NewMagnetGroupLabel = typeof magnetGroupLabel.$inferInsert;
/** Stored inherent product magnet configuration. */
export type ProductMagnetConfiguration =
  typeof productMagnetConfiguration.$inferSelect;
/** Values accepted for an inherent product magnet configuration. */
export type NewProductMagnetConfiguration =
  typeof productMagnetConfiguration.$inferInsert;
/** Stored magnet group in a product configuration. */
export type ProductMagnetGroup = typeof productMagnetGroup.$inferSelect;
/** Values accepted for a magnet group in a product configuration. */
export type NewProductMagnetGroup = typeof productMagnetGroup.$inferInsert;
/** Stored exact magnet slot in a product configuration. */
export type ProductMagnetSlot = typeof productMagnetSlot.$inferSelect;
/** Values accepted for an exact magnet slot in a product configuration. */
export type NewProductMagnetSlot = typeof productMagnetSlot.$inferInsert;
/** Stored slider plate-set row. */
export type ProductSliderPlate = typeof productSliderPlate.$inferSelect;
/** Values accepted when creating a slider plate-set row. */
export type NewProductSliderPlate = typeof productSliderPlate.$inferInsert;
/** Stored slider insert-set row. */
export type ProductSliderInsert = typeof productSliderInsert.$inferSelect;
/** Values accepted when creating a slider insert-set row. */
export type NewProductSliderInsert = typeof productSliderInsert.$inferInsert;
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
/** Stored collection slider row. */
export type CollectionSlider = typeof collectionSlider.$inferSelect;
/** Values accepted when creating a collection slider row. */
export type NewCollectionSlider = typeof collectionSlider.$inferInsert;
/** Stored collection slider plate-set row. */
export type CollectionSliderPlate = typeof collectionSliderPlate.$inferSelect;
/** Values accepted when creating a collection slider plate-set row. */
export type NewCollectionSliderPlate =
  typeof collectionSliderPlate.$inferInsert;
/** Stored collection slider insert-set row. */
export type CollectionSliderInsert = typeof collectionSliderInsert.$inferSelect;
/** Values accepted when creating a collection slider insert-set row. */
export type NewCollectionSliderInsert =
  typeof collectionSliderInsert.$inferInsert;
