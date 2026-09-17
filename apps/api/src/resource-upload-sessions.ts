import { type Database, schema } from "@package/database";
import {
  maxSessionBytes,
  type ResourceStorage,
  type ResourceUploadMetadata,
} from "@package/resources";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";

export const resourceUploadErrorCodes = [
  "content_length_mismatch",
  "content_length_required",
  "invalid_request",
  "session_expired",
  "session_not_found",
  "upload_failed",
  "uploads_incomplete",
] as const;

export type ResourceUploadErrorCode = (typeof resourceUploadErrorCodes)[number];

export type ResourceUploadSessionInput =
  | {
      categories: string[];
      description: string;
      files: ResourceUploadMetadata[];
      name: string;
      operation: "create";
      preview?: ResourceUploadMetadata;
    }
  | {
      files: ResourceUploadMetadata[];
      operation: "version";
      preview?: ResourceUploadMetadata;
      resourceId: number;
    };

export type ResourceUploadSessionResult = {
  expiresAt: string;
  id: string;
  uploads: Array<{
    contentType: string;
    fileName: string;
    id: string;
    kind: "preview" | "resource";
    size: number;
  }>;
};

export type ResourceUploadCompletion = {
  resourceId: number;
  version: number;
};

export class ResourceUploadSessionError extends Error {
  constructor(
    readonly code: ResourceUploadErrorCode,
    readonly status: 400 | 404 | 409 | 411 | 502,
  ) {
    super(code);
    this.name = "ResourceUploadSessionError";
  }
}

export function createResourceUploadSessionsService(input: {
  db: Database;
  now?: () => Date;
  randomUUID?: () => string;
  storage: ResourceStorage;
}) {
  const now = input.now ?? (() => new Date());
  const randomUUID = input.randomUUID ?? crypto.randomUUID.bind(crypto);

  return {
    async cleanupExpired(): Promise<number> {
      const expired = await input.db
        .select({
          objectPath: schema.resourceUploadFiles.objectPath,
          sessionId: schema.resourceUploadSessions.id,
          uploadedAt: schema.resourceUploadFiles.uploadedAt,
        })
        .from(schema.resourceUploadSessions)
        .leftJoin(
          schema.resourceUploadFiles,
          eq(
            schema.resourceUploadFiles.sessionId,
            schema.resourceUploadSessions.id,
          ),
        )
        .where(
          and(
            isNull(schema.resourceUploadSessions.completedAt),
            lt(schema.resourceUploadSessions.expiresAt, now()),
          ),
        );

      const sessions = new Map<string, typeof expired>();
      for (const file of expired) {
        sessions.set(file.sessionId, [
          ...(sessions.get(file.sessionId) ?? []),
          file,
        ]);
      }
      let deleted = 0;

      for (const [sessionId, files] of sessions) {
        const objectPaths = files.flatMap(({ objectPath, uploadedAt }) =>
          objectPath && uploadedAt ? [objectPath] : [],
        );
        const results = await Promise.allSettled(
          objectPaths.map((objectPath) => input.storage.delete(objectPath)),
        );
        if (results.some(({ status }) => status === "rejected")) continue;

        await input.db
          .delete(schema.resourceUploadSessions)
          .where(
            and(
              eq(schema.resourceUploadSessions.id, sessionId),
              isNull(schema.resourceUploadSessions.completedAt),
              lt(schema.resourceUploadSessions.expiresAt, now()),
            ),
          );
        deleted += 1;
      }

      return deleted;
    },

    async complete(
      sessionId: string,
      uploaderClerkId: string,
    ): Promise<ResourceUploadCompletion> {
      const session = await getSession(input.db, sessionId, uploaderClerkId);
      if (session.completedAt) {
        return completedSessionResult(session);
      }
      if (session.expiresAt <= now()) {
        throw new ResourceUploadSessionError("session_expired", 409);
      }

      const [{ missingUploads = 0 } = {}] = await input.db
        .select({ missingUploads: sql<number>`count(*)::int` })
        .from(schema.resourceUploadFiles)
        .where(
          and(
            eq(schema.resourceUploadFiles.sessionId, sessionId),
            isNull(schema.resourceUploadFiles.uploadedAt),
          ),
        );
      if (missingUploads > 0) {
        throw new ResourceUploadSessionError("uploads_incomplete", 409);
      }

      const result =
        session.operation === "create"
          ? await completeResource(input.db, sessionId, uploaderClerkId)
          : await completeVersion(input.db, sessionId, uploaderClerkId);
      if (result) return result;

      return completedSessionResult(
        await getSession(input.db, sessionId, uploaderClerkId),
      );
    },

    async create(
      sessionInput: ResourceUploadSessionInput,
      uploaderClerkId: string,
    ): Promise<ResourceUploadSessionResult> {
      const metadata = normalizeSessionInput(sessionInput);
      if (sessionInput.operation === "version") {
        const [ownedResource] = await input.db
          .select({ id: schema.resources.id })
          .from(schema.resources)
          .where(
            and(
              eq(schema.resources.id, sessionInput.resourceId),
              eq(schema.resources.uploaderClerkId, uploaderClerkId),
            ),
          )
          .limit(1);
        if (!ownedResource) {
          throw new ResourceUploadSessionError("session_not_found", 404);
        }
      }

      const id = randomUUID();
      const expiresAt = new Date(now().getTime() + 60 * 60 * 1000);
      const uploads = (() => {
        try {
          return [
            ...metadata.files.map((file) => ({
              id: randomUUID(),
              kind: "resource" as const,
              ...input.storage.createUploadTarget(file),
            })),
            ...(metadata.preview
              ? [
                  {
                    id: randomUUID(),
                    kind: "preview" as const,
                    ...input.storage.createUploadTarget(
                      metadata.preview,
                      "preview",
                    ),
                  },
                ]
              : []),
          ];
        } catch {
          throw new ResourceUploadSessionError("invalid_request", 400);
        }
      })();
      const uploadValues = sql.join(
        uploads.map(
          (file) =>
            sql`(${file.id}::uuid, ${file.kind}, ${file.fileName}, ${file.contentType}, ${file.size}, ${file.objectPath}, ${file.url})`,
        ),
        sql`, `,
      );

      await input.db.execute(sql`
        with inserted_session as (
          insert into resource_upload_sessions (
            id, uploader_clerk_id, operation, resource_id, name, description,
            categories, expires_at
          ) values (
            ${id}::uuid, ${uploaderClerkId}, ${sessionInput.operation},
            ${sessionInput.operation === "version" ? sessionInput.resourceId : null},
            ${sessionInput.operation === "create" ? metadata.name : null},
            ${sessionInput.operation === "create" ? metadata.description : null},
            ${JSON.stringify(sessionInput.operation === "create" ? metadata.categories : [])}::jsonb,
            ${expiresAt}
          )
          returning id
        ), input_files(id, kind, file_name, content_type, size, object_path, url) as (
          values ${uploadValues}
        )
        insert into resource_upload_files (
          id, session_id, kind, file_name, content_type, size, object_path, url
        )
        select input_files.id, inserted_session.id, input_files.kind,
          input_files.file_name, input_files.content_type, input_files.size,
          input_files.object_path, input_files.url
        from input_files cross join inserted_session
      `);

      return {
        expiresAt: expiresAt.toISOString(),
        id,
        uploads: uploads.map(
          ({ contentType, fileName, id: fileId, kind, size }) => ({
            contentType,
            fileName,
            id: fileId,
            kind,
            size,
          }),
        ),
      };
    },

    async upload(
      sessionId: string,
      fileId: string,
      uploaderClerkId: string,
      request: Request,
    ): Promise<void> {
      const [file] = await input.db
        .select({
          completedAt: schema.resourceUploadSessions.completedAt,
          contentType: schema.resourceUploadFiles.contentType,
          expiresAt: schema.resourceUploadSessions.expiresAt,
          objectPath: schema.resourceUploadFiles.objectPath,
          size: schema.resourceUploadFiles.size,
        })
        .from(schema.resourceUploadFiles)
        .innerJoin(
          schema.resourceUploadSessions,
          eq(
            schema.resourceUploadSessions.id,
            schema.resourceUploadFiles.sessionId,
          ),
        )
        .where(
          and(
            eq(schema.resourceUploadFiles.id, fileId),
            eq(schema.resourceUploadFiles.sessionId, sessionId),
            eq(schema.resourceUploadSessions.uploaderClerkId, uploaderClerkId),
          ),
        )
        .limit(1);
      if (!file || file.completedAt) {
        throw new ResourceUploadSessionError("session_not_found", 404);
      }
      if (file.expiresAt <= now()) {
        throw new ResourceUploadSessionError("session_expired", 409);
      }

      const contentLength = parseContentLength(
        request.headers.get("content-length"),
      );
      if (contentLength === null) {
        throw new ResourceUploadSessionError("content_length_required", 411);
      }
      if (
        contentLength !== file.size ||
        request.headers.get("content-type") !== file.contentType ||
        !request.body
      ) {
        throw new ResourceUploadSessionError("content_length_mismatch", 400);
      }

      try {
        const fixedLength = new FixedLengthStream(contentLength);
        await Promise.all([
          request.body.pipeTo(fixedLength.writable),
          input.storage.uploadStream({
            body: fixedLength.readable,
            contentLength,
            contentType: file.contentType,
            objectPath: file.objectPath,
          }),
        ]);
      } catch {
        throw new ResourceUploadSessionError("upload_failed", 502);
      }

      const uploadedAt = now();
      const [uploaded] = await input.db
        .update(schema.resourceUploadFiles)
        .set({ uploadedAt })
        .from(schema.resourceUploadSessions)
        .where(
          and(
            eq(schema.resourceUploadFiles.id, fileId),
            eq(schema.resourceUploadFiles.sessionId, sessionId),
            eq(
              schema.resourceUploadSessions.id,
              schema.resourceUploadFiles.sessionId,
            ),
            isNull(schema.resourceUploadSessions.completedAt),
            gt(schema.resourceUploadSessions.expiresAt, uploadedAt),
          ),
        )
        .returning({ id: schema.resourceUploadFiles.id });
      if (!uploaded) {
        try {
          await input.storage.delete(file.objectPath);
        } catch {
          throw new ResourceUploadSessionError("upload_failed", 502);
        }
        throw new ResourceUploadSessionError("session_expired", 409);
      }
    },
  };
}

export type ResourceUploadSessionsService = ReturnType<
  typeof createResourceUploadSessionsService
>;

function normalizeSessionInput(input: ResourceUploadSessionInput): {
  categories: Array<{ name: string; slug: string }>;
  description?: string;
  files: ResourceUploadMetadata[];
  name?: string;
  preview?: ResourceUploadMetadata;
} {
  if (input.files.length === 0 || input.files.length > 10) {
    throw new ResourceUploadSessionError("invalid_request", 400);
  }
  const fileNames = input.files.map(({ fileName }) =>
    fileName.trim().toLocaleLowerCase(),
  );
  if (new Set(fileNames).size !== fileNames.length) {
    throw new ResourceUploadSessionError("invalid_request", 400);
  }
  const totalSize =
    input.files.reduce((total, { size }) => total + size, 0) +
    (input.preview?.size ?? 0);
  if (!Number.isSafeInteger(totalSize) || totalSize > maxSessionBytes) {
    throw new ResourceUploadSessionError("invalid_request", 400);
  }

  if (input.operation === "version") return { ...input, categories: [] };

  const name = input.name.trim();
  const description = input.description.trim();
  const categories = [
    ...new Map(
      input.categories.map((category) => {
        const categoryName = category.trim();
        return [slugify(categoryName), categoryName] as const;
      }),
    ),
  ].map(([slug, categoryName]) => ({ name: categoryName, slug }));
  if (
    !name ||
    name.length > 120 ||
    !description ||
    description.length > 5000 ||
    categories.length === 0 ||
    categories.length > 10 ||
    categories.some(
      ({ name: categoryName, slug }) =>
        !categoryName || categoryName.length > 60 || !slug,
    )
  ) {
    throw new ResourceUploadSessionError("invalid_request", 400);
  }

  return { ...input, categories, description, name };
}

function parseContentLength(value: string | null): number | null {
  if (!value || !/^\d+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

async function getSession(
  db: Database,
  sessionId: string,
  uploaderClerkId: string,
) {
  const [session] = await db
    .select({
      completedAt: schema.resourceUploadSessions.completedAt,
      completedResourceId: schema.resourceUploadSessions.completedResourceId,
      completedVersion: schema.resourceUploadSessions.completedVersion,
      expiresAt: schema.resourceUploadSessions.expiresAt,
      operation: schema.resourceUploadSessions.operation,
    })
    .from(schema.resourceUploadSessions)
    .where(
      and(
        eq(schema.resourceUploadSessions.id, sessionId),
        eq(schema.resourceUploadSessions.uploaderClerkId, uploaderClerkId),
      ),
    )
    .limit(1);
  if (!session) {
    throw new ResourceUploadSessionError("session_not_found", 404);
  }
  return session;
}

function completedSessionResult(session: {
  completedResourceId: number | null;
  completedVersion: number | null;
}): ResourceUploadCompletion {
  if (!session.completedResourceId || !session.completedVersion) {
    throw new ResourceUploadSessionError("uploads_incomplete", 409);
  }
  return {
    resourceId: session.completedResourceId,
    version: session.completedVersion,
  };
}

async function completeResource(
  db: Database,
  sessionId: string,
  uploaderClerkId: string,
): Promise<ResourceUploadCompletion | undefined> {
  const result = await db.execute<ResourceUploadCompletion>(sql`
    with locked_session as (
      select * from resource_upload_sessions
      where id = ${sessionId}::uuid
        and uploader_clerk_id = ${uploaderClerkId}
        and operation = 'create'
        and completed_at is null
        and expires_at > now()
        and not exists (
          select 1 from resource_upload_files
          where session_id = ${sessionId}::uuid and uploaded_at is null
        )
      for update
    ), preview as (
      select * from resource_upload_files
      where session_id = ${sessionId}::uuid and kind = 'preview'
    ), inserted_resource as (
      insert into resources (
        uploader_clerk_id, name, description, preview_image_file_name,
        preview_image_content_type, preview_image_size,
        preview_image_object_path, preview_image_url
      )
      select locked_session.uploader_clerk_id, locked_session.name,
        locked_session.description, preview.file_name, preview.content_type,
        preview.size, preview.object_path, preview.url
      from locked_session left join preview on true
      returning id
    ), input_categories as (
      select category.name, category.slug
      from locked_session,
        lateral jsonb_to_recordset(locked_session.categories)
          as category(name text, slug text)
    ), upserted_categories as (
      insert into resource_categories (name, slug, created_by_clerk_id)
      select input_categories.name, input_categories.slug,
        locked_session.uploader_clerk_id
      from input_categories cross join locked_session
      on conflict (slug) do update set name = resource_categories.name
      returning id, (xmax = 0) as created
    ), inserted_version as (
      insert into resource_versions (resource_id, version)
      select id, 1 from inserted_resource
      returning id, resource_id, version
    ), inserted_files as (
      insert into resource_files (
        version_id, file_name, content_type, size, object_path, url
      )
      select inserted_version.id, uploads.file_name, uploads.content_type,
        uploads.size, uploads.object_path, uploads.url
      from inserted_version cross join resource_upload_files uploads
      where uploads.session_id = ${sessionId}::uuid
        and uploads.kind = 'resource'
      returning id
    ), inserted_assignments as (
      insert into resources_to_categories (resource_id, category_id)
      select inserted_resource.id, upserted_categories.id
      from inserted_resource cross join upserted_categories
      returning category_id
    ), inserted_resource_notification as (
      insert into resource_notifications (type, resource_id, uploader_clerk_id)
      select 'resource_created', inserted_resource.id,
        locked_session.uploader_clerk_id
      from inserted_resource cross join locked_session
      returning id
    ), inserted_category_notifications as (
      insert into resource_notifications (
        type, resource_id, category_id, uploader_clerk_id
      )
      select 'category_created', inserted_resource.id, upserted_categories.id,
        locked_session.uploader_clerk_id
      from inserted_resource cross join upserted_categories
        cross join locked_session
      where upserted_categories.created
      returning id
    ), completed as (
      update resource_upload_sessions
      set completed_resource_id = inserted_version.resource_id,
        completed_version = inserted_version.version, completed_at = now()
      from inserted_version
      where resource_upload_sessions.id = ${sessionId}::uuid
        and (select count(*) from inserted_files) = (
          select count(*) from resource_upload_files
          where session_id = ${sessionId}::uuid and kind = 'resource'
        )
        and (select count(*) from inserted_assignments) = (
          select jsonb_array_length(categories) from locked_session
        )
        and (select count(*) from inserted_resource_notification) = 1
      returning inserted_version.resource_id as "resourceId",
        inserted_version.version
    )
    select * from completed
  `);
  return result.rows[0];
}

async function completeVersion(
  db: Database,
  sessionId: string,
  uploaderClerkId: string,
): Promise<ResourceUploadCompletion | undefined> {
  const result = await db.execute<ResourceUploadCompletion>(sql`
    with locked_session as (
      select resource_upload_sessions.*
      from resource_upload_sessions
      inner join resources
        on resources.id = resource_upload_sessions.resource_id
      where resource_upload_sessions.id = ${sessionId}::uuid
        and resource_upload_sessions.uploader_clerk_id = ${uploaderClerkId}
        and resources.uploader_clerk_id = ${uploaderClerkId}
        and resource_upload_sessions.operation = 'version'
        and resource_upload_sessions.completed_at is null
        and resource_upload_sessions.expires_at > now()
        and not exists (
          select 1 from resource_upload_files
          where session_id = ${sessionId}::uuid and uploaded_at is null
        )
      for update
    ), inserted_version as (
      insert into resource_versions (resource_id, version)
      select locked_session.resource_id,
        coalesce(max(resource_versions.version), 0) + 1
      from locked_session
      left join resource_versions
        on resource_versions.resource_id = locked_session.resource_id
      group by locked_session.resource_id
      returning id, resource_id, version
    ), inserted_files as (
      insert into resource_files (
        version_id, file_name, content_type, size, object_path, url
      )
      select inserted_version.id, uploads.file_name, uploads.content_type,
        uploads.size, uploads.object_path, uploads.url
      from inserted_version cross join resource_upload_files uploads
      where uploads.session_id = ${sessionId}::uuid
        and uploads.kind = 'resource'
      returning id
    ), preview as (
      select * from resource_upload_files
      where session_id = ${sessionId}::uuid and kind = 'preview'
    ), updated_resource as (
      update resources
      set preview_image_file_name = coalesce(
          preview.file_name, resources.preview_image_file_name
        ),
        preview_image_content_type = coalesce(
          preview.content_type, resources.preview_image_content_type
        ),
        preview_image_size = coalesce(preview.size, resources.preview_image_size),
        preview_image_object_path = coalesce(
          preview.object_path, resources.preview_image_object_path
        ),
        preview_image_url = coalesce(preview.url, resources.preview_image_url),
        updated_at = now()
      from inserted_version left join preview on true
      where resources.id = inserted_version.resource_id
      returning resources.id
    ), completed as (
      update resource_upload_sessions
      set completed_resource_id = inserted_version.resource_id,
        completed_version = inserted_version.version, completed_at = now()
      from inserted_version
      where resource_upload_sessions.id = ${sessionId}::uuid
        and (select count(*) from inserted_files) = (
          select count(*) from resource_upload_files
          where session_id = ${sessionId}::uuid and kind = 'resource'
        )
        and (select count(*) from updated_resource) = 1
      returning inserted_version.resource_id as "resourceId",
        inserted_version.version
    )
    select * from completed
  `);
  return result.rows[0];
}
