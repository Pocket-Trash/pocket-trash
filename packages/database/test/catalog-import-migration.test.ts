import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Generated application row returned by the migration test insert. */
type ApplicationRow = {
  /** Generated manifest application identifier. */
  id: string;
};

describe("catalog import baseline", () => {
  const database = new PGlite();
  const hash = "a".repeat(64);
  const fingerprint = "b".repeat(64);

  beforeAll(async () => {
    await migrate(drizzle({ client: database }), {
      migrationsFolder: fileURLToPath(new URL("../drizzle/", import.meta.url)),
    });
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it("records terminal immutable attempts and durable ownership mappings", async () => {
    const application = await database.query<ApplicationRow>(`
      INSERT INTO catalog_manifest_application (
        manifest_version, manifest_hash, approval_payload_hash, operation,
        environment, owner_clerk_id, actor_clerk_id, record_count,
        image_count, total_bytes
      ) VALUES (
        '1', '${hash}', '${hash}', 'apply', 'production', 'owner', 'actor', 1, 1, 12
      ) RETURNING id
    `);
    const applicationId = application.rows[0]?.id;
    expect(applicationId).toBeTruthy();
    await expect(
      database.exec(`
        UPDATE catalog_manifest_application
        SET actor_clerk_id = 'other-actor'
        WHERE id = '${applicationId}'
      `),
    ).rejects.toThrow(/immutable/iu);
    await database.exec(`
      INSERT INTO catalog_manifest_record (
        application_id, manifest_hash, record_key, entity_type, record_id,
        applied_fingerprint
      ) VALUES (
        '${applicationId}', '${hash}', 'product:one', 'product', '1000', '${fingerprint}'
      );
      INSERT INTO catalog_manifest_object (
        application_id, manifest_hash, image_key, owner_record_key, object_path,
        url, sha256, size
      ) VALUES (
        '${applicationId}', '${hash}', 'image:one', 'product:one',
        'imports/${hash}.png', 'https://cdn.example.com/${hash}.png', '${fingerprint}', 12
      );
      UPDATE catalog_manifest_application
      SET outcome = 'succeeded', finished_at = now()
      WHERE id = '${applicationId}';
    `);

    await expect(
      database.exec(`
        UPDATE catalog_manifest_application
        SET manifest_version = 'changed'
        WHERE id = '${applicationId}'
      `),
    ).rejects.toThrow(/immutable/iu);
    await expect(
      database.exec(
        `DELETE FROM catalog_manifest_application WHERE id = '${applicationId}'`,
      ),
    ).rejects.toThrow(/immutable/iu);
  });

  it("rejects invalid hashes, counts, and terminal metadata", async () => {
    await expect(
      database.exec(`
        INSERT INTO catalog_manifest_application (
          manifest_version, manifest_hash, approval_payload_hash, operation,
          environment, owner_clerk_id, actor_clerk_id, record_count,
          image_count, total_bytes, outcome
        ) VALUES ('1', 'bad', '${hash}', 'apply', 'production', 'owner', 'actor', -1, 0, 0, 'succeeded')
      `),
    ).rejects.toThrow(/constraint/iu);
  });
});
