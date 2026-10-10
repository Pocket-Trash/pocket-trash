import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  pensFixtureCounts,
  seedCatalog,
  seedPensFixtures,
} from "../scripts/seed.js";
import * as schema from "../src/schema/index.js";

/** Complete migration chain used by the fixture integration test. */
const migrationsFolder = fileURLToPath(new URL("../drizzle/", import.meta.url));
/** Disposable PostgreSQL database used by the fixture integration test. */
const database = new PGlite();
/** Drizzle client for the disposable database. */
const db = drizzle({ client: database, schema });
/** In-memory upload-storage boundary used to observe deterministic writes. */
const storage = {
  /**
   * Builds the same content-addressed target shape as production storage.
   *
   * @param {object} image - Fixture image metadata.
   * @param {object} owner - Fixture product owner.
   * @returns {object} Content-addressed image target.
   */
  createImageTarget: (image, owner) => ({
    ...image,
    objectPath: `images/${owner.entity}/${owner.entityId}/${image.sha256}.png`,
    url: `https://cdn.example.test/images/${owner.entity}/${owner.entityId}/${image.sha256}.png`,
  }),
  /** Accepts fixture bytes without performing a network write. */
  putImage: vi.fn(async () => undefined),
};

describe("Pens development fixtures", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder });
    await seedCatalog(db);
  }, 60_000);

  afterAll(async () => {
    await database.close();
  });

  it("is deterministic and preserves the approved image cardinalities", async () => {
    await seedPensFixtures(db, storage);
    await seedPensFixtures(db, storage);
    const result = await database.query(`
      SELECT pt.slug AS type, count(DISTINCT p.id)::int AS products,
        count(pi.id)::int AS images
      FROM product p
      JOIN product_types pt ON pt.id = p.product_type_id
      LEFT JOIN product_image pi ON pi.product_id = p.id AND pi.deleted_at IS NULL
      WHERE p.slug LIKE 'pocket-trash-demo-%'
      GROUP BY pt.slug ORDER BY pt.slug;
    `);
    expect(result.rows).toEqual([
      { images: 24, products: pensFixtureCounts.pens, type: "pen" },
      { images: 22, products: pensFixtureCounts.refills, type: "refill" },
    ]);
  }, 60_000);
});
