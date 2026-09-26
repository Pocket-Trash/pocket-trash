import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createLogger } from "@package/logger";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import { createCatalogService } from "./index.js";

describe("catalog product persistence", () => {
  it("round-trips source details through create and edit", async () => {
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
        .values({ name: "Maker" })
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

      const service = createCatalogService(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      );
      const created = await service.createProduct({
        actorClerkId: "user-test",
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
          bearing: "R188",
          description: "Created description",
          makerProductUrl: "https://maker.example/spinner",
          makerProductUrlValid: true,
          spinDiameterMm: "52",
        }),
      );

      await service.setMakerProductUrlValidity({
        makerProductUrlValid: false,
        productId: created.id,
      });
      const updated = await service.updateProduct({
        actorClerkId: "user-test",
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
    } finally {
      await client.close();
    }
  }, 30_000);
});
