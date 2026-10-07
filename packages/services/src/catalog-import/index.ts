import { createHash } from "node:crypto";
import { z } from "zod";

/** Catalog tables that an import manifest may own. Collection data is excluded. */
export const catalogImportEntityTypes = [
  "maker",
  "material",
  "finish",
  "color",
  "color-effect",
  "pattern",
  "compatibility-family",
  "product",
  "product-material",
  "finish-option",
  "finish-option-finish",
  "finish-option-color",
  "product-compatibility-family",
  "product-included-component",
  "product-spinner",
  "product-spinner-button",
  "product-slider",
  "product-slider-plate",
  "product-slider-insert",
  "magnet-configuration-label",
  "magnet-group-label",
  "product-magnet-configuration",
  "product-magnet-group",
  "product-magnet-slot",
  "product-insert-click-option",
  "product-insert-magnet-offer",
  "product-insert-magnet-group",
  "product-insert-magnet-slot",
  "product-slider-insert-offer",
  "catalog-terminology-alias",
] as const;

/** One table from the catalog-only import allowlist. */
export type CatalogImportEntityType = (typeof catalogImportEntityTypes)[number];

/** JSON value accepted in immutable manifest record payloads. */
export type CatalogImportJson =
  | boolean
  | null
  | number
  | string
  | CatalogImportJson[]
  | {
      /**
       * Reads a nested JSON value.
       *
       * @param key - Manifest field name.
       * @returns Nested JSON value.
       */
      [key: string]: CatalogImportJson;
    };

/** String-keyed JSON object used for one catalog record payload. */
export type CatalogImportJsonObject = {
  /**
   * Reads a catalog field value.
   *
   * @param key - Catalog field name.
   * @returns JSON field value.
   */
  [key: string]: CatalogImportJson;
};

/** Expected database state before a manifest record is first applied. */
export type CatalogImportExpectation =
  | {
      /** Requires the record not to exist. */
      state: "absent";
    }
  | {
      /** Approved fingerprint for a pre-existing record. */
      fingerprint: string;
      /** Requires an exact fingerprint match. */
      state: "exact";
    };

/** One dependency-ordered catalog record in a manifest. */
export type CatalogImportRecord = {
  /** Allowlisted catalog entity kind. */
  entity: CatalogImportEntityType;
  /** Approved state required before first application. */
  expected: CatalogImportExpectation;
  /** Stable manifest-scoped record key. */
  key: string;
  /** Entity fields interpreted by the catalog executor. */
  payload: CatalogImportJsonObject;
  /** Named foreign-key references to earlier manifest records. */
  references: Record<string, string>;
};

/** One approved image asset staged before catalog activation. */
export type CatalogImportImage = {
  /** Disposable asset-provider key, never persisted as a public URL. */
  assetKey: string;
  /** Approved image media type. */
  contentType: "image/avif" | "image/jpeg" | "image/png" | "image/webp";
  /** Reviewed download filename. */
  fileName: string;
  /** Stable manifest-scoped image key. */
  key: string;
  /** Manifest product record that owns the activated image. */
  ownerRecordKey: string;
  /** Zero-based gallery position. */
  position: number;
  /** Approved lowercase SHA-256 digest. */
  sha256: string;
  /** Approved encoded byte count. */
  size: number;
};

/** Immutable catalog-only import manifest. */
export type CatalogImportManifest = {
  /** Hash of the separately reviewed provenance and scope payload. */
  approvalPayloadHash: string;
  /** Exact deployment environment allowed to apply this manifest. */
  environment: "development" | "preview" | "production";
  /** Approved image assets activated with catalog records. */
  images: CatalogImportImage[];
  /** Operator-visible immutable manifest version. */
  manifestVersion: string;
  /** Clerk user that owns every imported product. */
  ownerClerkId: string;
  /** Dependency-ordered catalog records. */
  records: CatalogImportRecord[];
  /** Versioned manifest contract discriminator. */
  schemaVersion: "catalog-import-v1";
};

/** Lowercase SHA-256 digest validator. */
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
/** Stable manifest key validator. */
const keySchema = z.string().trim().min(1).max(200);
/** Recursive JSON payload validator. */
const jsonSchema: z.ZodType<CatalogImportJson> = z.lazy(() =>
  z.union([
    z.boolean(),
    z.null(),
    z.number().finite(),
    z.string(),
    z.array(jsonSchema),
    z.record(z.string(), jsonSchema),
  ]),
);
/** Catalog record validator. */
const recordSchema = z.object({
  entity: z.enum(catalogImportEntityTypes),
  expected: z.discriminatedUnion("state", [
    z.object({ state: z.literal("absent") }),
    z.object({ fingerprint: sha256Schema, state: z.literal("exact") }),
  ]),
  key: keySchema,
  payload: z.record(z.string(), jsonSchema),
  references: z.record(z.string().trim().min(1), keySchema),
});
/** Catalog image validator. */
const imageSchema = z.object({
  assetKey: keySchema,
  contentType: z.enum(["image/avif", "image/jpeg", "image/png", "image/webp"]),
  fileName: z.string().trim().min(1).max(255),
  key: keySchema,
  ownerRecordKey: keySchema,
  position: z.number().int().nonnegative(),
  sha256: sha256Schema,
  size: z.number().int().positive(),
});
/** Complete catalog-only manifest validator. */
const manifestSchema = z
  .object({
    approvalPayloadHash: sha256Schema,
    environment: z.enum(["development", "preview", "production"]),
    images: z.array(imageSchema),
    manifestVersion: z.string().trim().min(1).max(100),
    ownerClerkId: z.string().trim().min(1).max(255),
    records: z.array(recordSchema).min(1),
    schemaVersion: z.literal("catalog-import-v1"),
  })
  .superRefine((manifest, context) => {
    const records = new Map<string, CatalogImportEntityType>();
    for (const [index, record] of manifest.records.entries()) {
      if (records.has(record.key)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate catalog record key ${record.key}.`,
          path: ["records", index, "key"],
        });
      }
      for (const reference of Object.values(record.references)) {
        if (!records.has(reference)) {
          context.addIssue({
            code: "custom",
            message: `Catalog reference ${reference} must name an earlier record.`,
            path: ["records", index, "references"],
          });
        }
      }
      records.set(record.key, record.entity);
      if (
        record.entity === "product" &&
        (record.payload.ownerClerkId !== manifest.ownerClerkId ||
          record.payload.approvalStatus !== "approved" ||
          record.payload.isPrivate !== false)
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Imported products must use the manifest owner and start approved and public.",
          path: ["records", index, "payload"],
        });
      }
    }
    const imageKeys = new Set<string>();
    const positions = new Set<string>();
    for (const [index, image] of manifest.images.entries()) {
      if (imageKeys.has(image.key)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate catalog image key ${image.key}.`,
          path: ["images", index, "key"],
        });
      }
      imageKeys.add(image.key);
      if (records.get(image.ownerRecordKey) !== "product") {
        context.addIssue({
          code: "custom",
          message: `Catalog image owner ${image.ownerRecordKey} must be a product record.`,
          path: ["images", index, "ownerRecordKey"],
        });
      }
      const positionKey = `${image.ownerRecordKey}:${image.position}`;
      if (positions.has(positionKey)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate gallery position ${image.position}.`,
          path: ["images", index, "position"],
        });
      }
      positions.add(positionKey);
    }
  });

/** Error raised when an import cannot prove a safety invariant. */
export class CatalogImportSafetyError extends Error {
  /**
   * Creates a catalog import safety failure.
   *
   * @param message - Operator-safe explanation without manifest payload data.
   */
  constructor(message: string) {
    super(message);
    this.name = "CatalogImportSafetyError";
  }
}

/**
 * Parses and validates one catalog-only manifest.
 *
 * @param value - Untrusted manifest input.
 * @returns Validated catalog import manifest.
 * @throws {CatalogImportSafetyError} When the input violates the manifest contract.
 */
export function parseCatalogImportManifest(
  value: unknown,
): CatalogImportManifest {
  const result = manifestSchema.safeParse(value);
  if (!result.success) {
    throw new CatalogImportSafetyError(
      `Invalid catalog-only manifest: ${result.error.issues[0]?.message ?? "unknown validation error"}`,
    );
  }
  return result.data;
}

/**
 * Recursively sorts object keys for deterministic JSON hashing.
 *
 * @param value - JSON-compatible value to canonicalize.
 * @returns Value with recursively sorted object keys.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

/**
 * Computes a lowercase SHA-256 digest of canonical JSON content.
 *
 * @param value - JSON-compatible content to hash.
 * @returns Lowercase hexadecimal SHA-256 digest.
 */
export function hashCatalogImportManifest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

/** Existing catalog record state returned by an executor. */
export type CatalogImportRecordState = {
  /** Fingerprint captured by the durable ownership mapping. */
  appliedFingerprint: string | null;
  /** Current allowlisted-state fingerprint. */
  fingerprint: string;
  /** Owning manifest hash, or `null` for pre-existing data. */
  ownedManifestHash: string | null;
  /** Persisted catalog identifier encoded without numeric precision loss. */
  recordId: string;
};

/** Persisted image-object ownership needed for verification. */
export type CatalogImportObjectOwnership = {
  /** Durable object path. */
  objectPath: string;
  /** Approved object checksum. */
  sha256: string;
  /** Approved object byte count. */
  size: number;
};

/** Result returned after applying one catalog record. */
export type CatalogImportAppliedRecord = {
  /** Fingerprint of the applied allowlisted state. */
  fingerprint: string;
  /** Persisted catalog identifier. */
  recordId: string;
};

/** Storage location returned after staging one verified object. */
export type CatalogImportStagedObject = {
  /** Durable versioned object path. */
  objectPath: string;
  /** Eventual public object URL. */
  url: string;
};

/**
 * Transaction-aware adapter that applies allowlisted catalog records.
 *
 * @template Transaction - Database transaction handle.
 */
export type CatalogImportExecutor<Transaction> = {
  /**
   * Applies one dependency-resolved record.
   *
   * @param transaction - Repository transaction handle.
   * @param record - Approved catalog record.
   * @param references - Persisted identifiers indexed by manifest record key.
   * @returns Persisted identifier and allowlisted-state fingerprint.
   */
  applyRecord(
    transaction: Transaction,
    record: CatalogImportRecord,
    references: ReadonlyMap<string, string>,
  ): Promise<CatalogImportAppliedRecord>;
  /**
   * Reads current state without mutation.
   *
   * @param recordKey - Stable manifest record key.
   * @param transaction - Optional active transaction handle.
   * @returns Current record state when the record exists.
   */
  inspectRecord(
    recordKey: string,
    transaction?: Transaction,
  ): Promise<CatalogImportRecordState | undefined>;
  /**
   * Deletes or restores one owned catalog record without touching collection data.
   *
   * @param transaction - Active database transaction.
   * @param recordKey - Stable manifest record key.
   * @param expectedFingerprint - Fingerprint that must still match.
   * @returns Nothing.
   */
  rollbackRecord(
    transaction: Transaction,
    recordKey: string,
    expectedFingerprint: string,
  ): Promise<void>;
};

/**
 * Durable application and ownership persistence used by the runner.
 *
 * @template Transaction - Database transaction handle.
 */
export type CatalogImportRepository<Transaction> = {
  /**
   * Completes an application attempt with its terminal outcome.
   *
   * @param applicationId - Durable application identifier.
   * @param outcome - Terminal application outcome.
   * @param errorCode - Redacted stable error code for failures.
   * @returns Nothing.
   */
  finishApplication(
    applicationId: string,
    outcome: "failed" | "rolled_back" | "succeeded",
    errorCode?: string,
  ): Promise<void>;
  /**
   * Reads one durable staged or active object mapping.
   *
   * @param manifestHash - Canonical manifest hash.
   * @param imageKey - Stable image key.
   * @returns Active object ownership when present.
   */
  inspectObjectOwnership(
    manifestHash: string,
    imageKey: string,
  ): Promise<CatalogImportObjectOwnership | undefined>;
  /**
   * Creates an append-only application attempt.
   *
   * @param input - Immutable application metadata.
   * @returns Generated application identifier.
   */
  recordApplication(input: {
    /** Clerk actor performing the operation. */
    actorClerkId: string;
    /** Reviewed provenance and scope hash. */
    approvalPayloadHash: string;
    /** Exact target environment. */
    environment: CatalogImportManifest["environment"];
    /** Approved image count. */
    imageCount: number;
    /** Canonical manifest hash. */
    manifestHash: string;
    /** Operator-visible manifest version. */
    manifestVersion: string;
    /** Requested operation. */
    operation: "apply" | "rollback";
    /** Clerk owner for imported products. */
    ownerClerkId: string;
    /** Approved record count. */
    recordCount: number;
    /** Approved total image byte count. */
    totalBytes: number;
  }): Promise<string>;
  /**
   * Persists durable ownership for one staged or active image object.
   *
   * @param input - Object ownership metadata.
   * @param transaction - Active database transaction.
   * @returns Nothing.
   */
  recordObjectOwnership(
    input: {
      /** Application attempt that activated the object. */
      applicationId: string;
      /** Stable manifest image key. */
      imageKey: string;
      /** Canonical manifest hash. */
      manifestHash: string;
      /** Durable versioned storage path. */
      objectPath: string;
      /** Stable product record key. */
      ownerRecordKey: string;
      /** Approved object checksum. */
      sha256: string;
      /** Approved object byte count. */
      size: number;
      /** Activated public object URL. */
      url: string;
    },
    transaction: Transaction,
  ): Promise<void>;
  /**
   * Persists durable ownership for one applied catalog record.
   *
   * @param input - Catalog record ownership metadata.
   * @param transaction - Active database transaction.
   * @returns Nothing.
   */
  recordRecordOwnership(
    input: {
      /** Application attempt that applied the record. */
      applicationId: string;
      /** Allowlisted catalog entity. */
      entity: CatalogImportEntityType;
      /** Applied allowlisted-state fingerprint. */
      fingerprint: string;
      /** Canonical manifest hash. */
      manifestHash: string;
      /** Persisted catalog identifier. */
      recordId: string;
      /** Stable manifest record key. */
      recordKey: string;
    },
    transaction: Transaction,
  ): Promise<void>;
  /**
   * Marks durable object ownership inactive without deleting stored bytes.
   *
   * @param manifestHash - Canonical manifest hash.
   * @param transaction - Active database transaction.
   * @returns Nothing.
   */
  markObjectsRolledBack(
    manifestHash: string,
    transaction: Transaction,
  ): Promise<void>;
  /**
   * Marks durable record ownership inactive after reference-safe rollback.
   *
   * @param manifestHash - Canonical manifest hash.
   * @param transaction - Active database transaction.
   * @returns Nothing.
   */
  markRecordsRolledBack(
    manifestHash: string,
    transaction: Transaction,
  ): Promise<void>;
  /**
   * Runs catalog activation or rollback atomically.
   *
   * @param callback - Transactional catalog operation.
   * @returns Nothing after commit.
   */
  transaction(
    callback: (transaction: Transaction) => Promise<void>,
  ): Promise<void>;
};

/** Reads disposable image bytes by approved manifest asset key. */
export type CatalogImportAssets = {
  /**
   * Reads one complete encoded image.
   *
   * @param assetKey - Approved disposable asset key.
   * @returns Complete encoded image bytes.
   */
  read(assetKey: string): Promise<Uint8Array>;
};

/**
 * Versioned object staging and activation operations.
 *
 * @template Transaction - Database transaction handle.
 */
export type CatalogImportObjects<Transaction> = {
  /**
   * Activates a verified staged image inside the catalog transaction.
   *
   * @param objectPath - Durable versioned storage path.
   * @param image - Approved image metadata.
   * @param ownerRecordId - Persisted product identifier.
   * @param transaction - Active database transaction.
   * @returns Nothing.
   */
  activate(
    objectPath: string,
    image: CatalogImportImage,
    ownerRecordId: string,
    transaction: Transaction,
  ): Promise<void>;
  /**
   * Uploads one content-addressed object without exposing it in catalog rows.
   *
   * @param image - Approved image metadata.
   * @param bytes - Checksum-verified encoded bytes.
   * @param manifestHash - Canonical manifest hash.
   * @returns Versioned object path and eventual public URL.
   */
  stage(
    image: CatalogImportImage,
    bytes: Uint8Array,
    manifestHash: string,
  ): Promise<CatalogImportStagedObject>;
  /**
   * Verifies a staged or active object against approved metadata.
   *
   * @param objectPath - Durable versioned storage path.
   * @param image - Approved image metadata.
   * @returns Whether stored content matches the manifest.
   */
  verify(objectPath: string, image: CatalogImportImage): Promise<boolean>;
};

/** Redacted record change printed by a dry run. */
export type CatalogImportChange = {
  /** Planned mutation category. */
  action: "create" | "unchanged" | "update";
  /** Allowlisted entity kind. */
  entity: CatalogImportEntityType;
  /** Stable manifest record key. */
  key: string;
};

/** Read-only import review returned before apply. */
export type CatalogImportDryRun = {
  /** Separately reviewed scope and provenance hash. */
  approvalPayloadHash: string;
  /** Redacted dependency-ordered record changes. */
  changes: CatalogImportChange[];
  /** Exact target environment. */
  environment: CatalogImportManifest["environment"];
  /** Number of approved gallery objects. */
  imageCount: number;
  /** Canonical immutable manifest content hash. */
  manifestHash: string;
  /** Manifest owner. */
  ownerClerkId: string;
  /** Number of catalog records. */
  recordCount: number;
  /** Total approved encoded image bytes. */
  totalBytes: number;
};

/** Environment and owner assertions shared by dry-run and apply. */
export type CatalogImportTarget = {
  /** Independently resolved deployment environment. */
  actualEnvironment: string;
  /** Independently configured expected catalog owner. */
  expectedOwnerClerkId: string;
};

/** Catalog import runner operations. */
export type CatalogImportRunner = {
  /**
   * Applies one pre-approved manifest after staging every image.
   *
   * @param manifest - Validated immutable manifest.
   * @param input - Independently resolved target and operator approval.
   * @returns Redacted applied plan.
   */
  apply(
    manifest: CatalogImportManifest,
    input: CatalogImportTarget & {
      /** Exact canonical manifest hash confirmed by the operator. */
      approvedManifestHash: string;
      /** Clerk actor recorded on the durable application attempt. */
      actorClerkId: string;
    },
  ): Promise<CatalogImportDryRun>;
  /**
   * Computes a read-only redacted import review.
   *
   * @param manifest - Candidate immutable manifest.
   * @param input - Independently resolved target.
   * @returns Redacted read-only plan.
   */
  dryRun(
    manifest: CatalogImportManifest,
    input: CatalogImportTarget,
  ): Promise<CatalogImportDryRun>;
  /**
   * Rolls back only unchanged manifest-owned catalog records.
   *
   * @param manifest - Previously applied immutable manifest.
   * @param input - Independently resolved target, actor, and confirmed hash.
   * @returns Nothing.
   */
  rollback(
    manifest: CatalogImportManifest,
    input: CatalogImportTarget & {
      /** Clerk actor recorded on the durable rollback attempt. */
      actorClerkId: string;
      /** Exact canonical manifest hash confirmed by the operator. */
      manifestHash: string;
    },
  ): Promise<void>;
  /**
   * Verifies records and staged objects from durable ownership mappings.
   *
   * @param manifest - Previously applied immutable manifest.
   * @param input - Confirmed canonical manifest hash.
   * @returns Nothing.
   */
  verify(
    manifest: CatalogImportManifest,
    input: {
      /** Exact canonical manifest hash confirmed by the operator. */
      manifestHash: string;
    },
  ): Promise<void>;
};

/** Verified image staged before transactional catalog activation. */
type StagedCatalogImage = {
  /** Approved image metadata. */
  image: CatalogImportImage;
  /** Durable versioned storage path. */
  objectPath: string;
  /** Eventual public object URL. */
  url: string;
};

/**
 * Throws when the independently resolved target is ambiguous or mismatched.
 *
 * @param manifest - Validated manifest target.
 * @param input - Independently resolved target.
 * @throws {CatalogImportSafetyError} When environment or owner does not match.
 */
function assertTarget(
  manifest: CatalogImportManifest,
  input: CatalogImportTarget,
): void {
  if (
    !["development", "preview", "production"].includes(
      input.actualEnvironment,
    ) ||
    input.actualEnvironment !== manifest.environment
  ) {
    throw new CatalogImportSafetyError(
      "Catalog import environment is ambiguous or does not match the manifest.",
    );
  }
  if (input.expectedOwnerClerkId !== manifest.ownerClerkId) {
    throw new CatalogImportSafetyError(
      "Catalog import owner does not match the reviewed target owner.",
    );
  }
}

/**
 * Creates a catalog import safety runner around durable adapters.
 *
 * @template Transaction - Database transaction handle.
 * @param dependencies - Asset, object, record, and ownership adapters.
 * @returns Catalog dry-run, apply, verification, and rollback operations.
 * @rejects When validation, safety checks, storage, or persistence fails.
 */
export function createCatalogImportRunner<Transaction>(dependencies: {
  /** Disposable approved image source. */
  assets: CatalogImportAssets;
  /** Allowlisted catalog record executor. */
  executor: CatalogImportExecutor<Transaction>;
  /** Staged object operations. */
  objects: CatalogImportObjects<Transaction>;
  /** Durable application and ownership persistence. */
  repository: CatalogImportRepository<Transaction>;
}): CatalogImportRunner {
  const { assets, executor, objects, repository } = dependencies;

  /**
   * Builds the read-only plan after target validation and drift detection.
   *
   * @param inputManifest - Candidate immutable manifest.
   * @param target - Independently resolved target.
   * @returns Redacted read-only plan.
   * @rejects When validation, target checks, or drift detection fails.
   */
  async function plan(
    inputManifest: CatalogImportManifest,
    target: CatalogImportTarget,
  ): Promise<CatalogImportDryRun> {
    const parsed = parseCatalogImportManifest(inputManifest);
    assertTarget(parsed, target);
    const manifestHash = hashCatalogImportManifest(parsed);
    const changes: CatalogImportChange[] = [];
    for (const record of parsed.records) {
      const current = await executor.inspectRecord(record.key);
      if (!current) {
        if (record.expected.state === "exact") {
          throw new CatalogImportSafetyError(
            `Catalog prior-state drift detected for ${record.key}.`,
          );
        }
        changes.push({
          action: "create",
          entity: record.entity,
          key: record.key,
        });
        continue;
      }
      if (
        current.ownedManifestHash === manifestHash &&
        current.appliedFingerprint !== null &&
        current.fingerprint === current.appliedFingerprint
      ) {
        changes.push({
          action: "unchanged",
          entity: record.entity,
          key: record.key,
        });
        continue;
      }
      if (
        record.expected.state !== "exact" ||
        record.expected.fingerprint !== current.fingerprint ||
        current.ownedManifestHash !== null
      ) {
        throw new CatalogImportSafetyError(
          `Catalog prior-state drift detected for ${record.key}.`,
        );
      }
      changes.push({
        action: "update",
        entity: record.entity,
        key: record.key,
      });
    }
    return {
      approvalPayloadHash: parsed.approvalPayloadHash,
      changes,
      environment: parsed.environment,
      imageCount: parsed.images.length,
      manifestHash,
      ownerClerkId: parsed.ownerClerkId,
      recordCount: parsed.records.length,
      totalBytes: parsed.images.reduce((sum, image) => sum + image.size, 0),
    };
  }

  return {
    /**
     * Applies the exact operator-approved manifest.
     *
     * @param inputManifest - Approved immutable manifest.
     * @param input - Independently resolved target, actor, and approved hash.
     * @returns Redacted applied plan.
     * @rejects When validation, safety checks, storage, or persistence fails.
     */
    async apply(inputManifest, input) {
      const parsed = parseCatalogImportManifest(inputManifest);
      const review = await plan(parsed, input);
      if (input.approvedManifestHash !== review.manifestHash) {
        throw new CatalogImportSafetyError(
          "Apply requires the exact approved manifest hash from dry-run.",
        );
      }
      const applicationId = await repository.recordApplication({
        actorClerkId: input.actorClerkId,
        approvalPayloadHash: parsed.approvalPayloadHash,
        environment: parsed.environment,
        imageCount: review.imageCount,
        manifestHash: review.manifestHash,
        manifestVersion: parsed.manifestVersion,
        operation: "apply",
        ownerClerkId: parsed.ownerClerkId,
        recordCount: review.recordCount,
        totalBytes: review.totalBytes,
      });
      try {
        const staged = new Map<string, StagedCatalogImage>();
        for (const image of parsed.images) {
          const bytes = await assets.read(image.assetKey);
          const digest = createHash("sha256").update(bytes).digest("hex");
          if (bytes.byteLength !== image.size || digest !== image.sha256) {
            throw new CatalogImportSafetyError(
              `Catalog image checksum or size mismatch for ${image.key}.`,
            );
          }
          const target = await objects.stage(image, bytes, review.manifestHash);
          if (!target.objectPath.includes(review.manifestHash)) {
            throw new CatalogImportSafetyError(
              `Catalog staged image path is not manifest-versioned for ${image.key}.`,
            );
          }
          if (!(await objects.verify(target.objectPath, image))) {
            throw new CatalogImportSafetyError(
              `Catalog staged image verification failed for ${image.key}.`,
            );
          }
          staged.set(image.key, { image, ...target });
        }

        await repository.transaction(async (transaction) => {
          const references = new Map<string, string>();
          for (const [index, record] of parsed.records.entries()) {
            const change = review.changes[index];
            const current = await executor.inspectRecord(
              record.key,
              transaction,
            );
            if (change?.action === "unchanged") {
              if (
                current?.ownedManifestHash !== review.manifestHash ||
                current.appliedFingerprint === null ||
                current.fingerprint !== current.appliedFingerprint
              )
                throw new CatalogImportSafetyError(
                  `Catalog prior-state drift detected before activation for ${record.key}.`,
                );
              references.set(record.key, current.recordId);
              continue;
            }
            if (
              (change?.action === "create" && current) ||
              (change?.action === "update" &&
                (!current ||
                  record.expected.state !== "exact" ||
                  record.expected.fingerprint !== current.fingerprint ||
                  current.ownedManifestHash !== null))
            ) {
              throw new CatalogImportSafetyError(
                `Catalog prior-state drift detected before activation for ${record.key}.`,
              );
            }
            const applied = await executor.applyRecord(
              transaction,
              record,
              references,
            );
            references.set(record.key, applied.recordId);
            await repository.recordRecordOwnership(
              {
                applicationId,
                entity: record.entity,
                fingerprint: applied.fingerprint,
                manifestHash: review.manifestHash,
                recordId: applied.recordId,
                recordKey: record.key,
              },
              transaction,
            );
          }
          for (const { image, objectPath, url } of staged.values()) {
            const ownerRecordId = references.get(image.ownerRecordKey);
            if (!ownerRecordId)
              throw new CatalogImportSafetyError(
                `Catalog image owner was not activated: ${image.ownerRecordKey}.`,
              );
            await objects.activate(
              objectPath,
              image,
              ownerRecordId,
              transaction,
            );
            await repository.recordObjectOwnership(
              {
                applicationId,
                imageKey: image.key,
                manifestHash: review.manifestHash,
                objectPath,
                ownerRecordKey: image.ownerRecordKey,
                sha256: image.sha256,
                size: image.size,
                url,
              },
              transaction,
            );
          }
        });
        await repository.finishApplication(applicationId, "succeeded");
        return review;
      } catch (error) {
        await repository.finishApplication(
          applicationId,
          "failed",
          error instanceof CatalogImportSafetyError
            ? "safety-check-failed"
            : "apply-failed",
        );
        throw error;
      }
    },
    dryRun: plan,
    /**
     * Rolls back unchanged manifest-owned records in reverse dependency order.
     *
     * @param inputManifest - Previously applied immutable manifest.
     * @param input - Independently resolved target, actor, and confirmed hash.
     * @returns Nothing.
     * @rejects When verification, rollback, or persistence fails.
     */
    async rollback(inputManifest, input) {
      const parsed = parseCatalogImportManifest(inputManifest);
      assertTarget(parsed, input);
      const expectedHash = hashCatalogImportManifest(parsed);
      if (input.manifestHash !== expectedHash) {
        throw new CatalogImportSafetyError(
          "Rollback manifest hash does not match immutable content.",
        );
      }
      await this.verify(parsed, { manifestHash: expectedHash });
      const applicationId = await repository.recordApplication({
        actorClerkId: input.actorClerkId,
        approvalPayloadHash: parsed.approvalPayloadHash,
        environment: parsed.environment,
        imageCount: parsed.images.length,
        manifestHash: expectedHash,
        manifestVersion: parsed.manifestVersion,
        operation: "rollback",
        ownerClerkId: parsed.ownerClerkId,
        recordCount: parsed.records.length,
        totalBytes: parsed.images.reduce((sum, image) => sum + image.size, 0),
      });
      try {
        await repository.transaction(async (transaction) => {
          for (const record of [...parsed.records].reverse()) {
            const current = await executor.inspectRecord(
              record.key,
              transaction,
            );
            if (!current?.appliedFingerprint)
              throw new CatalogImportSafetyError(
                `Catalog ownership disappeared before rollback: ${record.key}.`,
              );
            await executor.rollbackRecord(
              transaction,
              record.key,
              current.appliedFingerprint,
            );
          }
          await repository.markRecordsRolledBack(expectedHash, transaction);
          await repository.markObjectsRolledBack(expectedHash, transaction);
        });
        await repository.finishApplication(applicationId, "rolled_back");
      } catch (error) {
        await repository.finishApplication(
          applicationId,
          "failed",
          "rollback-failed",
        );
        throw error;
      }
    },
    /**
     * Verifies durable record and object ownership against current state.
     *
     * @param inputManifest - Previously applied immutable manifest.
     * @param input - Confirmed canonical manifest hash.
     * @returns Nothing.
     * @rejects When record or object ownership has drifted.
     */
    async verify(inputManifest, input) {
      const parsed = parseCatalogImportManifest(inputManifest);
      const expectedHash = hashCatalogImportManifest(parsed);
      if (input.manifestHash !== expectedHash) {
        throw new CatalogImportSafetyError(
          "Verification manifest hash does not match immutable content.",
        );
      }
      for (const record of parsed.records) {
        const current = await executor.inspectRecord(record.key);
        if (
          current?.ownedManifestHash !== expectedHash ||
          current.appliedFingerprint === null ||
          current.fingerprint !== current.appliedFingerprint
        ) {
          throw new CatalogImportSafetyError(
            `Catalog verification drift detected for ${record.key}.`,
          );
        }
      }
      for (const image of parsed.images) {
        const ownership = await repository.inspectObjectOwnership(
          expectedHash,
          image.key,
        );
        if (!ownership)
          throw new CatalogImportSafetyError(
            `Catalog image verification failed for ${image.key}.`,
          );
        if (
          ownership.sha256 !== image.sha256 ||
          ownership.size !== image.size ||
          !(await objects.verify(ownership.objectPath, image))
        )
          throw new CatalogImportSafetyError(
            `Catalog image verification failed for ${image.key}.`,
          );
      }
    },
  };
}

export type { CatalogImportTransaction } from "./repository.js";
export { createCatalogImportRepository } from "./repository.js";
