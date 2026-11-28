import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { type Database, schema } from "@package/database";
import { createNoopLogger } from "@package/logger";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { expect, it } from "vitest";
import { createDbServices } from "../index.js";

it("round-trips unknown and authored fountain-pen capabilities without evidence", async () => {
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
    const [maker] = await db
      .insert(schema.maker)
      .values({ name: "Fountain maker", slug: "fountain-maker" })
      .returning();
    const [material] = await db
      .insert(schema.material)
      .values({ name: "Titanium", slug: "titanium" })
      .returning();
    if (!maker || !material) throw new Error("Fixtures missing.");
    const services = createDbServices(db, createNoopLogger());
    const input = {
      actor: { clerkId: "fountain-owner", role: "user" as const },
      makerId: maker.id,
      productTypeSlug: "fountain-pen" as const,
      name: "OG1",
      slug: "og1",
      materialAssignments: [
        {
          materials: [{ materialId: material.id, materialSpecificId: null }],
          weight: null,
        },
      ],
      finishOptions: [],
      specs: {},
      fountainPen: {
        postable: null,
        ownerReplaceableNib: true,
        hasClip: false,
        hasInkWindow: null,
      },
    };
    const created = await services.catalog.createProduct(input);
    expect(created.fountainPen).toMatchObject(input.fountainPen);
    const updated = await services.catalog.updateProduct({
      ...input,
      productId: created.id,
      fountainPen: {
        postable: true,
        ownerReplaceableNib: null,
        hasClip: null,
        hasInkWindow: false,
      },
    });
    expect(updated.fountainPen).toMatchObject({
      postable: true,
      ownerReplaceableNib: null,
      hasClip: null,
      hasInkWindow: false,
    });
    expect(
      (await services.catalog.getProduct("fountain-pen", "og1", input.actor))
        ?.fountainPen,
    ).toEqual(updated.fountainPen);
  } finally {
    await client.close();
  }
}, 60_000);

/**
 * Creates an isolated public-service fixture with migrated reference data.
 * @returns Catalog services and minimal authored product input.
 * @rejects When migration replay or fixture persistence fails.
 */
async function fixture() {
  const client = new PGlite();
  const db = drizzle({
    client,
    relations: schema.relations,
  }) as unknown as Database;
  await migrate(drizzle({ client }), {
    migrationsFolder: fileURLToPath(
      new URL("../../../../database/drizzle", import.meta.url),
    ),
  });
  const [maker] = await db
    .insert(schema.maker)
    .values({ name: "Nib maker", slug: "nib-maker" })
    .returning();
  const [material] = await db
    .insert(schema.material)
    .values({ name: "Steel", slug: "steel" })
    .returning();
  if (!maker || !material) throw new Error("Fixtures missing.");
  return {
    client,
    db,
    services: createDbServices(db, createNoopLogger()),
    base: {
      actor: { clerkId: "nib-owner", role: "user" as const },
      makerId: maker.id,
      materialAssignments: [
        {
          materials: [{ materialId: material.id, materialSpecificId: null }],
          weight: null,
        },
      ],
      finishOptions: [],
      specs: {},
    },
  };
}

it("infers converters only from known matching connector and length classes", async () => {
  const { client, db, services, base } = await fixture();
  try {
    const families = await db
      .insert(schema.fountainPenConnectorFamily)
      .values([
        { slug: "international", name: "International" },
        { slug: "sailor", name: "Sailor" },
      ])
      .returning();
    const international = families.find((r) => r.slug === "international");
    const sailor = families.find((r) => r.slug === "sailor");
    const [cc] = await db
      .select()
      .from(schema.fountainPenFillingMechanism)
      .where(
        eq(schema.fountainPenFillingMechanism.slug, "cartridge-converter"),
      );
    if (!international || !sailor || !cc)
      throw new Error("References missing.");
    const converters = await db
      .insert(schema.fountainPenConverter)
      .values([
        {
          makerId: base.makerId,
          name: "K5",
          slug: "k5",
          connectorFamilyId: international.id,
          lengthClass: "long",
        },
        {
          makerId: base.makerId,
          name: "Mini",
          slug: "mini",
          connectorFamilyId: international.id,
          lengthClass: "short",
        },
        {
          makerId: base.makerId,
          name: "Sailor",
          slug: "sailor",
          connectorFamilyId: sailor.id,
          lengthClass: "long",
        },
        {
          makerId: base.makerId,
          name: "Unclassified",
          slug: "unclassified",
          connectorFamilyId: international.id,
        },
      ])
      .returning();
    const input = {
      ...base,
      productTypeSlug: "fountain-pen" as const,
      name: "Shonk",
      slug: "shonk",
      fountainPen: {
        fillingMechanismIds: [cc.id],
        connectorFamilyId: international.id,
        cartridgeConverterLength: "short" as const,
      },
    };
    const created = await services.catalog.createProduct(input);
    expect(created.compatibleConverters?.map((r) => r.name)).toEqual(["Mini"]);
    const both = await services.catalog.updateProduct({
      ...input,
      productId: created.id,
      fountainPen: {
        ...input.fountainPen,
        cartridgeConverterLength: "short-and-long",
      },
    });
    expect(both.compatibleConverters?.map((r) => r.id).sort()).toEqual(
      converters
        .filter((r) => ["K5", "Mini"].includes(r.name))
        .map((r) => r.id)
        .sort(),
    );
    const unknown = await services.catalog.updateProduct({
      ...input,
      productId: created.id,
      fountainPen: { ...input.fountainPen, cartridgeConverterLength: null },
    });
    expect(unknown.compatibleConverters).toEqual([]);
    const noCc = await services.catalog.updateProduct({
      ...input,
      productId: created.id,
      fountainPen: { ...input.fountainPen, fillingMechanismIds: [] },
    });
    expect(noCc.fountainPen).toMatchObject({
      connectorFamilyId: null,
      cartridgeConverterLength: null,
    });
    expect(noCc.compatibleConverters).toEqual([]);
  } finally {
    await client.close();
  }
}, 60_000);

it("copies nib defaults and installs one same-owner nib with section-specific fit", async () => {
  const { client, db, services, base } = await fixture();
  try {
    const [mount] = await db
      .insert(schema.nibMount)
      .values({ slug: "bock-250", name: "Bock 250 housing" })
      .returning();
    const [width] = await db
      .insert(schema.nibWidth)
      .values({ slug: "fine", name: "F" })
      .returning();
    if (!mount || !width) throw new Error("References missing.");
    const nib = await services.catalog.createProduct({
      ...base,
      productTypeSlug: "nib",
      name: "Bock 250 Steel",
      slug: "bock-250-steel",
      nib: {
        manufacturerSizeCode: "250",
        mountIds: [mount.id],
        widthIds: [width.id],
        defaultFeedMaterial: "ebonite",
      },
    });
    expect(nib.nib).toMatchObject({
      manufacturerSizeCode: "250",
      defaultFeedMaterial: "ebonite",
      defaultHousingMaterial: "plastic",
    });
    const pen = await services.catalog.createProduct({
      ...base,
      productTypeSlug: "fountain-pen",
      name: "Family",
      slug: "family",
      fountainPen: {
        sectionOptions: [
          {
            name: "Bock section",
            mountId: mount.id,
            defaultNibProductId: null,
          },
        ],
      },
    });
    const collection = await services.collections.createCollection({
      actor: base.actor,
      name: "Writing",
      description: null,
      isPrivate: false,
    });
    const appearance = {
      actor: base.actor,
      collectionId: collection.id,
      customFinish: null,
      finishOptionId: null,
      displayName: "",
      materialAssignmentId: nib.materials[0]?.assignmentId ?? null,
      installedPenPartCollectionItemIds: [],
      installedRefillOfferingId: null,
      installedRefillProductId: null,
    };
    const ownedNib = await services.collections.addPenProduct({
      ...appearance,
      productId: nib.id,
      productTypeSlug: "nib",
      nib: { widthId: width.id },
    });
    const nibItem = await services.collections.getOwnedItem(
      base.actor,
      ownedNib,
    );
    expect(nibItem?.nib).toMatchObject({
      widthId: width.id,
      feedMaterial: "ebonite",
      housingMaterial: "plastic",
    });
    const input = {
      ...appearance,
      productId: pen.id,
      productTypeSlug: "fountain-pen" as const,
      materialAssignmentId: pen.materials[0]?.assignmentId ?? null,
      fountainPen: {
        sectionOptionId: pen.fountainPen?.sectionOptions[0]?.id ?? null,
        nib: { mode: "owned" as const, ownedNibCollectionItemId: ownedNib },
      },
    };
    const ownedPen = await services.collections.addPenProduct(input);
    expect(
      (await services.collections.getOwnedItem(base.actor, ownedPen))
        ?.fountainPen?.nib,
    ).toMatchObject({ mode: "owned", ownedNibCollectionItemId: ownedNib });
    await expect(services.collections.addPenProduct(input)).rejects.toThrow();
    await expect(
      services.collections.addPenProduct({
        ...input,
        fountainPen: { ...input.fountainPen, nib: { mode: "default" } },
      }),
    ).rejects.toThrow("web.fountainPen.sectionWithoutNib");
    const updated = await services.catalog.updateProduct({
      ...base,
      productId: pen.id,
      productTypeSlug: "fountain-pen",
      name: pen.name,
      slug: pen.slug,
      fountainPen: {
        sectionOptions: pen.fountainPen?.sectionOptions.map((section) => ({
          ...section,
          defaultNibProductId: nib.id,
        })),
      },
    });
    const defaultPenId = await services.collections.addPenProduct({
      ...input,
      fountainPen: {
        sectionOptionId: updated.fountainPen?.sectionOptions[0]?.id ?? null,
        nib: { mode: "default", defaultNibWidthId: width.id },
      },
    });
    expect(
      (await services.collections.getOwnedItem(base.actor, defaultPenId))
        ?.fountainPen?.nib,
    ).toEqual({ mode: "default", defaultNibWidthId: width.id });
    expect(await db.select().from(schema.collectionDetailNib)).toHaveLength(1);
    await services.collections.updateItem({
      actor: base.actor,
      collectionItemId: defaultPenId,
      collectionId: collection.id,
      displayName: "",
      customFinish: null,
      finishOptionId: null,
      fountainPen: { nib: { mode: "none" } },
    });
    expect(
      (await services.collections.getOwnedItem(base.actor, defaultPenId))
        ?.fountainPen?.nib,
    ).toEqual({ mode: "none" });
  } finally {
    await client.close();
  }
}, 60_000);

it("retains independent material and finish snapshots after catalog offerings change", async () => {
  const { client, db, services, base } = await fixture();
  try {
    const [titanium] = await db
      .insert(schema.material)
      .values({ name: "Titanium", slug: "titanium" })
      .returning();
    const [finish] = await db
      .insert(schema.finish)
      .values({ name: "Satin", slug: "satin" })
      .returning();
    if (!titanium || !finish) throw new Error("References missing.");
    const input = {
      ...base,
      productTypeSlug: "fountain-pen" as const,
      name: "OG1",
      slug: "og1",
      fountainPen: {},
      materialAssignments: [
        ...base.materialAssignments,
        {
          materials: [{ materialId: titanium.id, materialSpecificId: null }],
          weight: null,
        },
      ],
      finishOptions: [
        {
          finishIds: [finish.id],
          colorIds: [],
          colorEffectId: null,
          patternId: null,
        },
      ],
    };
    const product = await services.catalog.createProduct(input);
    const collection = await services.collections.createCollection({
      actor: base.actor,
      name: "Writing",
      description: null,
      isPrivate: false,
    });
    const id = await services.collections.addPenProduct({
      actor: base.actor,
      collectionId: collection.id,
      productId: product.id,
      productTypeSlug: "fountain-pen",
      materialAssignmentId: null,
      materialAssignmentIds: product.materials.map((m) => m.assignmentId),
      finishOptionId: product.finishOptions[0]?.id ?? null,
      customFinish: null,
      displayName: "My OG1",
      installedPenPartCollectionItemIds: [],
      installedRefillOfferingId: null,
      installedRefillProductId: null,
    });
    const before = await services.collections.getOwnedItem(base.actor, id);
    expect(before?.materials.map((m) => m.slug).sort()).toEqual([
      "steel",
      "titanium",
    ]);
    expect(before?.finishOption?.finishes.map((f) => f.slug)).toEqual([
      "satin",
    ]);
    await services.catalog.updateProduct({
      ...input,
      productId: product.id,
      materialAssignments: input.materialAssignments.slice(1),
      finishOptions: [],
    });
    const after = await services.collections.getOwnedItem(base.actor, id);
    expect(after?.materials).toEqual(before?.materials);
    expect(after?.finishOption?.finishes).toEqual(
      before?.finishOption?.finishes,
    );
  } finally {
    await client.close();
  }
}, 60_000);

it("validates actual plating independently from base material and surface finish", async () => {
  const { client, db, services, base } = await fixture();
  try {
    const [metal] = await db
      .insert(schema.nibPlatingMetal)
      .values({ name: "Rhodium", slug: "rhodium" })
      .returning();
    if (!metal) throw new Error("Plating metal missing.");
    const nib = await services.catalog.createProduct({
      ...base,
      productTypeSlug: "nib",
      name: "Bock 250 Steel",
      slug: "bock-250-steel",
      nib: {
        manufacturerSizeCode: "250",
        platingStyles: ["unplated", "full", "two-tone"],
        platingMetalIds: [metal.id],
      },
    });
    const collection = await services.collections.createCollection({
      actor: base.actor,
      name: "Nibs",
      description: null,
      isPrivate: false,
    });
    const input = {
      actor: base.actor,
      collectionId: collection.id,
      productId: nib.id,
      productTypeSlug: "nib" as const,
      materialAssignmentId: nib.materials[0]?.assignmentId ?? null,
      finishOptionId: null,
      customFinish: null,
      displayName: "",
      installedPenPartCollectionItemIds: [],
      installedRefillOfferingId: null,
      installedRefillProductId: null,
    };
    await expect(
      services.collections.addPenProduct({
        ...input,
        nib: { platingStyle: "unplated", coatingMetalId: metal.id },
      }),
    ).rejects.toThrow();
    await expect(
      services.collections.addPenProduct({
        ...input,
        nib: { platingStyle: "full" },
      }),
    ).rejects.toThrow();
    const owned = await services.collections.addPenProduct({
      ...input,
      nib: {
        platingStyle: "two-tone",
        bodyCoatingMetalId: metal.id,
        tinesCoatingMetalId: null,
      },
    });
    const saved = await services.collections.getOwnedItem(base.actor, owned);
    expect(saved?.nib).toMatchObject({
      platingStyle: "two-tone",
      bodyCoatingMetalId: metal.id,
      tinesCoatingMetalId: null,
    });
    expect(saved?.materials.map((m) => m.slug)).toEqual(["steel"]);
    const [other] = await db
      .insert(schema.material)
      .values({ name: "Titanium", slug: "titanium" })
      .returning();
    if (!other) throw new Error("Material missing.");
    await expect(
      services.catalog.updateProduct({
        ...base,
        productId: nib.id,
        productTypeSlug: "nib",
        name: nib.name,
        slug: nib.slug,
        materialAssignments: [
          {
            materials: [{ materialId: other.id, materialSpecificId: null }],
            weight: null,
          },
        ],
      }),
    ).rejects.toThrow("web.nib.validation.baseMaterial");
  } finally {
    await client.close();
  }
}, 60_000);

it("inherits installed nib privacy, moves the assembly, and retains the pen when its nib is deleted", async () => {
  const { client, db, services, base } = await fixture();
  try {
    const nib = await services.catalog.createProduct({
      ...base,
      productTypeSlug: "nib",
      name: "Bock 250 Steel",
      slug: "bock-250-steel",
      nib: { manufacturerSizeCode: "250" },
    });
    const pen = await services.catalog.createProduct({
      ...base,
      productTypeSlug: "fountain-pen",
      name: "OG1",
      slug: "og1",
      fountainPen: { defaultNibProductId: nib.id },
    });
    const collection = await services.collections.createCollection({
      actor: base.actor,
      name: "Writing",
      description: null,
      isPrivate: false,
    });
    const common = {
      actor: base.actor,
      collectionId: collection.id,
      customFinish: null,
      finishOptionId: null,
      displayName: "",
      installedPenPartCollectionItemIds: [],
      installedRefillOfferingId: null,
      installedRefillProductId: null,
    };
    const nibId = await services.collections.addPenProduct({
      ...common,
      productId: nib.id,
      productTypeSlug: "nib",
      materialAssignmentId: nib.materials[0]?.assignmentId ?? null,
      isPrivate: true,
    });
    const penId = await services.collections.addPenProduct({
      ...common,
      productId: pen.id,
      productTypeSlug: "fountain-pen",
      materialAssignmentId: pen.materials[0]?.assignmentId ?? null,
      fountainPen: { nib: { mode: "owned", ownedNibCollectionItemId: nibId } },
    });
    const admin = { clerkId: "fountain-admin", role: "admin" as const };
    await services.users.ensure({ clerkId: admin.clerkId });
    for (const productId of [nib.id, pen.id])
      await services.catalog.decideProductApproval({
        actor: admin,
        productId,
        action: "approve",
        reason: "Reviewed fixture",
      });
    for (const collectionItemId of [nibId, penId])
      await services.collections.decideItemApproval({
        actor: admin,
        collectionItemId,
        action: "approve",
        reason: "Reviewed fixture",
      });
    const ownedPen = await services.collections.getOwnedItem(base.actor, penId);
    if (!ownedPen) throw new Error("Owned pen missing.");
    const publicInput = {
      ownerUserId: ownedPen.ownerUserId,
      collectionId: collection.id,
      collectionItemId: penId,
    };
    expect(
      await services.collections.getPublicItem(publicInput),
    ).not.toBeNull();
    expect(
      await services.collections.getOwnedItem(base.actor, nibId),
    ).toMatchObject({
      isPrivate: false,
      savedIsPrivate: true,
      privacyInheritedFromItemId: penId,
    });
    const installation = {
      actor: base.actor,
      collectionItemId: penId,
      collectionId: collection.id,
      displayName: "",
      customFinish: null,
      finishOptionId: null,
    };
    await services.collections.updateItem({
      ...installation,
      fountainPen: { nib: { mode: "none" } },
    });
    await services.collections.decideItemApproval({
      actor: admin,
      collectionItemId: nibId,
      action: "reverse",
      reason: "Pending replacement fixture",
    });
    const replacement = {
      ...installation,
      fountainPen: {
        nib: { mode: "owned" as const, ownedNibCollectionItemId: nibId },
      },
    };
    await expect(services.collections.updateItem(replacement)).rejects.toThrow(
      "web.fountainPen.unavailableNib",
    );
    expect(
      (await services.collections.getOwnedItem(base.actor, penId))?.fountainPen
        ?.nib,
    ).toEqual({ mode: "none" });
    await services.collections.decideItemApproval({
      actor: admin,
      collectionItemId: nibId,
      action: "approve",
      reason: "Replacement reviewed",
    });
    await services.catalog.setVisibility({
      actor: base.actor,
      productId: nib.id,
      isPrivate: true,
    });
    await expect(services.collections.updateItem(replacement)).rejects.toThrow(
      "web.fountainPen.unavailableNib",
    );
    await services.catalog.setVisibility({
      actor: base.actor,
      productId: nib.id,
      isPrivate: false,
    });
    await services.collections.updateItem(replacement);
    const membershipAudits = await db
      .select({ afterState: schema.auditEvent.afterState })
      .from(schema.auditEvent)
      .where(
        and(
          eq(schema.auditEvent.action, "collections.item.updated"),
          eq(schema.auditEvent.targetId, String(nibId)),
        ),
      );
    expect(membershipAudits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          afterState: expect.objectContaining({ inheritedFromItemId: penId }),
        }),
        expect.objectContaining({
          afterState: expect.objectContaining({ inheritedFromItemId: null }),
        }),
      ]),
    );
    await expect(
      services.collections.setItemVisibility({
        actor: base.actor,
        collectionItemId: nibId,
        isPrivate: false,
      }),
    ).rejects.toThrow("Privacy is inherited");
    const publicSearch = await services.search.search({
      query: "Bock",
      group: "collections",
      surface: "page",
    });
    expect(
      publicSearch.items.some(
        (item) => item.kind === "collection_item" && item.id === nibId,
      ),
    ).toBe(true);
    await services.catalog.setVisibility({
      actor: base.actor,
      productId: nib.id,
      isPrivate: true,
    });
    expect(
      (await services.catalog.getProduct("fountain-pen", "og1"))?.fountainPen
        ?.defaultNibProductId,
    ).toBeNull();
    expect(
      (await services.catalog.getProduct("fountain-pen", "og1", base.actor))
        ?.fountainPen?.defaultNibProductId,
    ).toBe(nib.id);
    expect(await services.collections.getPublicItem(publicInput)).toBeNull();
    expect(
      (
        await services.search.search({
          query: "OG1",
          group: "collections",
          surface: "page",
        })
      ).items.some(
        (item) => item.id === penId && item.kind === "collection_item",
      ),
    ).toBe(false);
    await services.catalog.setVisibility({
      actor: base.actor,
      productId: nib.id,
      isPrivate: false,
    });
    await services.collections.setItemVisibility({
      actor: base.actor,
      collectionItemId: penId,
      isPrivate: true,
    });
    expect(await services.collections.getPublicItem(publicInput)).toBeNull();
    expect(
      (
        await services.search.search({
          query: "Bock",
          group: "collections",
          surface: "page",
        })
      ).items.some(
        (item) => item.id === nibId && item.kind === "collection_item",
      ),
    ).toBe(false);
    await services.collections.setItemVisibility({
      actor: base.actor,
      collectionItemId: penId,
      isPrivate: false,
    });
    await services.collections.decideItemApproval({
      actor: admin,
      collectionItemId: nibId,
      action: "reverse",
      reason: "Moderation fixture",
    });
    await services.collections.decideItemApproval({
      actor: admin,
      collectionItemId: nibId,
      action: "reject",
      reason: "Moderation fixture",
    });
    expect(await services.collections.getPublicItem(publicInput)).toBeNull();
    await services.collections.decideItemApproval({
      actor: admin,
      collectionItemId: nibId,
      action: "reverse",
      reason: "Moderation cleared",
    });
    await services.collections.decideItemApproval({
      actor: admin,
      collectionItemId: nibId,
      action: "approve",
      reason: "Moderation cleared",
    });
    const destination = await services.collections.createCollection({
      actor: base.actor,
      name: "Private writing",
      description: null,
      isPrivate: true,
    });
    await services.collections.updateItem({
      actor: base.actor,
      collectionItemId: nibId,
      collectionId: destination.id,
      displayName: "",
      customFinish: null,
      finishOptionId: null,
    });
    expect(
      await services.collections.getOwnedItem(base.actor, penId),
    ).toMatchObject({ collectionId: destination.id });
    expect(
      await services.collections.getOwnedItem(base.actor, nibId),
    ).toMatchObject({
      collectionId: destination.id,
      collectionIsPrivate: true,
      privacyInheritedFromItemId: penId,
    });
    await services.collections.deleteItem({
      actor: base.actor,
      collectionItemId: nibId,
      confirmed: true,
    });
    expect(
      await services.collections.getOwnedItem(base.actor, nibId),
    ).toBeNull();
    expect(
      (await services.collections.getOwnedItem(base.actor, penId))?.fountainPen
        ?.nib,
    ).toEqual({ mode: "none" });
  } finally {
    await client.close();
  }
}, 60_000);
