import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
export const uploadTargetTypes = [
  "product",
  "collection",
  "collection_item",
  "resource",
] as const;
export const uploadFileKinds = ["image", "file"] as const;
export const uploadSession = pgTable(
  "upload_session",
  {
    id: uuid("id").primaryKey(),
    uploaderClerkId: text("uploader_clerk_id").notNull(),
    targetType: text("target_type", { enum: uploadTargetTypes }).notNull(),
    targetId: bigint("target_id", { mode: "number" }).notNull(),
    reservedResourceId: bigint("reserved_resource_id", { mode: "number" }),
    reservedVersion: integer("reserved_version"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
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
  (t) => [
    index("upload_session_expiry_idx").on(t.expiresAt),
    index("upload_session_owner_idx").on(t.uploaderClerkId),
    check(
      "upload_session_target_type_valid",
      sql`${t.targetType} in ('product', 'collection', 'collection_item', 'resource')`,
    ),
    check("upload_session_target_id_valid", sql`${t.targetId} > 0`),
    check(
      "upload_session_version_valid",
      sql`${t.reservedVersion} is null or ${t.reservedVersion} > 0`,
    ),
    uniqueIndex("upload_session_resource_version_reserved")
      .on(t.targetId, t.reservedVersion)
      .where(sql`${t.targetType} = 'resource' and ${t.completedAt} is null`),
  ],
);
export const uploadFile = pgTable(
  "upload_file",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => uploadSession.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: uploadFileKinds }).notNull(),
    position: integer("position").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256").notNull(),
    objectPath: text("object_path").notNull(),
    url: text("url").notNull(),
    uploadedAt: timestamp("uploaded_at", { mode: "date", withTimezone: true }),
  },
  (t) => [
    index("upload_file_session_idx").on(t.sessionId),
    unique("upload_file_path_reserved").on(t.objectPath),
    unique("upload_file_kind_hash_unique").on(t.sessionId, t.kind, t.sha256),
    uniqueIndex("upload_file_name_unique").on(
      t.sessionId,
      t.kind,
      sql`lower(${t.fileName})`,
    ),
    check("upload_file_kind_valid", sql`${t.kind} in ('image','file')`),
    check("upload_file_size_valid", sql`${t.size} > 0`),
    check("upload_file_position_valid", sql`${t.position} >= 0`),
    check("upload_file_hash_valid", sql`${t.sha256} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const storageObjectDeletion = pgTable(
  "storage_object_deletion",
  {
    objectPath: text("object_path").primaryKey(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("storage_object_deletion_created_idx").on(t.createdAt)],
);
