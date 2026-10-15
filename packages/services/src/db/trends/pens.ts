import type { Database } from "@package/database";
import { schema } from "@package/database";
import { inArray, sql } from "drizzle-orm";

/** One refill-format bucket with exact catalog relationship counts. */
export type PublicPenRefillTrendValue = {
  /** Distinct approved public Pens compatible with this format. */
  compatiblePenCount: number;
  /** Stable refill compatibility-group identifier. */
  key: string;
  /** Canonical refill-format label. */
  label: string;
  /** Distinct approved public standalone Refills in this format. */
  standaloneRefillCount: number;
};

/** Exact public Pen and Refill compatibility Trends. */
export type PublicPenRefillTrends = {
  /** Percentage of approved public Pens with at least one known refill format. */
  penCoveragePercent: number;
  /** Stable Pen product-type identifier used by URL filters. */
  penProductTypeId: number;
  /** Stable Refill product-type identifier used by URL filters. */
  refillProductTypeId: number;
  /** Refill-format buckets ordered by total catalog coverage. */
  values: PublicPenRefillTrendValue[];
};

/** Raw database row for one refill-format bucket. */
type PenRefillTrendRow = {
  /** Distinct compatible Pen count. */
  compatiblePenCount: number | string;
  /** Stable compatibility-group identifier. */
  groupId: number | string;
  /** Canonical refill-format label. */
  label: string;
  /** Distinct standalone Refill count. */
  standaloneRefillCount: number | string;
};

/** Raw database row for public Pen compatibility coverage. */
type PenRefillCoverageRow = {
  /** Distinct approved public Pens with a known refill format. */
  compatiblePenCount: number | string;
  /** Total approved public complete Pens. */
  penCount: number | string;
};

/**
 * Loads exact public Pen and standalone Refill counts by normalized refill format.
 *
 * Installed-refill and collection usage data are intentionally outside this query.
 *
 * @param db - Application database.
 * @returns Refill-format Trends, or null when Pen or Refill types are absent.
 * @rejects When a database query fails.
 */
export async function getPublicPenRefillTrends(
  db: Database,
): Promise<PublicPenRefillTrends | null> {
  const productTypes = await db
    .select({ id: schema.productType.id, slug: schema.productType.slug })
    .from(schema.productType)
    .where(inArray(schema.productType.slug, ["pen", "refill"]));
  const penType = productTypes.find(({ slug }) => slug === "pen");
  const refillType = productTypes.find(({ slug }) => slug === "refill");
  if (!penType || !refillType) return null;

  const [coverage, formats] = await Promise.all([
    db.execute<PenRefillCoverageRow>(sql`
      with public_pens as (
        select product.id
        from product
        inner join product_detail_pen on product_detail_pen.id = product.id
        where product.product_type_id = ${penType.id}
          and product.approval_status = 'approved'
          and not product.is_private
      ), compatible_pen_formats as (
        select assertion.pen_product_id, assertion.target_group_id as group_id
        from refill_compatibility_assertion assertion
        inner join public_pens on public_pens.id = assertion.pen_product_id
        where assertion.target_group_id is not null
        union
        select assertion.pen_product_id, membership.group_id
        from refill_compatibility_assertion assertion
        inner join public_pens on public_pens.id = assertion.pen_product_id
        inner join refill_compatibility_group_membership membership
          on membership.refill_product_id = assertion.target_refill_product_id
      )
      select
        (select count(*)::integer from public_pens) as "penCount",
        count(distinct compatible_pen_formats.pen_product_id)::integer as "compatiblePenCount"
      from compatible_pen_formats
    `),
    db.execute<PenRefillTrendRow>(sql`
      with public_pens as (
        select product.id
        from product
        inner join product_detail_pen on product_detail_pen.id = product.id
        where product.product_type_id = ${penType.id}
          and product.approval_status = 'approved'
          and not product.is_private
      ), public_refills as (
        select product.id
        from product
        inner join product_detail_refill on product_detail_refill.id = product.id
        where product.product_type_id = ${refillType.id}
          and product.approval_status = 'approved'
          and not product.is_private
      ), compatible_pen_formats as (
        select assertion.pen_product_id, assertion.target_group_id as group_id
        from refill_compatibility_assertion assertion
        inner join public_pens on public_pens.id = assertion.pen_product_id
        where assertion.target_group_id is not null
        union
        select assertion.pen_product_id, membership.group_id
        from refill_compatibility_assertion assertion
        inner join public_pens on public_pens.id = assertion.pen_product_id
        inner join refill_compatibility_group_membership membership
          on membership.refill_product_id = assertion.target_refill_product_id
      )
      select
        compatibility_group.id as "groupId",
        concept.canonical_label_fallback as label,
        count(distinct compatible_pen_formats.pen_product_id)::integer as "compatiblePenCount",
        count(distinct public_refills.id)::integer as "standaloneRefillCount"
      from refill_compatibility_group compatibility_group
      inner join catalog_terminology_concept concept
        on concept.id = compatibility_group.concept_id
      left join compatible_pen_formats
        on compatible_pen_formats.group_id = compatibility_group.id
      left join refill_compatibility_group_membership membership
        on membership.group_id = compatibility_group.id
      left join public_refills on public_refills.id = membership.refill_product_id
      group by compatibility_group.id, concept.canonical_label_fallback
      having count(distinct compatible_pen_formats.pen_product_id) > 0
        or count(distinct public_refills.id) > 0
      order by
        count(distinct compatible_pen_formats.pen_product_id)
          + count(distinct public_refills.id) desc,
        concept.canonical_label_fallback
    `),
  ]);
  const coverageRow = coverage.rows[0];
  const penCount = Number(coverageRow?.penCount ?? 0);
  const compatiblePenCount = Number(coverageRow?.compatiblePenCount ?? 0);

  return {
    penCoveragePercent:
      penCount === 0
        ? 0
        : Math.round((compatiblePenCount / penCount) * 1000) / 10,
    penProductTypeId: penType.id,
    refillProductTypeId: refillType.id,
    values: formats.rows.map((row) => ({
      compatiblePenCount: Number(row.compatiblePenCount),
      key: String(row.groupId),
      label: row.label,
      standaloneRefillCount: Number(row.standaloneRefillCount),
    })),
  };
}
