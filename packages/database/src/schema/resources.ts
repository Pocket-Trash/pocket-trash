import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const resourceNotificationTypes = [
  "resource_created",
  "category_created",
] as const;
export const resourceUploadOperations = ["create", "version"] as const;
export const resourceUploadFileKinds = ["resource", "image"] as const;
export const resourceDeletionRoles = ["owner", "admin"] as const;

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
      sql`(${table.isPrivate} and num_nonnulls(${table.privateReason}, ${table.privatedAt}, ${table.privatedByClerkId}) in (0, 3)) or (not ${table.isPrivate} and num_nonnulls(${table.privateReason}, ${table.privatedAt}, ${table.privatedByClerkId}) = 0)`,
    ),
    check(
      "resources_deletion_metadata_consistent",
      sql`num_nonnulls(${table.deletedAt}, ${table.deletedByClerkId}, ${table.deletedByRole}) in (0, 3)`,
    ),
    check(
      "resources_deleted_by_role_valid",
      sql`${table.deletedByRole} is null or ${table.deletedByRole} in ('owner', 'admin')`,
    ),
  ],
);

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
    check("resource_versions_version_positive", sql`${table.version} > 0`),
    check("resource_versions_size_positive", sql`${table.legacySize} > 0`),
  ],
);

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

export const resourceUploadSessions = pgTable(
  "resource_upload_sessions",
  {
    id: uuid("id").primaryKey(),
    uploaderClerkId: text("uploader_clerk_id").notNull(),
    operation: text("operation", {
      enum: resourceUploadOperations,
    }).notNull(),
    resourceId: bigint("resource_id", { mode: "number" }).references(
      () => resources.id,
      { onDelete: "cascade" },
    ),
    reservedResourceId: bigint("reserved_resource_id", { mode: "number" }),
    name: text("name"),
    description: text("description"),
    categories: jsonb("categories")
      .$type<Array<{ name: string; slug: string }>>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    isPrivate: boolean("is_private").default(false).notNull(),
    completedResourceId: bigint("completed_resource_id", {
      mode: "number",
    }).references(() => resources.id, { onDelete: "cascade" }),
    completedVersion: integer("completed_version"),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    completedAt: timestamp("completed_at", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("resource_upload_sessions_expires_at_idx").on(table.expiresAt),
    index("resource_upload_sessions_uploader_clerk_id_idx").on(
      table.uploaderClerkId,
    ),
    check(
      "resource_upload_sessions_operation_valid",
      sql`${table.operation} in ('create', 'version')`,
    ),
    check(
      "resource_upload_sessions_metadata_consistent",
      sql`(${table.operation} = 'create' and ${table.resourceId} is null and ${table.reservedResourceId} is not null and num_nonnulls(${table.name}, ${table.description}) = 2 and jsonb_array_length(${table.categories}) between 1 and 10) or (${table.operation} = 'version' and ${table.resourceId} is not null and ${table.reservedResourceId} is null and num_nonnulls(${table.name}, ${table.description}) = 0 and ${table.categories} = '[]'::jsonb and not ${table.isPrivate})`,
    ),
    check(
      "resource_upload_sessions_completion_consistent",
      sql`num_nonnulls(${table.completedResourceId}, ${table.completedVersion}, ${table.completedAt}) in (0, 3)`,
    ),
  ],
);

export const resourceUploadFiles = pgTable(
  "resource_upload_files",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => resourceUploadSessions.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: resourceUploadFileKinds }).notNull(),
    position: integer("position").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    objectPath: text("object_path").notNull(),
    url: text("url").notNull(),
    uploadedAt: timestamp("uploaded_at", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("resource_upload_files_session_id_idx").on(table.sessionId),
    unique("resource_upload_files_object_path_unique").on(table.objectPath),
    uniqueIndex("resource_upload_files_session_file_name_unique")
      .on(table.sessionId, sql`lower(${table.fileName})`)
      .where(sql`${table.kind} = 'resource'`),
    unique("resource_upload_files_session_kind_position_unique").on(
      table.sessionId,
      table.kind,
      table.position,
    ),
    check(
      "resource_upload_files_kind_valid",
      sql`${table.kind} in ('resource', 'image')`,
    ),
    check("resource_upload_files_position_valid", sql`${table.position} >= 0`),
    check("resource_upload_files_size_positive", sql`${table.size} > 0`),
  ],
);

export const resourceCategories = pgTable("resource_categories", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity({ startWith: 1000 }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdByClerkId: text("created_by_clerk_id").notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

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

export const resourceDownloads = pgTable(
  "resource_downloads",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    versionId: bigint("version_id", { mode: "number" }).references(
      () => resourceVersions.id,
      { onDelete: "restrict" },
    ),
    fileId: bigint("file_id", { mode: "number" }).references(
      () => resourceFiles.id,
      { onDelete: "restrict" },
    ),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("resource_downloads_version_id_idx").on(table.versionId),
    index("resource_downloads_file_id_idx").on(table.fileId),
  ],
);

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

export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;
export type ResourceVersion = typeof resourceVersions.$inferSelect;
export type NewResourceVersion = typeof resourceVersions.$inferInsert;
export type ResourceFile = typeof resourceFiles.$inferSelect;
export type NewResourceFile = typeof resourceFiles.$inferInsert;
export type ResourceUploadSession = typeof resourceUploadSessions.$inferSelect;
export type NewResourceUploadSession =
  typeof resourceUploadSessions.$inferInsert;
export type ResourceUploadFile = typeof resourceUploadFiles.$inferSelect;
export type NewResourceUploadFile = typeof resourceUploadFiles.$inferInsert;
export type ResourceImage = typeof resourceImages.$inferSelect;
export type NewResourceImage = typeof resourceImages.$inferInsert;
export type ResourceCategory = typeof resourceCategories.$inferSelect;
export type NewResourceCategory = typeof resourceCategories.$inferInsert;
export type ResourceDownload = typeof resourceDownloads.$inferSelect;
export type NewResourceDownload = typeof resourceDownloads.$inferInsert;
export type ResourceNotification = typeof resourceNotifications.$inferSelect;
export type NewResourceNotification = typeof resourceNotifications.$inferInsert;
