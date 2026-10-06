import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createLogger } from "@package/logger";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import { createDbServices } from "../index.js";

describe("catalog product persistence", () => {
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
      if (!maker || !productType || !finish || !material) {
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
});
