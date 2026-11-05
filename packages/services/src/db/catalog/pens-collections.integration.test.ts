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
  it("persists serials, installed parts, refills, offerings, and images", async () => {
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
        await tx.insert(schema.productDetailPen).values({
          id: ids.get("pen")!,
          tipInterchangeable: true,
          clipInterchangeable: true,
        });
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
      const clipRoles = await db
        .select({ id: schema.catalogTerminologyConcept.id })
        .from(schema.catalogTerminologyConcept)
        .where(
          inArray(schema.catalogTerminologyConcept.key, ["clip", "actuator"]),
        );
      await db.insert(schema.penPartRoleAssignment).values(
        clipRoles.map(({ id }) => ({
          conceptId: id,
          partProductId: productId.get("pen-clip")!,
        })),
      );
      const materialAssignments = await db
        .insert(schema.productMaterial)
        .values(
          penProductTypes.map((slug) => ({
            productId: productId.get(slug)!,
          })),
        )
        .returning({
          id: schema.productMaterial.id,
          productId: schema.productMaterial.productId,
        });
      await db.insert(schema.productMaterialComponent).values(
        materialAssignments.map(({ id }) => ({
          materialId: material.id,
          productMaterialId: id,
        })),
      );
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
        const created = await tx
          .insert(schema.refillOffering)
          .values({
            inkColorId: inkColor.id,
            normalizedTipSize: "0.5 mm",
            refillProductId: refillId,
            tipSize: "0.5 mm",
            tipStyleId: tipStyle.id,
          })
          .returning();
        if (!created[0]) throw new Error("Offering fixtures missing.");
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
      const services = createDbServices(
        db,
        createNoopLogger({ app: "test", environment: "test" }),
      );
      const service = services.collections;
      const partItemIds = new Map<string, number>();
      for (const slug of penProductTypes.filter((slug) => slug !== "pen")) {
        const id = await service.addPenProduct({
          actor,
          collectionId: partsCollection.id,
          installedPenPartCollectionItemIds: [],
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
      await db.insert(schema.penCompatiblePart).values({
        partProductId: tipId,
        penProductId: penId,
      });
      await expect(
        service.addPenProduct({
          actor,
          collectionId: pensCollection.id,
          customFinish: null,
          displayName: "Invalid Pen",
          finishOptionId: null,
          installedPenPartCollectionItemIds: [partItemIds.get("pen-clip")!],
          installedRefillOfferingId: null,
          installedRefillProductId: null,
          materialAssignmentId: materialIdByProduct.get(penId)!,
          productId: penId,
          productTypeSlug: "pen",
          serialNumber: null,
        }),
      ).rejects.toThrow("Customization confirmation");
      const penItemId = await service.addPenProduct({
        actor,
        collectionId: pensCollection.id,
        installedPenPartCollectionItemIds: [partItemIds.get("pen-tip")!],
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
      await expect(
        service.updateItem({
          actor,
          collectionItemId: penItemId,
          displayName: "Owned Pen",
          customFinish: null,
          finishOptionId: null,
          installedPenPartCollectionItemIds: [
            partItemIds.get("pen-tip")!,
            partItemIds.get("pen-clip")!,
          ],
          customizationConfirmedPartCollectionItemIds: [
            partItemIds.get("pen-clip")!,
          ],
        }),
      ).resolves.toBeUndefined();
      const customized = await db
        .select()
        .from(schema.collectionItemInstalledPenPart)
        .where(
          eq(
            schema.collectionItemInstalledPenPart.penCollectionItemId,
            penItemId,
          ),
        );
      expect(customized).toHaveLength(2);
      await expect(
        services.catalog.updateProduct({
          actor: { ...actor, role: "admin" },
          productId: productId.get("pen-clip")!,
          productTypeSlug: "pen-clip",
          makerId: maker.id,
          name: "pen-clip",
          slug: "owned-pen-clip",
          specs: {},
          materialAssignments: [
            {
              weight: null,
              materials: [
                { materialId: material.id, materialSpecificId: null },
              ],
            },
          ],
          finishOptions: [],
          penPartRoles: ["clip"],
          reason: "Attempt to remove an installed role",
        }),
      ).rejects.toThrow("web.pens.partRoles.inUse");

      expect(customized).toContainEqual(
        expect.objectContaining({
          partCollectionItemId: partItemIds.get("pen-clip"),
          requiresCustomization: true,
        }),
      );
      await expect(
        service.updateItem({
          actor,
          collectionItemId: penItemId,
          displayName: "Owned Pen",
          customFinish: null,
          finishOptionId: null,
          installedPenPartCollectionItemIds: [
            partItemIds.get("pen-tip")!,
            partItemIds.get("pen-clip")!,
          ],
        }),
      ).resolves.toBeUndefined();
      expect(
        await db
          .select()
          .from(schema.penCompatiblePart)
          .where(eq(schema.penCompatiblePart.penProductId, penId)),
      ).toHaveLength(1);
      const [unchangedPen] = await db
        .select()
        .from(schema.productDetailPen)
        .where(eq(schema.productDetailPen.id, penId));
      expect(unchangedPen).toMatchObject({
        tipInterchangeable: true,
        clipInterchangeable: true,
      });
      const ordinaryUpdate = {
        actor,
        collectionItemId: penItemId,
        displayName: "Owned Pen",
        customFinish: null,
        finishOptionId: null,
      };
      const mechanismItemId = partItemIds.get("pen-mechanism");
      const clipItemId = partItemIds.get("pen-clip");
      const actuatorItemIdForLink = partItemIds.get("pen-actuator");
      const tipItemId = partItemIds.get("pen-tip");
      const mechanismCatalogId = productId.get("pen-mechanism");
      const clipCatalogId = productId.get("pen-clip");
      if (
        !mechanismItemId ||
        !clipItemId ||
        !actuatorItemIdForLink ||
        !tipItemId ||
        !mechanismCatalogId ||
        !clipCatalogId
      )
        throw new Error("Owned actuation fixtures missing.");
      const mechanismMaterialId = materialIdByProduct.get(mechanismCatalogId);
      if (!mechanismMaterialId)
        throw new Error("Mechanism material fixture missing.");
      const linkedParts = [tipItemId, clipItemId, mechanismItemId];
      await db.insert(schema.penActuatorMechanism).values({
        actuatorProductId: clipCatalogId,
        mechanismProductId: mechanismCatalogId,
      });
      await service.updateItem({
        ...ordinaryUpdate,
        installedPenPartCollectionItemIds: linkedParts,
        customizationConfirmedPartCollectionItemIds: [mechanismItemId],
        installedPenActuations: [
          {
            actuatorCollectionItemId: clipItemId,
            mechanismCollectionItemId: mechanismItemId,
          },
        ],
      });
      expect(
        (await service.listOwned(actor)).find(
          ({ collectionItemId }) => collectionItemId === penItemId,
        ),
      ).toMatchObject({
        installedPenActuations: [
          {
            actuatorCollectionItemId: clipItemId,
            mechanismCollectionItemId: mechanismItemId,
            requiresCustomization: false,
          },
        ],
      });
      const linked = await db
        .select()
        .from(schema.collectionItemInstalledPenPart)
        .where(
          eq(
            schema.collectionItemInstalledPenPart.penCollectionItemId,
            penItemId,
          ),
        );
      expect(linked).toHaveLength(3);
      expect(
        linked.filter(
          ({ partCollectionItemId }) => partCollectionItemId === clipItemId,
        ),
      ).toHaveLength(1);
      await service.updateItem({
        ...ordinaryUpdate,
        installedPenPartCollectionItemIds: linkedParts,
      });
      expect(
        (await service.listOwned(actor)).find(
          ({ collectionItemId }) => collectionItemId === penItemId,
        )?.installedPenActuations,
      ).toHaveLength(1);
      await expect(
        service.updateItem({
          ...ordinaryUpdate,
          installedPenPartCollectionItemIds: [
            ...linkedParts,
            actuatorItemIdForLink,
          ],
          customizationConfirmedPartCollectionItemIds: [actuatorItemIdForLink],
          installedPenActuations: [
            {
              actuatorCollectionItemId: actuatorItemIdForLink,
              mechanismCollectionItemId: mechanismItemId,
            },
          ],
        }),
      ).rejects.toThrow("web.pens.installedActuation.confirmationRequired");
      await service.updateItem({
        ...ordinaryUpdate,
        installedPenPartCollectionItemIds: [
          ...linkedParts,
          actuatorItemIdForLink,
        ],
        customizationConfirmedPartCollectionItemIds: [actuatorItemIdForLink],
        installedPenActuations: [
          {
            actuatorCollectionItemId: actuatorItemIdForLink,
            mechanismCollectionItemId: mechanismItemId,
            customizationConfirmed: true,
          },
        ],
      });
      expect(
        (await service.listOwned(actor)).find(
          ({ collectionItemId }) => collectionItemId === penItemId,
        )?.installedPenActuations,
      ).toEqual([
        {
          actuatorCollectionItemId: actuatorItemIdForLink,
          mechanismCollectionItemId: mechanismItemId,
          requiresCustomization: true,
        },
      ]);
      await service.updateItem({
        ...ordinaryUpdate,
        installedPenPartCollectionItemIds: [
          ...linkedParts,
          actuatorItemIdForLink,
        ],
        installedPenActuations: [
          {
            actuatorCollectionItemId: actuatorItemIdForLink,
            mechanismCollectionItemId: mechanismItemId,
          },
        ],
      });
      await expect(
        service.updateItem({
          ...ordinaryUpdate,
          installedPenPartCollectionItemIds: linkedParts,
          installedPenActuations: [
            {
              actuatorCollectionItemId: clipItemId,
              mechanismCollectionItemId: mechanismItemId,
            },
            {
              actuatorCollectionItemId: clipItemId,
              mechanismCollectionItemId: mechanismItemId,
            },
          ],
        }),
      ).rejects.toThrow("web.pens.installedActuation.invalid");
      await expect(
        db
          .update(schema.collectionItemInstalledPenPart)
          .set({
            actuatedMechanismCollectionItemId: tipItemId,
          })
          .where(
            eq(
              schema.collectionItemInstalledPenPart.partCollectionItemId,
              actuatorItemIdForLink,
            ),
          ),
      ).rejects.toThrow();
      for (const pair of [
        {
          actuatorCollectionItemId: tipItemId,
          mechanismCollectionItemId: mechanismItemId,
        },
        {
          actuatorCollectionItemId: clipItemId,
          mechanismCollectionItemId: clipItemId,
        },
      ])
        await expect(
          service.updateItem({
            ...ordinaryUpdate,
            installedPenPartCollectionItemIds: linkedParts,
            installedPenActuations: [pair],
          }),
        ).rejects.toThrow("web.pens.installedActuation.invalid");
      await service.updateItem({
        ...ordinaryUpdate,
        installedPenPartCollectionItemIds: [tipItemId, clipItemId],
        installedPenActuations: [],
      });
      await expect(
        service.updateItem({
          ...ordinaryUpdate,
          installedPenPartCollectionItemIds: [penItemId],
          customizationConfirmedPartCollectionItemIds: [penItemId],
        }),
      ).rejects.toThrow("available and owned");
      await expect(
        service.updateItem({
          ...ordinaryUpdate,
          installedPenPartCollectionItemIds: [
            partItemIds.get("pen-tip")!,
            partItemIds.get("pen-tip")!,
          ],
        }),
      ).rejects.toThrow("only once");
      const capItemId = partItemIds.get("pen-top-cap")!;
      await db
        .update(schema.collectionItem)
        .set({ owned: false })
        .where(eq(schema.collectionItem.id, capItemId));
      await expect(
        service.updateItem({
          ...ordinaryUpdate,
          installedPenPartCollectionItemIds: [capItemId],
          customizationConfirmedPartCollectionItemIds: [capItemId],
        }),
      ).rejects.toThrow("available and owned");
      await db
        .update(schema.collectionItem)
        .set({ owned: true })
        .where(eq(schema.collectionItem.id, capItemId));
      await db
        .update(schema.collectionItem)
        .set({
          isPrivate: true,
          privateReason: "Staff privacy",
          privatedAt: new Date(),
          privatedByClerkId: "staff",
        })
        .where(eq(schema.collectionItem.id, capItemId));
      await expect(
        service.updateItem({
          ...ordinaryUpdate,
          installedPenPartCollectionItemIds: [capItemId],
          customizationConfirmedPartCollectionItemIds: [capItemId],
        }),
      ).rejects.toThrow("available and owned");
      await db
        .update(schema.collectionItem)
        .set({
          isPrivate: false,
          privateReason: null,
          privatedAt: null,
          privatedByClerkId: null,
        })
        .where(eq(schema.collectionItem.id, capItemId));
      const [otherOwner] = await db
        .insert(schema.user)
        .values({ clerkId: "other-pens-owner", username: "Other Pens owner" })
        .returning();
      if (!otherOwner) throw new Error("Other owner missing.");
      const [otherCollection] = await db
        .insert(schema.userCollection)
        .values({
          ownerId: otherOwner.id,
          name: "Other Pens",
          normalizedName: "other pens",
        })
        .returning();
      if (!otherCollection) throw new Error("Other collection missing.");
      await db
        .update(schema.collectionItem)
        .set({ ownerId: otherOwner.id, collectionId: otherCollection.id })
        .where(eq(schema.collectionItem.id, capItemId));
      await expect(
        service.updateItem({
          ...ordinaryUpdate,
          installedPenPartCollectionItemIds: [capItemId],
          customizationConfirmedPartCollectionItemIds: [capItemId],
        }),
      ).rejects.toThrow("available and owned");
      await db
        .update(schema.collectionItem)
        .set({ ownerId: owner.id, collectionId: partsCollection.id })
        .where(eq(schema.collectionItem.id, capItemId));
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
        installedPenPartCollectionItemIds: expect.arrayContaining([
          partItemIds.get("pen-tip"),
          partItemIds.get("pen-clip"),
        ]),
        customizedPenPartCollectionItemIds: [partItemIds.get("pen-clip")],
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
      const alternateMechanismItemId = await service.addPenProduct({
        actor,
        collectionId: partsCollection.id,
        productId: mechanismCatalogId,
        productTypeSlug: "pen-mechanism",
        displayName: "Second owned mechanism",
        installedPenPartCollectionItemIds: [],
        customFinish: null,
        finishOptionId: null,
        installedRefillProductId: null,
        installedRefillOfferingId: null,
        serialNumber: null,
        materialAssignmentId: materialIdByProduct.get(mechanismCatalogId)!,
      });
      await service.updateItem({
        ...ordinaryUpdate,
        installedPenPartCollectionItemIds: [
          ...linkedParts,
          alternateMechanismItemId,
        ],
        customizationConfirmedPartCollectionItemIds: [
          mechanismItemId,
          alternateMechanismItemId,
        ],
        installedPenActuations: [
          {
            actuatorCollectionItemId: clipItemId,
            mechanismCollectionItemId: mechanismItemId,
          },
        ],
      });
      await service.updateItem({
        ...ordinaryUpdate,
        installedPenActuations: [
          {
            actuatorCollectionItemId: clipItemId,
            mechanismCollectionItemId: alternateMechanismItemId,
          },
        ],
      });
      expect(
        (await service.listOwned(actor)).find(
          ({ collectionItemId }) => collectionItemId === penItemId,
        )?.installedPenActuations,
      ).toEqual([
        {
          actuatorCollectionItemId: clipItemId,
          mechanismCollectionItemId: alternateMechanismItemId,
          requiresCustomization: false,
        },
      ]);
      await db
        .update(schema.product)
        .set({ isPrivate: true })
        .where(eq(schema.product.id, mechanismCatalogId));
      await expect(
        service.updateItem({
          ...ordinaryUpdate,
          installedPenActuations: [
            {
              actuatorCollectionItemId: clipItemId,
              mechanismCollectionItemId: mechanismItemId,
            },
          ],
        }),
      ).rejects.toThrow("web.pens.installedActuation.confirmationRequired");
      await service.updateItem({
        ...ordinaryUpdate,
        installedPenActuations: [
          {
            actuatorCollectionItemId: clipItemId,
            mechanismCollectionItemId: mechanismItemId,
            customizationConfirmed: true,
          },
        ],
      });
      await db
        .update(schema.product)
        .set({ isPrivate: false })
        .where(eq(schema.product.id, mechanismCatalogId));
      await service.updateItem({
        ...ordinaryUpdate,
        installedPenPartCollectionItemIds: [tipItemId, clipItemId],
        installedPenActuations: [],
      });
      const actuatorItemId = partItemIds.get("pen-actuator")!;
      const customPenInput = {
        actor,
        collectionId: pensCollection.id,
        installedPenPartCollectionItemIds: [actuatorItemId, mechanismItemId],
        installedPenActuations: [
          {
            actuatorCollectionItemId: actuatorItemId,
            mechanismCollectionItemId: mechanismItemId,
            customizationConfirmed: true,
          },
        ],
        customFinish: null,
        displayName: "Customized Pen",
        finishOptionId: null,
        installedRefillOfferingId: null,
        installedRefillProductId: null,
        materialAssignmentId: materialIdByProduct.get(penId)!,
        productId: penId,
        productTypeSlug: "pen" as const,
        serialNumber: null,
      };
      await db.insert(schema.penCompatiblePart).values({
        penProductId: penId,
        partProductId: productId.get("pen-actuator")!,
      });
      await expect(service.addPenProduct(customPenInput)).rejects.toThrow(
        "Customization confirmation",
      );
      const customPenItemId = await service.addPenProduct({
        ...customPenInput,
        customizationConfirmedPartCollectionItemIds: [
          actuatorItemId,
          mechanismItemId,
        ],
      });
      expect(
        await db
          .select()
          .from(schema.collectionItemInstalledPenPart)
          .where(
            eq(
              schema.collectionItemInstalledPenPart.penCollectionItemId,
              customPenItemId,
            ),
          ),
      ).toContainEqual(
        expect.objectContaining({
          partCollectionItemId: actuatorItemId,
          requiresCustomization: true,
        }),
      );
      await expect(
        service.addPenProduct({
          ...customPenInput,
          customizationConfirmedPartCollectionItemIds: [
            actuatorItemId,
            mechanismItemId,
          ],
        }),
      ).rejects.toThrow("unavailable");
    } finally {
      await client.close();
    }
  }, 30_000);
});
