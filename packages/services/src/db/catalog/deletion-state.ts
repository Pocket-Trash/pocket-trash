import type { AuditJsonObject, Database } from "@package/database";
import { sql } from "drizzle-orm";

/**
 * Reads complete allowlisted item snapshots, including trashed images and finish membership.
 * Clerk identities, counterparties, and signed image URLs are intentionally excluded.
 *
 * @param tx - Caller transaction after item and upload-target locks are acquired.
 * @param ids - Item identifiers in the destructive operation.
 * @returns Stable item snapshots ordered by identifier.
 * @rejects When snapshot loading fails.
 */
export async function collectionItemDeletionState(
  tx: Pick<Database, "execute">,
  ids: number[],
): Promise<AuditJsonObject[]> {
  if (!ids.length) return [];
  // Freeze child keys and rows so FK writers cannot change the allowlisted pre-state.
  for (const table of [
    "collection_detail_spinner_button",
    "collection_detail_spinner",
    "collection_detail_slider",
    "collection_detail_slider_plate",
    "collection_detail_slider_insert",
  ]) {
    await tx.execute(sql`select id from ${sql.identifier(table)}
      where id in (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )}) order by id for update`);
  }
  await tx.execute(sql`select id from finish_option
    where collection_item_id in (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )}) order by id for update`);
  await tx.execute(sql`select id from collection_item_image
    where collection_item_id in (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )}) order by id for update`);
  const result = await tx.execute<{
    /** Allowlisted JSON state of one item. */
    state: AuditJsonObject;
  }>(sql`
    select jsonb_build_object(
      'id', item.id, 'collectionId', item.collection_id,
      'displayName', item.display_name, 'description', item.description,
      'materialId', item.material_id, 'owned', item.owned,
      'purchasedAt', item.purchased_at, 'soldAt', item.sold_at,
      'approvalStatus', item.approval_status,
      'approvalDecisionReason', item.approval_decision_reason,
      'approvalDecidedAt', item.approval_decided_at,
      'isPrivate', item.is_private, 'privateReason', item.private_reason,
      'privatedAt', item.privated_at,
      'createdAt', item.created_at, 'updatedAt', item.updated_at,
      'productSpinnerId', spinner.product_spinner_id,
      'installedButtonId', spinner.installed_button_id, 'bearing', spinner.bearing,
      'productSpinnerButtonId', button.product_spinner_button_id,
      'productSliderId', slider.product_slider_id,
      'installedPlateId', slider.installed_plate_id,
      'installedInsertId', slider.installed_insert_id,
      'productSliderPlateId', slider_plate.product_slider_plate_id,
      'productSliderInsertId', slider_insert.product_slider_insert_id,
      'finishOptions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', option.id, 'position', option.position,
          'sourceProductFinishOptionId', option.source_product_finish_option_id,
          'colorEffectId', option.color_effect_id,
          'finishes', coalesce((select jsonb_agg(jsonb_build_object(
            'id', finish_id, 'position', position) order by position)
            from finish_option_finish where finish_option_id = option.id), '[]'),
          'colors', coalesce((select jsonb_agg(jsonb_build_object(
            'id', color_id, 'position', position) order by position)
            from finish_option_color where finish_option_id = option.id), '[]')
        ) order by option.id)
        from finish_option option where option.collection_item_id = item.id), '[]'),
      'images', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', image.id, 'position', image.position,
          'fileName', image.file_name, 'contentType', image.content_type,
          'size', image.size, 'sha256', image.sha256,
          'storageProvider', image.storage_provider, 'objectPath', image.object_path,
          'deletedAt', image.deleted_at, 'createdAt', image.created_at
        ) order by image.id)
        from collection_item_image image where image.collection_item_id = item.id), '[]')
    ) as state
    from collection_item item
    left join collection_detail_spinner spinner on spinner.id = item.id
    left join collection_detail_spinner_button button on button.id = item.id
    left join collection_detail_slider slider on slider.id = item.id
    left join collection_detail_slider_plate slider_plate on slider_plate.id = item.id
    left join collection_detail_slider_insert slider_insert on slider_insert.id = item.id
    where item.id in (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})
    order by item.id
  `);
  return result.rows.map(({ state }) => state);
}

/**
 * Reads collection state and all covers without identities or signed URLs.
 *
 * @param tx - Caller transaction holding the collection and upload-target locks.
 * @param id - Collection identifier.
 * @returns Allowlisted collection state.
 * @rejects When the collection disappears or snapshot loading fails.
 */
export async function collectionDeletionState(
  tx: Pick<Database, "execute">,
  id: number,
): Promise<AuditJsonObject> {
  const result = await tx.execute<{
    /** Allowlisted JSON state of the collection. */
    state: AuditJsonObject;
  }>(sql`
    select jsonb_build_object(
      'id', collection.id, 'name', collection.name,
      'normalizedName', collection.normalized_name,
      'description', collection.description, 'isPrivate', collection.is_private,
      'privateReason', collection.private_reason, 'privatedAt', collection.privated_at,
      'createdAt', collection.created_at, 'updatedAt', collection.updated_at,
      'images', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', image.id, 'isCurrent', image.is_current, 'position', image.position,
          'fileName', image.file_name, 'contentType', image.content_type,
          'size', image.size, 'sha256', image.sha256,
          'storageProvider', image.storage_provider, 'objectPath', image.object_path,
          'createdAt', image.created_at
        ) order by image.id)
        from collection_image image where image.collection_id = collection.id), '[]')
    ) as state from user_collection collection where collection.id = ${id}
  `);
  const state = result.rows[0]?.state;
  if (!state) throw new Error("Collection does not exist.");
  return state;
}
