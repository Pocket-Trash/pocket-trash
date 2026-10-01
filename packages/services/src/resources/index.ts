import type { Database } from "@package/database";
import { schema } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import {
  createUncompressedZip,
  createUploadStorage,
  maxResourceImages,
  maxResourceSessionBytes,
  sha256,
  signResourceUrl,
  type UploadInput,
  type UploadResult,
  type UploadStorage,
  type UploadStorageConfig,
} from "@package/storage";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  type SQL,
  sql,
} from "drizzle-orm";
import { type Actor, hasPermission } from "../authorization.js";
import { type AuditService, createAuditService } from "../db/audit/index.js";
import {
  loadResourceAuditContext,
  resourceAudit,
  resourceAuditEvents,
  writeResourceAudit,
} from "../db/audit/resources.js";
import { signImages } from "../images/sign-images.js";
import { hashLogIdentifier, loggedMutation } from "../logging.js";
import { lockTarget } from "../storage/image-records.js";
import { createStorageService } from "../storage/index.js";
import {
  assertNotPendingDeletion,
  cleanupObjectDeletions,
  queueObjectDeletions,
} from "../storage/object-lifecycle.js";

/** Input for creating a resource and its initial version. */
export type CreateResourceInput = {
  /** User creating the resource. */
  actor: Actor;
  /** Category names assigned to the resource. */
  categories: string[];
  /** Resource description. */
  description: string;
  /** Files in the initial version. */
  files: UploadInput[];
  /** Resource gallery images. */
  images: UploadInput[];
  /** Resource name. */
  name: string;
};

/** Input for editing resource metadata and gallery images. */
export type UpdateResourceInput = {
  /** User editing the resource. */
  actor: Actor;
  /** Category names assigned to the resource. */
  categories: string[];
  /** Resource description. */
  description: string;
  /** New gallery images. */
  images: UploadInput[];
  /** Resource name. */
  name: string;
  /** Existing gallery image identifiers to retain. */
  retainedImageIds: number[];
  /** Resource identifier. */
  resourceId: number;
  /** Required staff reason for a cross-owner edit. */
  reason?: string;
};

/** Actor viewing a resource. */
export type ResourceViewer = Actor;

/** Input for uploading a new resource version. */
export type UploadResourceVersionInput = {
  /** User uploading the version. */
  actor: Actor;
  /** Files in the new version. */
  files: UploadInput[];
  /** Resource identifier. */
  resourceId: number;
  /** Required staff reason for a cross-owner upload. */
  reason?: string;
};

/** Resource version returned to clients. */
export type ResourceVersionDetail = {
  /** Version creation time. */
  createdAt: Date;
  /** Recorded download count. */
  downloadCount: number;
  /** Files attached to the version. */
  files: ResourceFileDetail[];
  /** Version identifier. */
  id: number;
  /** Sequential version number. */
  version: number;
};

/** Resource file returned to clients. */
export type ResourceFileDetail = {
  /** File media type. */
  contentType: string;
  /** Original file name. */
  fileName: string;
  /** File identifier. */
  id: number;
  /** File size in bytes. */
  size: number;
};

/** Resource image returned to clients. */
export type ResourceImageDetail = {
  /** Image media type. */
  contentType: string;
  /** Original image file name. */
  fileName: string;
  /** Image identifier. */
  id: number;
  /** Gallery position. */
  position: number;
  /** Image size in bytes. */
  size: number;
  /** Signed image URL. */
  url: string;
};

/** Full resource detail returned to clients. */
export type ResourceDetail = {
  /** Assigned categories. */
  categories: {
    /** Category identifier. */
    id: number;
    /** Category name. */
    name: string;
    /** Category slug. */
    slug: string;
  }[];
  /** Resource creation time. */
  createdAt: Date;
  /** Latest resource version. */
  currentVersion: ResourceVersionDetail;
  /** Resource description. */
  description: string;
  /** Download count across versions. */
  downloadCount: number;
  /** Resource identifier. */
  id: number;
  /** Gallery images. */
  images: ResourceImageDetail[];
  /** Whether staff made the resource private. */
  isAdminPrivate: boolean;
  /** Whether the resource is private. */
  isPrivate: boolean;
  /** Resource name. */
  name: string;
  /** Staff privacy reason, or `null` when staff did not make the resource private. */
  privateReason: string | null;
  /** Time staff made the resource private, or `null` when no moderation action applies. */
  privatedAt: Date | null;
  /** Clerk identifier of the uploader. */
  uploaderClerkId: string;
  /** Public uploader username. */
  uploaderUsername: string;
  /** Earlier resource versions. */
  versions: ResourceVersionDetail[];
};

/** Resource directory response. */
export type ResourceDirectory = {
  /** Available categories. */
  categories: {
    /** Category identifier. */
    id: number;
    /** Category name. */
    name: string;
    /** Category slug. */
    slug: string;
  }[];
  /** Unknown requested category slugs. */
  invalidFilters: string[];
  /** Matching resources. */
  resources: ResourceDirectoryItem[];
};

/** Resource summary returned in directory listings. */
export type ResourceDirectoryItem = {
  /** Assigned categories. */
  categories: {
    /** Category identifier. */
    id: number;
    /** Category name. */
    name: string;
    /** Category slug. */
    slug: string;
  }[];
  /** Resource creation time. */
  createdAt: Date;
  /** Latest version summary. */
  currentVersion: {
    /** Number of files in the version. */
    fileCount: number;
    /** First file identifier. */
    fileId: number;
    /** First file name. */
    fileName: string;
    /** Version identifier. */
    id: number;
    /** Sequential version number. */
    version: number;
  };
  /** Download count across versions. */
  downloadCount: number;
  /** Signed cover image URL, or `null` when the resource has no gallery image. */
  coverImageUrl: string | null;
  /** Resource identifier. */
  id: number;
  /** Whether the resource is private. */
  isPrivate: boolean;
  /** Resource name. */
  name: string;
  /** Staff privacy reason, or `null` when staff did not make the resource private. */
  privateReason: string | null;
  /** Clerk identifier of the uploader. */
  uploaderClerkId: string;
  /** Public uploader username. */
  uploaderUsername: string;
};

/** Resource notification shown to staff. */
export type ResourceNotificationItem = {
  /** Current category names. */
  categories: string[];
  /** Category associated with the notification, or `null` for non-category events. */
  categoryName: string | null;
  /** Notification creation time. */
  createdAt: Date;
  /** Notification identifier. */
  id: number;
  /** Whether the resource is private. */
  isPrivate: boolean;
  /** Notification read time, or `null` while unread. */
  readAt: Date | null;
  /** Username of the staff reader, or `null` while unread or when the reader identity is unavailable. */
  readByUsername: string | null;
  /** Resource identifier. */
  resourceId: number;
  /** Resource name. */
  resourceName: string;
  /** Notification type. */
  type: (typeof schema.resourceNotificationTypes)[number];
  /** Public uploader username. */
  uploaderUsername: string;
};

/** Soft-deleted resource returned in trash listings. */
export type ResourceTrashItem = {
  /** Deletion time. */
  deletedAt: Date;
  /** Username of the deleting actor. */
  deletedByUsername: string;
  /** Role used for deletion. */
  deletedByRole: (typeof schema.resourceDeletionRoles)[number];
  /** Resource identifier. */
  id: number;
  /** Whether the resource is private. */
  isPrivate: boolean;
  /** Resource name. */
  name: string;
  /** Public uploader username. */
  uploaderUsername: string;
};

/** Resource catalog operations. */
export type ResourcesService = {
  /**
   * Adds a resource version.
   *
   * @param input - Version upload input.
   * @returns Created version identity.
   * @rejects When validation, authorization, upload, persistence, audit, or logging fails.
   */
  addVersion(input: UploadResourceVersionInput): Promise<{
    /** Version identifier. */
    id: number;
    /** Sequential version number. */
    version: number;
  }>;
  /**
   * Creates a resource.
   *
   * @param input - Resource creation input.
   * @returns Created resource identity.
   * @rejects When validation, upload, persistence, audit, or logging fails.
   */
  create(input: CreateResourceInput): Promise<{
    /** Resource identifier. */
    id: number;
  }>;
  /**
   * Downloads a resource file.
   *
   * @param resourceId - Resource identifier.
   * @param fileId - File identifier.
   * @param viewer - Optional viewer.
   * @returns Signed file URL, or `null` when the file is missing or inaccessible.
   * @rejects When an identifier is invalid or database, signing, or logging work fails.
   */
  downloadFile(
    resourceId: number,
    fileId: number,
    viewer?: ResourceViewer,
  ): Promise<string | null>;
  /**
   * Downloads a resource version archive.
   *
   * @param resourceId - Resource identifier.
   * @param versionId - Version identifier.
   * @param viewer - Optional viewer.
   * @returns Signed archive URL, or `null` when the version is missing, inaccessible, or has fewer than two files.
   * @rejects When an identifier is invalid or database, storage, signing, or logging work fails.
   */
  downloadVersion(
    resourceId: number,
    versionId: number,
    viewer?: ResourceViewer,
  ): Promise<string | null>;
  /**
   * Gets resource details.
   *
   * @param resourceId - Resource identifier.
   * @param viewer - Optional viewer.
   * @returns Resource details, or `null` when the resource is missing or inaccessible.
   * @rejects When the identifier is invalid or database, signing, or logging work fails.
   */
  getDetail(
    resourceId: number,
    viewer?: ResourceViewer,
  ): Promise<ResourceDetail | null>;
  /**
   * Lists the resource directory.
   *
   * @param categorySlugs - Category filters.
   * @param viewer - Optional viewer.
   * @returns Filtered directory with resources ordered newest-first.
   * @rejects When category validation, database, signing, or logging fails.
   */
  listDirectory(
    categorySlugs?: string[],
    viewer?: ResourceViewer,
  ): Promise<ResourceDirectory>;
  /**
   * Lists soft-deleted resources visible to staff.
   *
   * @returns Soft-deleted resources ordered newest-first.
   * @rejects When database access or logging fails.
   */
  listAdminTrash(): Promise<ResourceTrashItem[]>;
  /**
   * Lists resource notifications visible to staff.
   *
   * @returns Resource notifications ordered newest-first.
   * @rejects When database access or logging fails.
   */
  listNotifications(): Promise<ResourceNotificationItem[]>;
  /**
   * Lists resources owned by an account.
   *
   * @param uploaderClerkId - Owner Clerk identifier.
   * @returns Owned resource summaries ordered by latest update.
   * @rejects When owner validation, database access, or logging fails.
   */
  listOwned(uploaderClerkId: string): Promise<
    {
      /** Resource identifier. */
      id: number;
      /** Whether the resource is private. */
      isPrivate: boolean;
      /** Resource name. */
      name: string;
      /** Staff privacy reason, or `null` when staff did not make the resource private. */
      privateReason: string | null;
      /** Last update time. */
      updatedAt: Date;
      /** Latest version number. */
      version: number;
    }[]
  >;
  /**
   * Lists owner-deleted resources.
   *
   * @param uploaderClerkId - Owner Clerk identifier.
   * @returns Owner trash items ordered newest-first.
   * @rejects When owner validation, database access, or logging fails.
   */
  listOwnerTrash(uploaderClerkId: string): Promise<ResourceTrashItem[]>;
  /**
   * Lists resource categories.
   *
   * @param search - Optional category search.
   * @returns Up to 20 matching categories in alphabetical order.
   * @rejects When database access or logging fails.
   */
  listCategories(search?: string): Promise<
    {
      /** Category identifier. */
      id: number;
      /** Category name. */
      name: string;
      /** Category slug. */
      slug: string;
    }[]
  >;
  /**
   * Marks a resource notification read.
   *
   * @param notificationId - Notification identifier.
   * @param actorClerkId - Reader Clerk identifier.
   * @returns Completion after updating the notification.
   * @rejects When the identifier is invalid or database access or logging fails.
   */
  markNotificationRead(
    notificationId: number,
    actorClerkId: string,
  ): Promise<void>;
  /**
   * Makes a resource private as staff.
   *
   * @param input - Actor, reason, and resource identity.
   * @returns Completion after moderation.
   * @rejects When validation, authorization, persistence, audit, or logging fails.
   */
  markPrivate(input: {
    /** Staff actor. */
    actor: Actor;
    /** Moderation reason. */
    reason: string;
    /** Resource identifier. */
    resourceId: number;
  }): Promise<void>;
  /**
   * Permanently purges a soft-deleted resource.
   *
   * @param input - Actor, reason, and resource identity.
   * @returns Completion after deletion is queued.
   * @rejects When validation, authorization, persistence, deletion queuing, audit, or logging fails.
   */
  permanentlyDelete(input: {
    /** Staff actor. */
    actor: Actor;
    /** Purge reason. */
    reason: string;
    /** Resource identifier. */
    resourceId: number;
  }): Promise<void>;
  /**
   * Changes resource visibility.
   *
   * @param input - Visibility change input.
   * @returns Completion after the update.
   * @rejects When validation, authorization, persistence, audit, or logging fails.
   */
  setVisibility(input: {
    /** User changing visibility. */
    actor: Actor;
    /** Whether the resource should be public. */
    isPublic: boolean;
    /** Required staff reason for a cross-owner change. */
    reason?: string;
    /** Resource identifier. */
    resourceId: number;
  }): Promise<void>;
  /**
   * Restores a soft-deleted resource.
   *
   * @param input - Restore input.
   * @returns Completion after restoration.
   * @rejects When validation, authorization, persistence, audit, or logging fails.
   */
  restore(input: {
    /** User restoring the resource. */
    actor: Actor;
    /** Required staff reason for a cross-owner restore. */
    reason?: string;
    /** Resource identifier. */
    resourceId: number;
  }): Promise<void>;
  /**
   * Soft-deletes a resource.
   *
   * @param input - Deletion input.
   * @returns Recorded deletion role.
   * @rejects When validation, authorization, persistence, audit, or logging fails.
   */
  softDelete(input: {
    /** User deleting the resource. */
    actor: Actor;
    /** Required staff reason for a cross-owner deletion. */
    reason?: string;
    /** Resource identifier. */
    resourceId: number;
  }): Promise<{
    /** Role recorded for the deletion. */
    deletedByRole: ResourceTrashItem["deletedByRole"];
  }>;
  /**
   * Updates resource metadata and images.
   *
   * @param input - Resource update input.
   * @returns Updated resource identity.
   * @rejects When validation, authorization, upload, persistence, audit, or logging fails.
   */
  update(input: UpdateResourceInput): Promise<{
    /** Resource identifier. */
    id: number;
  }>;
};

/**
 * Creates the resource service.
 *
 * @param db - Application database.
 * @param storage - Resource object storage.
 * @param logger - Application logger.
 * @param signUrl - Signs a resource object path for access.
 * @param audit - Optional audit service for resource mutations.
 * @returns The configured resource service.
 */
export function createResourcesService(
  db: Database,
  storage: UploadStorage,
  logger: Logger,
  signUrl: (objectPath: string) => Promise<string> = async () => {
    throw new Error("Resource URL signing is not configured.");
  },
  audit?: AuditService,
): ResourcesService {
  return {
    /**
     * Adds a resource version.
     *
     * @param input - Version upload input.
     * @returns Created version identity.
     * @rejects When validation, authorization, upload, persistence, audit, or logging fails.
     */
    async addVersion(input) {
      return await loggedMutation(
        logger,
        loggerMessages.resources.addVersion,
        async () => {
          const result = await uploadBufferedSession(
            db,
            storage,
            logger,
            input,
            { type: "resource", id: input.resourceId },
            { operation: "version", reason: input.reason },
            audit,
          );
          const version = await db
            .select({
              id: schema.resourceVersions.id,
              version: schema.resourceVersions.version,
            })
            .from(schema.resourceVersions)
            .where(
              and(
                eq(schema.resourceVersions.resourceId, result.resourceId),
                eq(schema.resourceVersions.version, result.version),
              ),
            )
            .limit(1);
          if (!version[0]) throw new Error("Resource version is missing.");
          return version[0];
        },
        {
          attributes: {
            fileCount: input.files.length,
            resourceId: input.resourceId,
            uploaderClerkIdHash: hashLogIdentifier(input.actor.clerkId),
          },
        },
      );
    },
    /**
     * Creates a resource.
     *
     * @param input - Resource creation input.
     * @returns Created resource identity.
     * @rejects When validation, upload, persistence, audit, or logging fails.
     */
    async create(input) {
      return await loggedMutation(
        logger,
        loggerMessages.resources.create,
        async () => {
          const result = await uploadBufferedSession(
            db,
            storage,
            logger,
            input,
            { type: "resource" },
            {
              operation: "create",
              name: input.name,
              description: input.description,
              categories: input.categories,
            },
            audit,
          );
          return { id: result.resourceId };
        },
        {
          attributes: {
            categoryCount: input.categories.length,
            fileCount: input.files.length,
            imageCount: input.images.length,
            uploaderClerkIdHash: hashLogIdentifier(input.actor.clerkId),
          },
        },
      );
    },
    /**
     * Downloads a resource file.
     *
     * @param resourceId - Resource identifier.
     * @param fileId - File identifier.
     * @param viewer - Optional viewer.
     * @returns Signed file URL, or `null` when the file is missing or inaccessible.
     * @rejects When an identifier is invalid or database, signing, or logging work fails.
     */
    async downloadFile(resourceId, fileId, viewer) {
      return await logger.operation(
        loggerMessages.resources.download,
        async () => {
          assertPositiveInteger(resourceId, "resourceId");
          assertPositiveInteger(fileId, "fileId");

          const result = await db.execute<{
            /** Stored path signed to download the requested file. */
            objectPath: string;
            /** Owning version recorded in the download event. */
            versionId: number;
          }>(sql`
            select resource_files.object_path as "objectPath",
              resource_versions.id as "versionId"
            from resource_files
            inner join resource_versions
              on resource_versions.id = resource_files.version_id
            inner join resources
              on resources.id = resource_versions.resource_id
            where resource_files.id = ${fileId}
              and resource_versions.resource_id = ${resourceId}
              and resources.deleted_at is null
              and (resources.is_private = false
                or ${hasPermission(viewer, "resources.manage")}
                or resources.uploader_clerk_id = ${viewer?.clerkId ?? ""})
            limit 1
          `);
          const file = result.rows[0];

          if (!file) return null;

          const url = await signUrl(file.objectPath);
          await recordResourceDownload(db, file.versionId, viewer?.clerkId);
          return url;
        },
        { attributes: { fileId, resourceId } },
      );
    },
    /**
     * Downloads a resource version archive.
     *
     * @param resourceId - Resource identifier.
     * @param versionId - Version identifier.
     * @param viewer - Optional viewer.
     * @returns Signed archive URL, or `null` when the version is missing, inaccessible, or has fewer than two files.
     * @rejects When an identifier is invalid or database, storage, signing, or logging work fails.
     */
    async downloadVersion(resourceId, versionId, viewer) {
      return await logger.operation(
        loggerMessages.resources.download,
        async () => {
          assertPositiveInteger(resourceId, "resourceId");
          assertPositiveInteger(versionId, "versionId");
          const result = await db.execute<{
            /** Archive object path, or `null` before an archive is recorded. */
            archiveObjectPath: string | null;
            /** Download filename stored in the archive. */
            fileName: string;
            /** Stored file object path. */
            objectPath: string;
            /**
             * File size in bytes.
             */
            size: number;
            /** Human-facing resource version number. */
            version: number;
            /** Version whose files are assembled into the archive. */
            versionId: number;
          }>(sql`
            select resource_versions.id as "versionId",
              resource_versions.version,
              resource_versions.archive_object_path as "archiveObjectPath",
              resource_files.file_name as "fileName",
              resource_files.object_path as "objectPath",
              resource_files.size
            from resource_versions
            inner join resources
              on resources.id = resource_versions.resource_id
            inner join resource_files
              on resource_files.version_id = resource_versions.id
            where resource_versions.id = ${versionId}
              and resource_versions.resource_id = ${resourceId}
              and resources.deleted_at is null
              and (resources.is_private = false
                or ${hasPermission(viewer, "resources.manage")}
                or resources.uploader_clerk_id = ${viewer?.clerkId ?? ""})
            order by resource_files.id
          `);
          const firstFile = result.rows[0];
          if (!firstFile || result.rows.length < 2) return null;

          const objectPath =
            firstFile.archiveObjectPath ??
            (await createVersionArchive(
              db,
              storage,
              resourceId,
              versionId,
              firstFile.version,
              result.rows,
            ));
          const url = await signUrl(objectPath);
          await recordResourceDownload(db, versionId, viewer?.clerkId);
          return url;
        },
        { attributes: { resourceId, versionId } },
      );
    },
    /**
     * Gets resource detail.
     *
     * @param resourceId - Resource identifier.
     * @param viewer - Optional viewer.
     * @returns Resource detail, or `null` when the resource is missing or inaccessible.
     * @rejects When the identifier is invalid or database, signing, or logging work fails.
     */
    async getDetail(resourceId, viewer) {
      return await logger.operation(
        loggerMessages.resources.getDetail,
        async () => {
          assertPositiveInteger(resourceId, "resourceId");
          const [record] = await db
            .select({
              resource: schema.resources,
              uploaderUsername: schema.user.username,
            })
            .from(schema.resources)
            .innerJoin(
              schema.user,
              eq(schema.user.clerkId, schema.resources.uploaderClerkId),
            )
            .where(
              and(
                eq(schema.resources.id, resourceId),
                isNull(schema.resources.deletedAt),
                isNotNull(schema.user.username),
              ),
            )
            .limit(1);

          if (
            !record?.uploaderUsername ||
            !canViewResource(record.resource, viewer)
          ) {
            return null;
          }
          const resource = record.resource;

          const [images, versions, files, categories, totals] =
            await Promise.all([
              db
                .select({
                  contentType: schema.resourceImages.contentType,
                  fileName: schema.resourceImages.fileName,
                  id: schema.resourceImages.id,
                  objectPath: schema.resourceImages.objectPath,
                  position: schema.resourceImages.position,
                  size: schema.resourceImages.size,
                })
                .from(schema.resourceImages)
                .where(eq(schema.resourceImages.resourceId, resourceId))
                .orderBy(schema.resourceImages.position),
              db
                .select({
                  createdAt: schema.resourceVersions.createdAt,
                  downloadCount: count(schema.resourceDownloads.id),
                  id: schema.resourceVersions.id,
                  version: schema.resourceVersions.version,
                })
                .from(schema.resourceVersions)
                .leftJoin(
                  schema.resourceDownloads,
                  eq(
                    schema.resourceDownloads.versionId,
                    schema.resourceVersions.id,
                  ),
                )
                .where(eq(schema.resourceVersions.resourceId, resourceId))
                .groupBy(schema.resourceVersions.id)
                .orderBy(desc(schema.resourceVersions.version)),
              db
                .select({
                  contentType: schema.resourceFiles.contentType,
                  fileName: schema.resourceFiles.fileName,
                  id: schema.resourceFiles.id,
                  size: schema.resourceFiles.size,
                  versionId: schema.resourceFiles.versionId,
                })
                .from(schema.resourceFiles)
                .innerJoin(
                  schema.resourceVersions,
                  eq(
                    schema.resourceVersions.id,
                    schema.resourceFiles.versionId,
                  ),
                )
                .where(eq(schema.resourceVersions.resourceId, resourceId))
                .orderBy(schema.resourceFiles.id),
              db
                .select({
                  id: schema.resourceCategories.id,
                  name: schema.resourceCategories.name,
                  slug: schema.resourceCategories.slug,
                })
                .from(schema.resourcesToCategories)
                .innerJoin(
                  schema.resourceCategories,
                  eq(
                    schema.resourceCategories.id,
                    schema.resourcesToCategories.categoryId,
                  ),
                )
                .where(eq(schema.resourcesToCategories.resourceId, resourceId))
                .orderBy(schema.resourceCategories.name),
              db
                .select({ downloadCount: count(schema.resourceDownloads.id) })
                .from(schema.resourceVersions)
                .leftJoin(
                  schema.resourceDownloads,
                  eq(
                    schema.resourceDownloads.versionId,
                    schema.resourceVersions.id,
                  ),
                )
                .where(eq(schema.resourceVersions.resourceId, resourceId)),
            ]);
          const versionDetails = versions.map((version) => {
            const versionFiles = files.filter(
              (file) => file.versionId === version.id,
            );
            return {
              ...version,
              files: versionFiles.map(
                ({ contentType, fileName, id, size }) => ({
                  contentType,
                  fileName,
                  id,
                  size,
                }),
              ),
            };
          });
          const currentVersion = versionDetails[0];
          if (!currentVersion) return null;
          const signedImages = (await signImages(images, signUrl)).map(
            ({ contentType, fileName, id, position, size, url }) => ({
              contentType,
              fileName,
              id,
              position,
              size,
              url,
            }),
          );

          return {
            categories,
            createdAt: resource.createdAt,
            currentVersion,
            description: resource.description,
            downloadCount: totals[0]?.downloadCount ?? 0,
            id: resource.id,
            images: signedImages,
            isAdminPrivate: Boolean(resource.privatedByClerkId),
            isPrivate: resource.isPrivate,
            name: resource.name,
            privateReason: resource.privateReason,
            privatedAt: resource.privatedAt,
            uploaderClerkId: resource.uploaderClerkId,
            uploaderUsername: record.uploaderUsername,
            versions: versionDetails.slice(1),
          };
        },
        { attributes: { resourceId } },
      );
    },
    /**
     * Lists resources visible in the public directory.
     *
     * @param categorySlugs - Category filters to apply.
     * @param viewer - Optional requesting user.
     * @returns Filtered directory with resources ordered newest-first.
     * @rejects When category validation, database, signing, or logging fails.
     */
    async listDirectory(categorySlugs = [], viewer) {
      return await logger.operation(
        loggerMessages.resources.listDirectory,
        async () => {
          const filters = normalizeCategorySlugs(categorySlugs);
          const categoryResult = await db.execute<{
            /** Category identifier. */
            id: number;
            /** Category name. */
            name: string;
            /** Category slug. */
            slug: string;
          }>(sql`
            select id, name, slug
            from resource_categories
            order by name
          `);
          const categories = categoryResult.rows;
          const knownSlugs = new Set(categories.map(({ slug }) => slug));
          const invalidFilters = filters.filter(
            (slug) => !knownSlugs.has(slug),
          );

          if (invalidFilters.length > 0) {
            return { categories, invalidFilters, resources: [] };
          }

          const filter =
            filters.length === 0
              ? sql`true`
              : sql`exists (
                  select 1
                  from resources_to_categories selected_assignments
                  inner join resource_categories selected_categories
                    on selected_categories.id = selected_assignments.category_id
                  where selected_assignments.resource_id = resources.id
                    and selected_categories.slug in (${sql.join(
                      filters.map((slug) => sql`${slug}`),
                      sql`, `,
                    )})
                )`;
          const resourceResult = await db.execute<
            Omit<ResourceDirectoryItem, "coverImageUrl"> & {
              /** Cover image object path, or `null` when no cover exists. */
              coverImageObjectPath: string | null;
            }
          >(sql`
            select
              resources.id,
              resources.name,
              resources.uploader_clerk_id as "uploaderClerkId",
              users.username as "uploaderUsername",
              resources.is_private as "isPrivate",
              resources.private_reason as "privateReason",
              resources.created_at as "createdAt",
              cover_image.object_path as "coverImageObjectPath",
              jsonb_build_object(
                'id', current_version.id,
                'version', current_version.version,
                'fileCount', current_version.file_count,
                'fileId', current_version.file_id,
                'fileName', current_version.file_name
              ) as "currentVersion",
              count(distinct resource_downloads.id)::int as "downloadCount",
              coalesce(
                jsonb_agg(
                  distinct jsonb_build_object(
                    'id', resource_categories.id,
                    'name', resource_categories.name,
                    'slug', resource_categories.slug
                  )
                ) filter (where resource_categories.id is not null),
                '[]'::jsonb
              ) as categories
            from resources
            inner join users on users.clerk_id = resources.uploader_clerk_id
            inner join lateral (
              select resource_versions.id, resource_versions.version,
                first_file.id as file_id, first_file.file_name,
                (select count(*)::int from resource_files
                  where resource_files.version_id = resource_versions.id
                ) as file_count
              from resource_versions
              inner join lateral (
                select id, file_name
                from resource_files
                where resource_files.version_id = resource_versions.id
                order by resource_files.id
                limit 1
              ) first_file on true
              where resource_versions.resource_id = resources.id
              order by version desc
              limit 1
            ) current_version on true
            left join lateral (
              select object_path
              from resource_images
              where resource_images.resource_id = resources.id
              order by position, id
              limit 1
            ) cover_image on true
            left join resource_versions all_versions
              on all_versions.resource_id = resources.id
            left join resource_downloads
              on resource_downloads.version_id = all_versions.id
            left join resources_to_categories
              on resources_to_categories.resource_id = resources.id
            left join resource_categories
              on resource_categories.id = resources_to_categories.category_id
            where (${schema.resources.isPrivate} = false
                or ${hasPermission(viewer, "resources.manage")}
                or ${schema.resources.uploaderClerkId} = ${viewer?.clerkId ?? ""})
              and ${schema.resources.deletedAt} is null
              and users.username is not null
              and ${filter}
            group by resources.id, current_version.id, current_version.version,
              current_version.file_count, current_version.file_id,
              current_version.file_name, cover_image.object_path, users.id
            order by resources.created_at desc
          `);

          return {
            categories,
            invalidFilters,
            resources: await Promise.all(
              resourceResult.rows.map(
                async ({ coverImageObjectPath, ...resource }) => ({
                  ...resource,
                  coverImageUrl: coverImageObjectPath
                    ? ((
                        await signImages(
                          [{ objectPath: coverImageObjectPath, url: "" }],
                          signUrl,
                        )
                      ).at(0)?.url ?? null)
                    : null,
                }),
              ),
            ),
          };
        },
        { attributes: { categoryCount: categorySlugs.length } },
      );
    },
    /**
     * Lists resources owned by an account.
     *
     * @param uploaderClerkId - Owner Clerk identifier.
     * @returns Owned resource summaries ordered by latest update.
     * @rejects When owner validation, database access, or logging fails.
     */
    async listOwned(uploaderClerkId) {
      return await logger.operation(
        loggerMessages.resources.listOwned,
        async () => {
          const owner = uploaderClerkId.trim();
          if (!owner) throw new Error("uploaderClerkId is required.");
          const result = await db.execute<{
            /** Resource identifier. */
            id: number;
            /** Whether the resource is private. */
            isPrivate: boolean;
            /** Resource name. */
            name: string;
            /** Staff privacy reason, or `null` when staff did not make the resource private. */
            privateReason: string | null;
            /** Last update time. */
            updatedAt: Date;
            /** Latest version number. */
            version: number;
          }>(sql`
            select resources.id, resources.name, resources.is_private as "isPrivate",
              resources.private_reason as "privateReason",
              resources.updated_at as "updatedAt",
              current_version.version
            from resources
            inner join lateral (
              select version
              from resource_versions
              where resource_versions.resource_id = resources.id
              order by version desc
              limit 1
            ) current_version on true
            where resources.uploader_clerk_id = ${owner}
              and resources.deleted_at is null
            order by resources.updated_at desc
          `);
          return result.rows;
        },
        {
          attributes: {
            uploaderClerkIdHash: hashLogIdentifier(uploaderClerkId),
          },
        },
      );
    },
    /**
     * Lists soft-deleted resources visible to staff.
     *
     * @returns Soft-deleted resources ordered newest-first.
     * @rejects When database access or logging fails.
     */
    async listAdminTrash() {
      return await logger.operation(
        loggerMessages.resources.listAdminTrash,
        async () => await listTrash(db, sql`true`),
      );
    },
    /**
     * Lists owner-deleted resources.
     *
     * @param uploaderClerkId - Owner Clerk identifier.
     * @returns Owner trash items ordered newest-first.
     * @rejects When owner validation, database access, or logging fails.
     */
    async listOwnerTrash(uploaderClerkId) {
      return await logger.operation(
        loggerMessages.resources.listOwnerTrash,
        async () => {
          const owner = uploaderClerkId.trim();
          if (!owner) throw new Error("uploaderClerkId is required.");
          return await listTrash(
            db,
            sql`resources.uploader_clerk_id = ${owner}
              and resources.deleted_by_clerk_id = ${owner}
              and resources.deleted_by_role = 'owner'`,
          );
        },
        {
          attributes: {
            uploaderClerkIdHash: hashLogIdentifier(uploaderClerkId),
          },
        },
      );
    },
    /**
     * Lists resource notifications visible to staff.
     *
     * @returns Resource notifications ordered newest-first.
     * @rejects When database access or logging fails.
     */
    async listNotifications() {
      return await logger.operation(
        loggerMessages.resources.listNotifications,
        async () => {
          const result = await db.execute<ResourceNotificationItem>(sql`
            select
              resource_notifications.id,
              resource_notifications.type,
              resource_notifications.resource_id as "resourceId",
              resources.name as "resourceName",
              resources.is_private as "isPrivate",
              notification_category.name as "categoryName",
              coalesce(
                array_agg(
                  distinct assigned_category.name
                  order by assigned_category.name
                ) filter (where assigned_category.id is not null),
                array[]::text[]
              ) as categories,
              uploader.username as "uploaderUsername",
              resource_notifications.created_at as "createdAt",
              resource_notifications.read_at as "readAt",
              reader.username as "readByUsername"
            from resource_notifications
            inner join resources
              on resources.id = resource_notifications.resource_id
            inner join users uploader
              on uploader.clerk_id = resource_notifications.uploader_clerk_id
              and uploader.username is not null
            left join users reader
              on reader.clerk_id = resource_notifications.read_by_clerk_id
            left join resource_categories notification_category
              on notification_category.id = resource_notifications.category_id
            left join resources_to_categories
              on resources_to_categories.resource_id = resources.id
            left join resource_categories assigned_category
              on assigned_category.id = resources_to_categories.category_id
            where resources.deleted_at is null
            group by resource_notifications.id, resources.id,
              notification_category.id, uploader.id, reader.id
            order by resource_notifications.created_at desc,
              resource_notifications.id desc
          `);
          return result.rows;
        },
      );
    },
    /**
     * Lists resource categories.
     *
     * @param search - Optional category search.
     * @returns Up to 20 matching categories in alphabetical order.
     * @rejects When database access or logging fails.
     */
    async listCategories(search = "") {
      return await logger.operation(
        loggerMessages.resources.listCategories,
        async () => {
          const query = db
            .select({
              id: schema.resourceCategories.id,
              name: schema.resourceCategories.name,
              slug: schema.resourceCategories.slug,
            })
            .from(schema.resourceCategories)
            .orderBy(schema.resourceCategories.name)
            .limit(20);

          return search.trim()
            ? await query.where(
                ilike(schema.resourceCategories.name, `%${search.trim()}%`),
              )
            : await query;
        },
        { attributes: { hasSearch: Boolean(search.trim()) } },
      );
    },
    /**
     * Marks a resource notification read.
     *
     * @param notificationId - Notification identifier.
     * @param actorClerkId - Reader Clerk identifier.
     * @returns Completion after updating the notification.
     * @rejects When the identifier is invalid or database access or logging fails.
     */
    async markNotificationRead(notificationId, actorClerkId) {
      await logger.operation(
        loggerMessages.resources.markNotificationRead,
        async () => {
          assertPositiveInteger(notificationId, "notificationId");
          const actor = actorClerkId.trim();
          if (!actor) throw new Error("actorClerkId is required.");
          await db.execute(sql`
            update resource_notifications
            set read_at = now(), read_by_clerk_id = ${actor}
            where id = ${notificationId} and read_at is null
          `);
        },
        {
          attributes: {
            actorClerkIdHash: hashLogIdentifier(actorClerkId),
            notificationId,
          },
        },
      );
    },
    /**
     * Makes a resource private as staff.
     *
     * @param input - Actor, reason, and resource identity.
     * @returns Completion after moderation.
     * @rejects When validation, authorization, persistence, audit, or logging fails.
     */
    async markPrivate(input) {
      await logger.operation(
        loggerMessages.resources.markPrivate,
        async () => {
          assertPositiveInteger(input.resourceId, "resourceId");
          const actorClerkId = input.actor.clerkId.trim();
          const reason = input.reason.trim();
          if (!actorClerkId || !reason || reason.length > 1000) {
            throw new Error("Private resource metadata is invalid.");
          }
          await withResourceAuditTransaction(db, audit, async (tx) => {
            const context = audit
              ? await loadResourceAuditContext(
                  tx,
                  input.actor,
                  input.resourceId,
                )
              : undefined;
            const result = await tx.execute<{
              /** Resource identifier. */
              id: number;
            }>(sql`
              update resources
              set is_private = true, private_reason = ${reason},
                privated_at = now(), privated_by_clerk_id = ${actorClerkId},
                updated_at = now()
              where id = ${input.resourceId}
                and privated_by_clerk_id is null
                and deleted_at is null
              returning id
            `);
            if (!result.rows[0]) throw new Error("Resource is unavailable.");
            if (audit && context) {
              const after = await loadResourceAuditContext(
                tx,
                input.actor,
                input.resourceId,
              );
              await writeResourceAudit(audit, tx, {
                actor: input.actor,
                after: after.state,
                before: context.state,
                context,
                definition: resourceAudit.visibilityChanged,
                reason,
                targetId: input.resourceId,
              });
            }
          });
        },
        {
          attributes: {
            actorClerkIdHash: hashLogIdentifier(input.actor.clerkId),
            resourceId: input.resourceId,
          },
        },
      );
    },
    /**
     * Permanently purges a soft-deleted resource.
     *
     * @param input - Actor, reason, and resource identity.
     * @returns Completion after deletion is queued.
     * @rejects When validation, authorization, persistence, deletion queuing, audit, or logging fails.
     */
    async permanentlyDelete(input) {
      await loggedMutation(
        logger,
        loggerMessages.resources.permanentlyDelete,
        async () => {
          assertPositiveInteger(input.resourceId, "resourceId");
          const actorClerkId = input.actor.clerkId.trim();
          const reason = input.reason.trim();
          if (
            !actorClerkId ||
            !reason ||
            reason.length > 1000 ||
            !hasPermission(input.actor, "resources.purge")
          ) {
            throw new Error("Resource permanent deletion requires an admin.");
          }

          const paths = await db.transaction(async (tx) => {
            await lockTarget(tx, { type: "resource", id: input.resourceId });
            const context = audit
              ? await loadResourceAuditContext(
                  tx,
                  input.actor,
                  input.resourceId,
                )
              : undefined;
            const objects = await tx.execute<{
              /** Stored object path, or `null` when the resource has no objects. */
              objectPath: string | null;
            }>(sql`
            select stored_objects.object_path as "objectPath"
            from resources
            left join lateral (
              select resource_images.object_path
              from resource_images
              where resource_images.resource_id = resources.id
              union
              select resource_files.object_path
              from resource_files
              inner join resource_versions
                on resource_versions.id = resource_files.version_id
              where resource_versions.resource_id = resources.id
              union
              select resource_versions.object_path
              from resource_versions
              where resource_versions.resource_id = resources.id
                and resource_versions.object_path is not null
              union
              select resource_versions.archive_object_path
              from resource_versions
              where resource_versions.resource_id = resources.id
                and resource_versions.archive_object_path is not null
            ) stored_objects on true
            where resources.id = ${input.resourceId}
              and resources.deleted_at is not null
          `);
            if (objects.rows.length === 0) {
              throw new Error(
                "Resource must be soft-deleted before permanent deletion.",
              );
            }

            await queueObjectDeletions(
              tx,
              objects.rows.flatMap(({ objectPath }) =>
                objectPath ? [objectPath] : [],
              ),
            );

            const deleted = await tx.execute<{
              /** Resource identifier. */
              id: number;
            }>(sql`
            delete from resources
            where id = ${input.resourceId} and deleted_at is not null
            returning id
          `);
            if (!deleted.rows[0]) {
              throw new Error(
                "Resource permanent deletion could not be completed.",
              );
            }
            if (audit && context) {
              await writeResourceAudit(audit, tx, {
                actor: input.actor,
                before: context.state,
                context,
                definition: resourceAudit.purged,
                permission: "resources.purge",
                reason,
                targetId: input.resourceId,
              });
            }
            return objects.rows.flatMap(({ objectPath }) =>
              objectPath ? [objectPath] : [],
            );
          });
          await cleanupObjectDeletions(db, storage, logger, paths);
        },
        {
          attributes: {
            actorClerkIdHash: hashLogIdentifier(input.actor.clerkId),
            resourceId: input.resourceId,
          },
        },
      );
    },
    /**
     * Changes resource visibility.
     *
     * @param input - Visibility change input.
     * @returns Completion after the update.
     * @rejects When validation, authorization, persistence, audit, or logging fails.
     */
    async setVisibility(input) {
      await logger.operation(
        loggerMessages.resources.update,
        async () => {
          assertPositiveInteger(input.resourceId, "resourceId");
          const actorClerkId = input.actor.clerkId.trim();
          if (!actorClerkId) throw new Error("actorClerkId is required.");
          const canManage = hasPermission(input.actor, "resources.manage");
          await withResourceAuditTransaction(db, audit, async (tx) => {
            const context = audit
              ? await loadResourceAuditContext(
                  tx,
                  input.actor,
                  input.resourceId,
                )
              : undefined;
            const result = await tx.execute<{
              /** Resource identifier. */
              id: number;
            }>(sql`
              update resources
              set is_private = ${!input.isPublic}, private_reason = null,
                privated_at = null, privated_by_clerk_id = null,
                updated_at = now()
              where id = ${input.resourceId}
                and (uploader_clerk_id = ${actorClerkId} or ${canManage})
                and (${canManage} or privated_by_clerk_id is null)
                and (${input.isPublic} or uploader_clerk_id = ${actorClerkId})
                and deleted_at is null
              returning id
            `);
            if (!result.rows[0]) {
              throw new Error("Resource visibility update is not allowed.");
            }
            if (audit && context) {
              const after = await loadResourceAuditContext(
                tx,
                input.actor,
                input.resourceId,
              );
              await writeResourceAudit(audit, tx, {
                actor: input.actor,
                after: after.state,
                before: context.state,
                context,
                definition: resourceAudit.visibilityChanged,
                reason: input.reason,
                targetId: input.resourceId,
              });
            }
          });
        },
        {
          attributes: {
            actorClerkIdHash: hashLogIdentifier(input.actor.clerkId),
            isPublic: input.isPublic,
            resourceId: input.resourceId,
          },
        },
      );
    },
    /**
     * Restores a soft-deleted resource.
     *
     * @param input - Restore input.
     * @returns Completion after restoration.
     * @rejects When validation, authorization, persistence, audit, or logging fails.
     */
    async restore(input) {
      await logger.operation(
        loggerMessages.resources.restore,
        async () => {
          assertPositiveInteger(input.resourceId, "resourceId");
          const actorClerkId = input.actor.clerkId.trim();
          if (!actorClerkId) throw new Error("actorClerkId is required.");
          const canManage = hasPermission(input.actor, "resources.manage");
          await withResourceAuditTransaction(db, audit, async (tx) => {
            const context = audit
              ? await loadResourceAuditContext(
                  tx,
                  input.actor,
                  input.resourceId,
                )
              : undefined;
            const result = await tx.execute<{
              /** Resource identifier. */
              id: number;
            }>(sql`
              update resources
              set deleted_at = null, deleted_by_clerk_id = null,
                deleted_by_role = null, updated_at = now()
              where id = ${input.resourceId}
                and deleted_at is not null
                and (${canManage} or (
                  uploader_clerk_id = ${actorClerkId}
                  and deleted_by_clerk_id = ${actorClerkId}
                  and deleted_by_role = 'owner'
                ))
              returning id
            `);
            if (!result.rows[0]) {
              throw new Error("Resource restoration is not allowed.");
            }
            if (audit && context) {
              const after = await loadResourceAuditContext(
                tx,
                input.actor,
                input.resourceId,
              );
              await writeResourceAudit(audit, tx, {
                actor: input.actor,
                after: after.state,
                before: context.state,
                context,
                definition: resourceAudit.restored,
                reason: input.reason,
                targetId: input.resourceId,
              });
            }
          });
        },
        {
          attributes: {
            actorClerkIdHash: hashLogIdentifier(input.actor.clerkId),
            resourceId: input.resourceId,
          },
        },
      );
    },
    /**
     * Soft-deletes a resource.
     *
     * @param input - Deletion input.
     * @returns Recorded deletion role.
     * @rejects When validation, authorization, persistence, audit, or logging fails.
     */
    async softDelete(input) {
      return await logger.operation(
        loggerMessages.resources.softDelete,
        async () => {
          assertPositiveInteger(input.resourceId, "resourceId");
          const actorClerkId = input.actor.clerkId.trim();
          if (!actorClerkId) throw new Error("actorClerkId is required.");
          const canManage = hasPermission(input.actor, "resources.manage");
          return await withResourceAuditTransaction(db, audit, async (tx) => {
            const context = audit
              ? await loadResourceAuditContext(
                  tx,
                  input.actor,
                  input.resourceId,
                )
              : undefined;
            const result = await tx.execute<{
              /** Role recorded for the deletion. */
              deletedByRole: ResourceTrashItem["deletedByRole"];
            }>(sql`
              update resources
              set deleted_at = now(), deleted_by_clerk_id = ${actorClerkId},
                deleted_by_role = case
                  when uploader_clerk_id = ${actorClerkId} then 'owner'
                  else 'admin'
                end,
                updated_at = now()
              where id = ${input.resourceId}
                and deleted_at is null
                and (uploader_clerk_id = ${actorClerkId} or ${canManage})
              returning deleted_by_role as "deletedByRole"
            `);
            const deleted = result.rows[0];
            if (!deleted) throw new Error("Resource deletion is not allowed.");
            if (audit && context) {
              const after = await loadResourceAuditContext(
                tx,
                input.actor,
                input.resourceId,
              );
              await writeResourceAudit(audit, tx, {
                actor: input.actor,
                after: after.state,
                before: context.state,
                context,
                definition: resourceAudit.softDeleted,
                reason: input.reason,
                targetId: input.resourceId,
              });
            }
            return deleted;
          });
        },
        {
          attributes: {
            actorClerkIdHash: hashLogIdentifier(input.actor.clerkId),
            resourceId: input.resourceId,
          },
        },
      );
    },
    /**
     * Updates resource metadata and images.
     *
     * @param input - Resource update input.
     * @returns Updated resource identity.
     * @rejects When validation, authorization, upload, persistence, audit, or logging fails.
     */
    async update(input) {
      return await loggedMutation(
        logger,
        loggerMessages.resources.update,
        async () => {
          const normalized = normalizeUpdateInput(input);
          const removedPaths: string[] = [];
          const result = await db.transaction(async (tx) => {
            await lockTarget(tx, {
              type: "resource",
              id: normalized.resourceId,
            });
            const [ownedResource] = await tx
              .select({ id: schema.resources.id })
              .from(schema.resources)
              .where(
                sql`${schema.resources.id} = ${normalized.resourceId}
                and (${schema.resources.uploaderClerkId} = ${normalized.actor.clerkId}
                  or ${normalized.canManage})
                and ${schema.resources.deletedAt} is null`,
              )
              .limit(1);
            if (!ownedResource) throw new Error("Resource owner is required.");
            const before = audit
              ? await loadResourceAuditContext(
                  tx,
                  normalized.actor,
                  normalized.resourceId,
                )
              : undefined;
            const currentImages = await tx
              .select({
                id: schema.resourceImages.id,
                objectPath: schema.resourceImages.objectPath,
              })
              .from(schema.resourceImages)
              .where(
                eq(schema.resourceImages.resourceId, normalized.resourceId),
              );
            const currentImageIds = new Set(currentImages.map(({ id }) => id));
            if (
              normalized.retainedImageIds.some(
                (id) => !currentImageIds.has(id),
              ) ||
              normalized.retainedImageIds.length + normalized.images.length ===
                0 ||
              normalized.retainedImageIds.length + normalized.images.length >
                maxResourceImages
            ) {
              throw new Error("Resource images are invalid.");
            }

            const images = await uploadResourceImages(
              storage,
              normalized.images,
              normalized.resourceId,
              tx,
            );
            try {
              const updated = await persistResourceUpdate(
                tx,
                normalized,
                images,
              );
              const retained = new Set(normalized.retainedImageIds);
              removedPaths.push(
                ...currentImages
                  .filter(({ id }) => !retained.has(id))
                  .map(({ objectPath }) => objectPath),
              );
              await queueObjectDeletions(tx, removedPaths);
              if (audit && before) {
                const after = await loadResourceAuditContext(
                  tx,
                  normalized.actor,
                  normalized.resourceId,
                );
                await writeResourceAudit(audit, tx, {
                  actor: normalized.actor,
                  after: after.state,
                  before: before.state,
                  context: before,
                  definition: resourceAudit.updated,
                  reason: normalized.reason,
                  targetId: normalized.resourceId,
                });
              }
              return updated;
            } catch (error) {
              await deleteUploadedFiles(storage, images);
              throw error;
            }
          });
          await cleanupObjectDeletions(db, storage, logger, removedPaths);
          return result;
        },
        {
          attributes: {
            categoryCount: input.categories.length,
            imageCount: input.images.length,
            resourceId: input.resourceId,
            actorClerkIdHash: hashLogIdentifier(input.actor.clerkId),
          },
        },
      );
    },
  };
}

/**
 * Creates a resource service from storage configuration.
 *
 * @param db - Application database.
 * @param config - Upload storage configuration.
 * @param logger - Application logger.
 * @returns Configured resource service.
 * @throws When the storage configuration is invalid.
 */
export function createConfiguredResourcesService(
  db: Database,
  config: UploadStorageConfig,
  logger: Logger,
): ResourcesService {
  return createResourcesService(
    db,
    createUploadStorage(config),
    logger,
    /**
     * Signs a resource object path.
     *
     * @param objectPath - Resource object path.
     * @returns Signed resource URL.
     * @rejects When URL signing fails.
     */
    async (objectPath) => await signResourceUrl({ ...config, objectPath }),
    createAuditService(logger, resourceAuditEvents, db),
  );
}

/**
 * Persists normalized resource metadata and gallery changes.
 *
 * @param db - Caller-owned transaction.
 * @param input - Normalized update input.
 * @param images - Uploaded gallery images.
 * @returns Updated resource identity.
 * @rejects When the resource cannot be updated.
 */
async function persistResourceUpdate(
  db: Pick<Database, "execute">,
  input: ReturnType<typeof normalizeUpdateInput>,
  images: UploadResult[],
): Promise<{
  /** Resource identifier. */
  id: number;
}> {
  const categoryValues = sql.join(
    input.categories.map(
      /**
       * Serializes a category row.
       *
       * @param category - Normalized category.
       * @returns SQL category tuple.
       */
      ({ name, slug }) => sql`(${name}, ${slug})`,
    ),
    sql`, `,
  );
  const retainedImages = JSON.stringify(
    input.retainedImageIds.map((id) => ({ id })),
  );
  const newImages = JSON.stringify(
    images.map((image, position) => ({ ...image, position })),
  );
  const result = await db.execute<{
    /** Resource identifier. */
    id: number;
  }>(sql`
    with input_categories(name, slug) as (values ${categoryValues}),
    updated_resource as (
      update resources
      set name = ${input.name}, description = ${input.description}, updated_at = now()
      where id = ${input.resourceId}
        and (uploader_clerk_id = ${input.actor.clerkId} or ${input.canManage})
        and deleted_at is null
      returning id
    ),
    input_retained_images(id) as (
      select id
      from jsonb_to_recordset(${retainedImages}::jsonb) as retained(id bigint)
    ),
    deleted_images as (
      delete from resource_images
      where resource_id = (select id from updated_resource)
        and not exists (
          select 1 from input_retained_images
          where input_retained_images.id = resource_images.id
        )
      returning id
    ),
    input_images(file_name, content_type, size, object_path, url, position) as (
      select image."fileName", image."contentType", image.size,
        image."objectPath", image.url, image.position
      from jsonb_to_recordset(${newImages}::jsonb) as image(
        "fileName" text, "contentType" text, size integer,
        "objectPath" text, url text, position integer
      )
    ),
    inserted_images as (
      insert into resource_images (
        resource_id, position, file_name, content_type, size, object_path, url
      )
      select updated_resource.id,
        coalesce((
          select max(position) from resource_images
          where resource_id = updated_resource.id
        ), -1) + row_number() over (order by input_images.position),
        input_images.file_name, input_images.content_type, input_images.size,
        input_images.object_path, input_images.url
      from updated_resource cross join input_images
      returning id
    ),
    upserted_categories as (
      insert into resource_categories (name, slug, created_by_clerk_id)
      select name, slug, ${input.uploaderClerkId} from input_categories
      on conflict (slug) do update set name = resource_categories.name
      returning id
    ),
    inserted_assignments as (
      insert into resources_to_categories (resource_id, category_id)
      select updated_resource.id, upserted_categories.id
      from updated_resource cross join upserted_categories
      on conflict do nothing
    ),
    deleted_assignments as (
      delete from resources_to_categories
      where resource_id = (select id from updated_resource)
        and category_id not in (select id from upserted_categories)
    )
    select updated_resource.id
    from updated_resource
    where (select count(*) from upserted_categories) = ${input.categories.length}
      and (select count(*) from inserted_images) = ${images.length}
      and (select count(*) from deleted_images) >= 0
  `);
  const updated = result.rows[0];
  if (!updated) throw new Error("Resource owner is required.");
  return { id: Number(updated.id) };
}

/**
 * Lists deleted resources matching an authorization filter.
 *
 * @param db - Application database.
 * @param filter - SQL authorization condition applied to deleted resources.
 * @returns Deleted resources ordered newest first.
 * @rejects When the database query fails.
 */
async function listTrash(
  db: Database,
  filter: SQL,
): Promise<ResourceTrashItem[]> {
  const result = await db.execute<ResourceTrashItem>(sql`
    select resources.id, resources.name,
      uploader.username as "uploaderUsername",
      is_private as "isPrivate", deleted_at as "deletedAt",
      deleted_by.username as "deletedByUsername",
      deleted_by_role as "deletedByRole"
    from resources
    inner join users uploader
      on uploader.clerk_id = resources.uploader_clerk_id
      and uploader.username is not null
    inner join users deleted_by
      on deleted_by.clerk_id = resources.deleted_by_clerk_id
      and deleted_by.username is not null
    where resources.deleted_at is not null and ${filter}
    order by resources.deleted_at desc, resources.id desc
  `);
  return result.rows;
}

/**
 * Validates and normalizes a resource update request.
 *
 * @param input - Candidate update fields, uploads, and actor identity.
 * @returns Deduplicated image identifiers, normalized metadata, and management permission.
 * @throws When an identifier, metadata field, image, or upload size is invalid.
 */
function normalizeUpdateInput(input: UpdateResourceInput) {
  assertPositiveInteger(input.resourceId, "resourceId");
  const retainedImageIds = [...new Set(input.retainedImageIds)];
  retainedImageIds.forEach((id) => {
    assertPositiveInteger(id, "imageId");
  });
  const images = normalizeResourceImages(input.images, false);
  assertCombinedUploadSize(images);
  return {
    ...input,
    canManage: hasPermission(input.actor, "resources.manage"),
    ...normalizeMetadata({
      ...input,
      uploaderClerkId: input.actor.clerkId,
    }),
    images,
    retainedImageIds,
  };
}

/**
 * Validates and normalizes resource metadata.
 *
 * @param input - Candidate resource metadata and uploader identity.
 * @returns Trimmed metadata and deduplicated category names and slugs.
 * @throws When a required field or category violates its limits.
 */
function normalizeMetadata(input: {
  /**
   * Category display names supplied by the uploader.
   */
  categories: string[];
  /**
   * Resource description supplied by the uploader.
   */
  description: string;
  /**
   * Display name.
   */
  name: string;
  /**
   * Uploader Clerk user identifier.
   */
  uploaderClerkId: string;
}) {
  const name = input.name.trim();
  const description = input.description.trim();
  const uploaderClerkId = input.uploaderClerkId.trim();
  const categories = [
    ...new Map(
      input.categories.map((category) => {
        const categoryName = category.trim();
        return [slugify(categoryName), categoryName] as const;
      }),
    ),
  ].map(([slug, categoryName]) => ({ name: categoryName, slug }));

  if (!name || name.length > 120) throw new Error("Resource name is invalid.");
  if (!description || description.length > 5000) {
    throw new Error("Resource description is invalid.");
  }
  if (!uploaderClerkId) throw new Error("uploaderClerkId is required.");
  if (
    categories.length === 0 ||
    categories.length > 10 ||
    categories.some(
      ({ name: categoryName, slug }) =>
        !categoryName || categoryName.length > 60 || !slug,
    )
  ) {
    throw new Error("Resource categories are invalid.");
  }

  return { categories, description, name, uploaderClerkId };
}

/**
 * Deduplicates and validates resource category filters.
 *
 * @param categorySlugs - Candidate lowercase category slugs.
 * @returns Trimmed unique category slugs.
 * @throws When more than ten filters are supplied or a slug is invalid.
 */
function normalizeCategorySlugs(categorySlugs: string[]): string[] {
  const filters = [...new Set(categorySlugs.map((slug) => slug.trim()))];
  if (
    filters.length > 10 ||
    filters.some((slug) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug))
  ) {
    throw new Error("Resource category filters are invalid.");
  }
  return filters;
}

/**
 * Converts a display value to a lowercase URL slug.
 *
 * @param value - Display value to normalize.
 * @returns Hyphen-separated ASCII slug.
 */
function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

/**
 * Requires a positive integer.
 *
 * @param value - Candidate identifier.
 * @param name - Field name included in the validation error.
 * @throws When the value is not a positive safe integer.
 */
function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

/**
 * Validates a resource image collection.
 *
 * @param images - Candidate image uploads.
 * @param required - Whether at least one image must be present.
 * @returns Validated uploads in their original order.
 * @throws When the count is invalid or filenames are duplicated.
 */
function normalizeResourceImages(
  images: UploadInput[],
  required: boolean,
): UploadInput[] {
  if (
    !Array.isArray(images) ||
    (required && images.length === 0) ||
    images.length > maxResourceImages
  ) {
    throw new Error(`A resource requires 1–${maxResourceImages} images.`);
  }

  const names = images.map(({ fileName }) => fileName.trim().toLowerCase());
  if (new Set(names).size !== names.length) {
    throw new Error("Resource image filenames must be unique.");
  }
  return images;
}

/**
 * Validates combined upload size.
 *
 * @param files - Uploads whose byte lengths are combined.
 * @throws When the total is unsafe or exceeds the session limit.
 */
function assertCombinedUploadSize(files: UploadInput[]): void {
  const total = files.reduce((size, file) => size + file.bytes.byteLength, 0);
  if (!Number.isSafeInteger(total) || total > maxResourceSessionBytes) {
    throw new Error("Resource upload exceeds the combined size limit.");
  }
}

/**
 * Uploads validated resource images with collision protection.
 *
 * @param storage - Object storage used to derive targets and upload bytes.
 * @param images - Validated image uploads.
 * @param resourceId - Resource identifier.
 * @param db - Application database.
 * @returns Uploaded image targets in input order.
 * @rejects When hashing, collision checks, or upload fails.
 */
async function uploadResourceImages(
  storage: UploadStorage,
  images: UploadInput[],
  resourceId: number,
  db: Pick<Database, "execute">,
): Promise<UploadResult[]> {
  const uploaded: UploadResult[] = [];
  try {
    for (const image of images) {
      const target = storage.createImageTarget(
        {
          ...image,
          size: image.bytes.byteLength,
          sha256: await sha256(image.bytes),
        },
        { entity: "resources", entityId: resourceId },
      );
      await assertNotPendingDeletion(db, target.objectPath);
      const existing = await db.execute(
        sql`select 1 from resource_images where object_path=${target.objectPath} union all select 1 from upload_file where object_path=${target.objectPath} limit 1`,
      );
      if (existing.rows.length)
        throw new Error("Image is already attached or reserved by an upload.");
      if (uploaded.some((file) => file.objectPath === target.objectPath))
        throw new Error("Duplicate image.");
      await storage.putImage({
        body: image.bytes,
        contentLength: image.bytes.byteLength,
        contentType: image.contentType,
        objectPath: target.objectPath,
      });
      uploaded.push(target);
    }
    return uploaded;
  } catch (error) {
    await deleteUploadedFiles(storage, uploaded);
    throw error;
  }
}

/**
 * Attempts to delete every uploaded object without failing on individual errors.
 *
 * @param storage - Object storage containing the uploads.
 * @param files - Uploaded targets to delete.
 */
async function deleteUploadedFiles(
  storage: UploadStorage,
  files: UploadResult[],
): Promise<void> {
  await Promise.allSettled(
    files.map(({ objectPath }) => storage.delete(objectPath)),
  );
}

/**
 * Uploads and atomically records an uncompressed resource-version archive.
 *
 * @param db - Application database.
 * @param storage - Object storage used to read files and write the archive.
 * @param resourceId - Resource identifier.
 * @param versionId - Version identifier.
 * @param version - Human-facing resource version number.
 * @param files - Stored version files included in the archive.
 * @returns Winning archive object path after concurrent creation is reconciled.
 * @rejects When reading, uploading, recording, or cleanup fails.
 */
async function createVersionArchive(
  db: Database,
  storage: UploadStorage,
  resourceId: number,
  versionId: number,
  version: number,
  files: Array<{
    /** Download filename written into the archive. */
    fileName: string;
    /** Stored object path read into the archive. */
    objectPath: string;
    /** Uncompressed file size in bytes. */
    size: number;
  }>,
): Promise<string> {
  const archive = createUncompressedZip(
    files.map((file) => ({
      fileName: file.fileName,
      /**
       * Opens the stored file as an archive entry stream.
       *
       * @returns Readable file stream.
       * @rejects When object storage cannot read the file.
       */
      open: async () => await storage.readFile(file.objectPath),
      size: file.size,
    })),
  );
  const candidate = storage.createArchiveTarget(
    resourceId,
    version,
    archive.contentLength,
  );
  let recorded = false;

  try {
    await storage.putFile({
      body: archive.body,
      contentLength: archive.contentLength,
      contentType: candidate.contentType,
      objectPath: candidate.objectPath,
    });
    const result = await db.execute<{
      /** Archive path won by this request or a concurrent creator. */
      objectPath: string;
    }>(sql`
      with selected_archive as (
        update resource_versions
        set archive_object_path = ${candidate.objectPath}
        where id = ${versionId} and archive_object_path is null
        returning archive_object_path
      )
      select archive_object_path as "objectPath"
      from selected_archive
      union all
      select archive_object_path as "objectPath"
      from resource_versions
      where id = ${versionId}
        and archive_object_path is not null
        and not exists (select 1 from selected_archive)
      limit 1
    `);
    const winner = result.rows[0]?.objectPath;
    if (!winner) throw new Error("Resource archive could not be recorded.");
    recorded = winner === candidate.objectPath;
    if (!recorded) await storage.delete(candidate.objectPath);
    return winner;
  } catch (error) {
    if (!recorded)
      await Promise.allSettled([storage.delete(candidate.objectPath)]);
    throw error;
  }
}

/**
 * Records an authenticated or anonymous resource-version download.
 *
 * @param db - Application database.
 * @param versionId - Version identifier.
 * @param userClerkId - Authenticated Clerk identifier, or absent for an anonymous download.
 * @rejects When download persistence fails.
 */
async function recordResourceDownload(
  db: Database,
  versionId: number,
  userClerkId?: string,
): Promise<void> {
  if (userClerkId) {
    await db.execute(sql`
      insert into resource_downloads (version_id, user_clerk_id)
      values (${versionId}, ${userClerkId})
      on conflict (version_id, user_clerk_id) do nothing
    `);
    return;
  }

  await db.execute(sql`
    update resource_versions
    set anonymous_download_count = anonymous_download_count + 1
    where id = ${versionId}
  `);
}

/**
 * Checks public, owner, and administrator access to a resource.
 *
 * @param resource - Resource privacy and ownership fields.
 * @param viewer - Optional catalog viewer.
 * @returns Whether the viewer may read the resource.
 */
export function canViewResource(
  resource: {
    /** Whether public discovery is disabled for the resource. */
    isPrivate: boolean;
    /** Clerk identifier allowed to view its own private resource. */
    uploaderClerkId: string;
  },
  viewer?: ResourceViewer,
): boolean {
  return (
    !resource.isPrivate ||
    hasPermission(viewer, "resources.manage") ||
    resource.uploaderClerkId === viewer?.clerkId
  );
}

/**
 * Resource mutation callback.
 *
 * @template T - Callback result type.
 */
type ResourceAuditCallback<T> = {
  /**
   * Runs a resource mutation.
   *
   * @param transaction - Caller-owned transaction.
   * @returns Callback result.
   * @rejects When the resource mutation fails.
   */
  (transaction: Parameters<AuditService["write"]>[0]): Promise<T>;
};

/**
 * Uses a transaction when audit writes are enabled.
 *
 * @template T - Callback result type.
 * @param db - Application database.
 * @param audit - Optional audit service.
 * @param callback - Mutation callback.
 * @returns Callback result.
 * @rejects When the mutation callback or database transaction fails.
 */
async function withResourceAuditTransaction<T>(
  db: Database,
  audit: AuditService | undefined,
  callback: ResourceAuditCallback<T>,
): Promise<T> {
  return audit ? await db.transaction(callback) : await callback(db);
}

/**
 * Uploads buffered resource inputs through the session service.
 *
 * @param db - Application database.
 * @param storage - Upload storage.
 * @param logger - Application logger.
 * @param input - Resource or version upload input.
 * @param target - Resource upload target.
 * @param payload - Resource session payload.
 * @param audit - Optional audit service.
 * @returns Completed resource upload identity.
 * @rejects When hashing, session creation, upload, persistence, audit, logging, or result validation fails.
 */
async function uploadBufferedSession(
  db: Database,
  storage: UploadStorage,
  logger: Logger,
  input: CreateResourceInput | UploadResourceVersionInput,
  target: {
    /** Resource target type. */
    type: "resource";
    /** Existing resource identifier for version uploads. */
    id?: number;
  },
  payload: Record<string, unknown>,
  audit?: AuditService,
) {
  const service = createStorageService({ audit, db, storage, logger });
  const actor = input.actor;
  const inputs = [
    ...input.files.map((file) => ({ ...file, kind: "file" as const })),
    ...("images" in input
      ? input.images.map((file) => ({ ...file, kind: "image" as const }))
      : []),
  ];
  const files = await Promise.all(
    inputs.map(async (file) => ({
      kind: file.kind,
      fileName: file.fileName,
      contentType: file.contentType,
      size: file.bytes.byteLength,
      sha256: await sha256(file.bytes),
    })),
  );
  const session = await service.create({ target, payload, files }, actor);
  for (const [index, file] of inputs.entries()) {
    const upload = session.uploads[index];
    if (!upload) throw new Error("Upload target is missing.");
    await service.upload(
      session.id,
      upload.id,
      actor,
      new Request("https://storage.internal/upload", {
        method: "PUT",
        body: new Uint8Array(file.bytes),
        headers: {
          "content-type": file.contentType,
          "content-length": String(file.bytes.byteLength),
        },
      }),
    );
  }
  const result = await service.completeUpload(session.id, actor);
  if (result.resourceId === undefined || result.version === undefined)
    throw new Error("Resource result is missing.");
  return result;
}
