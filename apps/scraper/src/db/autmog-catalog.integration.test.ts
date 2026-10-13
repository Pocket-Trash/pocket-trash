import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { normalizeAutmogProduct } from "../autmog/normalize.js";
import type { ShopifyProduct } from "../autmog/shopify.js";
import {
  syncCanonicalAutmogImage,
  syncCanonicalAutmogPen,
} from "./autmog-catalog.js";

describe("canonical Autmog catalog synchronization", () => {
  it("creates, updates, and reuses a canonical Pen without staging writes", async () => {
    const { client, db } = await createTestDatabase();
    const original = normalizeAutmogProduct(createProduct());

    try {
      const created = await syncCanonicalAutmogPen(db, original);
      expect(created).toMatchObject({
        created: true,
        dryRun: false,
        updated: false,
      });
      expect(created.productId).not.toBeNull();
      expect(created.listingId).not.toBeNull();
      if (created.productId === null || created.listingId === null)
        throw new Error("Expected canonical Autmog identity.");
      const productId = created.productId;
      expect(created.imageCandidates).toHaveLength(1);
      await expect(countRows(db, schema.tmpProducts)).resolves.toBe(0);
      await expect(countRows(db, schema.tmpImages)).resolves.toBe(0);
      await expect(countRows(db, schema.tmpAutmogPens)).resolves.toBe(0);

      await db
        .update(schema.product)
        .set({
          approvalStatus: "approved",
          isPrivate: true,
          ownerClerkId: "user_owner",
        })
        .where(eq(schema.product.id, productId));

      const unchanged = await syncCanonicalAutmogPen(db, original);
      expect(unchanged).toMatchObject({
        created: false,
        dryRun: false,
        productId: created.productId,
        updated: false,
      });

      const changed = normalizeAutmogProduct(
        createProduct({
          body_html:
            "<p>Updated aluminum and titanium click pen with a conical nose and Pilot G2 refill.</p>",
          handle: "updated-autmog-pen",
          title: "Updated Autmog Pen",
        }),
      );
      const plannedUpdate = await syncCanonicalAutmogPen(db, changed, {
        dryRun: true,
      });
      expect(plannedUpdate).toMatchObject({
        created: false,
        dryRun: true,
        productId: created.productId,
        updated: true,
      });
      const [beforeUpdate] = await db
        .select({ name: schema.product.name })
        .from(schema.product)
        .where(eq(schema.product.id, productId));
      expect(beforeUpdate?.name).toBe(original.title);

      const updated = await syncCanonicalAutmogPen(db, changed);
      expect(updated).toMatchObject({
        created: false,
        productId: created.productId,
        updated: true,
      });

      const [product] = await db
        .select()
        .from(schema.product)
        .where(eq(schema.product.id, productId));
      expect(product).toMatchObject({
        approvalStatus: "approved",
        isPrivate: true,
        makerProductUrl: "https://www.autmog.com/products/updated-autmog-pen",
        name: "Updated Autmog Pen",
        ownerClerkId: "user_owner",
      });
      await expect(countRows(db, schema.productMaterial)).resolves.toBe(2);
      await expect(
        countRows(db, schema.refillCompatibilityAssertion),
      ).resolves.toBe(1);
      await expect(
        countRows(db, schema.refillCompatibilityEvidence),
      ).resolves.toBe(0);
    } finally {
      await client.close();
    }
  }, 30_000);

  it("plans new products without writing and persists canonical image mappings", async () => {
    const { client, db } = await createTestDatabase();
    const item = normalizeAutmogProduct(createProduct());

    try {
      const planned = await syncCanonicalAutmogPen(db, item, { dryRun: true });
      expect(planned).toEqual({
        created: true,
        dryRun: true,
        imageCandidates: [],
        listingId: null,
        productId: null,
        updated: false,
      });
      await expect(countRows(db, schema.product)).resolves.toBe(0);

      const created = await syncCanonicalAutmogPen(db, item);
      if (created.productId === null || created.listingId === null)
        throw new Error("Expected canonical Autmog identity.");
      const { listingId, productId } = created;
      const uploaded = {
        contentType: "image/jpeg",
        fileName: "a".repeat(64) + ".jpg",
        objectPath: `images/products/${productId}/${"a".repeat(64)}.jpg`,
        position: 1,
        sha256: "a".repeat(64),
        size: 42,
        sourceImageId: "456",
        sourceUrl: "https://cdn.shopify.com/image.jpg",
        url: `https://cdn.pocket-trash.app/images/products/${productId}/${"a".repeat(64)}.jpg`,
      };
      const firstImage = await syncCanonicalAutmogImage(db, {
        listingId,
        productId,
        uploaded,
      });
      expect(firstImage.changed).toBe(true);
      const unchangedImage = await syncCanonicalAutmogImage(db, {
        listingId,
        productId,
        uploaded,
      });
      expect(unchangedImage).toEqual({
        changed: false,
        productImageId: firstImage.productImageId,
      });
      await expect(countRows(db, schema.productImage)).resolves.toBe(1);
      await expect(countRows(db, schema.catalogSourceImage)).resolves.toBe(1);
      await expect(syncCanonicalAutmogPen(db, item)).resolves.toMatchObject({
        imageCandidates: [],
      });
    } finally {
      await client.close();
    }
  }, 30_000);
});

/**
 * Creates a migrated database with canonical Autmog lookup rows.
 *
 * @returns Disposable PGlite client and typed database.
 * @rejects When migrations or lookup seeding fail.
 */
async function createTestDatabase(): Promise<{
  /** Disposable PGlite client owned by the test. */
  client: PGlite;
  /** Migrated typed database used by the test. */
  db: Database;
}> {
  const client = new PGlite();
  const migrationsFolder = fileURLToPath(
    new URL("../../../../packages/database/drizzle", import.meta.url),
  );
  await migratePglite(drizzle({ client }), { migrationsFolder });
  const db = drizzle({
    client,
    relations: schema.relations,
  }) as unknown as Database;

  await db.insert(schema.maker).values({
    name: "Autmog",
    rootUrl: "https://www.autmog.com",
    slug: "autmog",
  });
  await db.insert(schema.material).values([
    { name: "Titanium", slug: "titanium" },
    { name: "Aluminum", slug: "aluminum" },
  ]);
  await db.insert(schema.finish).values([
    { name: "Machine finish", slug: "machine-finish" },
    { name: "KVR", slug: "kvr" },
  ]);
  await db.insert(schema.pattern).values({
    name: "Grip lines",
    slug: "grip-lines",
  });
  const [nose, refillGroupConcept] = await db
    .insert(schema.catalogTerminologyConcept)
    .values([
      {
        canonicalLabelFallback: "Conical",
        canonicalLabelKey: "catalog.penNoseProfiles.conical",
        key: "conical",
        namespace: "pen-nose-profile",
        normalizedCanonicalLabel: "conical",
      },
      {
        canonicalLabelFallback: "Pilot G2 standard",
        canonicalLabelKey: "catalog.refillCompatibilityGroups.pilotG2Standard",
        key: "pilot-g2-standard",
        namespace: "refill-compatibility-group",
        normalizedCanonicalLabel: "pilot g2 standard",
      },
    ])
    .returning({ id: schema.catalogTerminologyConcept.id });
  if (!nose || !refillGroupConcept) throw new Error("Failed to seed concepts.");
  await db.insert(schema.refillCompatibilityGroup).values({
    conceptId: refillGroupConcept.id,
  });
  return { client, db };
}

/**
 * Counts all rows in one schema table for integration assertions.
 *
 * @param db - Migrated test database.
 * @param table - Schema table to scan.
 * @returns Number of persisted rows.
 */
async function countRows(
  db: Database,
  table: Parameters<Database["select"]>[0] extends never ? never : object,
): Promise<number> {
  return (await db.select().from(table as typeof schema.product)).length;
}

/**
 * Builds one representative Autmog Shopify Pen.
 *
 * @param overrides - Shopify values that replace fixture defaults.
 * @returns Complete Shopify product fixture.
 */
function createProduct(
  overrides: Partial<ShopifyProduct> = {},
): ShopifyProduct {
  return {
    available: true,
    body_html:
      "<p>Titanium click pen with grip lines, a conical nose, and Pilot G2 refill.</p>",
    created_at: "2026-01-01T00:00:00Z",
    handle: "autmog-pen",
    id: 123,
    images: [
      {
        height: 1200,
        id: 456,
        position: 1,
        src: "https://cdn.shopify.com/image.jpg",
        width: 1600,
      },
    ],
    product_type: "Pens",
    published_at: "2026-01-02T00:00:00Z",
    tags: ["pen"],
    title: "Autmog Titanium Pen",
    updated_at: "2026-01-03T00:00:00Z",
    variants: [],
    vendor: "Autmog",
    ...overrides,
  };
}
