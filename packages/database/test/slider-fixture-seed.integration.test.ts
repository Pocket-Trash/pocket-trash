import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createUploadStorage } from "../../storage/src/index.js";
import {
  seedCatalog,
  seedSliderFixtures,
  seedUsersAndSettings,
  sliderFixtureCatalog,
  sliderFixtureOwnerClerkId,
} from "../scripts/seed.js";
import type { Database } from "../src/client.js";
import * as schema from "../src/schema/index.js";
import {
  finishOption,
  pattern,
  product,
  productImage,
  productInsertMagnetOffer,
  productMagnetConfiguration,
  productSlider,
  productSliderInsert,
  productSliderInsertOffer,
  productSliderPlate,
  productType,
} from "../src/schema/index.js";

describe("deterministic slider fixture seed", () => {
  const client = new PGlite();
  const db = drizzle(client, { schema }) as unknown as Database;
  const uploadedObjectPaths: string[] = [];
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        uploadedObjectPaths.push(String(_input));
        return new Response(null, { status: 201 });
      }
      throw new Error(`Unexpected fixture storage request: ${String(_input)}`);
    },
  );
  const storage = createUploadStorage({
    accessKey: "fixture-access-key",
    cdnBaseUrl: "https://fixture-cdn.example.com",
    endpoint: "https://fixture-storage.example.com",
    folderPrefix: "resources/dev",
    imageFolderPrefix: "images/dev",
    zoneName: "fixture-zone",
  });

  beforeAll(async () => {
    vi.stubGlobal("fetch", fetchMock);
    const folder = fileURLToPath(new URL("../drizzle", import.meta.url));
    for (const file of readdirSync(folder)
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      await client.exec(
        readFileSync(join(folder, file), "utf8").replaceAll(
          "--> statement-breakpoint",
          "",
        ),
      );
    }
    await seedUsersAndSettings(db);
    await seedCatalog(db);
  }, 30_000);

  afterAll(async () => {
    vi.unstubAllGlobals();
    await client.close();
  });

  it("is repeatable, image-safe, and preserves the complete discovery fixture", async () => {
    await seedSliderFixtures(db, storage);
    const firstProducts = await loadFixtureProducts();
    const firstUploadCount = uploadedObjectPaths.length;

    await seedSliderFixtures(db, storage);
    const secondProducts = await loadFixtureProducts();

    expect(secondProducts).toEqual(firstProducts);
    expect(uploadedObjectPaths).toHaveLength(firstUploadCount);
    expect(firstProducts).toHaveLength(sliderFixtureCatalog.products.length);
    expect(firstProducts.filter(({ type }) => type === "slider")).toHaveLength(
      21,
    );
    expect(
      firstProducts.filter(({ type }) => type === "slider-plate"),
    ).toHaveLength(3);
    expect(
      firstProducts.filter(({ type }) => type === "slider-insert"),
    ).toHaveLength(3);
    expect(
      firstProducts.every(
        ({ approvalStatus, isPrivate, ownerClerkId }) =>
          approvalStatus === "approved" &&
          !isPrivate &&
          ownerClerkId === sliderFixtureOwnerClerkId,
      ),
    ).toBe(true);

    const imageRows = await db
      .select({ productId: productImage.productId })
      .from(productImage)
      .where(
        inArray(
          productImage.productId,
          firstProducts.map(({ id }) => id),
        ),
      );
    const imagesByProduct = Map.groupBy(
      imageRows,
      ({ productId }) => productId,
    );
    for (const type of ["slider", "slider-plate", "slider-insert"] as const) {
      const products = firstProducts
        .filter((fixture) => fixture.type === type)
        .sort(
          (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
        );
      expect(imagesByProduct.get(products[0]?.id ?? 0)).toHaveLength(2);
      expect(
        products
          .slice(1)
          .every(({ id }) => imagesByProduct.get(id)?.length === 1),
      ).toBe(true);
    }

    await expectDiscoveryRelationships(firstProducts.map(({ id }) => id));
  }, 30_000);

  /**
   * Reads every product owned by the deterministic slider fixture user.
   *
   * @returns Persisted fixture products in stable identifier order.
   */
  async function loadFixtureProducts() {
    return db
      .select({
        approvalStatus: product.approvalStatus,
        id: product.id,
        isPrivate: product.isPrivate,
        ownerClerkId: product.ownerClerkId,
        slug: product.slug,
        type: productType.slug,
        updatedAt: product.updatedAt,
      })
      .from(product)
      .innerJoin(productType, eq(productType.id, product.productTypeId))
      .where(eq(product.ownerClerkId, sliderFixtureOwnerClerkId))
      .orderBy(product.id);
  }

  /**
   * Verifies the relationships required by discovery and assembly workflows.
   *
   * @param productIds - Persisted fixture product identifiers.
   * @returns Completion after every relationship assertion passes.
   */
  async function expectDiscoveryRelationships(productIds: number[]) {
    const [bodyConfigurations, incompleteSources, defaultOffers] =
      await Promise.all([
        db
          .select({ productId: productMagnetConfiguration.productId })
          .from(productMagnetConfiguration)
          .where(inArray(productMagnetConfiguration.productId, productIds)),
        db
          .select({ id: productSlider.id })
          .from(productSlider)
          .where(
            and(
              inArray(productSlider.id, productIds),
              eq(
                productSlider.magnetSetupSourceNote,
                "The maker documents the click count but not every magnet position.",
              ),
            ),
          ),
        db
          .select({ sliderProductId: productSliderInsertOffer.sliderProductId })
          .from(productSliderInsertOffer)
          .innerJoin(
            productInsertMagnetOffer,
            eq(
              productInsertMagnetOffer.id,
              productSliderInsertOffer.insertOfferId,
            ),
          )
          .where(
            and(
              inArray(productSliderInsertOffer.sliderProductId, productIds),
              eq(productSliderInsertOffer.isAdvertisedDefault, true),
              eq(productInsertMagnetOffer.sourceLabel, "Default setup"),
            ),
          ),
      ]);
    expect(bodyConfigurations).toHaveLength(1);
    expect(incompleteSources).toHaveLength(1);
    expect(defaultOffers.length).toBeGreaterThan(0);

    const [includedPlates, patternedProducts] = await Promise.all([
      db
        .select({ productId: productSlider.id })
        .from(productSlider)
        .where(
          and(
            inArray(productSlider.id, productIds),
            isNotNull(productSlider.includedPlateProductId),
          ),
        ),
      db
        .select({ productId: finishOption.productId })
        .from(finishOption)
        .innerJoin(pattern, eq(pattern.id, finishOption.patternId))
        .where(inArray(finishOption.productId, productIds)),
    ]);
    expect(new Set(includedPlates.map(({ productId }) => productId)).size).toBe(
      20,
    );
    expect(patternedProducts.length).toBeGreaterThan(0);

    const [plates, inserts] = await Promise.all([
      db
        .select({ id: productSliderPlate.id })
        .from(productSliderPlate)
        .where(inArray(productSliderPlate.id, productIds)),
      db
        .select({ id: productSliderInsert.id })
        .from(productSliderInsert)
        .where(inArray(productSliderInsert.id, productIds)),
    ]);
    expect(plates).toHaveLength(3);
    expect(inserts).toHaveLength(3);
  }
});
