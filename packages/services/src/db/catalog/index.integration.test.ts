import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createLogger } from "@package/logger";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import { createDbServices } from "../index.js";

describe("catalog product persistence", () => {
  it("normalizes, constrains, lists, and audits maker-scoped terminology aliases", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });

    try {
      const migrationsFolder = fileURLToPath(
        new URL("../../../../database/drizzle", import.meta.url),
      );
      for (const file of readdirSync(migrationsFolder)
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        await client.exec(
          readFileSync(join(migrationsFolder, file), "utf8").replaceAll(
            "--> statement-breakpoint",
            "",
          ),
        );
      }
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Alias Maker", slug: "alias-maker" })
        .returning({ id: schema.maker.id });
      await db
        .insert(schema.productType)
        .values({ name: "Slider Insert", slug: "slider-insert" });
      await db.insert(schema.user).values({ clerkId: "admin-alias" });
      if (!maker) throw new Error("Alias fixtures were not created.");

      const service = createDbServices(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      ).catalog;
      const input = {
        actor: { clerkId: "admin-alias", role: "admin" as const },
        canonicalKey: "slider-insert" as const,
        canonicalNamespace: "product-type" as const,
        isPreferred: true,
        label: "  CASSÉTTE  ",
        makerId: maker.id,
      };

      await expect(service.createTerminologyAlias(input)).resolves.toEqual(
        expect.objectContaining({
          canonicalKey: "slider-insert",
          label: "CASSÉTTE",
          normalizedValue: "cassette",
        }),
      );
      await expect(
        service.createTerminologyAlias({
          ...input,
          isPreferred: false,
          label: "cassette",
        }),
      ).rejects.toThrow("Alias already exists");
      await expect(service.listTerminologyAliases()).resolves.toEqual([
        expect.objectContaining({ makerName: "Alias Maker" }),
      ]);

      const events = await db.select().from(schema.auditEvent);
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: "products.terminology_alias.created",
            permission: "products.manage",
          }),
        ]),
      );
    } finally {
      await client.close();
    }
  }, 30_000);

  it("round-trips source details and enforces approval transitions", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });

    try {
      const migrationsFolder = fileURLToPath(
        new URL("../../../../database/drizzle", import.meta.url),
      );
      for (const file of readdirSync(migrationsFolder)
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        await client.exec(
          readFileSync(join(migrationsFolder, file), "utf8").replaceAll(
            "--> statement-breakpoint",
            "",
          ),
        );
      }
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Maker", slug: "maker" })
        .returning({ id: schema.maker.id });
      const [productType] = await db
        .insert(schema.productType)
        .values({ name: "Spinner", slug: "spinner" })
        .returning({ id: schema.productType.id });
      const [finish] = await db
        .insert(schema.finish)
        .values({ name: "Stonewashed", slug: "stonewashed" })
        .returning({ id: schema.finish.id });
      const [material] = await db
        .insert(schema.material)
        .values({ name: "Titanium", slug: "titanium" })
        .returning({ id: schema.material.id });
      const [pattern] = await db
        .insert(schema.pattern)
        .values({ name: "Honeycomb", slug: "honeycomb" })
        .returning({ id: schema.pattern.id });
      if (!maker || !productType || !finish || !material || !pattern) {
        throw new Error("Catalog fixtures were not created.");
      }

      await db
        .insert(schema.user)
        .values([{ clerkId: "user-test" }, { clerkId: "admin-test" }]);
      const service = createDbServices(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      ).catalog;
      const created = await service.createProduct({
        actor: { clerkId: "user-test", role: "user" },
        description: "Created description",
        finishOptions: [
          {
            colorEffectId: null,
            colorIds: [],
            finishIds: [finish.id],
            patternId: pattern.id,
          },
        ],
        makerId: maker.id,
        makerProductUrl: "https://maker.example/spinner/",
        materialIds: [material.id],
        name: "Spinner",
        productTypeSlug: "spinner",
        slug: "spinner",
        specs: { bearing: "R188", spinDiameterMm: "52" },
      });

      expect(created).toEqual(
        expect.objectContaining({
          approvalStatus: "pending",
          bearing: "R188",
          description: "Created description",
          makerProductUrl: "https://maker.example/spinner",
          makerProductUrlValid: true,
          spinDiameterMm: "52",
        }),
      );
      expect(created.finishOptions[0]?.pattern).toEqual({
        id: pattern.id,
        name: "Honeycomb",
        slug: "honeycomb",
      });
      await expect(
        service.getProduct("spinner", "spinner"),
      ).resolves.toBeNull();
      await expect(
        service.getProduct("spinner", "spinner", {
          clerkId: "other-user",
          role: "user",
        }),
      ).resolves.toBeNull();
      await expect(
        service.getProduct("spinner", "spinner", {
          clerkId: "admin-test",
          role: "admin",
        }),
      ).resolves.toEqual(expect.objectContaining({ id: created.id }));
      await expect(
        service.decideProductApproval({
          action: "approve",
          actor: { clerkId: "user-test", role: "user" },
          productId: created.id,
          reason: "Ready",
        }),
      ).rejects.toThrow("Product does not exist.");
      await expect(
        service.decideProductApproval({
          action: "approve",
          actor: { clerkId: "admin-test", role: "admin" },
          productId: created.id,
          reason: " ",
        }),
      ).rejects.toThrow("A decision reason is required.");
      await expect(
        service.decideProductApproval({
          action: "approve",
          actor: { clerkId: "admin-test", role: "admin" },
          productId: created.id,
          reason: "Ready for the catalog",
        }),
      ).resolves.toBe("approved");
      const sharedPreviewUrl =
        "https://cdn.example.test/images/preview/products/1000/shared.png?format=webp&quality=85";
      await db.insert(schema.productImage).values({
        contentType: "image/png",
        fileName: "shared.png",
        objectPath: "images/preview/products/1000/shared.png",
        position: 0,
        productId: created.id,
        sha256: "a".repeat(64),
        size: 1,
        storageOwned: false,
        url: sharedPreviewUrl,
      });
      await expect(service.getProduct("spinner", "spinner")).resolves.toEqual(
        expect.objectContaining({
          approvalStatus: "approved",
          id: created.id,
          images: [expect.objectContaining({ url: sharedPreviewUrl })],
        }),
      );
      await expect(
        service.decideProductApproval({
          action: "reject",
          actor: { clerkId: "admin-test", role: "admin" },
          productId: created.id,
          reason: "Invalid direct transition",
        }),
      ).rejects.toThrow("Approval transition is invalid.");
      await expect(
        service.decideProductApproval({
          action: "reverse",
          actor: { clerkId: "admin-test", role: "admin" },
          productId: created.id,
          reason: "Needs another review",
        }),
      ).resolves.toBe("pending");
      await expect(
        service.decideProductApproval({
          action: "reject",
          actor: { clerkId: "admin-test", role: "admin" },
          productId: created.id,
          reason: "Not suitable",
        }),
      ).resolves.toBe("rejected");

      await service.setMakerProductUrlValidity({
        actor: { clerkId: "admin-test", role: "admin" },
        makerProductUrlValid: false,
        productId: created.id,
        reason: "Broken source link",
      });
      const updated = await service.updateProduct({
        actor: { clerkId: "user-test", role: "user" },
        description: "Edited description",
        finishOptions: [
          {
            colorEffectId: null,
            colorIds: [],
            finishIds: [finish.id],
            patternId: pattern.id,
          },
        ],
        makerId: maker.id,
        makerProductUrl: "https://maker.example/spinner/",
        materialIds: [material.id],
        name: "Edited spinner",
        productId: created.id,
        productTypeSlug: "spinner",
        slug: "edited-spinner",
        specs: { bearing: "One Drop", spinDiameterMm: "54" },
      });

      expect(updated).toEqual(
        expect.objectContaining({
          bearing: "One Drop",
          description: "Edited description",
          makerProductUrl: "https://maker.example/spinner",
          makerProductUrlValid: false,
          spinDiameterMm: "54",
        }),
      );

      const carbon = await service.createMaterial({
        actor: { clerkId: "admin-test", role: "admin" },
        description: "Lightweight composite.",
        name: "Carbon Fiber",
      });
      const carbonCollision = await service.createMaterial({
        actor: { clerkId: "admin-test", role: "admin" },
        description: null,
        name: "Carbon/Fiber",
      });
      expect(carbon).toEqual(
        expect.objectContaining({
          description: "Lightweight composite.",
          slug: "carbon-fiber",
        }),
      );
      expect(carbonCollision.slug).toBe("carbon-fiber-2");

      const renamed = await service.updateMaterial({
        actor: { clerkId: "admin-test", role: "admin" },
        description: null,
        materialId: carbon.id,
        name: "Forged Carbon",
      });
      expect(renamed).toEqual(
        expect.objectContaining({
          description: null,
          name: "Forged Carbon",
          slug: "carbon-fiber",
        }),
      );
      await service.attachImages({
        actor: { clerkId: "admin-test", role: "admin" },
        files: [
          {
            contentType: "image/png",
            fileName: "carbon.png",
            kind: "image",
            objectPath: `images/materials/${carbon.id}/carbon.png`,
            position: 0,
            sha256: "a".repeat(64),
            size: 10,
            url: `https://cdn.test/materials/${carbon.id}/carbon.png`,
          },
        ],
        target: { id: carbon.id, type: "material" },
      });
      const withImage = await service.getAdminMaterial(carbon.id, {
        clerkId: "admin-test",
        role: "admin",
      });
      const imageId = withImage?.images[0]?.id;
      expect(imageId).toEqual(expect.any(Number));
      if (!imageId) throw new Error("Material image was not created.");
      await service.softDeleteImage({
        actor: { clerkId: "admin-test", role: "admin" },
        imageId,
        targetType: "material",
      });
      expect(
        (
          await service.getAdminMaterial(carbon.id, {
            clerkId: "admin-test",
            role: "admin",
          })
        )?.images[0]?.deletedAt,
      ).toEqual(expect.any(Date));
      await service.restoreImage({
        actor: { clerkId: "admin-test", role: "admin" },
        imageId,
        targetType: "material",
      });
      expect(
        (
          await service.getAdminMaterial(carbon.id, {
            clerkId: "admin-test",
            role: "admin",
          })
        )?.images[0]?.deletedAt,
      ).toBeNull();
      await expect(
        service.getAdminMaterial(carbon.id, {
          clerkId: "user-test",
          role: "user",
        }),
      ).rejects.toThrow("Material does not exist.");
      await expect(
        service.listAdminMaterials({ clerkId: "admin-test", role: "admin" }),
      ).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: carbon.id, slug: "carbon-fiber" }),
        ]),
      );
    } finally {
      await client.close();
    }
  }, 30_000);

  it("round-trips slider subtypes and keeps reviewed relationships distinct", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });

    try {
      const migrationsFolder = fileURLToPath(
        new URL("../../../../database/drizzle", import.meta.url),
      );
      for (const file of readdirSync(migrationsFolder)
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        await client.exec(
          readFileSync(join(migrationsFolder, file), "utf8").replaceAll(
            "--> statement-breakpoint",
            "",
          ),
        );
      }
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Slider Maker", slug: "slider-maker" })
        .returning({ id: schema.maker.id });
      const productTypes = await db
        .insert(schema.productType)
        .values([
          { name: "Slider", slug: "slider" },
          { name: "Slider Plate", slug: "slider-plate" },
          { name: "Slider Insert", slug: "slider-insert" },
        ])
        .returning({ id: schema.productType.id });
      const [material] = await db
        .insert(schema.material)
        .values({ name: "Titanium", slug: "titanium" })
        .returning({ id: schema.material.id });
      if (!maker || productTypes.length !== 3 || !material) {
        throw new Error("Slider fixtures were not created.");
      }

      await db
        .insert(schema.user)
        .values([{ clerkId: "user-test" }, { clerkId: "admin-test" }]);
      const service = createDbServices(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      ).catalog;
      const admin = { clerkId: "admin-test", role: "admin" as const };
      const plate = await service.createProduct({
        actor: admin,
        finishOptions: [],
        makerId: maker.id,
        materialIds: [material.id],
        name: "Matched Plates",
        productTypeSlug: "slider-plate",
        slug: "matched-plates",
        specs: {
          lengthMm: "50",
          thicknessMm: "4",
          weightG: "28",
          widthMm: "20",
        },
      });
      const insert = await service.createProduct({
        actor: admin,
        finishOptions: [],
        makerId: maker.id,
        materialIds: [material.id],
        name: "Cassette Insert",
        productTypeSlug: "slider-insert",
        slug: "cassette-insert",
        specs: {
          lengthMm: "42",
          thicknessMm: "3",
          weightG: "18",
          widthMm: "16",
        },
      });
      const slider = await service.createProduct({
        actor: admin,
        finishOptions: [],
        includedComponentIds: [plate.id, insert.id],
        makerId: maker.id,
        materialIds: [material.id],
        name: "Rail Slider",
        productTypeSlug: "slider",
        slug: "rail-slider",
        bodyHostedMagnetSetup: {
          clickCount: 4,
          configuration: {
            label: "Medium",
            sourceLabel: "4-click layout",
            sourceNotes: null,
            groups: [
              {
                diameterMm: "6.35",
                grade: "n52",
                key: "corners",
                label: "Corners",
                thicknessMm: "3.175",
              },
            ],
            slots: [
              {
                documentedColumn: 1,
                documentedRow: 1,
                groupKey: "corners",
                half: "half-a",
                key: "A1",
                state: "occupied",
              },
              {
                documentedColumn: 1,
                documentedRow: 1,
                groupKey: null,
                half: "half-b",
                key: "B1",
                state: "empty",
              },
            ],
          },
          sourceNote: null,
        },
        specs: {
          lengthMm: "52",
          magnetSystem: "body-hosted",
          thicknessMm: "12",
          weightBasis: "complete-build",
          weightG: "96",
          widthMm: "24",
        },
      });

      expect(slider).toEqual(
        expect.objectContaining({
          bodyHostedMagnetSetup: {
            clickCount: 4,
            configuration: {
              label: "Medium",
              sourceLabel: "4-click layout",
              sourceNotes: null,
              groups: [
                expect.objectContaining({
                  diameterMm: "6.35",
                  grade: "N52",
                  key: "corners",
                  label: "Corners",
                  thicknessMm: "3.175",
                }),
              ],
              slots: [
                expect.objectContaining({
                  groupKey: "corners",
                  half: "half-a",
                  key: "A1",
                  state: "occupied",
                }),
                expect.objectContaining({
                  groupKey: null,
                  half: "half-b",
                  key: "B1",
                  state: "empty",
                }),
              ],
            },
            sourceNote: null,
          },
          magnetSystem: "body-hosted",
          weightBasis: "complete-build",
          weightG: "96",
        }),
      );
      expect(slider.includedComponents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: plate.id,
            productTypeSlug: "slider-plate",
          }),
          expect.objectContaining({
            id: insert.id,
            productTypeSlug: "slider-insert",
          }),
        ]),
      );
      expect(plate).toEqual(
        expect.objectContaining({
          lengthMm: "50",
          magnetSystem: null,
          weightBasis: null,
          weightG: "28",
        }),
      );
      await expect(
        service.createProduct({
          actor: admin,
          bodyHostedMagnetSetup: {
            clickCount: 0,
            configuration: null,
            sourceNote: "The maker documents an incomplete layout.",
          },
          finishOptions: [],
          makerId: maker.id,
          materialIds: [material.id],
          name: "Invalid body setup",
          productTypeSlug: "slider",
          slug: "invalid-body-setup",
          specs: { magnetSystem: "body-hosted" },
        }),
      ).rejects.toThrow("Click count must be a positive integer");
      await expect(
        service.createProduct({
          actor: admin,
          bodyHostedMagnetSetup: {
            clickCount: 2,
            configuration: {
              label: "Small",
              sourceLabel: null,
              sourceNotes: null,
              groups: [
                {
                  diameterMm: "6",
                  grade: "N42",
                  key: "center",
                  label: "Center",
                  thicknessMm: "3",
                },
              ],
              slots: [
                {
                  documentedColumn: null,
                  documentedRow: null,
                  groupKey: "missing",
                  half: "half-a",
                  key: "A1",
                  state: "occupied",
                },
              ],
            },
            sourceNote: null,
          },
          finishOptions: [],
          makerId: maker.id,
          materialIds: [material.id],
          name: "Cross configuration reference",
          productTypeSlug: "slider",
          slug: "cross-configuration-reference",
          specs: { magnetSystem: "body-hosted" },
        }),
      ).rejects.toThrow("Magnet group does not belong to this configuration");
      await expect(
        service.deleteProduct({
          actor: admin,
          confirmed: true,
          productId: plate.id,
          reason: "Remove referenced component",
        }),
      ).resolves.toBe(false);
    } finally {
      await client.close();
    }
  }, 30_000);

  it("round-trips insert offers with stable click order and exact slider defaults", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });

    try {
      const migrationsFolder = fileURLToPath(
        new URL("../../../../database/drizzle", import.meta.url),
      );
      for (const file of readdirSync(migrationsFolder)
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        await client.exec(
          readFileSync(join(migrationsFolder, file), "utf8").replaceAll(
            "--> statement-breakpoint",
            "",
          ),
        );
      }
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Insert Maker", slug: "insert-maker" })
        .returning({ id: schema.maker.id });
      await db.insert(schema.productType).values([
        { name: "Slider", slug: "slider" },
        { name: "Slider Insert", slug: "slider-insert" },
      ]);
      const [material] = await db
        .insert(schema.material)
        .values({ name: "Steel", slug: "steel" })
        .returning({ id: schema.material.id });
      await db.insert(schema.user).values({ clerkId: "admin-insert" });
      if (!maker || !material) throw new Error("Insert fixtures failed.");
      const service = createDbServices(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      ).catalog;
      const actor = { clerkId: "admin-insert", role: "admin" as const };
      const configuration = {
        groups: [
          {
            diameterMm: "6.35",
            grade: "n52",
            key: "corners",
            label: "Corners",
            thicknessMm: "3.175",
          },
        ],
        label: "Medium",
        slots: [
          {
            documentedColumn: null,
            documentedRow: null,
            groupKey: "corners",
            half: "half-a" as const,
            key: "A1",
            state: "occupied" as const,
          },
        ],
        sourceLabel: "Maker medium",
        sourceNotes: null,
      };
      const insert = await service.createProduct({
        actor,
        finishOptions: [],
        insertHostedMagnetOptions: {
          clickCounts: [3, 5],
          offers: [
            {
              clickCount: 3,
              configuration,
              isAdvertisedDefault: true,
            },
            {
              clickCount: 5,
              configuration: { ...configuration, label: "Strong" },
              isAdvertisedDefault: false,
            },
          ],
        },
        makerId: maker.id,
        materialIds: [material.id],
        name: "Exact Insert",
        productTypeSlug: "slider-insert",
        slug: "exact-insert",
        specs: {},
      });
      expect(
        insert.insertClickOptions.map(({ clickCount }) => clickCount),
      ).toEqual([3, 5]);
      expect(insert.insertMagnetOffers).toEqual([
        expect.objectContaining({
          clickCount: 3,
          isAdvertisedDefault: true,
          configuration: expect.objectContaining({ label: "Medium" }),
        }),
        expect.objectContaining({
          clickCount: 5,
          isAdvertisedDefault: false,
          configuration: expect.objectContaining({ label: "Strong" }),
        }),
      ]);
      const advertisedOffer = insert.insertMagnetOffers[1];
      if (!advertisedOffer) throw new Error("Offer fixture failed.");
      const slider = await service.createProduct({
        actor,
        advertisedInsertOffers: [
          { isAdvertisedDefault: true, offerId: advertisedOffer.id },
        ],
        finishOptions: [],
        makerId: maker.id,
        materialIds: [material.id],
        name: "Insert Slider",
        productTypeSlug: "slider",
        slug: "insert-slider",
        specs: { magnetSystem: "insert-driven" },
      });
      expect(slider.advertisedInsertOffers).toEqual([
        expect.objectContaining({
          id: advertisedOffer.id,
          insertProductId: insert.id,
          insertProductName: "Exact Insert",
          isSliderAdvertisedDefault: true,
        }),
      ]);
      const updated = await service.updateProduct({
        actor,
        finishOptions: [],
        insertHostedMagnetOptions: {
          clickCounts: [5, 7, 3],
          offers: insert.insertMagnetOffers.map((offer) => ({
            clickCount: offer.clickCount,
            configuration: offer.configuration,
            id: offer.id,
            isAdvertisedDefault: offer.isAdvertisedDefault,
          })),
        },
        makerId: maker.id,
        materialIds: [material.id],
        name: insert.name,
        productId: insert.id,
        productTypeSlug: "slider-insert",
        slug: insert.slug,
        specs: {},
      });
      expect(
        updated.insertClickOptions.map(({ clickCount, insertionPosition }) => ({
          clickCount,
          insertionPosition,
        })),
      ).toEqual([
        { clickCount: 3, insertionPosition: 0 },
        { clickCount: 5, insertionPosition: 1 },
        { clickCount: 7, insertionPosition: 2 },
      ]);
      await expect(
        service.createProduct({
          actor,
          advertisedInsertOffers: [
            { isAdvertisedDefault: false, offerId: advertisedOffer.id },
          ],
          finishOptions: [],
          makerId: maker.id,
          materialIds: [material.id],
          name: "No default",
          productTypeSlug: "slider",
          slug: "no-default",
          specs: { magnetSystem: "insert-driven" },
        }),
      ).rejects.toThrow("requires exactly one advertised default");
    } finally {
      await client.close();
    }
  }, 30_000);

  it("orders canonical meaningful updates without approval or privacy churn", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });

    try {
      const migrationsFolder = fileURLToPath(
        new URL("../../../../database/drizzle", import.meta.url),
      );
      for (const file of readdirSync(migrationsFolder)
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        await client.exec(
          readFileSync(join(migrationsFolder, file), "utf8").replaceAll(
            "--> statement-breakpoint",
            "",
          ),
        );
      }
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Recent Maker", slug: "recent-maker" })
        .returning({ id: schema.maker.id });
      await db
        .insert(schema.productType)
        .values({ name: "Spinner", slug: "spinner" });
      const [material] = await db
        .insert(schema.material)
        .values({ name: "Titanium", slug: "titanium" })
        .returning({ id: schema.material.id });
      await db.insert(schema.user).values({ clerkId: "admin-recent" });
      if (!maker || !material)
        throw new Error("Recent-product fixtures were not created.");

      const service = createDbServices(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      ).catalog;
      const actor = { clerkId: "admin-recent", role: "admin" as const };
      const created = [];
      for (const [name, slug] of [
        ["Beta", "beta"],
        ["Alpha", "alpha-one"],
        ["Alpha", "alpha-two"],
      ] as const) {
        created.push(
          await service.createProduct({
            actor,
            finishOptions: [],
            makerId: maker.id,
            materialIds: [material.id],
            name,
            productTypeSlug: "spinner",
            slug,
            specs: { bearing: "R188" },
          }),
        );
      }
      const [beta, alphaOne, alphaTwo] = created;
      if (!beta || !alphaOne || !alphaTwo)
        throw new Error("Recent products were not created.");
      const baseline = new Date("2026-01-01T00:00:00.000Z");
      const misleadingSubtypeDate = new Date("2030-01-01T00:00:00.000Z");
      await db.update(schema.product).set({ updatedAt: baseline });
      await db
        .update(schema.productSpinner)
        .set({ updatedAt: misleadingSubtypeDate })
        .where(eq(schema.productSpinner.id, beta.id));

      await expect(service.listProducts(undefined, actor)).resolves.toEqual([
        expect.objectContaining({ id: alphaOne.id, updatedAt: baseline }),
        expect.objectContaining({ id: alphaTwo.id, updatedAt: baseline }),
        expect.objectContaining({ id: beta.id, updatedAt: baseline }),
      ]);

      await service.decideProductApproval({
        action: "approve",
        actor,
        productId: beta.id,
        reason: "Ready",
      });
      await service.setVisibility({
        actor,
        isPrivate: true,
        productId: beta.id,
      });
      await service.setVisibility({
        actor,
        isPrivate: false,
        productId: beta.id,
      });
      const [moderated] = await db
        .select({ updatedAt: schema.product.updatedAt })
        .from(schema.product)
        .where(eq(schema.product.id, beta.id));
      expect(moderated?.updatedAt).toEqual(baseline);

      const updated = await service.updateProduct({
        actor,
        finishOptions: [],
        makerId: maker.id,
        materialIds: [material.id],
        name: beta.name,
        productId: beta.id,
        productTypeSlug: "spinner",
        slug: beta.slug,
        specs: { bearing: "One Drop" },
      });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(baseline.getTime());
      expect((await service.listProducts(undefined, actor))[0]?.id).toBe(
        beta.id,
      );

      await db
        .update(schema.product)
        .set({ updatedAt: baseline })
        .where(eq(schema.product.id, beta.id));
      await service.attachImages({
        actor,
        files: [
          {
            contentType: "image/jpeg",
            fileName: "beta.jpg",
            kind: "image",
            objectPath: "images/test/products/beta.jpg",
            position: 0,
            sha256: "a".repeat(64),
            size: 12,
            url: "https://cdn.example/beta.jpg",
          },
        ],
        target: { id: beta.id, type: "product" },
      });
      const [image] = await db
        .select({ id: schema.productImage.id })
        .from(schema.productImage)
        .where(eq(schema.productImage.productId, beta.id));
      const [afterImage] = await db
        .select({ updatedAt: schema.product.updatedAt })
        .from(schema.product)
        .where(eq(schema.product.id, beta.id));
      expect(afterImage?.updatedAt.getTime()).toBeGreaterThan(
        baseline.getTime(),
      );
      if (!image) throw new Error("Product image was not created.");

      await db
        .update(schema.product)
        .set({ updatedAt: baseline })
        .where(eq(schema.product.id, beta.id));
      await service.softDeleteImage({
        actor,
        imageId: image.id,
        targetType: "product",
      });
      const [afterDeletion] = await db
        .select({ updatedAt: schema.product.updatedAt })
        .from(schema.product)
        .where(eq(schema.product.id, beta.id));
      expect(afterDeletion?.updatedAt.getTime()).toBeGreaterThan(
        baseline.getTime(),
      );

      await db
        .update(schema.product)
        .set({ updatedAt: baseline })
        .where(eq(schema.product.id, beta.id));
      await service.restoreImage({
        actor,
        imageId: image.id,
        targetType: "product",
      });
      const [afterRestore] = await db
        .select({ updatedAt: schema.product.updatedAt })
        .from(schema.product)
        .where(eq(schema.product.id, beta.id));
      expect(afterRestore?.updatedAt.getTime()).toBeGreaterThan(
        baseline.getTime(),
      );
    } finally {
      await client.close();
    }
  }, 30_000);
});
