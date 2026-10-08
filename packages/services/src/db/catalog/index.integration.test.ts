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
        specs: {},
      });
      const insert = await service.createProduct({
        actor: admin,
        finishOptions: [],
        makerId: maker.id,
        materialIds: [material.id],
        name: "Cassette Insert",
        productTypeSlug: "slider-insert",
        slug: "cassette-insert",
        specs: {},
      });
      const slider = await service.createProduct({
        actor: admin,
        finishOptions: [],
        includedInsertProductId: insert.id,
        includedPlateProductId: plate.id,
        makerId: maker.id,
        materialIds: [material.id],
        name: "Rail Slider",
        productTypeSlug: "slider",
        slug: "rail-slider",
        specs: {
          lengthMm: "52",
          thicknessMm: "12",
          usesInserts: true,
          weightBasis: "complete-build",
          weightG: "96",
          widthMm: "24",
        },
      });

      expect(slider).toEqual(
        expect.objectContaining({
          clickCount: null,
          magnetLayout: null,
          usesInserts: true,
          weightBasis: "complete-build",
          weightG: "96",
        }),
      );
      expect(slider.includedPlate).toEqual(
        expect.objectContaining({
          id: plate.id,
          productTypeSlug: "slider-plate",
        }),
      );
      expect(slider.includedInsert).toEqual(
        expect.objectContaining({
          id: insert.id,
          productTypeSlug: "slider-insert",
        }),
      );
      expect(plate).toEqual(
        expect.objectContaining({
          lengthMm: null,
          usesInserts: null,
          weightBasis: null,
          weightG: null,
        }),
      );
      const bodySlider = await service.createProduct({
        actor: admin,
        finishOptions: [],
        magnetLayout: "2x2",
        makerId: maker.id,
        materialIds: [material.id],
        name: "Body Slider",
        productTypeSlug: "slider",
        slug: "body-slider",
        specs: { usesInserts: false },
      });
      expect(bodySlider).toMatchObject({ clickCount: 1, magnetLayout: "2x2" });
      await expect(
        service.createProduct({
          actor: admin,
          finishOptions: [],
          includedInsertProductId: insert.id,
          magnetLayout: "2x3",
          makerId: maker.id,
          materialIds: [material.id],
          name: "Duplicate Insert Layout",
          productTypeSlug: "slider",
          slug: "duplicate-insert-layout",
          specs: { usesInserts: true },
        }),
      ).rejects.toThrow("exact included insert owns the magnet layout");
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
