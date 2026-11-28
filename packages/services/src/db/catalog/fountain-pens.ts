import { type AuditJsonObject, type Database, schema } from "@package/database";
import { and, eq, inArray, sql } from "drizzle-orm";
import { type Actor, hasPermission } from "../../authorization.js";
import {
  type FountainPenDetails,
  type FountainPenItemWrite,
  type FountainPenWrite,
  fountainPenItemSchema,
  fountainPenSchema,
  type NibDetails,
  type NibItemWrite,
  type NibWrite,
  nibItemSchema,
  nibSchema,
} from "../../fountain-pens.js";
import type {
  CatalogProduct,
  ProductWriteInput,
  UserCollectionItem,
} from "./index.js";

/** Caller-owned catalog transaction. */
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Read operations needed to hydrate the two fountain-pen catalog subtypes. */
type ReadDb = Pick<Database, "select">;
/** Controlled terminology namespaces for each fountain-pen classification. */
const conceptNamespaces = {
  nibConstructionId: "fountain-pen-nib-construction",
  bodySilhouetteId: "fountain-pen-body-silhouette",
  crossSectionId: "fountain-pen-cross-section",
  formFactorId: "fountain-pen-form-factor",
  capClosureId: "fountain-pen-cap-closure",
  nibDeploymentId: "fountain-pen-nib-deployment",
} as const;

/**
 * Validates subtype boundaries and the fixed base material of a nib model.
 * @param input - Complete catalog product write.
 * @throws When subtype data is attached to another product type or a nib lacks one fixed material.
 */
export function assertFountainPenProduct(input: ProductWriteInput) {
  if (
    input.fountainPen !== undefined &&
    input.productTypeSlug !== "fountain-pen"
  )
    throw new Error("Only fountain pens may declare fountain-pen facts.");
  if (input.nib !== undefined && input.productTypeSlug !== "nib")
    throw new Error("Only nibs may declare nib specifications.");
  if (input.productTypeSlug === "nib") {
    if (
      input.materialAssignments.length !== 1 ||
      input.materialAssignments[0]?.materials.length !== 1
    )
      throw new Error("web.nib.validation.baseMaterial");
    if (input.nib !== undefined) nibSchema.parse(input.nib);
  }
  if (input.fountainPen !== undefined)
    fountainPenSchema.parse(input.fountainPen);
}

/**
 * Requires a reference to belong to its registered terminology namespace.
 * @param db - Catalog reader in the caller transaction.
 * @param id - Optional concept identifier.
 * @param namespace - Required controlled namespace.
 * @rejects When a selected concept belongs to another axis or does not exist.
 */
async function assertConcept(db: ReadDb, id: number | null, namespace: string) {
  if (id === null) return;
  const [concept] = await db
    .select({ id: schema.catalogTerminologyConcept.id })
    .from(schema.catalogTerminologyConcept)
    .where(
      and(
        eq(schema.catalogTerminologyConcept.id, id),
        eq(schema.catalogTerminologyConcept.namespace, namespace),
      ),
    )
    .limit(1);
  if (!concept) throw new Error("Invalid fountain-pen classification.");
}

/**
 * Validates visible nib models without confusing manufacturer or nominal size with fit.
 * @param db - Caller-owned catalog reader.
 * @param ids - Nib product identifiers used by an authored model.
 * @param actor - Authenticated author.
 * @rejects When any selected nib is not an accessible nib model.
 */
async function assertNibModels(db: ReadDb, ids: number[], actor: Actor) {
  const unique = [...new Set(ids)];
  if (!unique.length) return;
  const rows = await db
    .select({
      id: schema.product.id,
      owner: schema.product.ownerClerkId,
      private: schema.product.isPrivate,
      approval: schema.product.approvalStatus,
    })
    .from(schema.product)
    .innerJoin(
      schema.productDetailNib,
      eq(schema.product.id, schema.productDetailNib.id),
    )
    .where(inArray(schema.product.id, unique));
  if (
    rows.length !== unique.length ||
    rows.some(
      (row) =>
        !hasPermission(actor, "products.manage") &&
        row.owner !== actor.clerkId &&
        (row.private || row.approval !== "approved"),
    )
  )
    throw new Error("Nib model does not exist.");
}

/**
 * Replaces a nib model's specifications and offered reference sets.
 * @param tx - Caller-owned catalog transaction.
 * @param productId - Material-specific nib product.
 * @param input - Authored nib specifications.
 * @param create - Whether to insert a new subtype row.
 * @rejects When references, namespace validation, or persistence fail.
 */
export async function writeNibProduct(
  tx: Transaction,
  productId: number,
  input: NibWrite | undefined,
  create: boolean,
) {
  if (!create && input === undefined) return;
  const value = nibSchema.parse(input);
  await assertConcept(tx, value.sizeFamilyId, "nib-size-family");
  const { widthIds, mountIds, platingStyles, platingMetalIds, ...facts } =
    value;
  if (create)
    await tx
      .insert(schema.productDetailNib)
      .values({ id: productId, ...facts });
  else
    await tx
      .update(schema.productDetailNib)
      .set({ ...facts, updatedAt: new Date() })
      .where(eq(schema.productDetailNib.id, productId));
  await tx
    .delete(schema.nibWidthOffering)
    .where(eq(schema.nibWidthOffering.nibProductId, productId));
  if (widthIds.length)
    await tx
      .insert(schema.nibWidthOffering)
      .values(
        widthIds.map((widthId) => ({ nibProductId: productId, widthId })),
      );
  await tx
    .delete(schema.nibMountCompatibility)
    .where(eq(schema.nibMountCompatibility.nibProductId, productId));
  if (mountIds.length)
    await tx
      .insert(schema.nibMountCompatibility)
      .values(
        mountIds.map((mountId) => ({ nibProductId: productId, mountId })),
      );
  await tx
    .delete(schema.nibPlatingStyleOffering)
    .where(eq(schema.nibPlatingStyleOffering.nibProductId, productId));
  await tx
    .insert(schema.nibPlatingStyleOffering)
    .values(platingStyles.map((style) => ({ nibProductId: productId, style })));
  await tx
    .delete(schema.nibPlatingMetalOffering)
    .where(eq(schema.nibPlatingMetalOffering.nibProductId, productId));
  if (platingMetalIds.length)
    await tx.insert(schema.nibPlatingMetalOffering).values(
      platingMetalIds.map((metalId) => ({
        nibProductId: productId,
        metalId,
      })),
    );
}

/**
 * Replaces model-owned grip sections while preserving retained identities.
 * @param tx - Caller-owned catalog transaction.
 * @param productId - Fountain-pen product owning every section.
 * @param sections - Complete replacement section set.
 * @rejects When a section identity is foreign, a default nib mismatches its mount, or a used section is removed.
 */
async function replaceSections(
  tx: Transaction,
  productId: number,
  sections: FountainPenDetails["sectionOptions"],
) {
  const existing = await tx
    .select({ id: schema.fountainPenSectionOption.id })
    .from(schema.fountainPenSectionOption)
    .where(eq(schema.fountainPenSectionOption.penProductId, productId));
  const retained = new Set<number>();
  for (const section of sections) {
    if (
      section.id !== undefined &&
      (!existing.some((row) => row.id === section.id) ||
        retained.has(section.id))
    )
      throw new Error("Invalid grip section identity.");
    if (
      section.defaultNibProductId !== null &&
      !section.compatibleNibProductIds.includes(section.defaultNibProductId)
    ) {
      const mounts =
        section.mountId === null
          ? []
          : await tx
              .select()
              .from(schema.nibMountCompatibility)
              .where(
                and(
                  eq(
                    schema.nibMountCompatibility.nibProductId,
                    section.defaultNibProductId,
                  ),
                  eq(schema.nibMountCompatibility.mountId, section.mountId),
                ),
              );
      if (!mounts.length)
        throw new Error("The included nib must match the grip section.");
    }
    const facts = {
      name: section.name,
      mountId: section.mountId,
      defaultNibProductId: section.defaultNibProductId,
    };
    const [stored] =
      section.id === undefined
        ? await tx
            .insert(schema.fountainPenSectionOption)
            .values({ penProductId: productId, ...facts })
            .returning({ id: schema.fountainPenSectionOption.id })
        : await tx
            .update(schema.fountainPenSectionOption)
            .set({ ...facts, updatedAt: new Date() })
            .where(eq(schema.fountainPenSectionOption.id, section.id))
            .returning({ id: schema.fountainPenSectionOption.id });
    if (!stored) throw new Error("Grip section could not be saved.");
    retained.add(stored.id);
    await tx
      .delete(schema.fountainPenSectionCompatibleNib)
      .where(
        eq(schema.fountainPenSectionCompatibleNib.sectionOptionId, stored.id),
      );
    if (section.compatibleNibProductIds.length)
      await tx.insert(schema.fountainPenSectionCompatibleNib).values(
        section.compatibleNibProductIds.map((nibProductId) => ({
          sectionOptionId: stored.id,
          nibProductId,
        })),
      );
  }
  const removed = existing
    .filter(({ id }) => !retained.has(id))
    .map(({ id }) => id);
  if (removed.length)
    await tx
      .delete(schema.fountainPenSectionOption)
      .where(inArray(schema.fountainPenSectionOption.id, removed));
}

/**
 * Replaces fountain-pen facts, filling choices, sections, and finial options.
 * @param tx - Caller-owned catalog transaction.
 * @param productId - Fountain-pen product identity.
 * @param input - Authored subtype facts; omission on edit preserves them.
 * @param actor - Author used to validate linked nib visibility.
 * @param create - Whether to insert a new subtype row.
 * @rejects When references, section ownership, installed fit protections, or persistence fail.
 */
export async function writeFountainPenProduct(
  tx: Transaction,
  productId: number,
  input: FountainPenWrite | undefined,
  actor: Actor,
  create: boolean,
) {
  if (!create && input === undefined) return;
  const value = fountainPenSchema.parse(input ?? {});
  for (const [field, namespace] of Object.entries(conceptNamespaces))
    await assertConcept(
      tx,
      value[field as keyof typeof conceptNamespaces],
      namespace,
    );
  await assertNibModels(
    tx,
    [
      value.defaultNibProductId,
      ...value.compatibleNibProductIds,
      ...value.sectionOptions.flatMap((section) => [
        section.defaultNibProductId,
        ...section.compatibleNibProductIds,
      ]),
    ].filter((id): id is number => id !== null),
    actor,
  );
  const mechanisms = value.fillingMechanismIds.length
    ? await tx
        .select()
        .from(schema.fountainPenFillingMechanism)
        .where(
          inArray(
            schema.fountainPenFillingMechanism.id,
            value.fillingMechanismIds,
          ),
        )
    : [];
  if (mechanisms.length !== value.fillingMechanismIds.length)
    throw new Error("Filling mechanism does not exist.");
  const cc = mechanisms.some(({ slug }) => slug === "cartridge-converter");
  const {
    fillingMechanismIds,
    compatibleNibProductIds,
    sectionOptions,
    finialOptions,
    ...facts
  } = value;
  const storedFacts = {
    ...facts,
    connectorFamilyId: cc ? facts.connectorFamilyId : null,
    cartridgeConverterLength: cc ? facts.cartridgeConverterLength : null,
  };
  if (create)
    await tx
      .insert(schema.productDetailFountainPen)
      .values({ id: productId, ...storedFacts });
  else
    await tx
      .update(schema.productDetailFountainPen)
      .set({ ...storedFacts, updatedAt: new Date() })
      .where(eq(schema.productDetailFountainPen.id, productId));
  await tx
    .delete(schema.fountainPenFillingMechanismAssignment)
    .where(
      eq(schema.fountainPenFillingMechanismAssignment.penProductId, productId),
    );
  if (fillingMechanismIds.length)
    await tx.insert(schema.fountainPenFillingMechanismAssignment).values(
      fillingMechanismIds.map((mechanismId) => ({
        penProductId: productId,
        mechanismId,
      })),
    );
  await tx
    .delete(schema.fountainPenCompatibleNib)
    .where(eq(schema.fountainPenCompatibleNib.penProductId, productId));
  if (compatibleNibProductIds.length)
    await tx.insert(schema.fountainPenCompatibleNib).values(
      compatibleNibProductIds.map((nibProductId) => ({
        penProductId: productId,
        nibProductId,
      })),
    );
  await replaceSections(tx, productId, sectionOptions);
  const previous = await tx
    .select()
    .from(schema.fountainPenFinialOption)
    .where(eq(schema.fountainPenFinialOption.penProductId, productId));
  const retained = new Set<number>();
  for (const option of finialOptions) {
    if (
      option.id !== undefined &&
      (!previous.some((row) => row.id === option.id) || retained.has(option.id))
    )
      throw new Error("Invalid finial option identity.");
    const [row] =
      option.id === undefined
        ? await tx
            .insert(schema.fountainPenFinialOption)
            .values({ penProductId: productId, name: option.name })
            .returning()
        : await tx
            .update(schema.fountainPenFinialOption)
            .set({ name: option.name, updatedAt: new Date() })
            .where(eq(schema.fountainPenFinialOption.id, option.id))
            .returning();
    if (!row) throw new Error("Finial option could not be saved.");
    retained.add(row.id);
  }
  const removed = previous
    .filter(({ id }) => !retained.has(id))
    .map(({ id }) => id);
  if (removed.length)
    await tx
      .delete(schema.fountainPenFinialOption)
      .where(inArray(schema.fountainPenFinialOption.id, removed));
}

/**
 * Hydrates the catalog subtype payloads and inferred converter matches in batches.
 * @param db - Catalog reader, optionally in an audit transaction.
 * @param products - Visible products receiving their subtype details.
 * @param viewer - Optional viewer controlling linked nib model visibility.
 * @rejects When subtype or reference queries fail.
 */
export async function loadFountainPenProducts(
  db: ReadDb,
  products: CatalogProduct[],
  viewer?: Actor,
) {
  const nibIds = products
    .filter((p) => p.productTypeSlug === "nib")
    .map((p) => p.id);
  if (nibIds.length) {
    const [details, widths, mounts, styles, metals] = await Promise.all([
      db
        .select()
        .from(schema.productDetailNib)
        .where(inArray(schema.productDetailNib.id, nibIds)),
      db
        .select()
        .from(schema.nibWidthOffering)
        .where(inArray(schema.nibWidthOffering.nibProductId, nibIds)),
      db
        .select()
        .from(schema.nibMountCompatibility)
        .where(inArray(schema.nibMountCompatibility.nibProductId, nibIds)),
      db
        .select()
        .from(schema.nibPlatingStyleOffering)
        .where(inArray(schema.nibPlatingStyleOffering.nibProductId, nibIds)),
      db
        .select()
        .from(schema.nibPlatingMetalOffering)
        .where(inArray(schema.nibPlatingMetalOffering.nibProductId, nibIds)),
    ]);
    for (const row of details) {
      const product = products.find((p) => p.id === row.id);
      if (!product) continue;
      const { id } = row;
      product.nib = {
        form: row.form,
        manufacturerSizeCode: row.manufacturerSizeCode,
        sizeFamilyId: row.sizeFamilyId,
        defaultFeedMaterial: row.defaultFeedMaterial,
        defaultHousingMaterial: row.defaultHousingMaterial,
        widthIds: widths
          .filter((r) => r.nibProductId === id)
          .map((r) => r.widthId),
        mountIds: mounts
          .filter((r) => r.nibProductId === id)
          .map((r) => r.mountId),
        platingStyles: styles
          .filter((r) => r.nibProductId === id)
          .map((r) => r.style),
        platingMetalIds: metals
          .filter((r) => r.nibProductId === id)
          .map((r) => r.metalId),
      } satisfies NibDetails;
    }
  }
  const penIds = products
    .filter((p) => p.productTypeSlug === "fountain-pen")
    .map((p) => p.id);
  if (!penIds.length) return;
  const [
    details,
    fillings,
    compatible,
    sections,
    finials,
    sectionNibs,
    converters,
  ] = await Promise.all([
    db
      .select()
      .from(schema.productDetailFountainPen)
      .where(inArray(schema.productDetailFountainPen.id, penIds)),
    db
      .select()
      .from(schema.fountainPenFillingMechanismAssignment)
      .where(
        inArray(
          schema.fountainPenFillingMechanismAssignment.penProductId,
          penIds,
        ),
      ),
    db
      .select()
      .from(schema.fountainPenCompatibleNib)
      .where(inArray(schema.fountainPenCompatibleNib.penProductId, penIds)),
    db
      .select()
      .from(schema.fountainPenSectionOption)
      .where(inArray(schema.fountainPenSectionOption.penProductId, penIds)),
    db
      .select()
      .from(schema.fountainPenFinialOption)
      .where(inArray(schema.fountainPenFinialOption.penProductId, penIds)),
    db
      .select({
        sectionOptionId: schema.fountainPenSectionCompatibleNib.sectionOptionId,
        nibProductId: schema.fountainPenSectionCompatibleNib.nibProductId,
      })
      .from(schema.fountainPenSectionCompatibleNib)
      .innerJoin(
        schema.fountainPenSectionOption,
        eq(
          schema.fountainPenSectionOption.id,
          schema.fountainPenSectionCompatibleNib.sectionOptionId,
        ),
      )
      .where(inArray(schema.fountainPenSectionOption.penProductId, penIds)),
    db.select().from(schema.fountainPenConverter),
  ]);
  const linkedIds = [
    ...new Set([
      ...details.flatMap((row) =>
        row.defaultNibProductId === null ? [] : [row.defaultNibProductId],
      ),
      ...compatible.map((row) => row.nibProductId),
      ...sections.flatMap((row) =>
        row.defaultNibProductId === null ? [] : [row.defaultNibProductId],
      ),
      ...sectionNibs.map((row) => row.nibProductId),
    ]),
  ];
  const linked = linkedIds.length
    ? await db
        .select({
          id: schema.product.id,
          owner: schema.product.ownerClerkId,
          private: schema.product.isPrivate,
          approval: schema.product.approvalStatus,
        })
        .from(schema.product)
        .where(inArray(schema.product.id, linkedIds))
    : [];
  const visibleNibIds = new Set(
    linked
      .filter(
        (row) =>
          hasPermission(viewer, "products.manage") ||
          row.owner === viewer?.clerkId ||
          (!row.private && row.approval === "approved"),
      )
      .map((row) => row.id),
  );
  for (const row of details) {
    const product = products.find((p) => p.id === row.id);
    if (!product) continue;
    const { id } = row;
    const facts = {
      postable: row.postable,
      ownerReplaceableNib: row.ownerReplaceableNib,
      hasClip: row.hasClip,
      hasInkWindow: row.hasInkWindow,
      capabilityNotes: row.capabilityNotes,
      connectorFamilyId: row.connectorFamilyId,
      cartridgeConverterLength: row.cartridgeConverterLength,
      nibConstructionId: row.nibConstructionId,
      bodySilhouetteId: row.bodySilhouetteId,
      crossSectionId: row.crossSectionId,
      facetCount: row.facetCount,
      formFactorId: row.formFactorId,
      capClosureId: row.capClosureId,
      nibDeploymentId: row.nibDeploymentId,
      defaultNibProductId: row.defaultNibProductId,
    };
    product.fountainPen = {
      ...facts,
      defaultNibProductId:
        facts.defaultNibProductId !== null &&
        visibleNibIds.has(facts.defaultNibProductId)
          ? facts.defaultNibProductId
          : null,
      fillingMechanismIds: fillings
        .filter((r) => r.penProductId === id)
        .map((r) => r.mechanismId),
      compatibleNibProductIds: compatible
        .filter(
          (r) => r.penProductId === id && visibleNibIds.has(r.nibProductId),
        )
        .map((r) => r.nibProductId),
      sectionOptions: sections
        .filter((r) => r.penProductId === id)
        .map((r) => ({
          id: r.id,
          name: r.name,
          mountId: r.mountId,
          defaultNibProductId:
            r.defaultNibProductId !== null &&
            visibleNibIds.has(r.defaultNibProductId)
              ? r.defaultNibProductId
              : null,
          compatibleNibProductIds: sectionNibs
            .filter(
              (link) =>
                link.sectionOptionId === r.id &&
                visibleNibIds.has(link.nibProductId),
            )
            .map((link) => link.nibProductId),
        })),
      finialOptions: finials
        .filter((r) => r.penProductId === id)
        .map((r) => ({ id: r.id, name: r.name })),
    } satisfies FountainPenDetails;
    product.compatibleConverters = converters.filter(
      (converter) =>
        facts.connectorFamilyId !== null &&
        facts.cartridgeConverterLength !== null &&
        converter.connectorFamilyId === facts.connectorFamilyId &&
        converter.lengthClass !== null &&
        (facts.cartridgeConverterLength === "short-and-long" ||
          facts.cartridgeConverterLength === converter.lengthClass),
    );
  }
}

/**
 * Saves an owned nib, copying generic component defaults once and validating actual plating/width.
 * @param tx - Caller-owned item transaction.
 * @param itemId - Owned nib identity.
 * @param productId - Material-specific catalog nib.
 * @param input - Actual width, feed/housing, and plating selections.
 * @param create - Whether this is a new owned nib.
 * @rejects When actual choices are invalid or are not offered by the nib model.
 */
export async function writeNibItem(
  tx: Transaction,
  itemId: number,
  productId: number,
  input: NibItemWrite | undefined,
  create: boolean,
) {
  if (!create && input === undefined) return;
  const value = nibItemSchema.parse(input ?? {});
  const [model] = await tx
    .select()
    .from(schema.productDetailNib)
    .where(eq(schema.productDetailNib.id, productId));
  if (!model) throw new Error("Nib model does not exist.");
  const [previous] = await tx
    .select()
    .from(schema.collectionDetailNib)
    .where(eq(schema.collectionDetailNib.id, itemId));
  if (value.widthId !== null && value.widthId !== previous?.widthId) {
    const [width] = await tx
      .select()
      .from(schema.nibWidthOffering)
      .where(
        and(
          eq(schema.nibWidthOffering.nibProductId, productId),
          eq(schema.nibWidthOffering.widthId, value.widthId),
        ),
      );
    if (!width) throw new Error("web.nib.validation.width");
  }
  if (value.platingStyle !== previous?.platingStyle) {
    const [style] = await tx
      .select()
      .from(schema.nibPlatingStyleOffering)
      .where(
        and(
          eq(schema.nibPlatingStyleOffering.nibProductId, productId),
          eq(schema.nibPlatingStyleOffering.style, value.platingStyle),
        ),
      );
    if (!style) throw new Error("web.nib.validation.offering");
  }
  for (const field of [
    "coatingMetalId",
    "bodyCoatingMetalId",
    "tinesCoatingMetalId",
  ] as const) {
    const metalId = value[field];
    if (metalId === null || metalId === previous?.[field]) continue;
    const [offered] = await tx
      .select()
      .from(schema.nibPlatingMetalOffering)
      .where(
        and(
          eq(schema.nibPlatingMetalOffering.nibProductId, productId),
          eq(schema.nibPlatingMetalOffering.metalId, metalId),
        ),
      );
    if (!offered) throw new Error("web.nib.validation.offering");
  }
  const facts = {
    ...value,
    feedMaterial:
      value.feedMaterial ?? previous?.feedMaterial ?? model.defaultFeedMaterial,
    housingMaterial:
      value.housingMaterial ??
      previous?.housingMaterial ??
      model.defaultHousingMaterial,
  };
  if (create)
    await tx
      .insert(schema.collectionDetailNib)
      .values({ id: itemId, productNibId: productId, ...facts });
  else
    await tx
      .update(schema.collectionDetailNib)
      .set({ ...facts, updatedAt: new Date() })
      .where(eq(schema.collectionDetailNib.id, itemId));
}

/**
 * Saves one explicit nib state and moves an installed same-owner nib with its pen.
 * @param tx - Caller-owned item transaction.
 * @param itemId - Owned fountain-pen identity.
 * @param productId - Fountain-pen catalog identity.
 * @param input - Complete section, finial, and installed-nib selection.
 * @param ownerId - Physical item's owner, including staff edits.
 * @param collectionId - Collection that must contain both installed items.
 * @param create - Whether to insert a new subtype row.
 * @rejects When fit, included-nib rules, ownership, availability, or one-installation constraints fail.
 */
export async function writeFountainPenItem(
  tx: Transaction,
  itemId: number,
  productId: number,
  input: FountainPenItemWrite | undefined,
  ownerId: number,
  collectionId: number,
  create: boolean,
) {
  if (!create && input === undefined) return;
  const value = fountainPenItemSchema.parse(input ?? {});
  const [model] = await tx
    .select()
    .from(schema.productDetailFountainPen)
    .where(eq(schema.productDetailFountainPen.id, productId));
  if (!model) throw new Error("Fountain-pen model does not exist.");
  const [section] =
    value.sectionOptionId === null
      ? []
      : await tx
          .select()
          .from(schema.fountainPenSectionOption)
          .where(
            and(
              eq(schema.fountainPenSectionOption.id, value.sectionOptionId),
              eq(schema.fountainPenSectionOption.penProductId, productId),
            ),
          );
  if (value.sectionOptionId !== null && !section)
    throw new Error("web.fountainPen.sectionRequired");
  const [availableSection] = section
    ? []
    : await tx
        .select({ id: schema.fountainPenSectionOption.id })
        .from(schema.fountainPenSectionOption)
        .where(eq(schema.fountainPenSectionOption.penProductId, productId))
        .limit(1);
  if (value.finialOptionId !== null) {
    const [finial] = await tx
      .select()
      .from(schema.fountainPenFinialOption)
      .where(
        and(
          eq(schema.fountainPenFinialOption.id, value.finialOptionId),
          eq(schema.fountainPenFinialOption.penProductId, productId),
        ),
      );
    if (!finial)
      throw new Error("Finial option does not belong to this fountain pen.");
  }
  const nibState = value.nib;
  if (nibState.mode === "default") {
    if (!section && availableSection)
      throw new Error("web.fountainPen.sectionRequired");
    const defaultNib = section
      ? section.defaultNibProductId
      : model.defaultNibProductId;
    if (defaultNib === null)
      throw new Error("web.fountainPen.sectionWithoutNib");
    if (nibState.defaultNibWidthId !== null) {
      const [width] = await tx
        .select()
        .from(schema.nibWidthOffering)
        .where(
          and(
            eq(schema.nibWidthOffering.nibProductId, defaultNib),
            eq(schema.nibWidthOffering.widthId, nibState.defaultNibWidthId),
          ),
        );
      if (!width) throw new Error("web.nib.validation.width");
    }
  }
  let customizedNib = false;
  if (nibState.mode === "owned") {
    await tx.execute(
      sql`select id from collection_item where id = ${nibState.ownedNibCollectionItemId} for update`,
    );
    const [nib] = await tx
      .select({
        id: schema.collectionDetailNib.id,
        productId: schema.collectionDetailNib.productNibId,
        ownerId: schema.collectionItem.ownerId,
        collectionId: schema.collectionItem.collectionId,
        owned: schema.collectionItem.owned,
        soldAt: schema.collectionItem.soldAt,
        approval: schema.collectionItem.approvalStatus,
      })
      .from(schema.collectionDetailNib)
      .innerJoin(
        schema.collectionItem,
        eq(schema.collectionItem.id, schema.collectionDetailNib.id),
      )
      .where(
        eq(schema.collectionDetailNib.id, nibState.ownedNibCollectionItemId),
      );
    if (
      !nib ||
      nib.ownerId !== ownerId ||
      !nib.owned ||
      nib.soldAt !== null ||
      nib.approval === "rejected"
    )
      throw new Error("web.fountainPen.unavailableNib");
    const [installed] = await tx
      .select({ id: schema.collectionDetailFountainPen.id })
      .from(schema.collectionDetailFountainPen)
      .where(
        eq(
          schema.collectionDetailFountainPen.installedNibCollectionItemId,
          nib.id,
        ),
      );
    if (installed && installed.id !== itemId)
      throw new Error("web.fountainPen.alreadyInstalled");
    const explicit = section
      ? await tx
          .select()
          .from(schema.fountainPenSectionCompatibleNib)
          .where(
            and(
              eq(
                schema.fountainPenSectionCompatibleNib.sectionOptionId,
                section.id,
              ),
              eq(
                schema.fountainPenSectionCompatibleNib.nibProductId,
                nib.productId,
              ),
            ),
          )
      : await tx
          .select()
          .from(schema.fountainPenCompatibleNib)
          .where(
            and(
              eq(schema.fountainPenCompatibleNib.penProductId, productId),
              eq(schema.fountainPenCompatibleNib.nibProductId, nib.productId),
            ),
          );
    const mount =
      section?.mountId == null
        ? []
        : await tx
            .select()
            .from(schema.nibMountCompatibility)
            .where(
              and(
                eq(schema.nibMountCompatibility.nibProductId, nib.productId),
                eq(schema.nibMountCompatibility.mountId, section.mountId),
              ),
            );
    const compatible =
      (!availableSection || section !== undefined) &&
      (explicit.length > 0 ||
        mount.length > 0 ||
        (section ? section.defaultNibProductId : model.defaultNibProductId) ===
          nib.productId);
    customizedNib = !compatible || model.ownerReplaceableNib === false;
    if (customizedNib && !nibState.customizationConfirmed)
      throw new Error("web.fountainPen.incompatibleNib");
    if (nib.collectionId !== collectionId) {
      await tx
        .update(schema.collectionItem)
        .set({ collectionId, updatedAt: new Date() })
        .where(eq(schema.collectionItem.id, nib.id));
      await tx
        .update(schema.userCollection)
        .set({ updatedAt: new Date() })
        .where(
          inArray(schema.userCollection.id, [collectionId, nib.collectionId]),
        );
    }
  }
  const facts = {
    sectionOptionId: value.sectionOptionId,
    finialOptionId: value.finialOptionId,
    nibMode: nibState.mode,
    defaultNibWidthId:
      nibState.mode === "default" ? nibState.defaultNibWidthId : null,
    installedNibCollectionItemId:
      nibState.mode === "owned" ? nibState.ownedNibCollectionItemId : null,
    customizedNib,
  };
  if (create)
    await tx
      .insert(schema.collectionDetailFountainPen)
      .values({ id: itemId, productFountainPenId: productId, ...facts });
  else
    await tx
      .update(schema.collectionDetailFountainPen)
      .set({ ...facts, updatedAt: new Date() })
      .where(eq(schema.collectionDetailFountainPen.id, itemId));
}

/**
 * Hydrates owned subtype snapshots after the caller authorizes item visibility.
 * @param db - Collection reader after the base items have been authorized.
 * @param items - Visible collection items receiving their subtype snapshots.
 * @rejects When subtype queries fail.
 */
export async function loadFountainPenItems(
  db: ReadDb,
  items: UserCollectionItem[],
) {
  const ids = items.map((item) => item.collectionItemId);
  if (!ids.length) return;
  const [nibs, pens] = await Promise.all([
    db
      .select()
      .from(schema.collectionDetailNib)
      .where(inArray(schema.collectionDetailNib.id, ids)),
    db
      .select()
      .from(schema.collectionDetailFountainPen)
      .where(inArray(schema.collectionDetailFountainPen.id, ids)),
  ]);
  for (const row of nibs) {
    const item = items.find((i) => i.collectionItemId === row.id);
    if (!item) continue;
    item.nib = {
      widthId: row.widthId,
      feedMaterial: row.feedMaterial,
      housingMaterial: row.housingMaterial,
      platingStyle: row.platingStyle,
      coatingMetalId: row.coatingMetalId,
      bodyCoatingMetalId: row.bodyCoatingMetalId,
      tinesCoatingMetalId: row.tinesCoatingMetalId,
    };
  }
  for (const row of pens) {
    const item = items.find((i) => i.collectionItemId === row.id);
    if (!item) continue;
    item.fountainPen = {
      sectionOptionId: row.sectionOptionId,
      finialOptionId: row.finialOptionId,
      nib:
        row.nibMode === "default"
          ? { mode: "default", defaultNibWidthId: row.defaultNibWidthId }
          : row.nibMode === "owned" && row.installedNibCollectionItemId !== null
            ? {
                mode: "owned",
                ownedNibCollectionItemId: row.installedNibCollectionItemId,
                customizationConfirmed: row.customizedNib,
              }
            : { mode: "none" },
    };
  }
}

/**
 * Captures allowlisted owned subtype facts for create/update audit snapshots.
 * @param db - Caller transaction holding the collection-item lock.
 * @param itemId - Owned item being audited.
 * @returns Nib and fountain-pen facts without mutable timestamps or owner identifiers.
 * @rejects When the subtype read fails.
 */
export async function fountainPenItemAuditState(
  db: ReadDb,
  itemId: number,
): Promise<AuditJsonObject> {
  const [pens, nibs] = await Promise.all([
    db
      .select()
      .from(schema.collectionDetailFountainPen)
      .where(eq(schema.collectionDetailFountainPen.id, itemId)),
    db
      .select()
      .from(schema.collectionDetailNib)
      .where(eq(schema.collectionDetailNib.id, itemId)),
  ]);
  const pen = pens[0];
  const nib = nibs[0];
  return {
    fountainPen: pen
      ? {
          productId: pen.productFountainPenId,
          sectionOptionId: pen.sectionOptionId,
          finialOptionId: pen.finialOptionId,
          nibMode: pen.nibMode,
          defaultNibWidthId: pen.defaultNibWidthId,
          installedNibCollectionItemId: pen.installedNibCollectionItemId,
          customizedNib: pen.customizedNib,
        }
      : null,
    nib: nib
      ? {
          productId: nib.productNibId,
          widthId: nib.widthId,
          feedMaterial: nib.feedMaterial,
          housingMaterial: nib.housingMaterial,
          platingStyle: nib.platingStyle,
          coatingMetalId: nib.coatingMetalId,
          bodyCoatingMetalId: nib.bodyCoatingMetalId,
          tinesCoatingMetalId: nib.tinesCoatingMetalId,
        }
      : null,
  };
}

/**
 * Reads shared filling, fit, classification, width, and plating form references.
 * @param db - Application catalog reader.
 * @returns Independently selectable reference lists with their canonical identities.
 * @rejects When a reference query fails.
 */
export async function listFountainPenOptions(db: ReadDb) {
  const [
    fillingMechanisms,
    connectorFamilies,
    converters,
    nibMounts,
    nibWidths,
    platingStyles,
    platingMetals,
    concepts,
  ] = await Promise.all([
    db.select().from(schema.fountainPenFillingMechanism),
    db.select().from(schema.fountainPenConnectorFamily),
    db.select().from(schema.fountainPenConverter),
    db.select().from(schema.nibMount),
    db.select().from(schema.nibWidth),
    db.select().from(schema.nibPlatingStyle),
    db.select().from(schema.nibPlatingMetal),
    db
      .select()
      .from(schema.catalogTerminologyConcept)
      .where(
        inArray(schema.catalogTerminologyConcept.namespace, [
          ...Object.values(conceptNamespaces),
          "nib-size-family",
        ]),
      ),
  ]);
  return {
    fillingMechanisms,
    connectorFamilies,
    converters,
    nibMounts,
    nibWidths,
    platingStyles,
    platingMetals,
    concepts,
  };
}

/** Canonical form reference lists for the fountain-pen and nib subtypes. */
export type FountainPenOptions = Awaited<
  ReturnType<typeof listFountainPenOptions>
>;
