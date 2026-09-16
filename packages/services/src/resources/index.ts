import type { Database } from "@package/database";
import { schema } from "@package/database";
import { type Logger, loggerMessages } from "@package/logger";
import {
  createResourceStorage,
  type ResourceStorage,
  type ResourceStorageConfig,
  type ResourceUploadInput,
  type ResourceUploadResult,
} from "@package/resources";
import { count, desc, eq, ilike, sql } from "drizzle-orm";
import { hashLogIdentifier } from "../logging.js";

export type CreateResourceInput = {
  categories: string[];
  description: string;
  file: ResourceUploadInput;
  name: string;
  preview?: ResourceUploadInput;
  uploaderClerkId: string;
};

export type UpdateResourceInput = {
  categories: string[];
  description: string;
  name: string;
  preview?: ResourceUploadInput;
  resourceId: number;
  uploaderClerkId: string;
};

export type UploadResourceVersionInput = {
  file: ResourceUploadInput;
  resourceId: number;
  uploaderClerkId: string;
};

export type ResourceVersionDetail = {
  contentType: string;
  createdAt: Date;
  downloadCount: number;
  fileName: string;
  id: number;
  size: number;
  version: number;
};

export type ResourceDetail = {
  categories: { id: number; name: string; slug: string }[];
  createdAt: Date;
  currentVersion: ResourceVersionDetail;
  description: string;
  downloadCount: number;
  id: number;
  name: string;
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
    fileName: string;
    id: number;
  };
  downloadCount: number;
  id: number;
  name: string;
  previewImageUrl: string | null;
};

export type ResourcesService = {
  addVersion(
    input: UploadResourceVersionInput,
  ): Promise<{ id: number; version: number }>;
  create(input: CreateResourceInput): Promise<{ id: number }>;
  download(resourceId: number, versionId: number): Promise<string | null>;
  getDetail(resourceId: number): Promise<ResourceDetail | null>;
  listDirectory(categorySlugs?: string[]): Promise<ResourceDirectory>;
  listOwned(
    uploaderClerkId: string,
  ): Promise<{ id: number; name: string; updatedAt: Date; version: number }[]>;
  listCategories(
    search?: string,
  ): Promise<{ id: number; name: string; slug: string }[]>;
  update(input: UpdateResourceInput): Promise<{ id: number }>;
};

export function createResourcesService(
  db: Database,
  storage: ResourceStorage,
  logger: Logger,
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

          const uploaded = await storage.upload(input.file);
          try {
            const result = await db.execute<{
              id: number;
              version: number;
            }>(sql`
              with inserted_version as (
                insert into resource_versions (
                  resource_id, version, file_name, content_type, size, object_path, url
                )
                select resources.id,
                  coalesce(max(resource_versions.version), 0) + 1,
                  ${uploaded.fileName}, ${uploaded.contentType}, ${uploaded.size},
                  ${uploaded.objectPath}, ${uploaded.url}
                from resources
                left join resource_versions
                  on resource_versions.resource_id = resources.id
                where resources.id = ${resourceId}
                  and resources.uploader_clerk_id = ${uploaderClerkId}
                group by resources.id
                returning id, resource_id, version
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
            `);
            const version = result.rows[0];
            if (!version) throw new Error("Resource owner is required.");
            return version;
          } catch (error) {
            await Promise.allSettled([storage.delete(uploaded.objectPath)]);
            throw error;
          }
        },
        {
          attributes: {
            fileNameHash: hashLogIdentifier(input.file.fileName),
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
            const file = await storage.upload(normalized.file);
            uploaded.push(file);
            const preview = normalized.preview
              ? await storage.uploadPreview(normalized.preview)
              : undefined;
            if (preview) uploaded.push(preview);

            return await persistResource(db, normalized, file, preview);
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
            fileNameHash: hashLogIdentifier(input.file.fileName),
            hasPreview: Boolean(input.preview),
            uploaderClerkIdHash: hashLogIdentifier(input.uploaderClerkId),
          },
        },
      );
    },
    async download(resourceId, versionId) {
      return await logger.operation(
        loggerMessages.resources.download,
        async () => {
          assertPositiveInteger(resourceId, "resourceId");
          assertPositiveInteger(versionId, "versionId");

          const [version] = await db
            .select({
              id: schema.resourceVersions.id,
              url: schema.resourceVersions.url,
            })
            .from(schema.resourceVersions)
            .where(
              sql`${schema.resourceVersions.id} = ${versionId} and ${schema.resourceVersions.resourceId} = ${resourceId}`,
            )
            .limit(1);

          if (!version) return null;

          await db
            .insert(schema.resourceDownloads)
            .values({ versionId: version.id });
          return version.url;
        },
        { attributes: { resourceId, versionId } },
      );
    },
    async getDetail(resourceId) {
      return await logger.operation(
        loggerMessages.resources.getDetail,
        async () => {
          assertPositiveInteger(resourceId, "resourceId");
          const [resource] = await db
            .select()
            .from(schema.resources)
            .where(eq(schema.resources.id, resourceId))
            .limit(1);

          if (!resource) return null;

          const [versions, categories, totals] = await Promise.all([
            db
              .select({
                contentType: schema.resourceVersions.contentType,
                createdAt: schema.resourceVersions.createdAt,
                downloadCount: count(schema.resourceDownloads.id),
                fileName: schema.resourceVersions.fileName,
                id: schema.resourceVersions.id,
                size: schema.resourceVersions.size,
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
          const currentVersion = versions[0];
          if (!currentVersion) return null;

          return {
            categories,
            createdAt: resource.createdAt,
            currentVersion,
            description: resource.description,
            downloadCount: totals[0]?.downloadCount ?? 0,
            id: resource.id,
            name: resource.name,
            previewImageUrl: resource.previewImageUrl,
            uploaderClerkId: resource.uploaderClerkId,
            versions,
          };
        },
        { attributes: { resourceId } },
      );
    },
    async listDirectory(categorySlugs = []) {
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
          const resourceResult = await db.execute<ResourceDirectoryItem>(sql`
            select
              resources.id,
              resources.name,
              resources.created_at as "createdAt",
              resources.preview_image_url as "previewImageUrl",
              jsonb_build_object(
                'id', current_version.id,
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
              select id, file_name
              from resource_versions
              where resource_versions.resource_id = resources.id
              order by version desc
              limit 1
            ) current_version on true
            left join resource_versions all_versions
              on all_versions.resource_id = resources.id
            left join resource_downloads
              on resource_downloads.version_id = all_versions.id
            left join resources_to_categories
              on resources_to_categories.resource_id = resources.id
            left join resource_categories
              on resource_categories.id = resources_to_categories.category_id
            where ${filter}
            group by resources.id, current_version.id, current_version.file_name
            order by resources.created_at desc
          `);

          return {
            categories,
            invalidFilters,
            resources: resourceResult.rows,
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
            name: string;
            updatedAt: Date;
            version: number;
          }>(sql`
            select resources.id, resources.name,
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
              sql`${schema.resources.id} = ${normalized.resourceId} and ${schema.resources.uploaderClerkId} = ${normalized.uploaderClerkId}`,
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
            uploaderClerkIdHash: hashLogIdentifier(input.uploaderClerkId),
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
  return createResourcesService(db, createResourceStorage(config), logger);
}

async function persistResource(
  db: Database,
  input: ReturnType<typeof normalizeCreateInput>,
  file: ResourceUploadResult,
  preview?: ResourceUploadResult,
): Promise<{ id: number }> {
  const categoryValues = sql.join(
    input.categories.map(({ name, slug }) => sql`(${name}, ${slug})`),
    sql`, `,
  );
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
      returning id, slug
    ),
    inserted_version as (
      insert into resource_versions (
        resource_id, version, file_name, content_type, size, object_path, url
      )
      select id, 1, ${file.fileName}, ${file.contentType}, ${file.size},
        ${file.objectPath}, ${file.url}
      from inserted_resource
      returning id
    ),
    inserted_assignments as (
      insert into resources_to_categories (resource_id, category_id)
      select inserted_resource.id, upserted_categories.id
      from inserted_resource cross join upserted_categories
      returning resource_id
    )
    select inserted_resource.id
    from inserted_resource cross join inserted_version
    where (select count(*) from inserted_assignments) = ${input.categories.length}
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
        and uploader_clerk_id = ${input.uploaderClerkId}
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
  return { ...input, ...normalizeMetadata(input) };
}

function normalizeUpdateInput(input: UpdateResourceInput) {
  assertPositiveInteger(input.resourceId, "resourceId");
  return { ...input, ...normalizeMetadata(input) };
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
