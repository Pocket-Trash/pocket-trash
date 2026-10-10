import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "@package/database";
import { schema } from "@package/database";
import { createNoopLogger } from "@package/logger";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { createDbServices } from "../index.js";

/** Serializable Pen product types exercised by the collection flow. */
const penProductTypes = [
  "pen",
  "pen-actuator",
  "pen-clip",
  "pen-mechanism",
  "pen-tip",
  "pen-top-cap",
] as const;

describe("owned Pens and Pen parts", () => {
  it("persists serials, physical configuration, refills, offerings, and images", async () => {
    const client = new PGlite();
    const db = drizzle({
      client,
      relations: schema.relations,
    }) as unknown as Database;
    try {
      await migrate(drizzle({ client }), {
        migrationsFolder: fileURLToPath(
          new URL("../../../../database/drizzle", import.meta.url),
        ),
      });
      const [owner] = await db
        .insert(schema.user)
        .values({ clerkId: "pens-owner", username: "Pens owner" })
        .returning();
      const [maker] = await db
        .insert(schema.maker)
        .values({ name: "Pens maker", slug: "pens-maker" })
        .returning();
      const [material] = await db
        .insert(schema.material)
        .values({ name: "Titanium", slug: "titanium" })
        .returning();
      const [mechanism] = await db
        .insert(schema.mechanism)
        .values({ name: "Click", slug: "owned-click" })
        .returning();
      if (!owner || !maker || !material || !mechanism)
        throw new Error("Fixtures missing.");
      const productTypes = await db
        .select({ id: schema.productType.id, slug: schema.productType.slug })
        .from(schema.productType)
        .where(
          inArray(schema.productType.slug, [...penProductTypes, "refill"]),
        );
      const typeId = new Map(productTypes.map((type) => [type.slug, type.id]));
      const products = await db.transaction(async (tx) => {
        const created = await tx
          .insert(schema.product)
          .values(
            [...penProductTypes, "refill"].map((slug) => ({
              approvalStatus: "approved" as const,
              makerId: maker.id,
              name: slug,
              productTypeId: typeId.get(slug)!,
              slug: `owned-${slug}`,
            })),
          )
          .returning({ id: schema.product.id, slug: schema.product.slug });
        const ids = new Map(
          created.map((product) => [
            product.slug.replace("owned-", ""),
            product.id,
          ]),
        );
        await tx
          .insert(schema.productDetailPen)
          .values({ id: ids.get("pen")! });
        await tx
          .insert(schema.productDetailPenPart)
          .values(
            penProductTypes
              .filter((slug) => slug !== "pen")
              .map((slug) => ({ id: ids.get(slug)! })),
          );
        await tx
          .insert(schema.productDetailPenActuator)
          .values({ id: ids.get("pen-actuator")! });
        await tx
          .insert(schema.productDetailPenClip)
          .values({ id: ids.get("pen-clip")! });
        await tx.insert(schema.productDetailPenMechanism).values({
          id: ids.get("pen-mechanism")!,
          mechanismId: mechanism.id,
        });
        await tx
          .insert(schema.productDetailPenTip)
          .values({ id: ids.get("pen-tip")! });
        await tx
          .insert(schema.productDetailPenTopCap)
          .values({ id: ids.get("pen-top-cap")! });
        await tx.insert(schema.productDetailRefill).values({
          id: ids.get("refill")!,
          makerId: maker.id,
          model: "TEST-RF",
          normalizedModel: "test-rf",
        });
        return created;
      });
      const productId = new Map(
        products.map((product) => [
          product.slug.replace("owned-", ""),
          product.id,
        ]),
      );
      const refillId = productId.get("refill");
      const penId = productId.get("pen");
      const tipId = productId.get("pen-tip");
      if (!refillId || !penId || !tipId) throw new Error("Products missing.");
      const [tipRole] = await db
        .select({ id: schema.catalogTerminologyConcept.id })
        .from(schema.catalogTerminologyConcept)
        .where(
          eq(schema.catalogTerminologyConcept.normalizedCanonicalLabel, "tip"),
        );
      if (!tipRole) throw new Error("Tip role missing.");
      await db.insert(schema.penPartRoleAssignment).values({
        conceptId: tipRole.id,
        partProductId: tipId,
      });
      const materialAssignments = await db
        .insert(schema.productMaterial)
        .values(
          penProductTypes.map((slug) => ({
            materialId: material.id,
            productId: productId.get(slug)!,
          })),
        )
        .returning({
          id: schema.productMaterial.id,
          productId: schema.productMaterial.productId,
        });
      const materialIdByProduct = new Map(
        materialAssignments.map((assignment) => [
          assignment.productId,
          assignment.id,
        ]),
      );
      const [tipStyle] = await db
        .insert(schema.refillTipStyle)
        .values({ name: "Needle", slug: "owned-needle" })
        .returning();
      const [inkColor] = await db
        .insert(schema.refillInkColor)
        .values({ name: "Black", slug: "owned-black" })
        .returning();
      if (!tipStyle || !inkColor) throw new Error("Offering lookups missing.");
      const [offering] = await db.transaction(async (tx) => {
        const [source] = await tx
          .insert(schema.catalogSourceEvidence)
          .values({
            captureDate: "2026-10-10",
            claim: "The refill is sold in 0.5 mm black.",
            originalUrl: "https://example.com/refill",
            publisher: "Pens maker",
            sourceKind: "manufacturer-catalog",
          })
          .returning();
        const created = await tx
          .insert(schema.refillOffering)
          .values({
            approvedAt: new Date("2026-10-10"),
            inkColorId: inkColor.id,
            normalizedTipSize: "0.5 mm",
            refillProductId: refillId,
            tipSize: "0.5 mm",
            tipStyleId: tipStyle.id,
          })
          .returning();
        if (!source || !created[0])
          throw new Error("Offering fixtures missing.");
        await tx.insert(schema.refillOfferingEvidence).values({
          evidenceId: source.id,
          offeringId: created[0].id,
          stance: "supports",
        });
        return created;
      });
      if (!offering) throw new Error("Offering missing.");
      const collections = await db
        .insert(schema.userCollection)
        .values([
          {
            name: "Pens",
            normalizedName: "pens",
            ownerId: owner.id,
          },
          {
            name: "Parts",
            normalizedName: "parts",
            ownerId: owner.id,
          },
        ])
        .returning();
      const pensCollection = collections[0];
      const partsCollection = collections[1];
      if (!pensCollection || !partsCollection)
        throw new Error("Collections missing.");
      const actor = { clerkId: owner.clerkId, role: "user" as const };
      const service = createDbServices(
        db,
        createNoopLogger({ app: "test", environment: "test" }),
      ).collections;
      const partItemIds = new Map<string, number>();
      for (const slug of penProductTypes.filter((slug) => slug !== "pen")) {
        const id = await service.addPenProduct({
          actor,
          collectionId: partsCollection.id,
          configurationSelections: [],
          customFinish: null,
          displayName: `Owned ${slug}`,
          finishOptionId: null,
          installedRefillOfferingId: null,
          installedRefillProductId: null,
          materialAssignmentId: materialIdByProduct.get(productId.get(slug)!)!,
          productId: productId.get(slug)!,
          productTypeSlug: slug,
          serialNumber: slug === "pen-tip" ? "TIP-42" : null,
        });
        partItemIds.set(slug, id);
      }
      const slotKinds = await db
        .select({
          id: schema.configurationSlotKind.id,
          slug: schema.configurationSlotKind.slug,
        })
        .from(schema.configurationSlotKind)
        .where(inArray(schema.configurationSlotKind.slug, ["material", "tip"]));
      const slotKindId = new Map(slotKinds.map((kind) => [kind.slug, kind.id]));
      const { choices, tipSlot } = await db.transaction(async (tx) => {
        const slots = await tx
          .insert(schema.productConfigurationSlot)
          .values([
            {
              position: 0,
              productId: penId,
              required: true,
              slotKindId: slotKindId.get("material")!,
            },
            {
              position: 1,
              productId: penId,
              required: true,
              slotKindId: slotKindId.get("tip")!,
            },
          ])
          .returning({
            id: schema.productConfigurationSlot.id,
            position: schema.productConfigurationSlot.position,
          });
        const materialSlot = slots.find(({ position }) => position === 0);
        const selectedTipSlot = slots.find(({ position }) => position === 1);
        if (!materialSlot || !selectedTipSlot)
          throw new Error("Slots missing.");
        return {
          choices: await tx
            .insert(schema.productConfigurationChoice)
            .values([
              {
                position: 0,
                productId: penId,
                productMaterialId: materialIdByProduct.get(penId)!,
                slotId: materialSlot.id,
              },
              {
                partProductId: tipId,
                position: 0,
                productId: penId,
                slotId: selectedTipSlot.id,
              },
            ])
            .returning({
              id: schema.productConfigurationChoice.id,
              slotId: schema.productConfigurationChoice.slotId,
            }),
          tipSlot: selectedTipSlot,
        };
      });
      const penItemId = await service.addPenProduct({
        actor,
        collectionId: pensCollection.id,
        configurationSelections: choices.map((choice) => ({
          choiceId: choice.id,
          installedPartCollectionItemId:
            choice.slotId === tipSlot.id ? partItemIds.get("pen-tip")! : null,
          slotId: choice.slotId,
        })),
        customFinish: null,
        displayName: "Owned Pen",
        finishOptionId: null,
        installedRefillOfferingId: offering.id,
        installedRefillProductId: refillId,
        materialAssignmentId: materialIdByProduct.get(penId)!,
        productId: penId,
        productTypeSlug: "pen",
        serialNumber: "SAGA-1234",
      });
      const allItemIds = [penItemId, ...partItemIds.values()];
      await db.insert(schema.collectionItemImage).values(
        allItemIds.map((collectionItemId, index) => ({
          collectionItemId,
          contentType: "image/webp",
          fileName: `${collectionItemId}.webp`,
          objectPath: `collections/${collectionItemId}.webp`,
          position: 0,
          sha256: String(index + 1).padStart(64, "0"),
          size: 1,
          url: `https://example.com/${collectionItemId}.webp`,
        })),
      );

      const items = await service.listOwned(actor);
      expect(items).toHaveLength(penProductTypes.length);
      expect(items.every(({ imageCount }) => imageCount === 1)).toBe(true);
      expect(
        items.find(({ collectionItemId }) => collectionItemId === penItemId),
      ).toMatchObject({
        configurationSelections: expect.arrayContaining([
          expect.objectContaining({
            installedPartCollectionItemId: partItemIds.get("pen-tip"),
          }),
        ]),
        installedRefillOfferingId: offering.id,
        installedRefillProductId: refillId,
        productTypeSlug: "pen",
        serialNumber: "SAGA-1234",
      });
      expect(
        items.find(
          ({ collectionItemId }) =>
            collectionItemId === partItemIds.get("pen-tip"),
        ),
      ).toMatchObject({
        collectionId: pensCollection.id,
        privacyInheritedFromItemId: penItemId,
        serialNumber: "TIP-42",
      });
      await expect(
        service.countOwnedProducts({
          actorClerkId: actor.clerkId,
          productIds: [...productId.values()],
        }),
      ).resolves.toMatchObject(
        Object.fromEntries(
          penProductTypes.map((slug) => [productId.get(slug)!, 1]),
        ),
      );
      expect(
        await db
          .select({ id: schema.collectionDetailPen.id })
          .from(schema.collectionDetailPen)
          .where(eq(schema.collectionDetailPen.id, penItemId)),
      ).toHaveLength(1);
    } finally {
      await client.close();
    }
  }, 30_000);
});
