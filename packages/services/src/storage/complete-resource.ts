import { sql } from "drizzle-orm";
import { resourcePayload, slugify } from "./resource-payload.js";
import type { StorageDb } from "./types.js";

type UploadCompletion = { resourceId: number; version: number };
export async function completeResource(
  db: StorageDb,
  sessionId: string,
  uploaderClerkId: string,
  payload: Extract<ReturnType<typeof resourcePayload>, { operation: "create" }>,
): Promise<UploadCompletion | undefined> {
  const result = await db.execute<UploadCompletion>(sql`
    with locked_session as (
      select * from upload_session
      where id = ${sessionId}::uuid
        and uploader_clerk_id = ${uploaderClerkId}
        and payload->>'operation' = 'create'
        and completed_at is null
        and expires_at > now()
        and not exists (
          select 1 from upload_file
          where session_id = ${sessionId}::uuid and uploaded_at is null
        )
      for update
    ), inserted_resource as (
      insert into resources (
        id, uploader_clerk_id, name, description, is_private
      )
      overriding system value
      select locked_session.reserved_resource_id,
        locked_session.uploader_clerk_id, ${payload.name},
        ${payload.description}, ${payload.isPrivate}
      from locked_session
      returning id
    ), input_categories as (
      select category.name, category.slug
      from locked_session,
        lateral jsonb_to_recordset(${JSON.stringify([...new Map(payload.categories.map((name) => [slugify(name), { name, slug: slugify(name) }])).values()])}::jsonb)
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
      from inserted_version cross join upload_file uploads
      where uploads.session_id = ${sessionId}::uuid
        and uploads.kind = 'file'
      returning id
    ), inserted_images as (
      insert into resource_images (
        resource_id, position, file_name, content_type, size, object_path, url
      )
      select inserted_resource.id, uploads.position, uploads.file_name,
        uploads.content_type, uploads.size, uploads.object_path, uploads.url
      from inserted_resource cross join upload_file uploads
      where uploads.session_id = ${sessionId}::uuid
        and uploads.kind = 'image'
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
      update upload_session
      set completed_at = now()
      from inserted_version
      where upload_session.id = ${sessionId}::uuid
        and (select count(*) from inserted_files) = (
          select count(*) from upload_file
          where session_id = ${sessionId}::uuid and kind = 'file'
        )
        and (select count(*) from inserted_assignments) = (
          select count(*) from input_categories
        )
        and (select count(*) from inserted_images) = (
          select count(*) from upload_file
          where session_id = ${sessionId}::uuid and kind = 'image'
        )
        and (select count(*) from inserted_resource_notification) = 1
      returning inserted_version.resource_id as "resourceId",
        inserted_version.version
    )
    select * from completed
  `);
  return result.rows[0];
}

export async function completeVersion(
  db: StorageDb,
  sessionId: string,
  uploaderClerkId: string,
): Promise<UploadCompletion | undefined> {
  const result = await db.execute<UploadCompletion>(sql`
    with locked_session as (
      select upload_session.*
      from upload_session
      inner join resources
        on resources.id = upload_session.target_id
      where upload_session.id = ${sessionId}::uuid
        and upload_session.uploader_clerk_id = ${uploaderClerkId}
        and resources.deleted_at is null
        and upload_session.payload->>'operation' = 'version'
        and upload_session.completed_at is null
        and upload_session.expires_at > now()
        and not exists (
          select 1 from upload_file
          where session_id = ${sessionId}::uuid and uploaded_at is null
        )
      for update
    ), inserted_version as (
      insert into resource_versions (resource_id, version)
      select locked_session.target_id,
        locked_session.reserved_version
      from locked_session
      returning id, resource_id, version
    ), inserted_files as (
      insert into resource_files (
        version_id, file_name, content_type, size, object_path, url
      )
      select inserted_version.id, uploads.file_name, uploads.content_type,
        uploads.size, uploads.object_path, uploads.url
      from inserted_version cross join upload_file uploads
      where uploads.session_id = ${sessionId}::uuid
        and uploads.kind = 'file'
      returning id
    ), updated_resource as (
      update resources
      set updated_at = now()
      from inserted_version
      where resources.id = inserted_version.resource_id
      returning resources.id
    ), completed as (
      update upload_session
      set completed_at = now()
      from inserted_version
      where upload_session.id = ${sessionId}::uuid
        and (select count(*) from inserted_files) = (
          select count(*) from upload_file
          where session_id = ${sessionId}::uuid and kind = 'file'
        )
        and (select count(*) from updated_resource) = 1
      returning inserted_version.resource_id as "resourceId",
        inserted_version.version
    )
    select * from completed
  `);
  return result.rows[0];
}
