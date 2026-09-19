import type { Database } from "@package/database";
import { schema } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import {
  createResourceStorage,
  maxSessionBytes,
  type ResourceStorage,
  type ResourceStorageConfig,
  type ResourceUploadInput,
  type ResourceUploadResult,
  signResourceUrl,
} from "@package/resources";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  isNull,
  type SQL,
  sql,
} from "drizzle-orm";
import { hashLogIdentifier } from "../logging.js";

export type CreateResourceInput = {
  categories: string[];
  description: string;
  files: ResourceUploadInput[];
  images: ResourceUploadInput[];
  name: string;
  uploaderClerkId: string;
};

export type UpdateResourceInput = {
  actorClerkId: string;
  actorIsAdmin: boolean;
  categories: string[];
  description: string;
  images: ResourceUploadInput[];
  name: string;
  retainedImageIds: number[];
  resourceId: number;
};

export type ResourceViewer = {
  clerkId?: string;
  isAdmin?: boolean;
};

export type UploadResourceVersionInput = {
  files: ResourceUploadInput[];
  resourceId: number;
  uploaderClerkId: string;
};

export type ResourceVersionDetail = {
  createdAt: Date;
  downloadCount: number;
  files: ResourceFileDetail[];
  id: number;
  version: number;
};

export type ResourceFileDetail = {
  contentType: string;
  downloadCount: number;
  fileName: string;
  id: number;
  size: number;
};

export type ResourceImageDetail = {
  contentType: string;
  fileName: string;
  id: number;
  position: number;
  size: number;
  url: string;
};

export type ResourceDetail = {
  categories: { id: number; name: string; slug: string }[];
  createdAt: Date;
  currentVersion: ResourceVersionDetail;
  description: string;
  downloadCount: number;
  id: number;
  images: ResourceImageDetail[];
  isAdminPrivate: boolean;
  isPrivate: boolean;
  name: string;
  privateReason: string | null;
  privatedAt: Date | null;
  uploaderClerkId: string;
  versions: ResourceVersionDetail[];
};

export type ResourceDirectory = {
  categories: { id: number; name: string; slug: string }[];
  invalidFilters: string[];
  resources: ResourceDirectoryItem[];
};

export type ResourceDirectoryItem = {
  categories: { id: number; name: string; slug: string }[];
  createdAt: Date;
  currentVersion: {
    fileId: number;
    fileName: string;
    id: number;
  };
  downloadCount: number;
  coverImageUrl: string | null;
  id: number;
  isPrivate: boolean;
  name: string;
  privateReason: string | null;
  uploaderClerkId: string;
};

export type ResourceNotificationItem = {
  categories: string[];
  categoryName: string | null;
  createdAt: Date;
  id: number;
  isPrivate: boolean;
  readAt: Date | null;
  readByClerkId: string | null;
  resourceId: number;
  resourceName: string;
  type: (typeof schema.resourceNotificationTypes)[number];
  uploaderClerkId: string;
};

export type ResourceTrashItem = {
  deletedAt: Date;
  deletedByClerkId: string;
  deletedByRole: (typeof schema.resourceDeletionRoles)[number];
  id: number;
  isPrivate: boolean;
  name: string;
  uploaderClerkId: string;
};

export type ResourcesService = {
  addVersion(
    input: UploadResourceVersionInput,
  ): Promise<{ id: number; version: number }>;
  create(input: CreateResourceInput): Promise<{ id: number }>;
  download(
    resourceId: number,
    fileId: number,
    viewer?: ResourceViewer,
  ): Promise<string | null>;
  getDetail(
    resourceId: number,
    viewer?: ResourceViewer,
  ): Promise<ResourceDetail | null>;
  listDirectory(
    categorySlugs?: string[],
    viewer?: ResourceViewer,
  ): Promise<ResourceDirectory>;
  listAdminTrash(): Promise<ResourceTrashItem[]>;
  listNotifications(): Promise<ResourceNotificationItem[]>;
  listOwned(uploaderClerkId: string): Promise<
    {
      id: number;
      isPrivate: boolean;
      name: string;
      privateReason: string | null;
      updatedAt: Date;
      version: number;
    }[]
  >;
  listOwnerTrash(uploaderClerkId: string): Promise<ResourceTrashItem[]>;
  listCategories(
    search?: string,
  ): Promise<{ id: number; name: string; slug: string }[]>;
  markNotificationRead(
    notificationId: number,
    actorClerkId: string,
  ): Promise<void>;
  markPrivate(input: {
    actorClerkId: string;
    reason: string;
    resourceId: number;
  }): Promise<void>;
  setVisibility(input: {
    actorClerkId: string;
    actorIsAdmin: boolean;
    isPublic: boolean;
    resourceId: number;
  }): Promise<void>;
  restore(input: {
    actorClerkId: string;
    actorIsAdmin: boolean;
    resourceId: number;
  }): Promise<void>;
  softDelete(input: {
    actorClerkId: string;
    actorIsAdmin: boolean;
    resourceId: number;
  }): Promise<{ deletedByRole: ResourceTrashItem["deletedByRole"] }>;
  update(input: UpdateResourceInput): Promise<{ id: number }>;
};

export function createResourcesService(
  db: Database,
  storage: ResourceStorage,
  logger: Logger,
  signUrl: (objectPath: string) => Promise<string> = async () => {
    throw new Error("Resource URL signing is not configured.");
  },
): ResourcesService {
  return {
    async addVersion(input) {
      return await logger.operation(
        loggerMessages.resources.addVersion,
        async () => {
          const resourceId = input.resourceId;
          const uploaderClerkId = input.uploaderClerkId.trim();
          assertPositiveInteger(resourceId, "resourceId");
          if (!uploaderClerkId) throw new Error("uploaderClerkId is required.");

          const [ownedResource] = await db
            .select({ id: schema.resources.id })
            .from(schema.resources)
            .where(
              sql`${schema.resources.id} = ${resourceId}
                and ${schema.resources.uploaderClerkId} = ${uploaderClerkId}
                and ${schema.resources.deletedAt} is null`,
            )
            .limit(1);
          if (!ownedResource) throw new Error("Resource owner is required.");

          const uploaded = await uploadResourceFiles(
            storage,
            input.files,
            resourceId,
          );
          try {
            const fileValues = resourceFileValues(uploaded);
            const result = await db.execute<{
              id: number;
              version: number;
            }>(sql`
              with inserted_version as (
                insert into resource_versions (resource_id, version)
                select resources.id,
                  coalesce(max(resource_versions.version), 0) + 1
                from resources
                left join resource_versions
                  on resource_versions.resource_id = resources.id
                where resources.id = ${resourceId}
                  and resources.uploader_clerk_id = ${uploaderClerkId}
                  and resources.deleted_at is null
                group by resources.id
                returning id, resource_id, version
              ),
              input_files(file_name, content_type, size, object_path, url) as (
                values ${fileValues}
              ),
              inserted_files as (
                insert into resource_files (
                  version_id, file_name, content_type, size, object_path, url
                )
                select inserted_version.id, input_files.*
                from inserted_version cross join input_files
                returning id
              ),
              updated_resource as (
                update resources
                set updated_at = now()
                from inserted_version
                where resources.id = inserted_version.resource_id
                returning resources.id
              )
              select inserted_version.id, inserted_version.version
              from inserted_version cross join updated_resource
              where (select count(*) from inserted_files) = ${uploaded.length}
            `);
            const version = result.rows[0];
            if (!version) throw new Error("Resource owner is required.");
            return version;
          } catch (error) {
            await deleteUploadedFiles(storage, uploaded);
            throw error;
          }
        },
        {
          attributes: {
            fileCount: input.files.length,
            resourceId: input.resourceId,
            uploaderClerkIdHash: hashLogIdentifier(input.uploaderClerkId),
          },
        },
      );
    },
    async create(input) {
      return await logger.operation(
        loggerMessages.resources.create,
        async () => {
          const normalized = normalizeCreateInput(input);
          const resourceId = await reserveResourceId(db);
          const uploaded: ResourceUploadResult[] = [];

          try {
            const files = await uploadResourceFiles(
              storage,
              normalized.files,
              resourceId,
            );
            uploaded.push(...files);
            const images = await uploadResourceImages(
              storage,
              normalized.images,
              resourceId,
            );
            uploaded.push(...images);

            return await persistResource(
              db,
              resourceId,
              normalized,
              files,
              images,
            );
          } catch (error) {
            await Promise.allSettled(
              uploaded.map(({ objectPath }) => storage.delete(objectPath)),
            );
            throw error;
          }
        },
        {
          attributes: {
            categoryCount: input.categories.length,
            fileCount: input.files.length,
            imageCount: input.images.length,
            uploaderClerkIdHash: hashLogIdentifier(input.uploaderClerkId),
          },
        },
      );
    },
    async download(resourceId, fileId, viewer = {}) {
      return await logger.operation(
        loggerMessages.resources.download,
        async () => {
          assertPositiveInteger(resourceId, "resourceId");
          assertPositiveInteger(fileId, "fileId");

          const [file] = await db
            .select({
              id: schema.resourceFiles.id,
              objectPath: schema.resourceFiles.objectPath,
            })
            .from(schema.resourceFiles)
            .innerJoin(
              schema.resourceVersions,
              eq(schema.resourceVersions.id, schema.resourceFiles.versionId),
            )
            .innerJoin(
              schema.resources,
              eq(schema.resources.id, schema.resourceVersions.resourceId),
            )
            .where(
              sql`${schema.resourceFiles.id} = ${fileId}
                and ${schema.resourceVersions.resourceId} = ${resourceId}
                and ${schema.resources.deletedAt} is null
                and (${schema.resources.isPrivate} = false
                  or ${Boolean(viewer.isAdmin)}
                  or ${schema.resources.uploaderClerkId} = ${viewer.clerkId ?? ""})`,
            )
            .limit(1);

          if (!file) return null;

          await db.insert(schema.resourceDownloads).values({ fileId: file.id });
          return await signUrl(file.objectPath);
        },
        { attributes: { fileId, resourceId } },
      );
    },
    async getDetail(resourceId, viewer = {}) {
      return await logger.operation(
        loggerMessages.resources.getDetail,
        async () => {
          assertPositiveInteger(resourceId, "resourceId");
          const [resource] = await db
            .select()
            .from(schema.resources)
            .where(
              and(
                eq(schema.resources.id, resourceId),
                isNull(schema.resources.deletedAt),
              ),
            )
            .limit(1);

          if (!resource || !canViewResource(resource, viewer)) return null;

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
                  id: schema.resourceVersions.id,
                  version: schema.resourceVersions.version,
                })
                .from(schema.resourceVersions)
                .where(eq(schema.resourceVersions.resourceId, resourceId))
                .orderBy(desc(schema.resourceVersions.version)),
              db
                .select({
                  contentType: schema.resourceFiles.contentType,
                  downloadCount: count(schema.resourceDownloads.id),
                  fileName: schema.resourceFiles.fileName,
                  id: schema.resourceFiles.id,
                  size: schema.resourceFiles.size,
                  versionId: schema.resourceFiles.versionId,
                })
                .from(schema.resourceFiles)
                .leftJoin(
                  schema.resourceDownloads,
                  eq(schema.resourceDownloads.fileId, schema.resourceFiles.id),
                )
                .innerJoin(
                  schema.resourceVersions,
                  eq(
                    schema.resourceVersions.id,
                    schema.resourceFiles.versionId,
                  ),
                )
                .where(eq(schema.resourceVersions.resourceId, resourceId))
                .groupBy(schema.resourceFiles.id)
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
                .innerJoin(
                  schema.resourceFiles,
                  eq(
                    schema.resourceFiles.versionId,
                    schema.resourceVersions.id,
                  ),
                )
                .leftJoin(
                  schema.resourceDownloads,
                  eq(schema.resourceDownloads.fileId, schema.resourceFiles.id),
                )
                .where(eq(schema.resourceVersions.resourceId, resourceId)),
            ]);
          const versionDetails = versions.map((version) => {
            const versionFiles = files.filter(
              (file) => file.versionId === version.id,
            );
            return {
              ...version,
              downloadCount: versionFiles.reduce(
                (total, file) => total + file.downloadCount,
                0,
              ),
              files: versionFiles.map(
                ({ contentType, downloadCount, fileName, id, size }) => ({
                  contentType,
                  downloadCount,
                  fileName,
                  id,
                  size,
                }),
              ),
            };
          });
          const currentVersion = versionDetails[0];
          if (!currentVersion) return null;
          const signedImages = await Promise.all(
            images.map(async ({ objectPath, ...image }) => ({
              ...image,
              url: await signUrl(objectPath),
            })),
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
            versions: versionDetails,
          };
        },
        { attributes: { resourceId } },
      );
    },
    async listDirectory(categorySlugs = [], viewer = {}) {
      return await logger.operation(
        loggerMessages.resources.listDirectory,
        async () => {
          const filters = normalizeCategorySlugs(categorySlugs);
          const categoryResult = await db.execute<{
            id: number;
            name: string;
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
              coverImageObjectPath: string | null;
            }
          >(sql`
            select
              resources.id,
              resources.name,
              resources.uploader_clerk_id as "uploaderClerkId",
              resources.is_private as "isPrivate",
              resources.private_reason as "privateReason",
              resources.created_at as "createdAt",
              cover_image.object_path as "coverImageObjectPath",
              jsonb_build_object(
                'id', current_version.id,
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
            inner join lateral (
              select resource_versions.id, first_file.id as file_id,
                first_file.file_name
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
            left join resource_files all_files
              on all_files.version_id = all_versions.id
            left join resource_downloads
              on resource_downloads.file_id = all_files.id
            left join resources_to_categories
              on resources_to_categories.resource_id = resources.id
            left join resource_categories
              on resource_categories.id = resources_to_categories.category_id
            where (${schema.resources.isPrivate} = false
                or ${Boolean(viewer.isAdmin)}
                or ${schema.resources.uploaderClerkId} = ${viewer.clerkId ?? ""})
              and ${schema.resources.deletedAt} is null
              and ${filter}
            group by resources.id, current_version.id, current_version.file_id,
              current_version.file_name, cover_image.object_path
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
                    ? await signUrl(coverImageObjectPath)
                    : null,
                }),
              ),
            ),
          };
        },
        { attributes: { categoryCount: categorySlugs.length } },
      );
    },
    async listOwned(uploaderClerkId) {
      return await logger.operation(
        loggerMessages.resources.listOwned,
        async () => {
          const owner = uploaderClerkId.trim();
          if (!owner) throw new Error("uploaderClerkId is required.");
          const result = await db.execute<{
            id: number;
            isPrivate: boolean;
            name: string;
            privateReason: string | null;
            updatedAt: Date;
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
    async listAdminTrash() {
      return await logger.operation(
        loggerMessages.resources.listAdminTrash,
        async () => await listTrash(db, sql`true`),
      );
    },
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
              resource_notifications.uploader_clerk_id as "uploaderClerkId",
              resource_notifications.created_at as "createdAt",
              resource_notifications.read_at as "readAt",
              resource_notifications.read_by_clerk_id as "readByClerkId"
            from resource_notifications
            inner join resources
              on resources.id = resource_notifications.resource_id
            left join resource_categories notification_category
              on notification_category.id = resource_notifications.category_id
            left join resources_to_categories
              on resources_to_categories.resource_id = resources.id
            left join resource_categories assigned_category
              on assigned_category.id = resources_to_categories.category_id
            where resources.deleted_at is null
            group by resource_notifications.id, resources.id,
              notification_category.id
            order by resource_notifications.created_at desc,
              resource_notifications.id desc
          `);
          return result.rows;
        },
      );
    },
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
    async markPrivate(input) {
      await logger.operation(
        loggerMessages.resources.markPrivate,
        async () => {
          assertPositiveInteger(input.resourceId, "resourceId");
          const actorClerkId = input.actorClerkId.trim();
          const reason = input.reason.trim();
          if (!actorClerkId || !reason || reason.length > 1000) {
            throw new Error("Private resource metadata is invalid.");
          }
          await db.execute(sql`
            update resources
            set is_private = true, private_reason = ${reason},
              privated_at = now(), privated_by_clerk_id = ${actorClerkId},
              updated_at = now()
            where id = ${input.resourceId}
              and privated_by_clerk_id is null
              and deleted_at is null
            returning id
          `);
        },
        {
          attributes: {
            actorClerkIdHash: hashLogIdentifier(input.actorClerkId),
            resourceId: input.resourceId,
          },
        },
      );
    },
    async setVisibility(input) {
      await logger.operation(
        loggerMessages.resources.update,
        async () => {
          assertPositiveInteger(input.resourceId, "resourceId");
          const actorClerkId = input.actorClerkId.trim();
          if (!actorClerkId) throw new Error("actorClerkId is required.");
          const result = await db.execute<{ id: number }>(sql`
            update resources
            set is_private = ${!input.isPublic}, private_reason = null,
              privated_at = null, privated_by_clerk_id = null,
              updated_at = now()
            where id = ${input.resourceId}
              and (uploader_clerk_id = ${actorClerkId} or ${input.actorIsAdmin})
              and (${input.actorIsAdmin} or privated_by_clerk_id is null)
              and (${input.isPublic} or uploader_clerk_id = ${actorClerkId})
              and deleted_at is null
            returning id
          `);
          if (!result.rows[0]) {
            throw new Error("Resource visibility update is not allowed.");
          }
        },
        {
          attributes: {
            actorClerkIdHash: hashLogIdentifier(input.actorClerkId),
            isPublic: input.isPublic,
            resourceId: input.resourceId,
          },
        },
      );
    },
    async restore(input) {
      await logger.operation(
        loggerMessages.resources.restore,
        async () => {
          assertPositiveInteger(input.resourceId, "resourceId");
          const actorClerkId = input.actorClerkId.trim();
          if (!actorClerkId) throw new Error("actorClerkId is required.");
          const result = await db.execute<{ id: number }>(sql`
            update resources
            set deleted_at = null, deleted_by_clerk_id = null,
              deleted_by_role = null, updated_at = now()
            where id = ${input.resourceId}
              and deleted_at is not null
              and (${input.actorIsAdmin} or (
                uploader_clerk_id = ${actorClerkId}
                and deleted_by_clerk_id = ${actorClerkId}
                and deleted_by_role = 'owner'
              ))
            returning id
          `);
          if (!result.rows[0]) {
            throw new Error("Resource restoration is not allowed.");
          }
        },
        {
          attributes: {
            actorClerkIdHash: hashLogIdentifier(input.actorClerkId),
            resourceId: input.resourceId,
          },
        },
      );
    },
    async softDelete(input) {
      return await logger.operation(
        loggerMessages.resources.softDelete,
        async () => {
          assertPositiveInteger(input.resourceId, "resourceId");
          const actorClerkId = input.actorClerkId.trim();
          if (!actorClerkId) throw new Error("actorClerkId is required.");
          const result = await db.execute<{
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
              and (uploader_clerk_id = ${actorClerkId} or ${input.actorIsAdmin})
            returning deleted_by_role as "deletedByRole"
          `);
          const deleted = result.rows[0];
          if (!deleted) throw new Error("Resource deletion is not allowed.");
          return deleted;
        },
        {
          attributes: {
            actorClerkIdHash: hashLogIdentifier(input.actorClerkId),
            resourceId: input.resourceId,
          },
        },
      );
    },
    async update(input) {
      return await logger.operation(
        loggerMessages.resources.update,
        async () => {
          const normalized = normalizeUpdateInput(input);
          const [ownedResource] = await db
            .select({ id: schema.resources.id })
            .from(schema.resources)
            .where(
              sql`${schema.resources.id} = ${normalized.resourceId}
                and (${schema.resources.uploaderClerkId} = ${normalized.actorClerkId}
                  or ${normalized.actorIsAdmin})
                and ${schema.resources.deletedAt} is null`,
            )
            .limit(1);
          if (!ownedResource) throw new Error("Resource owner is required.");
          const currentImages = await db
            .select({
              id: schema.resourceImages.id,
              objectPath: schema.resourceImages.objectPath,
            })
            .from(schema.resourceImages)
            .where(eq(schema.resourceImages.resourceId, normalized.resourceId));
          const currentImageIds = new Set(currentImages.map(({ id }) => id));
          if (
            normalized.retainedImageIds.some(
              (id) => !currentImageIds.has(id),
            ) ||
            normalized.retainedImageIds.length + normalized.images.length ===
              0 ||
            normalized.retainedImageIds.length + normalized.images.length > 10
          ) {
            throw new Error("Resource images are invalid.");
          }

          const images = await uploadResourceImages(
            storage,
            normalized.images,
            normalized.resourceId,
          );
          try {
            const updated = await persistResourceUpdate(db, normalized, images);
            const retained = new Set(normalized.retainedImageIds);
            await Promise.allSettled(
              currentImages
                .filter(({ id }) => !retained.has(id))
                .map(({ objectPath }) => storage.delete(objectPath)),
            );
            return updated;
          } catch (error) {
            await deleteUploadedFiles(storage, images);
            throw error;
          }
        },
        {
          attributes: {
            categoryCount: input.categories.length,
            imageCount: input.images.length,
            resourceId: input.resourceId,
            actorClerkIdHash: hashLogIdentifier(input.actorClerkId),
          },
        },
      );
    },
  };
}

export function createConfiguredResourcesService(
  db: Database,
  config: ResourceStorageConfig,
  logger: Logger,
): ResourcesService {
  return createResourcesService(
    db,
    createResourceStorage(config),
    logger,
    async (objectPath) => await signResourceUrl({ ...config, objectPath }),
  );
}

async function persistResource(
  db: Database,
  resourceId: number,
  input: ReturnType<typeof normalizeCreateInput>,
  files: ResourceUploadResult[],
  images: ResourceUploadResult[],
): Promise<{ id: number }> {
  const categoryValues = sql.join(
    input.categories.map(({ name, slug }) => sql`(${name}, ${slug})`),
    sql`, `,
  );
  const fileValues = resourceFileValues(files);
  const imageValues = resourceImageValues(images);
  const result = await db.execute<{ id: number }>(sql`
    with input_categories(name, slug) as (values ${categoryValues}),
    inserted_resource as (
      insert into resources (
        id, uploader_clerk_id, name, description
      ) overriding system value values (
        ${resourceId}, ${input.uploaderClerkId}, ${input.name}, ${input.description}
      ) returning id
    ),
    upserted_categories as (
      insert into resource_categories (name, slug, created_by_clerk_id)
      select name, slug, ${input.uploaderClerkId} from input_categories
      on conflict (slug) do update set name = resource_categories.name
      returning id, slug, (xmax = 0) as created
    ),
    inserted_version as (
      insert into resource_versions (resource_id, version)
      select id, 1
      from inserted_resource
      returning id
    ),
    input_files(file_name, content_type, size, object_path, url) as (
      values ${fileValues}
    ),
    inserted_files as (
      insert into resource_files (
        version_id, file_name, content_type, size, object_path, url
      )
      select inserted_version.id, input_files.*
      from inserted_version cross join input_files
      returning id
    ),
    input_images(position, file_name, content_type, size, object_path, url) as (
      values ${imageValues}
    ),
    inserted_images as (
      insert into resource_images (
        resource_id, position, file_name, content_type, size, object_path, url
      )
      select inserted_resource.id, input_images.*
      from inserted_resource cross join input_images
      returning id
    ),
    inserted_assignments as (
      insert into resources_to_categories (resource_id, category_id)
      select inserted_resource.id, upserted_categories.id
      from inserted_resource cross join upserted_categories
      returning resource_id
    ),
    inserted_resource_notification as (
      insert into resource_notifications (
        type, resource_id, uploader_clerk_id
      )
      select 'resource_created', inserted_resource.id, ${input.uploaderClerkId}
      from inserted_resource
      returning id
    ),
    inserted_category_notifications as (
      insert into resource_notifications (
        type, resource_id, category_id, uploader_clerk_id
      )
      select 'category_created', inserted_resource.id,
        upserted_categories.id, ${input.uploaderClerkId}
      from inserted_resource cross join upserted_categories
      where upserted_categories.created
      returning id
    )
    select inserted_resource.id
    from inserted_resource cross join inserted_version
    where (select count(*) from inserted_files) = ${files.length}
      and (select count(*) from inserted_images) = ${images.length}
      and (select count(*) from inserted_assignments) = ${input.categories.length}
      and (select count(*) from inserted_resource_notification) = 1
      and (select count(*) from inserted_category_notifications) =
        (select count(*) from upserted_categories where created)
  `);
  const created = result.rows[0];
  if (!created) throw new Error("Failed to persist resource.");
  return created;
}

async function persistResourceUpdate(
  db: Database,
  input: ReturnType<typeof normalizeUpdateInput>,
  images: ResourceUploadResult[],
): Promise<{ id: number }> {
  const categoryValues = sql.join(
    input.categories.map(({ name, slug }) => sql`(${name}, ${slug})`),
    sql`, `,
  );
  const retainedImages = JSON.stringify(
    input.retainedImageIds.map((id) => ({ id })),
  );
  const newImages = JSON.stringify(
    images.map((image, position) => ({ ...image, position })),
  );
  const result = await db.execute<{ id: number }>(sql`
    with input_categories(name, slug) as (values ${categoryValues}),
    updated_resource as (
      update resources
      set name = ${input.name}, description = ${input.description}, updated_at = now()
      where id = ${input.resourceId}
        and (uploader_clerk_id = ${input.actorClerkId} or ${input.actorIsAdmin})
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
  return updated;
}

async function listTrash(
  db: Database,
  filter: SQL,
): Promise<ResourceTrashItem[]> {
  const result = await db.execute<ResourceTrashItem>(sql`
    select id, name, uploader_clerk_id as "uploaderClerkId",
      is_private as "isPrivate", deleted_at as "deletedAt",
      deleted_by_clerk_id as "deletedByClerkId",
      deleted_by_role as "deletedByRole"
    from resources
    where deleted_at is not null and ${filter}
    order by deleted_at desc, id desc
  `);
  return result.rows;
}

function normalizeCreateInput(input: CreateResourceInput) {
  const files = normalizeResourceFiles(input.files);
  const images = normalizeResourceImages(input.images, true);
  assertCombinedUploadSize([...files, ...images]);
  return {
    ...input,
    ...normalizeMetadata(input),
    files,
    images,
  };
}

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
    ...normalizeMetadata({
      ...input,
      uploaderClerkId: input.actorClerkId,
    }),
    images,
    retainedImageIds,
  };
}

function normalizeMetadata(input: {
  categories: string[];
  description: string;
  name: string;
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

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

function normalizeResourceFiles(
  files: ResourceUploadInput[],
): ResourceUploadInput[] {
  if (!Array.isArray(files) || files.length === 0 || files.length > 10) {
    throw new Error("A resource version requires 1–10 files.");
  }

  const names = files.map(({ fileName }) => fileName.trim().toLowerCase());
  if (new Set(names).size !== names.length) {
    throw new Error("Resource filenames must be unique within a version.");
  }

  return files;
}

function normalizeResourceImages(
  images: ResourceUploadInput[],
  required: boolean,
): ResourceUploadInput[] {
  if (
    !Array.isArray(images) ||
    (required && images.length === 0) ||
    images.length > 10
  ) {
    throw new Error("A resource requires 1–10 images.");
  }

  const names = images.map(({ fileName }) => fileName.trim().toLowerCase());
  if (new Set(names).size !== names.length) {
    throw new Error("Resource image filenames must be unique.");
  }
  return images;
}

function assertCombinedUploadSize(files: ResourceUploadInput[]): void {
  const total = files.reduce((size, file) => size + file.bytes.byteLength, 0);
  if (!Number.isSafeInteger(total) || total > maxSessionBytes) {
    throw new Error("Resource upload exceeds the combined size limit.");
  }
}

async function uploadResourceFiles(
  storage: ResourceStorage,
  files: ResourceUploadInput[],
  resourceId: number,
): Promise<ResourceUploadResult[]> {
  const uploaded: ResourceUploadResult[] = [];

  try {
    for (const file of normalizeResourceFiles(files)) {
      uploaded.push(await storage.upload(file, resourceId));
    }
    return uploaded;
  } catch (error) {
    await deleteUploadedFiles(storage, uploaded);
    throw error;
  }
}

async function uploadResourceImages(
  storage: ResourceStorage,
  images: ResourceUploadInput[],
  resourceId: number,
): Promise<ResourceUploadResult[]> {
  const uploaded: ResourceUploadResult[] = [];
  try {
    for (const image of images) {
      uploaded.push(await storage.uploadImage(image, resourceId));
    }
    return uploaded;
  } catch (error) {
    await deleteUploadedFiles(storage, uploaded);
    throw error;
  }
}

async function deleteUploadedFiles(
  storage: ResourceStorage,
  files: ResourceUploadResult[],
): Promise<void> {
  await Promise.allSettled(
    files.map(({ objectPath }) => storage.delete(objectPath)),
  );
}

function resourceFileValues(files: ResourceUploadResult[]) {
  return sql.join(
    files.map(
      (file) =>
        sql`(${file.fileName}, ${file.contentType}, ${file.size}, ${file.objectPath}, ${file.url})`,
    ),
    sql`, `,
  );
}

function resourceImageValues(images: ResourceUploadResult[]) {
  return sql.join(
    images.map(
      (image, position) =>
        sql`(${position}, ${image.fileName}, ${image.contentType}, ${image.size}, ${image.objectPath}, ${image.url})`,
    ),
    sql`, `,
  );
}

async function reserveResourceId(db: Database): Promise<number> {
  const result = await db.execute<{ id: number }>(sql`
    select nextval(pg_get_serial_sequence('resources', 'id'))::integer as id
  `);
  const id = result.rows[0]?.id;
  if (!id) throw new Error("Failed to reserve a resource ID.");
  return id;
}

export function canViewResource(
  resource: { isPrivate: boolean; uploaderClerkId: string },
  viewer: ResourceViewer,
): boolean {
  return (
    !resource.isPrivate ||
    Boolean(viewer.isAdmin) ||
    resource.uploaderClerkId === viewer.clerkId
  );
}
