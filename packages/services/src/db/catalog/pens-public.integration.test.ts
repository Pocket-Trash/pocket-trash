import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createLogger } from "@package/logger";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { createDbServices } from "../index.js";

describe("public Pens catalog reads", () => {
  it("returns approved refill offerings, aliases, and compatible Pens", async () => {
    const client = new PGlite();
    const db = drizzle({ client, relations: schema.relations });

    try {
      await migrate(drizzle({ client }), {
        migrationsFolder: fileURLToPath(
          new URL("../../../../database/drizzle", import.meta.url),
        ),
      });
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Pens Test Maker", slug: "pens-test-maker" })
        .returning({ id: schema.maker.id });
      const [penType] = await db
        .select({ id: schema.productType.id })
        .from(schema.productType)
        .where(eq(schema.productType.slug, "pen"));
      const [refillType] = await db
        .select({ id: schema.productType.id })
        .from(schema.productType)
        .where(eq(schema.productType.slug, "refill"));
      if (!maker || !penType || !refillType)
        throw new Error("Pens catalog fixtures were not created.");

      await db.transaction(async (transaction) => {
        const [pen, refill] = await transaction
          .insert(schema.product)
          .values([
            {
              approvalStatus: "approved",
              makerId: maker.id,
              name: "Compatible Pen",
              productTypeId: penType.id,
              slug: "compatible-pen",
            },
            {
              approvalStatus: "approved",
              makerId: maker.id,
              name: "BXS-V5RT",
              productTypeId: refillType.id,
              slug: "bxs-v5rt",
            },
          ])
          .returning({ id: schema.product.id, slug: schema.product.slug });
        if (!pen || !refill) throw new Error("Pens products were not created.");
        const penId = pen.slug === "compatible-pen" ? pen.id : refill.id;
        const refillId = refill.slug === "bxs-v5rt" ? refill.id : pen.id;

        await transaction.insert(schema.productDetailPen).values({ id: penId });
        await transaction.insert(schema.productDetailRefill).values({
          id: refillId,
          makerId: maker.id,
          model: "BXS-V5RT",
          normalizedModel: "bxs-v5rt",
        });
        await transaction.insert(schema.productAlias).values({
          label: "Pilot Precise V5 RT",
          normalizedValue: "pilot precise v5 rt",
          productId: refillId,
        });
        const [tipStyle] = await transaction
          .insert(schema.refillTipStyle)
          .values({ name: "Needle", slug: "needle" })
          .returning({ id: schema.refillTipStyle.id });
        const [inkColor] = await transaction
          .insert(schema.refillInkColor)
          .values({ name: "Blue", slug: "blue" })
          .returning({ id: schema.refillInkColor.id });
        const [sourceEvidence] = await transaction
          .insert(schema.catalogSourceEvidence)
          .values({
            captureDate: "2026-10-10",
            claim: "The refill is sold in 0.5 mm blue.",
            originalUrl: "https://example.com/refill",
            publisher: "Pens Test Maker",
            sourceKind: "manufacturer-catalog",
          })
          .returning({ id: schema.catalogSourceEvidence.id });
        if (!tipStyle || !inkColor || !sourceEvidence)
          throw new Error("Refill offering fixtures were not created.");
        const [offering] = await transaction
          .insert(schema.refillOffering)
          .values({
            approvedAt: new Date("2026-10-10"),
            inkColorId: inkColor.id,
            normalizedTipSize: "0.5 mm",
            refillProductId: refillId,
            tipSize: "0.5 mm",
            tipStyleId: tipStyle.id,
          })
          .returning({ id: schema.refillOffering.id });
        if (!offering) throw new Error("Refill offering was not created.");
        await transaction.insert(schema.refillOfferingEvidence).values({
          evidenceId: sourceEvidence.id,
          offeringId: offering.id,
          stance: "supports",
        });

        const [compatibilityEvidence] = await transaction
          .insert(schema.refillCompatibilityEvidence)
          .values({
            kind: "physical-fit-test",
            penProductId: penId,
            procedure: "Installed the refill and operated the pen.",
            refillProductId: refillId,
            result: "Fits and writes.",
            summary: "The refill fits the pen.",
            testDate: "2026-10-10",
          })
          .returning({ id: schema.refillCompatibilityEvidence.id });
        if (!compatibilityEvidence)
          throw new Error("Compatibility evidence was not created.");
        const [assertion] = await transaction
          .insert(schema.refillCompatibilityAssertion)
          .values({
            approvedAt: new Date("2026-10-10"),
            outcome: "compatible",
            penProductId: penId,
            targetRefillProductId: refillId,
          })
          .returning({ id: schema.refillCompatibilityAssertion.id });
        if (!assertion)
          throw new Error("Compatibility assertion was not created.");
        await transaction
          .insert(schema.refillCompatibilityAssertionEvidence)
          .values({
            assertionId: assertion.id,
            evidenceId: compatibilityEvidence.id,
            stance: "supports",
          });
      });

      const service = createDbServices(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      ).catalog;
      const [refill] = await service.listProducts("refill");

      expect(refill).toMatchObject({
        aliases: ["Pilot Precise V5 RT"],
        compatiblePens: [
          {
            name: "Compatible Pen",
            outcome: "compatible",
            requiredTipName: null,
            slug: "compatible-pen",
          },
        ],
        name: "BXS-V5RT",
        refillModel: "BXS-V5RT",
        refillOfferings: [
          { inkColor: "Blue", tipSize: "0.5 mm", tipStyle: "Needle" },
        ],
      });
    } finally {
      await client.close();
    }
  }, 30_000);
});
