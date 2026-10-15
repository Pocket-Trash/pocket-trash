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
  it("loads direct compatible parts, offerings, and refill compatibility", async () => {
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
        .values({ productId: penId })
        .returning({ id: schema.productMaterial.id });
      if (!productMaterial) throw new Error("Product material missing.");
      await db.insert(schema.productMaterialComponent).values({
        materialId: material.id,
        productMaterialId: productMaterial.id,
      });
      await db.insert(schema.penCompatiblePart).values({
        partProductId: tipId,
        penProductId: penId,
      });
      const [tipStyle] = await db
        .insert(schema.refillTipStyle)
        .values({ name: "Author Needle", slug: "author-needle" })
        .returning({ id: schema.refillTipStyle.id });
      const [inkColor] = await db
        .insert(schema.refillInkColor)
        .values({ name: "Author Blue", slug: "author-blue" })
        .returning({ id: schema.refillInkColor.id });
      const [groupConcept] = await db
        .select({ id: schema.catalogTerminologyConcept.id })
        .from(schema.catalogTerminologyConcept)
        .where(
          and(
            eq(
              schema.catalogTerminologyConcept.namespace,
              "refill-compatibility-group",
            ),
            eq(schema.catalogTerminologyConcept.key, "energel"),
          ),
        );
      await db.insert(schema.user).values({ clerkId: "pens-author" });
      if (!productMaterial || !tipStyle || !inkColor || !groupConcept)
        throw new Error("Pens authoring lookups were not created.");
      const service = createDbServices(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      ).catalog;
      const actor = { clerkId: "pens-author", role: "admin" as const };
      const [pen] = await service.listProducts("pen", actor);
      expect(pen).toMatchObject({
        compatibleParts: [
          {
            id: tipId,
            name: "Author Tip",
            productTypeSlug: "pen-tip",
            slug: "author-tip",
          },
        ],
        materials: [
          expect.objectContaining({ assignmentId: productMaterial.id }),
        ],
      });

      const offering = await service.authorPensCatalog({
        actor,
        inkColorId: inkColor.id,
        kind: "refill-offering",
        refillProductId: refillId,
        tipSize: "0.5 mm",
        tipStyleId: tipStyle.id,
      });
      const group = await service.authorPensCatalog({
        actor,
        conceptId: groupConcept.id,
        kind: "compatibility-group",
      });
      const membership = await service.authorPensCatalog({
        actor,
        groupId: group.id,
        kind: "compatibility-membership",
        refillProductId: refillId,
      });
      await service.updateProduct({
        actor,
        aliases: [],
        finishOptions: [],
        makerId: maker.id,
        materialAssignments: [
          { materialId: material.id, materialSpecificId: null },
        ],
        name: "Author Pen",
        productId: penId,
        productTypeSlug: "pen",
        reason: "Add refill compatibility",
        refillCompatibility: [
          { targetGroupId: null, targetRefillProductId: refillId },
          { targetGroupId: group.id, targetRefillProductId: null },
        ],
        slug: "author-pen",
        specs: {},
      });
      const authoredOptions = await service.listPensAdminOptions(actor);
      expect(authoredOptions.compatibilityAssertions).toContainEqual(
        expect.objectContaining({
          targetGroupId: group.id,
        }),
      );
      expect(authoredOptions.compatibilityMemberships).toContainEqual(
        expect.objectContaining({ id: membership.id, groupId: group.id }),
      );
      await service.updateProduct({
        actor,
        aliases: [],
        finishOptions: [],
        makerId: maker.id,
        materialAssignments: [
          { materialId: material.id, materialSpecificId: null },
        ],
        name: "Author Pen",
        productId: penId,
        productTypeSlug: "pen",
        reason: "Clear refill compatibility",
        refillCompatibility: [],
        slug: "author-pen",
        specs: {},
      });
      await service.authorPensCatalog({
        actor,
        kind: "compatibility-membership-remove",
        membershipId: membership.id,
        refillProductId: refillId,
      });
      const removedOptions = await service.listPensAdminOptions(actor);
      expect(removedOptions.compatibilityAssertions).toEqual([]);
      expect(removedOptions.compatibilityMemberships).toEqual([]);
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
            {
              materials: [
                { materialId: material.id, materialSpecificId: null },
              ],
            },
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
            {
              materials: [
                { materialId: material.id, materialSpecificId: null },
              ],
            },
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

      const tip = await service.createProduct({
        actor,
        finishOptions: [],
        makerId: maker.id,
        materialAssignments: [
          { materialId: material.id, materialSpecificId: null },
        ],
        name: "Compatible Tip",
        productTypeSlug: "pen-tip",
        slug: "compatible-tip",
        specs: {},
      });
      const pen = await service.createProduct({
        actor,
        compatiblePartProductIds: [tip.id],
        finishOptions: [],
        makerId: maker.id,
        materialAssignments: [
          { materialId: material.id, materialSpecificId: null },
        ],
        name: "Compatible Pen",
        productTypeSlug: "pen",
        slug: "compatible-pen",
        specs: {},
      });
      expect(pen.compatibleParts).toEqual([
        expect.objectContaining({ id: tip.id, productTypeSlug: "pen-tip" }),
      ]);
      await expect(
        service.updateProduct({
          actor,
          compatiblePartProductIds: [],
          finishOptions: [],
          makerId: maker.id,
          materialAssignments: [
            { materialId: material.id, materialSpecificId: null },
          ],
          name: pen.name,
          productId: pen.id,
          productTypeSlug: "pen",
          slug: pen.slug,
          specs: {},
        }),
      ).resolves.toMatchObject({ compatibleParts: [] });
      await expect(
        service.updateProduct({
          actor,
          compatiblePartProductIds: [refill.id],
          finishOptions: [],
          makerId: maker.id,
          materialAssignments: [
            { materialId: material.id, materialSpecificId: null },
          ],
          name: pen.name,
          productId: pen.id,
          productTypeSlug: "pen",
          slug: pen.slug,
          specs: {},
        }),
      ).rejects.toThrow("Compatible parts must be visible Pen-part products.");
    } finally {
      await client.close();
    }
  }, 30_000);

  it("resolves exact and group compatibility while absence stays unknown", async () => {
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
      const [tipType] = await db
        .select({ id: schema.productType.id })
        .from(schema.productType)
        .where(eq(schema.productType.slug, "pen-tip"));
      const [groupConcept] = await db
        .select({ id: schema.catalogTerminologyConcept.id })
        .from(schema.catalogTerminologyConcept)
        .where(
          and(
            eq(
              schema.catalogTerminologyConcept.namespace,
              "refill-compatibility-group",
            ),
            eq(schema.catalogTerminologyConcept.key, "energel"),
          ),
        );
      if (!maker || !penType || !refillType || !tipType || !groupConcept)
        throw new Error("Pens catalog fixtures were not created.");

      await db.transaction(async (transaction) => {
        const products = await transaction
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
            {
              approvalStatus: "approved",
              makerId: maker.id,
              name: "Grouped Refill",
              productTypeId: refillType.id,
              slug: "grouped-refill",
            },
            {
              approvalStatus: "approved",
              makerId: maker.id,
              name: "Unknown Refill",
              productTypeId: refillType.id,
              slug: "unknown-refill",
            },
            {
              approvalStatus: "approved",
              makerId: maker.id,
              name: "Needle Tip",
              productTypeId: tipType.id,
              slug: "needle-tip",
            },
          ])
          .returning({ id: schema.product.id, slug: schema.product.slug });
        /**
         * Resolves one product created by this compatibility fixture.
         *
         * @param slug - Product slug to resolve.
         * @returns Created product identifier.
         * @throws When the fixture product is absent.
         */
        const productId = (slug: string) => {
          const product = products.find((candidate) => candidate.slug === slug);
          if (!product) throw new Error(`Missing Pens product ${slug}.`);
          return product.id;
        };
        const penId = productId("compatible-pen");
        const refillId = productId("bxs-v5rt");
        const groupedRefillId = productId("grouped-refill");
        const unknownRefillId = productId("unknown-refill");
        const tipId = productId("needle-tip");

        await transaction.insert(schema.productDetailPen).values({ id: penId });
        await transaction
          .insert(schema.productDetailPenPart)
          .values({ id: tipId });
        await transaction
          .insert(schema.productDetailPenTip)
          .values({ id: tipId });
        await transaction.insert(schema.productDetailRefill).values([
          {
            id: refillId,
            makerId: maker.id,
            model: "BXS-V5RT",
            normalizedModel: "bxs-v5rt",
          },
          {
            id: groupedRefillId,
            makerId: maker.id,
            model: "GROUPED-RF",
            normalizedModel: "grouped-rf",
          },
          {
            id: unknownRefillId,
            makerId: maker.id,
            model: "UNKNOWN-RF",
            normalizedModel: "unknown-rf",
          },
        ]);
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
        if (!tipStyle || !inkColor)
          throw new Error("Refill offering fixtures were not created.");
        const [offering] = await transaction
          .insert(schema.refillOffering)
          .values({
            inkColorId: inkColor.id,
            normalizedTipSize: "0.5 mm",
            refillProductId: refillId,
            tipSize: "0.5 mm",
            tipStyleId: tipStyle.id,
          })
          .returning({ id: schema.refillOffering.id });
        if (!offering) throw new Error("Refill offering was not created.");
        const [assertion] = await transaction
          .insert(schema.refillCompatibilityAssertion)
          .values({
            penProductId: penId,
            targetRefillProductId: refillId,
          })
          .returning({ id: schema.refillCompatibilityAssertion.id });
        if (!assertion)
          throw new Error("Compatibility assertion was not created.");
        const [group] = await transaction
          .insert(schema.refillCompatibilityGroup)
          .values({ conceptId: groupConcept.id })
          .returning({ id: schema.refillCompatibilityGroup.id });
        if (!group) throw new Error("Compatibility group was not created.");
        await transaction
          .insert(schema.refillCompatibilityGroupMembership)
          .values({
            groupId: group.id,
            refillProductId: groupedRefillId,
          });
        await transaction.insert(schema.refillCompatibilityAssertion).values({
          penProductId: penId,
          targetGroupId: group.id,
        });
      });

      const service = createDbServices(
        db as unknown as Database,
        createLogger({ app: "api", environment: "test" }),
      ).catalog;
      const refills = await service.listProducts("refill");
      const refill = refills.find(({ slug }) => slug === "bxs-v5rt");
      const groupedRefill = refills.find(
        ({ slug }) => slug === "grouped-refill",
      );
      const unknownRefill = refills.find(
        ({ slug }) => slug === "unknown-refill",
      );

      expect(refill).toMatchObject({
        aliases: ["Pilot Precise V5 RT"],
        compatiblePens: [
          {
            name: "Compatible Pen",
            slug: "compatible-pen",
          },
        ],
        name: "BXS-V5RT",
        refillModel: "BXS-V5RT",
        refillOfferings: [
          { inkColor: "Blue", tipSize: "0.5 mm", tipStyle: "Needle" },
        ],
      });
      expect(groupedRefill?.compatiblePens).toEqual([
        expect.objectContaining({
          name: "Compatible Pen",
          slug: "compatible-pen",
        }),
      ]);
      expect(unknownRefill?.compatiblePens).toEqual([]);
    } finally {
      await client.close();
    }
  }, 30_000);
});
