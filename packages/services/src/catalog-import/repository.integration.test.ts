import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { drizzle } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCatalogImportRepository } from "./repository.js";

describe("catalog import repository", () => {
  const client = new PGlite();
  const db = drizzle({
    client: client,
    relations: schema.relations,
  }) as unknown as Database;
  const repository = createCatalogImportRepository(db);
  const manifestHash = "a".repeat(64);

  beforeAll(async () => {
    const folder = fileURLToPath(
      new URL("../../../database/drizzle", import.meta.url),
    );
    await migratePglite(drizzle({ client: client }), {
      migrationsFolder: folder,
    });
  }, 30_000);

  afterAll(async () => {
    await client.close();
  });

  it("persists immutable attempts and retryable record and object ownership", async () => {
    const applicationId = await repository.recordApplication({
      actorClerkId: "actor",
      approvalPayloadHash: "b".repeat(64),
      environment: "production",
      imageCount: 1,
      manifestHash,
      manifestVersion: "1",
      operation: "apply",
      ownerClerkId: "owner",
      recordCount: 1,
      totalBytes: 12,
    });
    await repository.transaction(async (transaction) => {
      await repository.recordRecordOwnership(
        {
          applicationId,
          entity: "product",
          fingerprint: "c".repeat(64),
          manifestHash,
          recordId: "1000",
          recordKey: "product:one",
        },
        transaction,
      );
      await repository.recordObjectOwnership(
        {
          applicationId,
          imageKey: "image:one",
          manifestHash,
          objectPath: `images/products/import/${manifestHash}.png`,
          ownerRecordKey: "product:one",
          sha256: "d".repeat(64),
          size: 12,
          url: `https://cdn.example.com/${manifestHash}.png`,
        },
        transaction,
      );
    });
    await repository.finishApplication(applicationId, "succeeded");

    await expect(
      repository.inspectObjectOwnership(manifestHash, "image:one"),
    ).resolves.toEqual({
      objectPath: `images/products/import/${manifestHash}.png`,
      sha256: "d".repeat(64),
      size: 12,
    });
    await expect(
      repository.finishApplication(applicationId, "failed", "too-late"),
    ).rejects.toThrow(/not running/iu);

    await repository.transaction(async (transaction) => {
      await repository.markRecordsRolledBack(manifestHash, transaction);
      await repository.markObjectsRolledBack(manifestHash, transaction);
    });
    await expect(
      repository.inspectObjectOwnership(manifestHash, "image:one"),
    ).resolves.toBeUndefined();
  }, 30_000);
});
