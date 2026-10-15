import type { Database } from "@package/database";
import { schema } from "@package/database";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  type SliderMagnetLayout,
  sliderClickCount,
  sliderMagnetLayoutDetails,
} from "../../constants.js";
import {
  convertDimension,
  convertWeight,
  type DimensionMeasurement,
  type WeightMeasurement,
} from "../../measurements.js";
import {
  PUBLIC_TRENDS_CONTRIBUTOR_THRESHOLD,
  PUBLIC_TRENDS_ROUNDING_INCREMENT,
} from "./constants.js";

/** Minimum catalog-field coverage required before a Slider chart is shown. */
export const SLIDER_TRENDS_COVERAGE_THRESHOLD = 70;

/** Stable Slider characteristic identifiers exposed to presentation clients. */
export const sliderTrendMetricIds = [
  "bodyMaterial",
  "length",
  "magnetLayout",
  "maker",
  "plateMaterial",
  "positionCount",
  "thickness",
  "weight",
  "width",
] as const;

/** Stable Slider characteristic identifier. */
export type SliderTrendMetricId = (typeof sliderTrendMetricIds)[number];

/** One exact Slider value with an optional privacy-safe collection count. */
export type PublicSliderTrendValue = {
  /** Exact count of approved public catalog Sliders. */
  catalogCount: number;
  /** Rounded owned-item count, or null when its contributor count is too low. */
  collectionCount: number | null;
  /** Stable category or canonical measurement key. */
  key: string;
  /** Human-readable category label; numeric values are formatted by the client. */
  label: string;
  /** Canonical numeric value for distribution charts. */
  numericValue: number | null;
};

/** One coverage-qualified Slider characteristic. */
export type PublicSliderTrend = {
  /** Percentage of approved public catalog Sliders with this field populated. */
  coveragePercent: number;
  /** Whether any collection value was removed by the contributor threshold. */
  hasSuppressedCollectionValues: boolean;
  /** Stable characteristic identifier. */
  metric: SliderTrendMetricId;
  /** Canonical unit for numeric values. */
  unit: "g" | "mm" | null;
  /** Exact catalog values paired with privacy-safe collection counts. */
  values: PublicSliderTrendValue[];
};

/** Coverage-qualified public Slider characteristics. */
export type PublicSliderTrends = {
  /** Number of approved public catalog Sliders used for coverage. */
  catalogProductCount: number;
  /** Stable Slider product-type identifier used by URL filters. */
  productTypeId: number;
  /** Eligible characteristic charts. */
  trends: PublicSliderTrend[];
};

/** One normalized source record used to build Slider Trends. */
export type SliderTrendSourceRecord = {
  /** Body materials assigned to the parent Slider. */
  bodyMaterials: SliderTrendCategory[];
  /** Stable product or collection-item identifier. */
  id: number;
  /** Exact catalog length. */
  length: DimensionMeasurement | null;
  /** Effective physical magnet layout. */
  magnetLayout: SliderMagnetLayout | null;
  /** Canonical maker category. */
  maker: SliderTrendCategory;
  /** Collection owner used only to enforce the public contributor threshold. */
  ownerId: number | null;
  /** Materials assigned to the effective included or installed plate. */
  plateMaterials: SliderTrendCategory[];
  /** Exact catalog thickness. */
  thickness: DimensionMeasurement | null;
  /** Exact catalog weight. */
  weight: WeightMeasurement | null;
  /** Exact catalog width. */
  width: DimensionMeasurement | null;
};

/** Stable named category used by a Slider Trend source record. */
type SliderTrendCategory = {
  /** Stable category identifier. */
  id: number;
  /** Human-readable category name. */
  name: string;
};

/** Raw Slider row before parent and plate materials are attached. */
type SliderTrendRow = {
  /** Stable product or collection-item identifier. */
  id: number;
  /** Stored length value. */
  length: string | null;
  /** Stored length unit. */
  lengthUnit: "in" | "mm" | null;
  /** Effective physical magnet layout. */
  magnetLayout: SliderMagnetLayout | null;
  /** Canonical maker category. */
  maker: SliderTrendCategory;
  /** Collection owner used only for contributor thresholds. */
  ownerId: number | null;
  /** Effective included or installed plate product. */
  plateProductId: number | null;
  /** Parent catalog Slider product. */
  productId: number;
  /** Stored thickness value. */
  thickness: string | null;
  /** Stored thickness unit. */
  thicknessUnit: "in" | "mm" | null;
  /** Stored weight value. */
  weight: string | null;
  /** Stored weight unit. */
  weightUnit: "g" | "oz" | null;
  /** Stored width value. */
  width: string | null;
  /** Stored width unit. */
  widthUnit: "in" | "mm" | null;
};

/** One normalized value emitted by a metric definition. */
type SliderMetricValue = {
  /** Stable grouping key. */
  key: string;
  /** Display label for categorical values. */
  label: string;
  /** Canonical numeric value. */
  numericValue: number | null;
};

/** Defines one Slider field without duplicating aggregation logic. */
type SliderMetricDefinition = {
  /**
   * Extracts normalized values from one Slider.
   *
   * @param record - Slider source record.
   * @returns Zero or more normalized values.
   */
  getValues: (record: SliderTrendSourceRecord) => SliderMetricValue[];
  /** Stable metric identifier. */
  metric: SliderTrendMetricId;
  /** Canonical numeric unit. */
  unit: PublicSliderTrend["unit"];
};

/**
 * Extracts categorical values from one Slider record.
 *
 * @param record - Slider source record.
 * @returns Zero or more category keys and labels.
 */
type SliderCategoryExtractor = (
  record: SliderTrendSourceRecord,
) => SliderTrendCategory[];

/**
 * Extracts one canonical measurement from a Slider record.
 *
 * @param record - Slider source record.
 * @returns Canonical measurement, or null when absent.
 */
type SliderMeasurementExtractor = (
  record: SliderTrendSourceRecord,
) => number | null;

/** Internal counts collected for one normalized Slider value. */
type SliderValueAggregate = {
  /** Exact catalog-product identifiers. */
  catalogIds: Set<number>;
  /** Exact collection-item identifiers. */
  collectionIds: Set<number>;
  /** Distinct collection owner identifiers. */
  contributorIds: Set<number>;
  /** Human-readable category label. */
  label: string;
  /** Canonical measurement value. */
  numericValue: number | null;
};

/** Shared definitions for fields that exist in the current Slider schema. */
const metricDefinitions: SliderMetricDefinition[] = [
  categoryMetric("bodyMaterial", (record) => record.bodyMaterials),
  measurementMetric("length", "mm", (record) =>
    canonicalDimension(record.length),
  ),
  categoryMetric("magnetLayout", (record) =>
    record.magnetLayout
      ? [
          {
            id: sliderClickCount(record.magnetLayout),
            name: sliderMagnetLayoutDetails[record.magnetLayout].label,
          },
        ]
      : [],
  ),
  categoryMetric("maker", (record) => [record.maker]),
  categoryMetric("plateMaterial", (record) => record.plateMaterials),
  categoryMetric("positionCount", (record) =>
    record.magnetLayout
      ? [
          {
            id: sliderClickCount(record.magnetLayout),
            name: String(sliderClickCount(record.magnetLayout)),
          },
        ]
      : [],
  ),
  measurementMetric("thickness", "mm", (record) =>
    canonicalDimension(record.thickness),
  ),
  measurementMetric("weight", "g", (record) =>
    record.weight
      ? canonicalNumber(
          convertWeight(record.weight.value, record.weight.unit, "g"),
        )
      : null,
  ),
  measurementMetric("width", "mm", (record) =>
    canonicalDimension(record.width),
  ),
];

/**
 * Loads coverage-qualified Slider characteristics from parent Slider records.
 *
 * @param db - Application database.
 * @returns Public Slider Trends, or null when the Slider product type is absent.
 * @rejects When a database query fails.
 */
export async function getPublicSliderTrends(
  db: Database,
): Promise<PublicSliderTrends | null> {
  const [sliderType] = await db
    .select({ id: schema.productType.id })
    .from(schema.productType)
    .where(eq(schema.productType.slug, "slider"))
    .limit(1);
  if (!sliderType) return null;

  const catalogRows = await sliderRows(db, sliderType.id, false);
  const collectionRows = await sliderRows(db, sliderType.id, true);
  return {
    catalogProductCount: catalogRows.length,
    productTypeId: sliderType.id,
    trends: summarizeSliderTrends(
      await rowsToRecords(db, catalogRows),
      await rowsToRecords(db, collectionRows),
    ),
  };
}

/**
 * Builds eligible public Slider metrics from exact catalog and collection rows.
 *
 * @param catalogRecords - Approved public catalog Sliders.
 * @param collectionRecords - Currently owned parent Slider items.
 * @returns Metrics at or above the coverage threshold.
 */
export function summarizeSliderTrends(
  catalogRecords: SliderTrendSourceRecord[],
  collectionRecords: SliderTrendSourceRecord[],
): PublicSliderTrend[] {
  if (catalogRecords.length === 0) return [];
  return metricDefinitions.flatMap((definition) => {
    const populated = catalogRecords.filter(
      (record) => definition.getValues(record).length > 0,
    );
    const coveragePercent =
      Math.round((populated.length / catalogRecords.length) * 1000) / 10;
    if (coveragePercent < SLIDER_TRENDS_COVERAGE_THRESHOLD) return [];

    const values = new Map<string, SliderValueAggregate>();
    /**
     * Adds one exact catalog or privacy-protected collection value.
     *
     * @param value - Normalized Slider value.
     * @param record - Source record containing the value.
     * @param source - Exact catalog or privacy-protected collection source.
     */
    const add = (
      value: SliderMetricValue,
      record: SliderTrendSourceRecord,
      source: "catalog" | "collection",
    ) => {
      const aggregate = values.get(value.key) ?? {
        catalogIds: new Set<number>(),
        collectionIds: new Set<number>(),
        contributorIds: new Set<number>(),
        label: value.label,
        numericValue: value.numericValue,
      };
      if (source === "catalog") aggregate.catalogIds.add(record.id);
      else {
        aggregate.collectionIds.add(record.id);
        if (record.ownerId !== null)
          aggregate.contributorIds.add(record.ownerId);
      }
      values.set(value.key, aggregate);
    };
    for (const record of catalogRecords)
      for (const value of definition.getValues(record))
        add(value, record, "catalog");
    for (const record of collectionRecords)
      for (const value of definition.getValues(record))
        add(value, record, "collection");

    return [
      {
        coveragePercent,
        hasSuppressedCollectionValues: Array.from(values.values()).some(
          (value) =>
            value.collectionIds.size > 0 &&
            value.contributorIds.size < PUBLIC_TRENDS_CONTRIBUTOR_THRESHOLD,
        ),
        metric: definition.metric,
        unit: definition.unit,
        values: Array.from(values, ([key, value]) => ({
          catalogCount: value.catalogIds.size,
          collectionCount:
            value.contributorIds.size >= PUBLIC_TRENDS_CONTRIBUTOR_THRESHOLD
              ? Math.round(
                  value.collectionIds.size / PUBLIC_TRENDS_ROUNDING_INCREMENT,
                ) * PUBLIC_TRENDS_ROUNDING_INCREMENT
              : null,
          key,
          label: value.label,
          numericValue: value.numericValue,
        })).sort((left, right) =>
          left.numericValue !== null && right.numericValue !== null
            ? left.numericValue - right.numericValue
            : right.catalogCount - left.catalogCount ||
              left.label.localeCompare(right.label),
        ),
      },
    ];
  });
}

/**
 * Loads one row per catalog Slider or currently owned Slider item.
 *
 * @param db - Application database.
 * @param productTypeId - Stable Slider product-type identifier.
 * @param collection - Whether to read owned collection items.
 * @returns Exact parent Slider rows without standalone components.
 */
async function sliderRows(
  db: Database,
  productTypeId: number,
  collection: boolean,
): Promise<SliderTrendRow[]> {
  const catalogLayout = sql<SliderMagnetLayout | null>`coalesce(
    ${schema.productDetailSlider.magnetLayout},
    (select magnet_layout from product_detail_slider_insert where id = ${schema.productDetailSlider.includedInsertProductId})
  )`;
  const collectionLayout = sql<SliderMagnetLayout | null>`coalesce(
    (select product_detail_slider_insert.magnet_layout
      from collection_detail_slider_insert
      inner join product_detail_slider_insert
        on product_detail_slider_insert.id = collection_detail_slider_insert.product_slider_insert_id
      where collection_detail_slider_insert.id = ${schema.collectionDetailSlider.installedInsertId}),
    ${catalogLayout}
  )`;
  const installedPlateProductId = sql<number | null>`(
    select product_slider_plate_id
    from collection_detail_slider_plate
    where id = ${schema.collectionDetailSlider.installedPlateId}
  )`;
  const fields = {
    id: collection ? schema.collectionItem.id : schema.product.id,
    length: schema.productDetailSlider.length,
    lengthUnit: schema.productDetailSlider.lengthUnit,
    magnetLayout: collection ? collectionLayout : catalogLayout,
    maker: { id: schema.maker.id, name: schema.maker.name },
    ownerId: collection
      ? schema.collectionItem.ownerId
      : sql<number | null>`null`,
    plateProductId: collection
      ? sql<
          number | null
        >`coalesce(${installedPlateProductId}, ${schema.productDetailSlider.includedPlateProductId})`
      : schema.productDetailSlider.includedPlateProductId,
    productId: schema.product.id,
    thickness: schema.productDetailSlider.thickness,
    thicknessUnit: schema.productDetailSlider.thicknessUnit,
    weight: schema.productDetailSlider.weight,
    weightUnit: schema.productDetailSlider.weightUnit,
    width: schema.productDetailSlider.width,
    widthUnit: schema.productDetailSlider.widthUnit,
  };
  const query = collection
    ? db
        .select(fields)
        .from(schema.collectionDetailSlider)
        .innerJoin(
          schema.collectionItem,
          eq(schema.collectionDetailSlider.id, schema.collectionItem.id),
        )
        .innerJoin(
          schema.productDetailSlider,
          eq(
            schema.collectionDetailSlider.productSliderId,
            schema.productDetailSlider.id,
          ),
        )
        .innerJoin(
          schema.product,
          eq(schema.productDetailSlider.id, schema.product.id),
        )
        .innerJoin(schema.maker, eq(schema.product.makerId, schema.maker.id))
        .where(
          and(
            eq(schema.product.productTypeId, productTypeId),
            eq(schema.collectionItem.owned, true),
            isNull(schema.collectionItem.soldAt),
          ),
        )
    : db
        .select(fields)
        .from(schema.productDetailSlider)
        .innerJoin(
          schema.product,
          eq(schema.productDetailSlider.id, schema.product.id),
        )
        .innerJoin(schema.maker, eq(schema.product.makerId, schema.maker.id))
        .where(
          and(
            eq(schema.product.productTypeId, productTypeId),
            eq(schema.product.approvalStatus, "approved"),
            eq(schema.product.isPrivate, false),
          ),
        );
  return await query.orderBy(asc(fields.id));
}

/**
 * Attaches body and effective plate materials to Slider rows.
 *
 * @param db - Application database.
 * @param rows - Exact Slider rows to hydrate.
 * @returns Normalized Slider source records.
 */
async function rowsToRecords(
  db: Database,
  rows: SliderTrendRow[],
): Promise<SliderTrendSourceRecord[]> {
  const materialMap = await materialsForProducts(
    db,
    rows.flatMap(({ plateProductId, productId }) =>
      plateProductId === null ? [productId] : [productId, plateProductId],
    ),
  );
  return rows.map((row) => ({
    bodyMaterials: materialMap.get(row.productId) ?? [],
    id: row.id,
    length: dimensionMeasurement(row.length, row.lengthUnit),
    magnetLayout: row.magnetLayout,
    maker: row.maker,
    ownerId: row.ownerId,
    plateMaterials:
      row.plateProductId === null
        ? []
        : (materialMap.get(row.plateProductId) ?? []),
    thickness: dimensionMeasurement(row.thickness, row.thicknessUnit),
    weight: weightMeasurement(row.weight, row.weightUnit),
    width: dimensionMeasurement(row.width, row.widthUnit),
  }));
}

/**
 * Loads distinct material categories for the requested products.
 *
 * @param db - Application database.
 * @param productIds - Catalog products whose materials are required.
 * @returns Material categories keyed by product identifier.
 */
async function materialsForProducts(db: Database, productIds: number[]) {
  const materials = new Map<number, SliderTrendCategory[]>();
  if (productIds.length === 0) return materials;
  const rows = await db
    .select({
      material: { id: schema.material.id, name: schema.material.name },
      productId: schema.productMaterial.productId,
    })
    .from(schema.productMaterial)
    .innerJoin(
      schema.productMaterialComponent,
      eq(
        schema.productMaterial.id,
        schema.productMaterialComponent.productMaterialId,
      ),
    )
    .innerJoin(
      schema.material,
      eq(schema.productMaterialComponent.materialId, schema.material.id),
    )
    .where(inArray(schema.productMaterial.productId, [...new Set(productIds)]))
    .orderBy(asc(schema.productMaterial.productId), asc(schema.material.name));
  for (const row of rows) {
    const values = materials.get(row.productId) ?? [];
    if (!values.some(({ id }) => id === row.material.id))
      values.push(row.material);
    materials.set(row.productId, values);
  }
  return materials;
}

/**
 * Defines one normalized categorical Slider metric.
 *
 * @param metric - Stable metric identifier.
 * @param getCategories - Category extractor.
 * @returns Shared metric definition.
 */
function categoryMetric(
  metric: SliderTrendMetricId,
  getCategories: SliderCategoryExtractor,
): SliderMetricDefinition {
  return {
    /**
     * Normalizes extracted categories.
     *
     * @param record - Slider source record.
     * @returns Normalized category values.
     */
    getValues: (record) =>
      getCategories(record).map(({ id, name }) => ({
        key: String(id).toLocaleLowerCase("en-US"),
        label: name.trim(),
        numericValue: null,
      })),
    metric,
    unit: null,
  };
}

/**
 * Defines one canonical numeric Slider metric.
 *
 * @param metric - Stable metric identifier.
 * @param unit - Canonical display unit.
 * @param getValue - Canonical numeric extractor.
 * @returns Shared metric definition.
 */
function measurementMetric(
  metric: SliderTrendMetricId,
  unit: "g" | "mm",
  getValue: SliderMeasurementExtractor,
): SliderMetricDefinition {
  return {
    /**
     * Wraps an available canonical measurement as a trend value.
     *
     * @param record - Slider source record.
     * @returns Zero or one normalized measurement value.
     */
    getValues: (record) => {
      const value = getValue(record);
      return value === null
        ? []
        : [{ key: String(value), label: String(value), numericValue: value }];
    },
    metric,
    unit,
  };
}

/**
 * Converts a stored dimension to a stable millimetre value.
 *
 * @param measurement - Stored dimension and source unit.
 * @returns Canonical millimetres, or null when absent.
 */
function canonicalDimension(measurement: DimensionMeasurement | null) {
  return measurement
    ? canonicalNumber(
        convertDimension(measurement.value, measurement.unit, "mm"),
      )
    : null;
}

/**
 * Removes floating-point conversion noise while retaining useful precision.
 *
 * @param value - Converted canonical number.
 * @returns Number rounded to six decimal places.
 */
function canonicalNumber(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/**
 * Reconstructs a valid stored dimension pair.
 *
 * @param value - Stored decimal text.
 * @param unit - Stored unit.
 * @returns Dimension measurement, or null when absent.
 */
function dimensionMeasurement(
  value: string | null,
  unit: "in" | "mm" | null,
): DimensionMeasurement | null {
  return value !== null && unit !== null ? { unit, value } : null;
}

/**
 * Reconstructs a valid stored weight pair.
 *
 * @param value - Stored decimal text.
 * @param unit - Stored unit.
 * @returns Weight measurement, or null when absent.
 */
function weightMeasurement(
  value: string | null,
  unit: "g" | "oz" | null,
): WeightMeasurement | null {
  return value !== null && unit !== null ? { unit, value } : null;
}
