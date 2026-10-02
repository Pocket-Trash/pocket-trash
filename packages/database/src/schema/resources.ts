import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Lifecycle events that create resource notifications. */
export const resourceNotificationTypes = [
  "resource_created",
  "category_created",
] as const;
/** Roles allowed to soft-delete resources. */
export const resourceDeletionRoles = ["owner", "admin"] as const;

/** User-uploaded resources and their lifecycle state. */
export const resources = pgTable(
  "resources",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    uploaderClerkId: text("uploader_clerk_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    isPrivate: boolean("is_private").default(false).notNull(),
    privateReason: text("private_reason"),
    privatedAt: timestamp("privated_at", { mode: "date", withTimezone: true }),
    privatedByClerkId: text("privated_by_clerk_id"),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
    deletedByClerkId: text("deleted_by_clerk_id"),
    deletedByRole: text("deleted_by_role", {
      enum: resourceDeletionRoles,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("resources_created_at_idx").on(table.createdAt),
    index("resources_deleted_at_idx").on(table.deletedAt),
    index("resources_uploader_clerk_id_idx").on(table.uploaderClerkId),
    check(
      "resources_private_metadata_consistent",
      sql`(not ${table.isPrivate} and num_nonnulls(${table.privateReason}, ${table.privatedAt}, ${table.privatedByClerkId}) = 0) or (${table.isPrivate} and (num_nonnulls(${table.privateReason}, ${table.privatedAt}, ${table.privatedByClerkId}) = 0 or (${table.privateReason} is not null and ${table.privatedAt} is not null)))`,
    ),
    check(
      "resources_deletion_metadata_consistent",
      sql`(${table.deletedAt} is null and ${table.deletedByClerkId} is null and ${table.deletedByRole} is null) or (${table.deletedAt} is not null and ${table.deletedByRole} is not null)`,
    ),
    check(
      "resources_deleted_by_role_valid",
      sql`${table.deletedByRole} is null or ${table.deletedByRole} in ('owner', 'admin')`,
    ),
  ],
);

/** Ordered images attached to resources; position zero is the cover image. */
export const resourceImages = pgTable(
  "resource_images",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    resourceId: bigint("resource_id", { mode: "number" })
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    storageProvider: text("storage_provider").notNull().default("bunny"),
    objectPath: text("object_path").notNull(),
    url: text("url").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("resource_images_resource_id_idx").on(table.resourceId),
    unique("resource_images_resource_position_unique").on(
      table.resourceId,
      table.position,
    ),
    unique("resource_images_object_path_unique").on(table.objectPath),
    check("resource_images_position_valid", sql`${table.position} >= 0`),
    check("resource_images_size_positive", sql`${table.size} > 0`),
  ],
);

/** Immutable uploaded file versions of resources. */
export const resourceVersions = pgTable(
  "resource_versions",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    resourceId: bigint("resource_id", { mode: "number" })
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    legacyFileName: text("file_name"),
    legacyContentType: text("content_type"),
    legacySize: integer("size"),
    legacyStorageProvider: text("storage_provider").default("bunny"),
    legacyObjectPath: text("object_path"),
    legacyUrl: text("url"),
    archiveObjectPath: text("archive_object_path"),
    anonymousDownloadCount: integer("anonymous_download_count")
      .default(0)
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("resource_versions_resource_id_idx").on(table.resourceId),
    unique("resource_versions_resource_version_unique").on(
      table.resourceId,
      table.version,
    ),
    unique("resource_versions_object_path_unique").on(table.legacyObjectPath),
    unique("resource_versions_archive_object_path_unique").on(
      table.archiveObjectPath,
    ),
    check("resource_versions_version_positive", sql`${table.version} > 0`),
    check("resource_versions_size_positive", sql`${table.legacySize} > 0`),
    check(
      "resource_versions_anonymous_download_count_nonnegative",
      sql`${table.anonymousDownloadCount} >= 0`,
    ),
  ],
);

/** Files belonging to immutable resource versions. */
export const resourceFiles = pgTable(
  "resource_files",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    versionId: bigint("version_id", { mode: "number" })
      .notNull()
      .references(() => resourceVersions.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    storageProvider: text("storage_provider").notNull().default("bunny"),
    objectPath: text("object_path").notNull(),
    url: text("url").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("resource_files_version_id_idx").on(table.versionId),
    unique("resource_files_object_path_unique").on(table.objectPath),
    uniqueIndex("resource_files_version_file_name_unique").on(
      table.versionId,
      sql`lower(${table.fileName})`,
    ),
    check("resource_files_size_positive", sql`${table.size} > 0`),
  ],
);

/** Reusable categories assigned to resources. */
export const resourceCategories = pgTable("resource_categories", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity({ startWith: 1000 }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdByClerkId: text("created_by_clerk_id"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Unique resource-to-category assignments. */
export const resourcesToCategories = pgTable(
  "resources_to_categories",
  {
    resourceId: bigint("resource_id", { mode: "number" })
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    categoryId: bigint("category_id", { mode: "number" })
      .notNull()
      .references(() => resourceCategories.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.resourceId, table.categoryId] }),
    index("resources_to_categories_category_id_idx").on(table.categoryId),
  ],
);

/** Unique authenticated downloads of resource versions. */
export const resourceDownloads = pgTable(
  "resource_downloads",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    versionId: bigint("version_id", { mode: "number" })
      .notNull()
      .references(() => resourceVersions.id, { onDelete: "cascade" }),
    userClerkId: text("user_clerk_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("resource_downloads_version_id_idx").on(table.versionId),
    unique("resource_downloads_version_user_unique").on(
      table.versionId,
      table.userClerkId,
    ),
  ],
);

/** Admin notifications emitted for new resources and categories. */
export const resourceNotifications = pgTable(
  "resource_notifications",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    type: text("type", { enum: resourceNotificationTypes }).notNull(),
    resourceId: bigint("resource_id", { mode: "number" })
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    categoryId: bigint("category_id", { mode: "number" }).references(
      () => resourceCategories.id,
      { onDelete: "restrict" },
    ),
    uploaderClerkId: text("uploader_clerk_id").notNull(),
    readAt: timestamp("read_at", { mode: "date", withTimezone: true }),
    readByClerkId: text("read_by_clerk_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("resource_notifications_created_at_idx").on(table.createdAt),
    check(
      "resource_notifications_type_valid",
      sql`${table.type} in ('resource_created', 'category_created')`,
    ),
    check(
      "resource_notifications_category_matches_type",
      sql`(${table.type} = 'category_created') = (${table.categoryId} is not null)`,
    ),
    check(
      "resource_notifications_read_metadata_consistent",
      sql`num_nonnulls(${table.readAt}, ${table.readByClerkId}) in (0, 2)`,
    ),
  ],
);

/** Stored resource row. */
export type Resource = typeof resources.$inferSelect;
/** Values accepted when creating a resource row. */
export type NewResource = typeof resources.$inferInsert;
/** Stored resource version row. */
export type ResourceVersion = typeof resourceVersions.$inferSelect;
/** Values accepted when creating a resource version row. */
export type NewResourceVersion = typeof resourceVersions.$inferInsert;
/** Stored resource file row. */
export type ResourceFile = typeof resourceFiles.$inferSelect;
/** Values accepted when creating a resource file row. */
export type NewResourceFile = typeof resourceFiles.$inferInsert;

/** Stored resource image row. */
export type ResourceImage = typeof resourceImages.$inferSelect;
/** Values accepted when creating a resource image row. */
export type NewResourceImage = typeof resourceImages.$inferInsert;
/** Stored resource category row. */
export type ResourceCategory = typeof resourceCategories.$inferSelect;
/** Values accepted when creating a resource category row. */
export type NewResourceCategory = typeof resourceCategories.$inferInsert;
/** Stored resource download row. */
export type ResourceDownload = typeof resourceDownloads.$inferSelect;
/** Values accepted when creating a resource download row. */
export type NewResourceDownload = typeof resourceDownloads.$inferInsert;
/** Stored resource notification row. */
export type ResourceNotification = typeof resourceNotifications.$inferSelect;
/** Values accepted when creating a resource notification row. */
export type NewResourceNotification = typeof resourceNotifications.$inferInsert;
