import type { Database } from "@package/database";
import { schema } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import {
  createResourceStorage,
  type ResourceStorage,
  type ResourceStorageConfig,
  type ResourceUploadInput,
  type ResourceUploadResult,
  signResourceUrl,
} from "@package/resources";
import { count, desc, eq, ilike, sql } from "drizzle-orm";
import { hashLogIdentifier } from "../logging.js";

export type CreateResourceInput = {
  categories: string[];
  description: string;
  files: ResourceUploadInput[];
  name: string;
  preview?: ResourceUploadInput;
  uploaderClerkId: string;
};

export type UpdateResourceInput = {
  actorClerkId: string;
  actorIsAdmin: boolean;
  categories: string[];
  description: string;
  name: string;
  preview?: ResourceUploadInput;
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

export type ResourceDetail = {
  categories: { id: number; name: string; slug: string }[];
  createdAt: Date;
  currentVersion: ResourceVersionDetail;
  description: string;
  downloadCount: number;
  id: number;
  isAdminPrivate: boolean;
  isPrivate: boolean;
  name: string;
  privateReason: string | null;
  privatedAt: Date | null;
  previewImageUrl: string | null;
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
  id: number;
  isPrivate: boolean;
  name: string;
  privateReason: string | null;
  previewImageUrl: string | null;
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
              sql`${schema.resources.id} = ${resourceId} and ${schema.resources.uploaderClerkId} = ${uploaderClerkId}`,
            )
            .limit(1);
          if (!ownedResource) throw new Error("Resource owner is required.");

          const uploaded = await uploadResourceFiles(storage, input.files);
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
          const uploaded: ResourceUploadResult[] = [];

          try {
            const files = await uploadResourceFiles(storage, normalized.files);
            uploaded.push(...files);
            const preview = normalized.preview
              ? await storage.uploadPreview(normalized.preview)
              : undefined;
            if (preview) uploaded.push(preview);

            return await persistResource(db, normalized, files, preview);
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
            hasPreview: Boolean(input.preview),
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
            .where(eq(schema.resources.id, resourceId))
            .limit(1);

          if (!resource || !canViewResource(resource, viewer)) return null;

          const [versions, files, categories, totals] = await Promise.all([
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
                eq(schema.resourceVersions.id, schema.resourceFiles.versionId),
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
                eq(schema.resourceFiles.versionId, schema.resourceVersions.id),
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

          return {
            categories,
            createdAt: resource.createdAt,
            currentVersion,
            description: resource.description,
            downloadCount: totals[0]?.downloadCount ?? 0,
            id: resource.id,
            isAdminPrivate: Boolean(resource.privatedByClerkId),
            isPrivate: resource.isPrivate,
            name: resource.name,
            privateReason: resource.privateReason,
            privatedAt: resource.privatedAt,
            previewImageUrl: resource.previewImageObjectPath
              ? await signUrl(resource.previewImageObjectPath)
              : null,
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
            Omit<ResourceDirectoryItem, "previewImageUrl"> & {
              previewImageObjectPath: string | null;
            }
          >(sql`
            select
              resources.id,
              resources.name,
              resources.uploader_clerk_id as "uploaderClerkId",
              resources.is_private as "isPrivate",
              resources.private_reason as "privateReason",
              resources.created_at as "createdAt",
              resources.preview_image_object_path as "previewImageObjectPath",
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
              and ${filter}
            group by resources.id, current_version.id, current_version.file_id,
              current_version.file_name
            order by resources.created_at desc
          `);

          return {
            categories,
            invalidFilters,
            resources: await Promise.all(
              resourceResult.rows.map(
                async ({ previewImageObjectPath, ...resource }) => ({
                  ...resource,
                  previewImageUrl: previewImageObjectPath
                    ? await signUrl(previewImageObjectPath)
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
    async update(input) {
      return await logger.operation(
        loggerMessages.resources.update,
        async () => {
          const normalized = normalizeUpdateInput(input);
          const [ownedResource] = await db
            .select({
              id: schema.resources.id,
              previewObjectPath: schema.resources.previewImageObjectPath,
            })
            .from(schema.resources)
            .where(
              sql`${schema.resources.id} = ${normalized.resourceId}
                and (${schema.resources.uploaderClerkId} = ${normalized.actorClerkId}
                  or ${normalized.actorIsAdmin})`,
            )
            .limit(1);
          if (!ownedResource) throw new Error("Resource owner is required.");

          const preview = normalized.preview
            ? await storage.uploadPreview(normalized.preview)
            : undefined;
          try {
            const updated = await persistResourceUpdate(
              db,
              normalized,
              preview,
            );
            if (preview && ownedResource.previewObjectPath) {
              await Promise.allSettled([
                storage.delete(ownedResource.previewObjectPath),
              ]);
            }
            return updated;
          } catch (error) {
            if (preview) {
              await Promise.allSettled([storage.delete(preview.objectPath)]);
            }
            throw error;
          }
        },
        {
          attributes: {
            categoryCount: input.categories.length,
            hasPreview: Boolean(input.preview),
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
  input: ReturnType<typeof normalizeCreateInput>,
  files: ResourceUploadResult[],
  preview?: ResourceUploadResult,
): Promise<{ id: number }> {
  const categoryValues = sql.join(
    input.categories.map(({ name, slug }) => sql`(${name}, ${slug})`),
    sql`, `,
  );
  const fileValues = resourceFileValues(files);
  const result = await db.execute<{ id: number }>(sql`
    with input_categories(name, slug) as (values ${categoryValues}),
    inserted_resource as (
      insert into resources (
        uploader_clerk_id, name, description,
        preview_image_file_name, preview_image_content_type,
        preview_image_size, preview_image_object_path, preview_image_url
      ) values (
        ${input.uploaderClerkId}, ${input.name}, ${input.description},
        ${preview?.fileName ?? null}, ${preview?.contentType ?? null},
        ${preview?.size ?? null}, ${preview?.objectPath ?? null},
        ${preview?.url ?? null}
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
  preview?: ResourceUploadResult,
): Promise<{ id: number }> {
  const categoryValues = sql.join(
    input.categories.map(({ name, slug }) => sql`(${name}, ${slug})`),
    sql`, `,
  );
  const result = await db.execute<{ id: number }>(sql`
    with input_categories(name, slug) as (values ${categoryValues}),
    updated_resource as (
      update resources
      set name = ${input.name}, description = ${input.description},
        preview_image_file_name = coalesce(
          ${preview?.fileName ?? null}, preview_image_file_name
        ),
        preview_image_content_type = coalesce(
          ${preview?.contentType ?? null}, preview_image_content_type
        ),
        preview_image_size = coalesce(
          ${preview?.size ?? null}, preview_image_size
        ),
        preview_image_object_path = coalesce(
          ${preview?.objectPath ?? null}, preview_image_object_path
        ),
        preview_image_url = coalesce(${preview?.url ?? null}, preview_image_url),
        updated_at = now()
      where id = ${input.resourceId}
        and (uploader_clerk_id = ${input.actorClerkId} or ${input.actorIsAdmin})
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
  `);
  const updated = result.rows[0];
  if (!updated) throw new Error("Resource owner is required.");
  return updated;
}

function normalizeCreateInput(input: CreateResourceInput) {
  return {
    ...input,
    ...normalizeMetadata(input),
    files: normalizeResourceFiles(input.files),
  };
}

function normalizeUpdateInput(input: UpdateResourceInput) {
  assertPositiveInteger(input.resourceId, "resourceId");
  return {
    ...input,
    ...normalizeMetadata({
      ...input,
      uploaderClerkId: input.actorClerkId,
    }),
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

async function uploadResourceFiles(
  storage: ResourceStorage,
  files: ResourceUploadInput[],
): Promise<ResourceUploadResult[]> {
  const uploaded: ResourceUploadResult[] = [];

  try {
    for (const file of normalizeResourceFiles(files)) {
      uploaded.push(await storage.upload(file));
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
