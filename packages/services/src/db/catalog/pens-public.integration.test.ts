import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createLogger } from "@package/logger";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { createDbServices } from "../index.js";

describe("public Pens catalog reads", () => {
  it("authors evidence-backed offerings, configuration rules, and compatibility", async () => {
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
        .values({ name: "Pens Author Maker", slug: "pens-author-maker" })
        .returning({ id: schema.maker.id });
      const [material] = await db
        .insert(schema.material)
        .values({ name: "Pens Author Metal", slug: "pens-author-metal" })
        .returning({ id: schema.material.id });
      const types = await db
        .select({ id: schema.productType.id, slug: schema.productType.slug })
        .from(schema.productType)
        .where(inArray(schema.productType.slug, ["pen", "pen-tip", "refill"]));
      const [tipRole] = await db
        .select({ id: schema.catalogTerminologyConcept.id })
        .from(schema.catalogTerminologyConcept)
        .where(
          and(
            eq(schema.catalogTerminologyConcept.namespace, "pen-part-role"),
            eq(schema.catalogTerminologyConcept.key, "tip"),
          ),
        );
      if (!maker || !material || !tipRole || types.length !== 3)
        throw new Error("Pens authoring fixtures were not created.");
      /**
       * Resolves a seeded product type identifier.
       *
       * @param slug - Canonical product type slug.
       * @returns Seeded product type identifier.
       * @throws When the requested product type fixture is absent.
       */
      const typeId = (slug: string) => {
        const row = types.find((type) => type.slug === slug);
        if (!row) throw new Error(`Missing product type ${slug}.`);
        return row.id;
      };
      const { penId, refillId, tipId } = await db.transaction(
        async (transaction) => {
          const products = await transaction
            .insert(schema.product)
            .values([
              {
                makerId: maker.id,
                name: "Author Pen",
                productTypeId: typeId("pen"),
                slug: "author-pen",
              },
              {
                makerId: maker.id,
                name: "Author Tip",
                productTypeId: typeId("pen-tip"),
                slug: "author-tip",
              },
              {
                makerId: maker.id,
                name: "Author Refill",
                productTypeId: typeId("refill"),
                slug: "author-refill",
              },
            ])
            .returning({ id: schema.product.id, slug: schema.product.slug });
          /**
           * Resolves an authored product identifier.
           *
           * @param slug - Authored product slug.
           * @returns Authored product identifier.
           * @throws When the requested product fixture is absent.
           */
          const productId = (slug: string) => {
            const row = products.find((product) => product.slug === slug);
            if (!row) throw new Error(`Missing authored product ${slug}.`);
            return row.id;
          };
          const penId = productId("author-pen");
          const tipId = productId("author-tip");
          const refillId = productId("author-refill");
          await transaction
            .insert(schema.productDetailPen)
            .values({ id: penId });
          await transaction
            .insert(schema.productDetailPenPart)
            .values({ id: tipId });
          await transaction
            .insert(schema.productDetailPenTip)
            .values({ id: tipId });
          await transaction.insert(schema.penPartRoleAssignment).values({
            conceptId: tipRole.id,
            partProductId: tipId,
          });
          await transaction.insert(schema.productDetailRefill).values({
            id: refillId,
            makerId: maker.id,
            model: "AUTHOR-RF",
            normalizedModel: "author-rf",
          });
          return { penId, refillId, tipId };
        },
      );
      const [productMaterial] = await db
        .insert(schema.productMaterial)
        .values({ materialId: material.id, productId: penId })
        .returning({ id: schema.productMaterial.id });
      const slotKinds = await db
        .select({
          id: schema.configurationSlotKind.id,
          slug: schema.configurationSlotKind.slug,
        })
        .from(schema.configurationSlotKind)
        .where(inArray(schema.configurationSlotKind.slug, ["material", "tip"]));
      const [tipStyle] = await db
        .insert(schema.refillTipStyle)
        .values({ name: "Author Needle", slug: "author-needle" })
        .returning({ id: schema.refillTipStyle.id });
      const [inkColor] = await db
        .insert(schema.refillInkColor)
        .values({ name: "Author Blue", slug: "author-blue" })
        .returning({ id: schema.refillInkColor.id });
      await db.insert(schema.user).values({ clerkId: "pens-author" });
      if (!productMaterial || !tipStyle || !inkColor)
        throw new Error("Pens authoring lookups were not created.");
      const service = createDbServices(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      ).catalog;
      const actor = { clerkId: "pens-author", role: "admin" as const };
      /**
       * Resolves a seeded configuration slot kind identifier.
       *
       * @param slug - Canonical slot kind slug.
       * @returns Seeded slot kind identifier.
       * @throws When the requested slot kind fixture is absent.
       */
      const slotKindId = (slug: string) => {
        const row = slotKinds.find((kind) => kind.slug === slug);
        if (!row) throw new Error(`Missing slot kind ${slug}.`);
        return row.id;
      };

      const materialSlot = await service.authorPensCatalog({
        actor,
        kind: "configuration-slot",
        productId: penId,
        required: false,
        slotKindId: slotKindId("material"),
      });
      const materialChoice = await service.authorPensCatalog({
        actor,
        kind: "configuration-choice",
        productId: penId,
        productMaterialId: productMaterial.id,
        slotId: materialSlot.id,
      });
      await service.authorPensCatalog({
        actor,
        kind: "configuration-slot-required",
        productId: penId,
        required: true,
        slotId: materialSlot.id,
      });
      const tipSlot = await service.authorPensCatalog({
        actor,
        kind: "configuration-slot",
        productId: penId,
        required: false,
        slotKindId: slotKindId("tip"),
      });
      const tipChoice = await service.authorPensCatalog({
        actor,
        kind: "configuration-choice",
        partProductId: tipId,
        productId: penId,
        slotId: tipSlot.id,
      });
      await expect(
        service.authorPensCatalog({
          actor,
          kind: "configuration-rule",
          productId: penId,
          requiredChoiceIds: [tipChoice.id],
          targetChoiceId: materialChoice.id,
        }),
      ).rejects.toThrow("only earlier choices");
      await expect(
        service.authorPensCatalog({
          actor,
          kind: "configuration-rule",
          productId: penId,
          requiredChoiceIds: [materialChoice.id],
          targetChoiceId: tipChoice.id,
        }),
      ).resolves.toMatchObject({ id: expect.any(Number) });

      const sourceEvidence = await service.authorPensCatalog({
        actor,
        captureDate: "2026-10-10",
        claim: "The maker lists this refill offering.",
        kind: "source-evidence",
        originalUrl: "https://example.com/refill",
        publisher: "Pens Author Maker",
        sourceKind: "maker-catalog",
      });
      await expect(
        service.authorPensCatalog({
          actor,
          approved: true,
          evidence: [],
          inkColorId: inkColor.id,
          kind: "refill-offering",
          refillProductId: refillId,
          tipSize: "0.5 mm",
          tipStyleId: tipStyle.id,
        }),
      ).rejects.toThrow("supporting evidence");
      const offering = await service.authorPensCatalog({
        actor,
        approved: true,
        evidence: [{ evidenceId: sourceEvidence.id, stance: "supports" }],
        inkColorId: inkColor.id,
        kind: "refill-offering",
        refillProductId: refillId,
        tipSize: "0.5 mm",
        tipStyleId: tipStyle.id,
      });
      const compatibilityEvidence = await service.authorPensCatalog({
        actor,
        evidenceKind: "physical-fit-test",
        kind: "compatibility-evidence",
        penProductId: penId,
        procedure: "Install the refill and actuate the pen three times.",
        refillProductId: refillId,
        result: "Fits and writes.",
        summary: "Physical fit confirmed.",
        testDate: "2026-10-10",
      });
      await expect(
        service.authorPensCatalog({
          actor,
          approved: true,
          evidence: [
            { evidenceId: compatibilityEvidence.id, stance: "supports" },
          ],
          kind: "compatibility-assertion",
          outcome: "compatible",
          penProductId: penId,
          targetRefillProductId: refillId,
        }),
      ).resolves.toMatchObject({ id: expect.any(Number) });
      await expect(
        db
          .select({ id: schema.refillOffering.id })
          .from(schema.refillOffering)
          .where(eq(schema.refillOffering.id, offering.id)),
      ).resolves.toHaveLength(1);
    } finally {
      await client.close();
    }
  }, 30_000);

  it("creates and updates typed refill and mechanism products", async () => {
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
        .values({ name: "Pens Admin Maker", slug: "pens-admin-maker" })
        .returning({ id: schema.maker.id });
      const [material] = await db
        .insert(schema.material)
        .values({ name: "Pens Admin Titanium", slug: "pens-admin-titanium" })
        .returning({ id: schema.material.id });
      const [mechanism] = await db
        .select({ id: schema.mechanism.id })
        .from(schema.mechanism)
        .where(eq(schema.mechanism.slug, "click"));
      await db.insert(schema.user).values({ clerkId: "pens-admin" });
      if (!maker || !material || !mechanism)
        throw new Error("Pens admin fixtures were not created.");
      const service = createDbServices(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      ).catalog;
      const actor = { clerkId: "pens-admin", role: "admin" as const };

      const refill = await service.createProduct({
        actor,
        aliases: ["Precise V5 RT"],
        finishOptions: [],
        makerId: maker.id,
        materialAssignments: [],
        name: "BXS-V5RT",
        productTypeSlug: "refill",
        refillModel: "BXS-V5RT",
        slug: "bxs-v5rt",
        specs: {},
      });
      await expect(
        service.createProduct({
          actor,
          finishOptions: [],
          makerId: maker.id,
          materialAssignments: [
            { materialId: material.id, materialSpecificId: null },
          ],
          name: "Click Mechanism",
          productTypeSlug: "pen-mechanism",
          slug: "click-mechanism",
          specs: {},
        }),
      ).rejects.toThrow("A Pen mechanism type is required.");
      await expect(
        service.createProduct({
          actor,
          finishOptions: [],
          makerId: maker.id,
          materialAssignments: [
            { materialId: material.id, materialSpecificId: null },
          ],
          mechanismId: mechanism.id,
          name: "Click Mechanism",
          productTypeSlug: "pen-mechanism",
          slug: "click-mechanism",
          specs: {},
        }),
      ).resolves.toMatchObject({ productTypeSlug: "pen-mechanism" });
      await expect(
        service.updateProduct({
          actor,
          aliases: ["Pilot Precise V5"],
          finishOptions: [],
          makerId: maker.id,
          materialAssignments: [],
          name: "BXS-V5RT",
          productId: refill.id,
          productTypeSlug: "refill",
          refillModel: "PV5RRBLU",
          slug: "bxs-v5rt",
          specs: {},
        }),
      ).resolves.toMatchObject({
        aliases: ["Pilot Precise V5"],
        refillModel: "PV5RRBLU",
      });
    } finally {
      await client.close();
    }
  }, 30_000);

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
