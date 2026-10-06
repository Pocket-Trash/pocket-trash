import type { Database } from "@package/database";
import { schema } from "@package/database";
import { eq, inArray, sql } from "drizzle-orm";
import type { AuditService } from "../audit/index.js";

/**
 * Account-owned database identifiers collected before deletion.
 */
type ErasureTargets = {
  /**
   * Audit actor event identifiers.
   */
  auditActorEventIds: Array<number | string>;
  /**
   * Audit owner event identifiers.
   */
  auditOwnerEventIds: Array<number | string>;
  /**
   * Collection identifiers.
   */
  collectionIds: Array<number | string>;
  /**
   * Collection image identifiers.
   */
  collectionImageIds: Array<number | string>;
  /**
   * Collection item identifiers.
   */
  collectionItemIds: Array<number | string>;
  /**
   * Collection item image identifiers.
   */
  collectionItemImageIds: Array<number | string>;
  /**
   * Resource file identifiers.
   */
  resourceFileIds: Array<number | string>;
  /**
   * Resource identifiers.
   */
  resourceIds: Array<number | string>;
  /**
   * Resource image identifiers.
   */
  resourceImageIds: Array<number | string>;
  /**
   * Resource version identifiers.
   */
  resourceVersionIds: Array<number | string>;
  /**
   * Upload file identifiers.
   */
  uploadFileIds: string[];
  /**
   * Upload session identifiers.
   */
  uploadSessionIds: string[];
};

/**
 * Remaining-record count for one post-erasure database location.
 */
type VerificationFinding = {
  /**
   * Database location that was verified.
   */
  location: string;
  /**
   * Number of records still referencing the erased account.
   */
  remaining: number | string;
};

/**
 * Erases account-owned database data and redacts retained audit records.
 *
 * @param db - Database containing the account data.
 * @param targetClerkId - Clerk identifier of the account to erase.
 * @param audit - Audit service used for retained-record redaction.
 * @returns Completion after the erasure transaction commits.
 * @rejects When target capture, redaction, deletion, or verification fails.
 */
export async function eraseAccountDatabaseData(
  db: Database,
  targetClerkId: string,
  audit: Pick<AuditService, "redactAccount">,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [account] = await tx
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.clerkId, targetClerkId))
      .limit(1)
      .for("update");
    const userId = account?.id ?? -1;
    const targetResult = await tx.execute(sql<ErasureTargets>`
      select
        array(select id from audit_event where actor_user_id = ${userId}) as "auditActorEventIds",
        array(select id from audit_event where owner_user_id = ${userId}) as "auditOwnerEventIds",
        array(select id from user_collection where owner_id = ${userId}) as "collectionIds",
        array(select id from collection_item where owner_id = ${userId}) as "collectionItemIds",
        array(select ci.id from collection_image ci join user_collection uc on uc.id = ci.collection_id where uc.owner_id = ${userId}) as "collectionImageIds",
        array(select cii.id from collection_item_image cii join collection_item ci on ci.id = cii.collection_item_id where ci.owner_id = ${userId}) as "collectionItemImageIds",
        array(select id from resources where uploader_clerk_id = ${targetClerkId}) as "resourceIds",
        array(select ri.id from resource_images ri join resources r on r.id = ri.resource_id where r.uploader_clerk_id = ${targetClerkId}) as "resourceImageIds",
        array(select rv.id from resource_versions rv join resources r on r.id = rv.resource_id where r.uploader_clerk_id = ${targetClerkId}) as "resourceVersionIds",
        array(select rf.id from resource_files rf join resource_versions rv on rv.id = rf.version_id join resources r on r.id = rv.resource_id where r.uploader_clerk_id = ${targetClerkId}) as "resourceFileIds",
        array(select id from upload_session where uploader_clerk_id = ${targetClerkId}) as "uploadSessionIds",
        array(select uf.id from upload_file uf join upload_session us on us.id = uf.session_id where us.uploader_clerk_id = ${targetClerkId}) as "uploadFileIds"
    `);
    const targets = targetResult.rows[0] as ErasureTargets | undefined;
    if (!targets) throw new Error("Database erasure target capture failed.");

    if (account) await audit.redactAccount(tx, account.id);

    if (account) {
      await tx.execute(sql`
        update collection_item
        set purchased_from_user_id = null, purchased_from_user = null
        where purchased_from_user_id = ${account.id}
      `);
      await tx.execute(sql`
        update collection_item
        set sold_to_user_id = null, sold_to_user = null
        where sold_to_user_id = ${account.id}
      `);
    }

    await tx.execute(sql`
      update user_collection
      set privated_by_clerk_id = null
      where privated_by_clerk_id = ${targetClerkId}
    `);
    await tx.execute(sql`
      update collection_item
      set privated_by_clerk_id = null
      where privated_by_clerk_id = ${targetClerkId}
    `);
    await tx.execute(sql`
      update collection_image
      set uploaded_by_clerk_id = null
      where uploaded_by_clerk_id = ${targetClerkId}
    `);
    await tx.execute(sql`
      update collection_item_image
      set uploaded_by_clerk_id = nullif(uploaded_by_clerk_id, ${targetClerkId}),
          deleted_by_clerk_id = nullif(deleted_by_clerk_id, ${targetClerkId})
      where uploaded_by_clerk_id = ${targetClerkId}
         or deleted_by_clerk_id = ${targetClerkId}
    `);
    await tx.execute(sql`
      update product
      set owner_clerk_id = nullif(owner_clerk_id, ${targetClerkId}),
          privated_by_clerk_id = nullif(privated_by_clerk_id, ${targetClerkId})
      where owner_clerk_id = ${targetClerkId}
         or privated_by_clerk_id = ${targetClerkId}
    `);
    await tx.execute(sql`
      update maker_image
      set uploaded_by_clerk_id = nullif(uploaded_by_clerk_id, ${targetClerkId}),
          deleted_by_clerk_id = nullif(deleted_by_clerk_id, ${targetClerkId})
      where uploaded_by_clerk_id = ${targetClerkId}
         or deleted_by_clerk_id = ${targetClerkId}
    `);
    await tx.execute(sql`
      update product_image
      set uploaded_by_clerk_id = nullif(uploaded_by_clerk_id, ${targetClerkId}),
          deleted_by_clerk_id = nullif(deleted_by_clerk_id, ${targetClerkId})
      where uploaded_by_clerk_id = ${targetClerkId}
         or deleted_by_clerk_id = ${targetClerkId}
    `);
    await tx.execute(sql`
      update material_image
      set uploaded_by_clerk_id = nullif(uploaded_by_clerk_id, ${targetClerkId}),
          deleted_by_clerk_id = nullif(deleted_by_clerk_id, ${targetClerkId})
      where uploaded_by_clerk_id = ${targetClerkId}
         or deleted_by_clerk_id = ${targetClerkId}
    `);

    await tx.execute(sql`
      delete from resource_notifications
      where uploader_clerk_id = ${targetClerkId}
    `);
    await tx.execute(sql`
      update resource_notifications
      set read_at = null, read_by_clerk_id = null
      where read_by_clerk_id = ${targetClerkId}
    `);
    await tx.execute(sql`
      delete from resource_downloads where user_clerk_id = ${targetClerkId}
    `);
    await tx.execute(sql`
      delete from resources where uploader_clerk_id = ${targetClerkId}
    `);
    await tx.execute(sql`
      update resources
      set privated_by_clerk_id = nullif(privated_by_clerk_id, ${targetClerkId}),
          deleted_by_clerk_id = nullif(deleted_by_clerk_id, ${targetClerkId})
      where privated_by_clerk_id = ${targetClerkId}
         or deleted_by_clerk_id = ${targetClerkId}
    `);
    await tx.execute(sql`
      update resource_categories
      set created_by_clerk_id = null
      where created_by_clerk_id = ${targetClerkId}
    `);

    await tx.execute(sql`
      delete from feedback where submitter_clerk_id = ${targetClerkId}
    `);
    await tx.execute(sql`
      delete from feedback_votes where voter_clerk_id = ${targetClerkId}
    `);
    await tx.execute(sql`
      update feedback_notifications
      set read_at = null, read_by_clerk_id = null
      where read_by_clerk_id = ${targetClerkId}
    `);
    await tx.execute(sql`
      delete from upload_session where uploader_clerk_id = ${targetClerkId}
    `);

    await tx.execute(sql`
      update feature_flags
      set archived_by_clerk_id = nullif(archived_by_clerk_id, ${targetClerkId}),
          created_by_clerk_id = nullif(created_by_clerk_id, ${targetClerkId}),
          updated_by_clerk_id = nullif(updated_by_clerk_id, ${targetClerkId})
      where archived_by_clerk_id = ${targetClerkId}
         or created_by_clerk_id = ${targetClerkId}
         or updated_by_clerk_id = ${targetClerkId}
    `);
    await tx.execute(sql`
      update feature_flag_user_overrides
      set created_by_clerk_id = nullif(created_by_clerk_id, ${targetClerkId}),
          updated_by_clerk_id = nullif(updated_by_clerk_id, ${targetClerkId})
      where created_by_clerk_id = ${targetClerkId}
         or updated_by_clerk_id = ${targetClerkId}
    `);

    if (account) {
      await tx.delete(schema.user).where(eq(schema.user.id, account.id));
    }
    await tx.execute(sql`set constraints all immediate`);

    const verification = await tx.execute(sql<VerificationFinding>`
      select 'users.clerk_id' as location, count(*) as remaining from users where clerk_id = ${targetClerkId}
      union all select 'users.id', count(*) from users where id = ${userId}
      union all select 'audit_event.actor_user_id', count(*) from audit_event where actor_user_id = ${userId}
      union all select 'audit_event.owner_user_id', count(*) from audit_event where owner_user_id = ${userId}
      union all select 'audit_export.requested_by_user_id', count(*) from audit_export where requested_by_user_id = ${userId}
      union all select 'audit_event.actor_retention', ${targets.auditActorEventIds.length} - count(*) from audit_event where ${inArray(schema.auditEvent.id, numericIds(targets.auditActorEventIds))}
      union all select 'audit_event.owner_retention', ${targets.auditOwnerEventIds.length} - count(*) from audit_event where ${inArray(schema.auditEvent.id, numericIds(targets.auditOwnerEventIds))}
      union all select 'user_settings.user_id', count(*) from user_settings where user_id = ${userId}
      union all select 'user_collection.owner_id', count(*) from user_collection where owner_id = ${userId}
      union all select 'collection_item.owner_id', count(*) from collection_item where owner_id = ${userId}
      union all select 'collection_item.purchased_from_user_id', count(*) from collection_item where purchased_from_user_id = ${userId}
      union all select 'collection_item.sold_to_user_id', count(*) from collection_item where sold_to_user_id = ${userId}
      union all select 'product.owner_clerk_id', count(*) from product where owner_clerk_id = ${targetClerkId}
      union all select 'product.privated_by_clerk_id', count(*) from product where privated_by_clerk_id = ${targetClerkId}
      union all select 'maker_image.uploaded_by_clerk_id', count(*) from maker_image where uploaded_by_clerk_id = ${targetClerkId}
      union all select 'maker_image.deleted_by_clerk_id', count(*) from maker_image where deleted_by_clerk_id = ${targetClerkId}
      union all select 'product_image.uploaded_by_clerk_id', count(*) from product_image where uploaded_by_clerk_id = ${targetClerkId}
      union all select 'product_image.deleted_by_clerk_id', count(*) from product_image where deleted_by_clerk_id = ${targetClerkId}
      union all select 'material_image.uploaded_by_clerk_id', count(*) from material_image where uploaded_by_clerk_id = ${targetClerkId}
      union all select 'material_image.deleted_by_clerk_id', count(*) from material_image where deleted_by_clerk_id = ${targetClerkId}
      union all select 'user_collection.privated_by_clerk_id', count(*) from user_collection where privated_by_clerk_id = ${targetClerkId}
      union all select 'collection_item.privated_by_clerk_id', count(*) from collection_item where privated_by_clerk_id = ${targetClerkId}
      union all select 'collection_image.uploaded_by_clerk_id', count(*) from collection_image where uploaded_by_clerk_id = ${targetClerkId}
      union all select 'collection_item_image.uploaded_by_clerk_id', count(*) from collection_item_image where uploaded_by_clerk_id = ${targetClerkId}
      union all select 'collection_item_image.deleted_by_clerk_id', count(*) from collection_item_image where deleted_by_clerk_id = ${targetClerkId}
      union all select 'resources.uploader_clerk_id', count(*) from resources where uploader_clerk_id = ${targetClerkId}
      union all select 'resources.privated_by_clerk_id', count(*) from resources where privated_by_clerk_id = ${targetClerkId}
      union all select 'resources.deleted_by_clerk_id', count(*) from resources where deleted_by_clerk_id = ${targetClerkId}
      union all select 'resource_categories.created_by_clerk_id', count(*) from resource_categories where created_by_clerk_id = ${targetClerkId}
      union all select 'resource_notifications.uploader_clerk_id', count(*) from resource_notifications where uploader_clerk_id = ${targetClerkId}
      union all select 'resource_notifications.read_by_clerk_id', count(*) from resource_notifications where read_by_clerk_id = ${targetClerkId}
      union all select 'resource_downloads.user_clerk_id', count(*) from resource_downloads where user_clerk_id = ${targetClerkId}
      union all select 'upload_session.uploader_clerk_id', count(*) from upload_session where uploader_clerk_id = ${targetClerkId}
      union all select 'feedback.submitter_clerk_id', count(*) from feedback where submitter_clerk_id = ${targetClerkId}
      union all select 'feedback_votes.voter_clerk_id', count(*) from feedback_votes where voter_clerk_id = ${targetClerkId}
      union all select 'feedback_notifications.read_by_clerk_id', count(*) from feedback_notifications where read_by_clerk_id = ${targetClerkId}
      union all select 'feature_flags.archived_by_clerk_id', count(*) from feature_flags where archived_by_clerk_id = ${targetClerkId}
      union all select 'feature_flags.created_by_clerk_id', count(*) from feature_flags where created_by_clerk_id = ${targetClerkId}
      union all select 'feature_flags.updated_by_clerk_id', count(*) from feature_flags where updated_by_clerk_id = ${targetClerkId}
      union all select 'feature_flag_user_overrides.user_id', count(*) from feature_flag_user_overrides where user_id = ${userId}
      union all select 'feature_flag_user_overrides.created_by_clerk_id', count(*) from feature_flag_user_overrides where created_by_clerk_id = ${targetClerkId}
      union all select 'feature_flag_user_overrides.updated_by_clerk_id', count(*) from feature_flag_user_overrides where updated_by_clerk_id = ${targetClerkId}
      union all select 'target.user_collection.id', count(*) from user_collection where ${inArray(schema.userCollection.id, numericIds(targets.collectionIds))}
      union all select 'target.collection_item.id', count(*) from collection_item where ${inArray(schema.collectionItem.id, numericIds(targets.collectionItemIds))}
      union all select 'target.collection_image.id', count(*) from collection_image where ${inArray(schema.collectionImage.id, numericIds(targets.collectionImageIds))}
      union all select 'target.collection_item_image.id', count(*) from collection_item_image where ${inArray(schema.collectionItemImage.id, numericIds(targets.collectionItemImageIds))}
      union all select 'target.resources.id', count(*) from resources where ${inArray(schema.resources.id, numericIds(targets.resourceIds))}
      union all select 'target.resource_images.id', count(*) from resource_images where ${inArray(schema.resourceImages.id, numericIds(targets.resourceImageIds))}
      union all select 'target.resource_versions.id', count(*) from resource_versions where ${inArray(schema.resourceVersions.id, numericIds(targets.resourceVersionIds))}
      union all select 'target.resource_files.id', count(*) from resource_files where ${inArray(schema.resourceFiles.id, numericIds(targets.resourceFileIds))}
      union all select 'target.upload_session.id', count(*) from upload_session where ${inArray(schema.uploadSession.id, targets.uploadSessionIds)}
      union all select 'target.upload_file.id', count(*) from upload_file where ${inArray(schema.uploadFile.id, targets.uploadFileIds)}
      union all select 'orphan.collection_item.collection_id', count(*) from collection_item ci left join user_collection uc on uc.id = ci.collection_id and uc.owner_id = ci.owner_id where uc.id is null
      union all select 'orphan.collection_image.collection_id', count(*) from collection_image ci left join user_collection uc on uc.id = ci.collection_id where uc.id is null
      union all select 'orphan.collection_item_image.collection_item_id', count(*) from collection_item_image cii left join collection_item ci on ci.id = cii.collection_item_id where ci.id is null
      union all select 'orphan.resource_images.resource_id', count(*) from resource_images ri left join resources r on r.id = ri.resource_id where r.id is null
      union all select 'orphan.resource_versions.resource_id', count(*) from resource_versions rv left join resources r on r.id = rv.resource_id where r.id is null
      union all select 'orphan.resource_files.version_id', count(*) from resource_files rf left join resource_versions rv on rv.id = rf.version_id where rv.id is null
      union all select 'orphan.upload_file.session_id', count(*) from upload_file uf left join upload_session us on us.id = uf.session_id where us.id is null
      union all select 'orphan.feedback_votes.feedback_id', count(*) from feedback_votes fv left join feedback f on f.id = fv.feedback_id where f.id is null
      union all select 'orphan.feedback_notifications.feedback_id', count(*) from feedback_notifications fn left join feedback f on f.id = fn.feedback_id where f.id is null
      union all select 'orphan.feature_flag_user_overrides.user_id', count(*) from feature_flag_user_overrides ffu left join users u on u.id = ffu.user_id where u.id is null
    `);
    const remainingLocations: string[] = [];
    for (const finding of verification.rows) {
      if (Number(finding.remaining) === 0) continue;
      if (typeof finding.location !== "string") {
        throw new Error("Database erasure verification returned invalid data.");
      }
      remainingLocations.push(finding.location);
    }
    if (remainingLocations.length > 0) {
      throw new DatabaseErasureVerificationError(remainingLocations);
    }
  });
}

/** Reports database locations that still reference an erased account. */
export class DatabaseErasureVerificationError extends Error {
  /** Stable machine-readable classification for erasure workflow handling. */
  readonly code = "database_verification_failed";

  /**
   * Creates a verification error for database locations that still contain data.
   *
   * @param locations - Database locations that failed verification.
   */
  constructor(readonly locations: string[]) {
    super("Database erasure verification failed.");
    this.name = "DatabaseErasureVerificationError";
  }
}

/**
 * Converts identifier values to numbers.
 *
 * @param values - Numeric or string identifiers returned by Postgres.
 * @returns Numeric identifiers, including non-finite results for invalid input.
 */
function numericIds(values: Array<number | string>): number[] {
  return values.map((value) => Number(value));
}
