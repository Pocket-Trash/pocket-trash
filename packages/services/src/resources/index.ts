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

export type ResourceDetail = {
  categories: { id: number; name: string; slug: string }[];
  createdAt: Date;
  currentVersion: {
    contentType: string;
    createdAt: Date;
    downloadCount: number;
    fileName: string;
    id: number;
    size: number;
    version: number;
  };
  description: string;
  downloadCount: number;
  id: number;
  name: string;
  previewImageUrl: string | null;
  uploaderClerkId: string;
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
  create(input: CreateResourceInput): Promise<{ id: number }>;
  download(resourceId: number, versionId: number): Promise<string | null>;
  getDetail(resourceId: number): Promise<ResourceDetail | null>;
  listDirectory(categorySlugs?: string[]): Promise<ResourceDirectory>;
  listCategories(
    search?: string,
  ): Promise<{ id: number; name: string; slug: string }[]>;
};

export function createResourcesService(
  db: Database,
  storage: ResourceStorage,
  logger: Logger,
): ResourcesService {
  return {
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
              .orderBy(desc(schema.resourceVersions.version))
              .limit(1),
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

function normalizeCreateInput(input: CreateResourceInput) {
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

  return { ...input, categories, description, name, uploaderClerkId };
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
