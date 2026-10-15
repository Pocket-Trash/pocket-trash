import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { createTrendsService } from "./index.js";

describe("public Pens and Refills Trends query", () => {
  it("counts distinct compatible Pens and standalone Refills by format", async () => {
    const client = new PGlite();
    const db = drizzle({ client, relations: schema.relations });

    try {
      await migratePGliteDatabase(client);
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Writing Maker", slug: "writing-maker" })
        .returning({ id: schema.maker.id });
      const types = await db
        .select({ id: schema.productType.id, slug: schema.productType.slug })
        .from(schema.productType);
      if (!maker) throw new Error("Pens fixture maker was not created.");
      const penType = types.find(({ slug }) => slug === "pen");
      const refillType = types.find(({ slug }) => slug === "refill");
      const clipType = types.find(({ slug }) => slug === "pen-clip");
      if (!penType || !refillType || !clipType)
        throw new Error("Pens fixture product types were not created.");

      const { parkerGroupId, pilotGroupId } = await db.transaction(
        async (transaction) => {
          const products = await transaction
            .insert(schema.product)
            .values([
              ...["Compatible One", "Compatible Two", "Unknown Format"].map(
                (name, index) => ({
                  approvalStatus: "approved" as const,
                  makerId: maker.id,
                  name,
                  productTypeId: penType.id,
                  slug: `pen-${index + 1}`,
                }),
              ),
              {
                approvalStatus: "approved",
                isPrivate: true,
                makerId: maker.id,
                name: "Private Pen",
                productTypeId: penType.id,
                slug: "private-pen",
              },
              ...["G2 One", "G2 Two", "Parker One"].map((name, index) => ({
                approvalStatus: "approved" as const,
                makerId: maker.id,
                name,
                productTypeId: refillType.id,
                slug: `refill-${index + 1}`,
              })),
              {
                approvalStatus: "approved",
                isPrivate: true,
                makerId: maker.id,
                name: "Private Refill",
                productTypeId: refillType.id,
                slug: "private-refill",
              },
              {
                approvalStatus: "approved",
                makerId: maker.id,
                name: "Clip",
                productTypeId: clipType.id,
                slug: "clip",
              },
            ])
            .returning({ id: schema.product.id, slug: schema.product.slug });
          /**
           * Resolves one fixture product slug.
           *
           * @param slug - Stable fixture slug.
           * @returns Matching product identifier.
           * @throws When the fixture product is missing.
           */
          const productId = (slug: string) => {
            const product = products.find(
              (candidate) => candidate.slug === slug,
            );
            if (!product)
              throw new Error(`Missing Pens fixture product ${slug}.`);
            return product.id;
          };
          const penIds = ["pen-1", "pen-2", "pen-3", "private-pen"].map(
            productId,
          );
          await transaction
            .insert(schema.productDetailPen)
            .values(penIds.map((id) => ({ id })));
          const refillIds = [
            "refill-1",
            "refill-2",
            "refill-3",
            "private-refill",
          ].map(productId);
          await transaction.insert(schema.productDetailRefill).values(
            refillIds.map((id, index) => ({
              id,
              makerId: maker.id,
              model: `Refill ${index + 1}`,
              normalizedModel: `refill ${index + 1}`,
            })),
          );
          await transaction
            .insert(schema.productDetailPenPart)
            .values({ id: productId("clip") });
          await transaction
            .insert(schema.productDetailPenClip)
            .values({ id: productId("clip") });

          const concepts = await transaction
            .select({
              id: schema.catalogTerminologyConcept.id,
              key: schema.catalogTerminologyConcept.key,
            })
            .from(schema.catalogTerminologyConcept)
            .where(
              inArray(schema.catalogTerminologyConcept.key, [
                "pilot-g2",
                "parker-g2",
              ]),
            );
          const conceptKeyById = new Map(
            concepts.map(({ id, key }) => [id, key]),
          );
          const groups = await transaction
            .insert(schema.refillCompatibilityGroup)
            .values(concepts.map(({ id }) => ({ conceptId: id })))
            .returning({
              conceptId: schema.refillCompatibilityGroup.conceptId,
              id: schema.refillCompatibilityGroup.id,
            });
          /**
           * Resolves the seeded terminology key for a compatibility concept.
           *
           * @param conceptId - Seeded terminology concept identifier.
           * @returns Stable concept key, when present.
           */
          const groupKey = (conceptId: number) => conceptKeyById.get(conceptId);
          const pilotGroup = groups.find(
            ({ conceptId }) => groupKey(conceptId) === "pilot-g2",
          );
          const parkerGroup = groups.find(
            ({ conceptId }) => groupKey(conceptId) === "parker-g2",
          );
          if (!pilotGroup || !parkerGroup)
            throw new Error(
              "Pens fixture compatibility groups were not created.",
            );
          await transaction
            .insert(schema.refillCompatibilityGroupMembership)
            .values([
              {
                groupId: pilotGroup.id,
                refillProductId: productId("refill-1"),
              },
              {
                groupId: pilotGroup.id,
                refillProductId: productId("refill-2"),
              },
              {
                groupId: pilotGroup.id,
                refillProductId: productId("private-refill"),
              },
              {
                groupId: parkerGroup.id,
                refillProductId: productId("refill-3"),
              },
            ]);
          await transaction.insert(schema.refillCompatibilityAssertion).values([
            { penProductId: productId("pen-1"), targetGroupId: pilotGroup.id },
            {
              penProductId: productId("pen-1"),
              targetRefillProductId: productId("refill-1"),
            },
            { penProductId: productId("pen-2"), targetGroupId: pilotGroup.id },
            {
              penProductId: productId("pen-1"),
              targetRefillProductId: productId("refill-3"),
            },
            {
              penProductId: productId("private-pen"),
              targetGroupId: pilotGroup.id,
            },
          ]);
          return {
            parkerGroupId: parkerGroup.id,
            pilotGroupId: pilotGroup.id,
          };
        },
      );

      const trends = await createTrendsService(
        db as unknown as Database,
      ).getPublicPenRefillTrends();

      expect(trends).toEqual({
        penCoveragePercent: 66.7,
        penProductTypeId: penType.id,
        refillProductTypeId: refillType.id,
        values: [
          {
            compatiblePenCount: 2,
            key: String(pilotGroupId),
            label: "Pilot G2",
            standaloneRefillCount: 2,
          },
          {
            compatiblePenCount: 1,
            key: String(parkerGroupId),
            label: "Parker-style G2",
            standaloneRefillCount: 1,
          },
        ],
      });
    } finally {
      await client.close();
    }
  }, 30_000);
});

/**
 * Applies the production migration chain to an isolated in-memory database.
 *
 * @param client - Empty PGlite client.
 * @returns Completion after every migration is applied.
 */
async function migratePGliteDatabase(client: PGlite): Promise<void> {
  const migrationsFolder = fileURLToPath(
    new URL("../../../../database/drizzle", import.meta.url),
  );
  await migratePglite(drizzle({ client }), { migrationsFolder });
}
