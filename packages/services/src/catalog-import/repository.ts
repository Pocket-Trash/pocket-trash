import { type Database, schema } from "@package/database";
import { and, eq, isNull } from "drizzle-orm";
import type {
  CatalogImportObjectOwnership,
  CatalogImportRepository,
} from "./index.js";

/** Transaction handle supplied by the shared Drizzle database client. */
export type CatalogImportTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

/**
 * Creates durable application and ownership persistence for catalog imports.
 *
 * @param db - Shared database client.
 * @returns Repository backed by terminal-immutable application records.
 */
export function createCatalogImportRepository(
  db: Database,
): CatalogImportRepository<CatalogImportTransaction> {
  return {
    /**
     * Transitions a running application to its terminal outcome.
     *
     * @param applicationId - Durable application identifier.
     * @param outcome - Terminal application outcome.
     * @param errorCode - Redacted stable failure code.
     * @returns Nothing.
     * @rejects When the application is not running or persistence fails.
     */
    async finishApplication(applicationId, outcome, errorCode) {
      const [finished] = await db
        .update(schema.catalogManifestApplication)
        .set({
          errorCode:
            outcome === "failed" ? (errorCode ?? "operation-failed") : null,
          finishedAt: new Date(),
          outcome,
        })
        .where(
          and(
            eq(schema.catalogManifestApplication.id, applicationId),
            eq(schema.catalogManifestApplication.outcome, "running"),
            isNull(schema.catalogManifestApplication.finishedAt),
          ),
        )
        .returning({ id: schema.catalogManifestApplication.id });
      if (!finished)
        throw new Error("Catalog manifest application is not running.");
    },
    /**
     * Reads active ownership for a manifest image.
     *
     * @param manifestHash - Canonical manifest hash.
     * @param imageKey - Stable image key.
     * @returns Active object ownership when present.
     * @rejects When persistence fails.
     */
    async inspectObjectOwnership(manifestHash, imageKey) {
      const [owned] = await db
        .select({
          objectPath: schema.catalogManifestObject.objectPath,
          sha256: schema.catalogManifestObject.sha256,
          size: schema.catalogManifestObject.size,
        })
        .from(schema.catalogManifestObject)
        .where(
          and(
            eq(schema.catalogManifestObject.manifestHash, manifestHash),
            eq(schema.catalogManifestObject.imageKey, imageKey),
            eq(schema.catalogManifestObject.state, "active"),
          ),
        )
        .limit(1);
      return owned satisfies CatalogImportObjectOwnership | undefined;
    },
    /**
     * Marks manifest-owned objects rolled back without deleting stored bytes.
     *
     * @param manifestHash - Canonical manifest hash.
     * @param transaction - Active database transaction.
     * @returns Nothing.
     * @rejects When persistence fails.
     */
    async markObjectsRolledBack(manifestHash, transaction) {
      await transaction
        .update(schema.catalogManifestObject)
        .set({ rolledBackAt: new Date(), state: "rolled_back" })
        .where(
          and(
            eq(schema.catalogManifestObject.manifestHash, manifestHash),
            eq(schema.catalogManifestObject.state, "active"),
          ),
        );
    },
    /**
     * Marks manifest-owned records rolled back.
     *
     * @param manifestHash - Canonical manifest hash.
     * @param transaction - Active database transaction.
     * @returns Nothing.
     * @rejects When persistence fails.
     */
    async markRecordsRolledBack(manifestHash, transaction) {
      await transaction
        .update(schema.catalogManifestRecord)
        .set({ rolledBackAt: new Date() })
        .where(
          and(
            eq(schema.catalogManifestRecord.manifestHash, manifestHash),
            isNull(schema.catalogManifestRecord.rolledBackAt),
          ),
        );
    },
    /**
     * Creates an append-only running application attempt.
     *
     * @param input - Immutable application metadata.
     * @returns Generated application identifier.
     * @rejects When persistence fails.
     */
    async recordApplication(input) {
      const [application] = await db
        .insert(schema.catalogManifestApplication)
        .values({
          actorClerkId: input.actorClerkId,
          approvalPayloadHash: input.approvalPayloadHash,
          environment: input.environment,
          imageCount: input.imageCount,
          manifestHash: input.manifestHash,
          manifestVersion: input.manifestVersion,
          operation: input.operation,
          ownerClerkId: input.ownerClerkId,
          recordCount: input.recordCount,
          totalBytes: input.totalBytes,
        })
        .returning({ id: schema.catalogManifestApplication.id });
      if (!application)
        throw new Error("Failed to record catalog manifest application.");
      return application.id;
    },
    /**
     * Upserts durable ownership for an activated object.
     *
     * @param input - Object ownership metadata.
     * @param transaction - Active database transaction.
     * @returns Nothing.
     * @rejects When persistence fails.
     */
    async recordObjectOwnership(input, transaction) {
      await transaction
        .insert(schema.catalogManifestObject)
        .values({
          applicationId: input.applicationId,
          imageKey: input.imageKey,
          manifestHash: input.manifestHash,
          objectPath: input.objectPath,
          ownerRecordKey: input.ownerRecordKey,
          sha256: input.sha256,
          size: input.size,
          url: input.url,
        })
        .onConflictDoUpdate({
          set: {
            applicationId: input.applicationId,
            objectPath: input.objectPath,
            ownerRecordKey: input.ownerRecordKey,
            rolledBackAt: null,
            sha256: input.sha256,
            size: input.size,
            state: "active",
            url: input.url,
          },
          target: [
            schema.catalogManifestObject.manifestHash,
            schema.catalogManifestObject.imageKey,
          ],
        });
    },
    /**
     * Upserts durable ownership for an applied catalog record.
     *
     * @param input - Record ownership metadata.
     * @param transaction - Active database transaction.
     * @returns Nothing.
     * @rejects When persistence fails.
     */
    async recordRecordOwnership(input, transaction) {
      await transaction
        .insert(schema.catalogManifestRecord)
        .values({
          applicationId: input.applicationId,
          appliedFingerprint: input.fingerprint,
          entityType: input.entity,
          manifestHash: input.manifestHash,
          recordId: input.recordId,
          recordKey: input.recordKey,
        })
        .onConflictDoUpdate({
          set: {
            applicationId: input.applicationId,
            appliedFingerprint: input.fingerprint,
            entityType: input.entity,
            recordId: input.recordId,
            rolledBackAt: null,
          },
          target: [
            schema.catalogManifestRecord.manifestHash,
            schema.catalogManifestRecord.recordKey,
          ],
        });
    },
    /**
     * Runs one catalog operation in a database transaction.
     *
     * @param callback - Transactional catalog operation.
     * @returns Nothing after commit.
     * @rejects When the callback or commit fails.
     */
    async transaction(callback) {
      await db.transaction(callback);
    },
  };
}
