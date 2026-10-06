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
      await expect(service.getProduct("spinner", "spinner")).resolves.toEqual(
        expect.objectContaining({ approvalStatus: "approved", id: created.id }),
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
    } finally {
      await client.close();
    }
  }, 30_000);
});
