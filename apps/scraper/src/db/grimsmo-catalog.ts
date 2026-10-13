import { type Database, schema } from "@package/database";
import { and, eq, inArray, sql } from "drizzle-orm";

/** Options controlling canonical Saga material synchronization. */
export type SyncCanonicalSagaMaterialsOptions = {
  /** Whether to report the planned assignments without writing them. */
  dryRun?: boolean;
};

/** Outcome of reconciling source material names with the canonical Saga Pen. */
export type CanonicalSagaMaterialSyncResult = {
  /** Canonical material names that were already assigned. */
  existingMaterialNames: string[];
  /** Canonical material names newly assigned, or planned in dry-run mode. */
  newMaterialNames: string[];
  /** Canonical Saga product identifier. */
  productId: number;
  /** Source material names that could not be resolved to canonical rows. */
  unresolvedMaterialNames: string[];
};

/** Stable catalog identity established by the approved Saga seed manifest. */
const sagaIdentity = {
  makerSlug: "grimsmo",
  productSlug: "saga",
};

/**
 * Adds newly observed source materials to the canonical Grimsmo Saga Pen.
 *
 * Existing assignments are never removed, and unresolved names never create
 * lookup rows. Material-specific names resolve to their canonical parent and
 * preserve the specific material on the product assignment.
 *
 * @param db - Database containing the seeded canonical Pens catalog.
 * @param sourceMaterialNames - Normalized material labels observed in the feed.
 * @param options - Dry-run control for the reconciliation.
 * @returns Added, existing, and unresolved canonical material names.
 * @rejects When the seeded canonical Saga Pen cannot be resolved.
 */
export async function syncCanonicalSagaMaterials(
  db: Database,
  sourceMaterialNames: readonly string[],
  { dryRun = false }: SyncCanonicalSagaMaterialsOptions = {},
): Promise<CanonicalSagaMaterialSyncResult> {
  const names = uniqueNormalizedNames(sourceMaterialNames);
  const [saga] = await db
    .select({ productId: schema.product.id })
    .from(schema.product)
    .innerJoin(schema.maker, eq(schema.product.makerId, schema.maker.id))
    .innerJoin(
      schema.productDetailPen,
      eq(schema.productDetailPen.id, schema.product.id),
    )
    .where(
      and(
        eq(schema.maker.slug, sagaIdentity.makerSlug),
        eq(schema.product.slug, sagaIdentity.productSlug),
      ),
    )
    .limit(1);

  if (!saga) {
    throw new Error(
      "Canonical Grimsmo Saga Pen is missing; run the approved Pens seed before the scraper.",
    );
  }

  if (names.length === 0) {
    return {
      existingMaterialNames: [],
      newMaterialNames: [],
      productId: saga.productId,
      unresolvedMaterialNames: [],
    };
  }

  const [generalMaterials, specificMaterials] = await Promise.all([
    db
      .select({
        materialId: schema.material.id,
        materialName: schema.material.name,
        materialSpecificId: sql<number | null>`null`,
      })
      .from(schema.material)
      .where(inArray(sql`lower(${schema.material.name})`, names)),
    db
      .select({
        materialId: schema.material.id,
        materialName: schema.materialSpecific.name,
        materialSpecificId: schema.materialSpecific.id,
      })
      .from(schema.materialSpecific)
      .innerJoin(
        schema.material,
        eq(schema.materialSpecific.materialId, schema.material.id),
      )
      .where(inArray(sql`lower(${schema.materialSpecific.name})`, names)),
  ]);
  const resolvedByName = new Map(
    [...generalMaterials, ...specificMaterials].map((material) => [
      material.materialName.trim().toLowerCase(),
      material,
    ]),
  );
  const resolved = names.flatMap((name) => {
    const material = resolvedByName.get(name);
    return material ? [material] : [];
  });
  const existing =
    resolved.length === 0
      ? []
      : await db
          .select({
            materialId: schema.productMaterial.materialId,
            materialSpecificId: schema.productMaterial.materialSpecificId,
          })
          .from(schema.productMaterial)
          .where(eq(schema.productMaterial.productId, saga.productId));
  const existingKeys = new Set(
    existing.map((assignment) =>
      materialAssignmentKey(
        assignment.materialId,
        assignment.materialSpecificId,
      ),
    ),
  );
  const newMaterials = resolved.filter(
    (material) =>
      !existingKeys.has(
        materialAssignmentKey(material.materialId, material.materialSpecificId),
      ),
  );

  if (!dryRun && newMaterials.length > 0) {
    await db
      .insert(schema.productMaterial)
      .values(
        newMaterials.map((material) => ({
          materialId: material.materialId,
          materialSpecificId: material.materialSpecificId,
          productId: saga.productId,
        })),
      )
      .onConflictDoNothing();
  }

  const newKeys = new Set(
    newMaterials.map((material) =>
      materialAssignmentKey(material.materialId, material.materialSpecificId),
    ),
  );

  return {
    existingMaterialNames: resolved
      .filter(
        (material) =>
          !newKeys.has(
            materialAssignmentKey(
              material.materialId,
              material.materialSpecificId,
            ),
          ),
      )
      .map((material) => material.materialName),
    newMaterialNames: newMaterials.map((material) => material.materialName),
    productId: saga.productId,
    unresolvedMaterialNames: names.filter((name) => !resolvedByName.has(name)),
  };
}

/**
 * Returns unique, case-insensitive material names in stable order.
 *
 * @param names - Source material names to normalize.
 * @returns Sorted unique lower-case material names.
 */
function uniqueNormalizedNames(names: readonly string[]): string[] {
  return [...new Set(names.map((name) => name.trim().toLowerCase()))]
    .filter(Boolean)
    .sort();
}

/**
 * Builds a stable key for one general or specific material assignment.
 *
 * @param materialId - Canonical general material identifier.
 * @param materialSpecificId - Optional canonical alloy or grade identifier.
 * @returns Stable assignment key used for idempotent comparison.
 */
function materialAssignmentKey(
  materialId: number,
  materialSpecificId: number | null,
): string {
  return `${materialId}:${materialSpecificId ?? "general"}`;
}
