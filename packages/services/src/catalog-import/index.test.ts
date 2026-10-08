import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  type CatalogImportManifest,
  CatalogImportSafetyError,
  createCatalogImportRunner,
  hashCatalogImportManifest,
  parseCatalogImportManifest,
} from "./index.js";

/** Clerk owner used by manifest safety tests. */
const ownerClerkId = "user_3JpzgbqP9fye2bo4YMrOfLhrkCa";
/** Encoded image fixture used by checksum tests. */
const imageBytes = new TextEncoder().encode("approved-image");
/** Approved checksum for the encoded image fixture. */
const imageSha256 = createHash("sha256").update(imageBytes).digest("hex");

/** Mutable catalog record state used by the in-memory executor. */
type HarnessRecordState = {
  /** Fingerprint captured by durable ownership. */
  appliedFingerprint: string | null;
  /** Current record fingerprint. */
  fingerprint: string;
  /** Owning manifest hash when imported. */
  ownedManifestHash: string | null;
  /** Simulated persisted identifier. */
  recordId: string;
};

/** Durable object state used by the in-memory repository. */
type HarnessObjectState = {
  /** Versioned object path. */
  objectPath: string;
  /** Approved checksum. */
  sha256: string;
  /** Approved encoded byte count. */
  size: number;
};

/** Terminal application result captured by the test repository. */
type HarnessApplication = {
  /** Terminal application outcome. */
  outcome: string;
};

/** Complete catalog-only manifest fixture used by runner tests. */
const manifest: CatalogImportManifest = {
  approvalPayloadHash:
    "b543130f1c35ccb33c338b64ec380ed6ad72970928ca4c8f9a6ee2be7543c494",
  environment: "production",
  images: [
    {
      assetKey: "images/slider.png",
      contentType: "image/png",
      fileName: "slider.png",
      key: "image:slider",
      ownerRecordKey: "product:slider",
      position: 0,
      sha256: imageSha256,
      size: imageBytes.byteLength,
    },
  ],
  manifestVersion: "2026-10-06.1",
  ownerClerkId,
  records: [
    {
      entity: "maker",
      expected: { state: "absent" },
      key: "maker:magnus",
      payload: { name: "Magnus Fidgets" },
      references: {},
    },
    {
      entity: "product",
      expected: { state: "absent" },
      key: "product:slider",
      payload: {
        approvalStatus: "approved",
        isPrivate: false,
        name: "Approved Slider",
        ownerClerkId,
        productTypeSlug: "slider",
        slug: "approved-slider",
      },
      references: { maker: "maker:magnus" },
    },
    {
      entity: "product-slider",
      expected: { state: "absent" },
      key: "slider:slider",
      payload: { magnetLayout: "2x4", usesInserts: false },
      references: { product: "product:slider" },
    },
  ],
  schemaVersion: "catalog-import-v1",
};

/**
 * Builds isolated in-memory collaborators for one runner test.
 *
 * @returns Stateful runner collaborators and their observable stores.
 */
function createHarness() {
  const current = new Map<string, HarnessRecordState>();
  const activeObjects = new Set<string>();
  const ownedObjects = new Map<string, HarnessObjectState>();
  const applications: HarnessApplication[] = [];
  const repository = {
    finishApplication: vi.fn(async (_id: string, outcome: string) => {
      applications.push({ outcome });
    }),
    inspectObjectOwnership: vi.fn(async (_manifestHash: string, key: string) =>
      ownedObjects.get(key),
    ),
    markObjectsRolledBack: vi.fn(async () => undefined),
    markRecordsRolledBack: vi.fn(async () => undefined),
    recordApplication: vi.fn(async () => "application-1"),
    recordObjectOwnership: vi.fn(
      async (input: {
        /** Stable image key. */
        imageKey: string;
        /** Durable staged object path. */
        objectPath: string;
        /** Approved object checksum. */
        sha256: string;
        /** Approved object byte count. */
        size: number;
      }) => {
        ownedObjects.set(input.imageKey, input);
      },
    ),
    recordRecordOwnership: vi.fn(
      async (input: {
        /** Applied content fingerprint. */
        fingerprint: string;
        /** Stable manifest content hash. */
        manifestHash: string;
        /** Stable record key. */
        recordKey: string;
      }) => {
        current.set(input.recordKey, {
          appliedFingerprint: input.fingerprint,
          fingerprint: input.fingerprint,
          ownedManifestHash: input.manifestHash,
          recordId: current.get(input.recordKey)?.recordId ?? "missing",
        });
      },
    ),
    transaction: vi.fn(
      async (callback: (tx: Record<string, never>) => Promise<void>) => {
        const before = new Map(current);
        try {
          await callback({});
        } catch (error) {
          current.clear();
          for (const [key, value] of before) current.set(key, value);
          throw error;
        }
      },
    ),
  };
  const executor = {
    applyRecord: vi.fn(
      async (
        _tx: unknown,
        record: CatalogImportManifest["records"][number],
      ) => {
        const fingerprint = hashCatalogImportManifest(record.payload);
        const recordId = String(current.size + 1);
        current.set(record.key, {
          appliedFingerprint: null,
          fingerprint,
          ownedManifestHash: null,
          recordId,
        });
        return { fingerprint, recordId };
      },
    ),
    inspectRecord: vi.fn(async (recordKey: string) => current.get(recordKey)),
    rollbackRecord: vi.fn(async (_tx: unknown, recordKey: string) => {
      current.delete(recordKey);
    }),
  };
  const assets = {
    read: vi.fn(async () => imageBytes),
  };
  const objects = {
    activate: vi.fn(async (objectPath: string) => {
      activeObjects.add(objectPath);
    }),
    stage: vi.fn(
      async (
        _image: CatalogImportManifest["images"][number],
        _bytes: Uint8Array,
        manifestHash: string,
      ) => ({
        objectPath: `catalog-import/${manifestHash}/${imageSha256}.png`,
        url: `https://cdn.example.com/catalog-import/${manifestHash}/${imageSha256}.png`,
      }),
    ),
    verify: vi.fn(async (objectPath: string) =>
      objectPath.includes(imageSha256),
    ),
  };
  return {
    activeObjects,
    applications,
    assets,
    current,
    executor,
    objects,
    repository,
    runner: createCatalogImportRunner({
      assets,
      executor,
      objects,
      repository,
    }),
  };
}

describe("catalog import manifest", () => {
  it("accepts catalog entities and rejects collection data", () => {
    expect(parseCatalogImportManifest(manifest)).toEqual(manifest);
    expect(() =>
      parseCatalogImportManifest({
        ...manifest,
        records: [
          {
            ...manifest.records[0],
            entity: "collection-item",
          },
        ],
      }),
    ).toThrow(/catalog/i);
  });

  it("requires every imported product to be approved, public, and owner-matched", () => {
    expect(() =>
      parseCatalogImportManifest({
        ...manifest,
        records: manifest.records.map((record) =>
          record.entity === "product"
            ? {
                ...record,
                payload: { ...record.payload, isPrivate: true },
              }
            : record,
        ),
      }),
    ).toThrow(/approved and public/i);
  });

  it.each([
    "inherentClickCount",
    "magnetSetupSourceNote",
    "weightBasis",
  ])("rejects retired slider field %s", (retiredField) => {
    expect(() =>
      parseCatalogImportManifest({
        ...manifest,
        records: manifest.records.map((record) =>
          record.entity === "product-slider"
            ? {
                ...record,
                payload: { ...record.payload, [retiredField]: "legacy" },
              }
            : record,
        ),
      }),
    ).toThrow(/retired/i);
  });

  it("hashes canonical content independent of object key order", () => {
    expect(hashCatalogImportManifest(manifest)).toBe(
      hashCatalogImportManifest({
        records: manifest.records,
        schemaVersion: manifest.schemaVersion,
        ownerClerkId: manifest.ownerClerkId,
        manifestVersion: manifest.manifestVersion,
        images: manifest.images,
        environment: manifest.environment,
        approvalPayloadHash: manifest.approvalPayloadHash,
      }),
    );
  });
});

describe("catalog import runner", () => {
  it("keeps dry-run read-only and returns a redacted review", async () => {
    const harness = createHarness();
    const result = await harness.runner.dryRun(manifest, {
      actualEnvironment: "production",
      expectedOwnerClerkId: ownerClerkId,
    });

    expect(result).toMatchObject({
      environment: "production",
      imageCount: 1,
      ownerClerkId,
      recordCount: 3,
      totalBytes: imageBytes.byteLength,
    });
    expect(result.changes).toEqual([
      { action: "create", entity: "maker", key: "maker:magnus" },
      { action: "create", entity: "product", key: "product:slider" },
      {
        action: "create",
        entity: "product-slider",
        key: "slider:slider",
      },
    ]);
    expect(harness.repository.recordApplication).not.toHaveBeenCalled();
    expect(harness.objects.stage).not.toHaveBeenCalled();
  });

  it.each([
    [
      "environment",
      { actualEnvironment: "preview", expectedOwnerClerkId: ownerClerkId },
    ],
    [
      "owner",
      {
        actualEnvironment: "production",
        expectedOwnerClerkId: "user_wrong",
      },
    ],
  ])("fails closed on %s ambiguity", async (_case, input) => {
    const harness = createHarness();
    await expect(harness.runner.dryRun(manifest, input)).rejects.toBeInstanceOf(
      CatalogImportSafetyError,
    );
  });

  it("requires the exact approved content hash and rejects prior-state drift", async () => {
    const harness = createHarness();
    const manifestHash = hashCatalogImportManifest(manifest);
    await expect(
      harness.runner.apply(manifest, {
        actualEnvironment: "production",
        approvedManifestHash: "f".repeat(64),
        actorClerkId: ownerClerkId,
        expectedOwnerClerkId: ownerClerkId,
      }),
    ).rejects.toThrow(/approved manifest hash/i);

    harness.current.set("product:slider", {
      appliedFingerprint: null,
      fingerprint: "unexpected",
      ownedManifestHash: null,
      recordId: "existing-product",
    });
    await expect(
      harness.runner.apply(manifest, {
        actualEnvironment: "production",
        approvedManifestHash: manifestHash,
        actorClerkId: ownerClerkId,
        expectedOwnerClerkId: ownerClerkId,
      }),
    ).rejects.toThrow(/drift/i);
  });

  it("stages and verifies every image before one transactional activation", async () => {
    const harness = createHarness();
    const manifestHash = hashCatalogImportManifest(manifest);
    await harness.runner.apply(manifest, {
      actualEnvironment: "production",
      approvedManifestHash: manifestHash,
      actorClerkId: ownerClerkId,
      expectedOwnerClerkId: ownerClerkId,
    });

    expect(harness.assets.read).toHaveBeenCalledOnce();
    expect(harness.objects.stage).toHaveBeenCalledOnce();
    expect(harness.objects.verify).toHaveBeenCalledOnce();
    expect(harness.repository.transaction).toHaveBeenCalledOnce();
    expect(harness.executor.applyRecord).toHaveBeenCalledTimes(3);
    expect(harness.objects.activate).toHaveBeenCalledOnce();

    await harness.runner.verify(manifest, { manifestHash });
    await harness.runner.rollback(manifest, {
      actualEnvironment: "production",
      actorClerkId: ownerClerkId,
      expectedOwnerClerkId: ownerClerkId,
      manifestHash,
    });
    expect(harness.executor.rollbackRecord).toHaveBeenCalledTimes(3);
    expect(harness.activeObjects.size).toBe(1);
  });

  it("rejects mismatched image bytes before staging or database writes", async () => {
    const harness = createHarness();
    harness.assets.read.mockResolvedValue(new TextEncoder().encode("wrong"));
    await expect(
      harness.runner.apply(manifest, {
        actualEnvironment: "production",
        approvedManifestHash: hashCatalogImportManifest(manifest),
        actorClerkId: ownerClerkId,
        expectedOwnerClerkId: ownerClerkId,
      }),
    ).rejects.toThrow(/checksum|size/i);
    expect(harness.objects.stage).not.toHaveBeenCalled();
    expect(harness.repository.transaction).not.toHaveBeenCalled();
  });

  it("rechecks prior state inside the activation transaction", async () => {
    const harness = createHarness();
    harness.objects.verify.mockImplementationOnce(async () => {
      harness.current.set("maker:magnus", {
        appliedFingerprint: null,
        fingerprint: "concurrent-write",
        ownedManifestHash: null,
        recordId: "other-maker",
      });
      return true;
    });

    await expect(
      harness.runner.apply(manifest, {
        actualEnvironment: "production",
        approvedManifestHash: hashCatalogImportManifest(manifest),
        actorClerkId: ownerClerkId,
        expectedOwnerClerkId: ownerClerkId,
      }),
    ).rejects.toThrow(/drift.*activation/i);
    expect(harness.executor.applyRecord).not.toHaveBeenCalled();
  });

  it("retries a partial failure with the same staged object and no destructive cleanup", async () => {
    const harness = createHarness();
    const applyRecord = harness.executor.applyRecord.getMockImplementation();
    if (!applyRecord) throw new Error("Missing catalog executor test double.");
    harness.executor.applyRecord
      .mockImplementationOnce(applyRecord)
      .mockRejectedValueOnce(new Error("interrupted"));
    const input = {
      actualEnvironment: "production",
      approvedManifestHash: hashCatalogImportManifest(manifest),
      actorClerkId: ownerClerkId,
      expectedOwnerClerkId: ownerClerkId,
    };

    await expect(harness.runner.apply(manifest, input)).rejects.toThrow(
      /interrupted/i,
    );
    await expect(harness.runner.apply(manifest, input)).resolves.toMatchObject({
      manifestHash: input.approvedManifestHash,
    });
    expect(harness.objects.stage).toHaveBeenCalledTimes(2);
    const stagedTargets = await Promise.all(
      harness.objects.stage.mock.results.map(
        ({ value }) =>
          value as Promise<{
            /** Versioned object path returned by the staging adapter. */
            objectPath: string;
          }>,
      ),
    );
    expect(
      new Set(stagedTargets.map(({ objectPath }) => objectPath)).size,
    ).toBe(1);
    expect(harness.applications).toEqual([
      { outcome: "failed" },
      { outcome: "succeeded" },
    ]);
  });
});
