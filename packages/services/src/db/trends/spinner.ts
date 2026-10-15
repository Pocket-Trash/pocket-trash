import type { Database } from "@package/database";
import { schema } from "@package/database";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
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

/** Minimum catalog-field coverage required before a Spinner chart is shown. */
export const SPINNER_TRENDS_COVERAGE_THRESHOLD = 70;

/** Stable Spinner characteristic identifiers exposed to presentation clients. */
export const spinnerTrendMetricIds = [
  "bearing",
  "bodyMaterial",
  "buttonDiameter",
  "length",
  "maker",
  "spinDiameter",
  "thickness",
  "thicknessWithButton",
  "weight",
  "width",
] as const;

/** Stable Spinner characteristic identifier. */
export type SpinnerTrendMetricId = (typeof spinnerTrendMetricIds)[number];

/** One exact catalog value with an optional privacy-safe collection count. */
export type PublicSpinnerTrendValue = {
  /** Exact count of approved public catalog Spinners. */
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

/** One coverage-qualified Spinner characteristic. */
export type PublicSpinnerTrend = {
  /** Percentage of approved public catalog Spinners with this field populated. */
  coveragePercent: number;
  /** Whether any collection value was removed by the contributor threshold. */
  hasSuppressedCollectionValues: boolean;
  /** Stable characteristic identifier. */
  metric: SpinnerTrendMetricId;
  /** Canonical unit for numeric values. */
  unit: "g" | "mm" | null;
  /** Exact catalog values paired with privacy-safe collection counts. */
  values: PublicSpinnerTrendValue[];
};

/** Coverage-qualified public Spinner characteristics. */
export type PublicSpinnerTrends = {
  /** Number of approved public catalog Spinners used for coverage. */
  catalogProductCount: number;
  /** Stable Spinner product-type identifier used by URL filters. */
  productTypeId: number;
  /** Eligible characteristic charts. */
  trends: PublicSpinnerTrend[];
};

/** One normalized source record used to build Spinner Trends. */
export type SpinnerTrendSourceRecord = {
  /** Optional bearing override or catalog bearing description. */
  bearing: string | null;
  /** Exact catalog button diameter. */
  buttonDiameter: DimensionMeasurement | null;
  /** Stable product or collection-item identifier. */
  id: number;
  /** Exact catalog length. */
  length: DimensionMeasurement | null;
  /** Canonical maker category. */
  maker: SpinnerTrendCategory;
  /** Body materials assigned to the parent Spinner product. */
  materials: SpinnerTrendCategory[];
  /** Collection owner used only to enforce the public contributor threshold. */
  ownerId: number | null;
  /** Exact catalog spin diameter. */
  spinDiameter: DimensionMeasurement | null;
  /** Exact catalog thickness without a button. */
  thickness: DimensionMeasurement | null;
  /** Exact catalog thickness with a button. */
  thicknessWithButton: DimensionMeasurement | null;
  /** Exact catalog weight. */
  weight: WeightMeasurement | null;
  /** Exact catalog width. */
  width: DimensionMeasurement | null;
};

/** Stable named category used by a Spinner Trend source record. */
type SpinnerTrendCategory = {
  /** Stable category identifier. */
  id: number;
  /** Human-readable category name. */
  name: string;
};

/** Raw joined row used to reconstruct one Spinner and its body materials. */
type SpinnerTrendJoinedRow = Omit<
  SpinnerTrendSourceRecord,
  | "buttonDiameter"
  | "length"
  | "materials"
  | "spinDiameter"
  | "thickness"
  | "thicknessWithButton"
  | "weight"
  | "width"
> & {
  /** Stored button diameter value. */
  buttonDiameter: string | null;
  /** Stored button diameter unit. */
  buttonDiameterUnit: "in" | "mm" | null;
  /** Stored length value. */
  length: string | null;
  /** Stored length unit. */
  lengthUnit: "in" | "mm" | null;
  /** Assigned body-material identifier. */
  materialId: number | null;
  /** Assigned body-material name. */
  materialName: string | null;
  /** Stored spin diameter value. */
  spinDiameter: string | null;
  /** Stored spin diameter unit. */
  spinDiameterUnit: "in" | "mm" | null;
  /** Stored thickness value. */
  thickness: string | null;
  /** Stored thickness unit. */
  thicknessUnit: "in" | "mm" | null;
  /** Stored thickness-with-button value. */
  thicknessWithButton: string | null;
  /** Stored thickness-with-button unit. */
  thicknessWithButtonUnit: "in" | "mm" | null;
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
type SpinnerMetricValue = {
  /** Stable grouping key. */
  key: string;
  /** Display label for categorical values. */
  label: string;
  /** Canonical numeric value. */
  numericValue: number | null;
};

/** Categorical value before normalization. */
type SpinnerMetricCategory = {
  /** Stable source category key. */
  key: string;
  /** Human-readable category label. */
  label: string;
};

/** Defines one Spinner field without duplicating aggregation logic. */
type SpinnerMetricDefinition = {
  /** Extracts zero or more values from one Spinner. */
  getValues: SpinnerMetricValueExtractor;
  /** Stable metric identifier. */
  metric: SpinnerTrendMetricId;
  /** Canonical numeric unit. */
  unit: PublicSpinnerTrend["unit"];
};

/**
 * Extracts normalized values from one Spinner record.
 *
 * @param record - Spinner source record.
 * @returns Zero or more normalized values.
 */
type SpinnerMetricValueExtractor = (
  record: SpinnerTrendSourceRecord,
) => SpinnerMetricValue[];

/** Internal counts collected for one normalized Spinner value. */
type SpinnerValueAggregate = {
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

/** Shared definitions for fields that exist in the current Spinner schema. */
const metricDefinitions: SpinnerMetricDefinition[] = [
  categoryMetric("bearing", (record) =>
    record.bearing ? [{ key: record.bearing, label: record.bearing }] : [],
  ),
  categoryMetric("bodyMaterial", (record) =>
    record.materials.map((material) => ({
      key: String(material.id),
      label: material.name,
    })),
  ),
  measurementMetric("buttonDiameter", "mm", (record) =>
    canonicalDimension(record.buttonDiameter),
  ),
  measurementMetric("length", "mm", (record) =>
    canonicalDimension(record.length),
  ),
  categoryMetric("maker", (record) => [
    { key: String(record.maker.id), label: record.maker.name },
  ]),
  measurementMetric("spinDiameter", "mm", (record) =>
    canonicalDimension(record.spinDiameter),
  ),
  measurementMetric("thickness", "mm", (record) =>
    canonicalDimension(record.thickness),
  ),
  measurementMetric("thicknessWithButton", "mm", (record) =>
    canonicalDimension(record.thicknessWithButton),
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
 * Loads coverage-qualified Spinner characteristics from parent Spinner records.
 *
 * @param db - Application database.
 * @returns Public Spinner Trends, or null when the Spinner product type is absent.
 * @rejects When a database query fails.
 */
export async function getPublicSpinnerTrends(
  db: Database,
): Promise<PublicSpinnerTrends | null> {
  const [spinnerType] = await db
    .select({ id: schema.productType.id })
    .from(schema.productType)
    .where(eq(schema.productType.slug, "spinner"))
    .limit(1);
  if (!spinnerType) return null;

  const catalogRows = await spinnerRows(db, spinnerType.id, false);
  const collectionRows = await spinnerRows(db, spinnerType.id, true);
  return {
    catalogProductCount: new Set(catalogRows.map(({ id }) => id)).size,
    productTypeId: spinnerType.id,
    trends: summarizeSpinnerTrends(
      joinedRowsToRecords(catalogRows),
      joinedRowsToRecords(collectionRows),
    ),
  };
}

/**
 * Builds eligible public Spinner metrics from exact catalog and collection rows.
 *
 * @param catalogRecords - Approved public catalog Spinners.
 * @param collectionRecords - Currently owned parent Spinner items.
 * @returns Metrics at or above the coverage threshold.
 */
export function summarizeSpinnerTrends(
  catalogRecords: SpinnerTrendSourceRecord[],
  collectionRecords: SpinnerTrendSourceRecord[],
): PublicSpinnerTrend[] {
  if (catalogRecords.length === 0) return [];

  return metricDefinitions.flatMap((definition) => {
    const populatedCatalogRecords = catalogRecords.filter(
      (record) => definition.getValues(record).length > 0,
    );
    const coveragePercent =
      Math.round(
        (populatedCatalogRecords.length / catalogRecords.length) * 1000,
      ) / 10;
    if (coveragePercent < SPINNER_TRENDS_COVERAGE_THRESHOLD) return [];

    const values = new Map<string, SpinnerValueAggregate>();
    /**
     * Adds one record to a normalized catalog or collection value.
     *
     * @param value - Normalized Spinner value.
     * @param record - Source record containing the value.
     * @param source - Exact catalog or privacy-protected collection source.
     */
    const add = (
      value: SpinnerMetricValue,
      record: SpinnerTrendSourceRecord,
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

    const publicValues = Array.from(values, ([key, value]) => ({
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
    );

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
        values: publicValues,
      },
    ];
  });
}

/**
 * Loads catalog or collection Spinner rows without joining standalone Buttons.
 *
 * @param db - Application database.
 * @param productTypeId - Stable Spinner product-type identifier.
 * @param collection - Whether to read owned collection items instead of catalog products.
 * @returns Joined Spinner rows with zero or more parent-product materials.
 */
async function spinnerRows(
  db: Database,
  productTypeId: number,
  collection: boolean,
): Promise<SpinnerTrendJoinedRow[]> {
  const fields = {
    bearing: collection
      ? sql<
          string | null
        >`coalesce(${schema.collectionDetailSpinner.bearing}, ${schema.productDetailSpinner.bearing})`
      : schema.productDetailSpinner.bearing,
    buttonDiameter: schema.productDetailSpinner.buttonDiameter,
    buttonDiameterUnit: schema.productDetailSpinner.buttonDiameterUnit,
    id: collection ? schema.collectionItem.id : schema.product.id,
    length: schema.productDetailSpinner.length,
    lengthUnit: schema.productDetailSpinner.lengthUnit,
    maker: { id: schema.maker.id, name: schema.maker.name },
    materialId: schema.material.id,
    materialName: schema.material.name,
    ownerId: collection
      ? schema.collectionItem.ownerId
      : sql<number | null>`null`,
    spinDiameter: schema.productDetailSpinner.spinDiameter,
    spinDiameterUnit: schema.productDetailSpinner.spinDiameterUnit,
    thickness: schema.productDetailSpinner.thickness,
    thicknessUnit: schema.productDetailSpinner.thicknessUnit,
    thicknessWithButton: schema.productDetailSpinner.thicknessWithButton,
    thicknessWithButtonUnit:
      schema.productDetailSpinner.thicknessWithButtonUnit,
    weight: schema.productDetailSpinner.weight,
    weightUnit: schema.productDetailSpinner.weightUnit,
    width: schema.productDetailSpinner.width,
    widthUnit: schema.productDetailSpinner.widthUnit,
  };
  const query = collection
    ? db
        .select(fields)
        .from(schema.collectionDetailSpinner)
        .innerJoin(
          schema.collectionItem,
          eq(schema.collectionDetailSpinner.id, schema.collectionItem.id),
        )
        .innerJoin(
          schema.productDetailSpinner,
          eq(
            schema.collectionDetailSpinner.productSpinnerId,
            schema.productDetailSpinner.id,
          ),
        )
        .innerJoin(
          schema.product,
          eq(schema.productDetailSpinner.id, schema.product.id),
        )
        .innerJoin(schema.maker, eq(schema.product.makerId, schema.maker.id))
        .leftJoin(
          schema.productMaterial,
          eq(schema.product.id, schema.productMaterial.productId),
        )
        .leftJoin(
          schema.productMaterialComponent,
          eq(
            schema.productMaterial.id,
            schema.productMaterialComponent.productMaterialId,
          ),
        )
        .leftJoin(
          schema.material,
          eq(schema.productMaterialComponent.materialId, schema.material.id),
        )
        .where(
          and(
            eq(schema.product.productTypeId, productTypeId),
            eq(schema.collectionItem.owned, true),
            isNull(schema.collectionItem.soldAt),
          ),
        )
    : db
        .select(fields)
        .from(schema.productDetailSpinner)
        .innerJoin(
          schema.product,
          eq(schema.productDetailSpinner.id, schema.product.id),
        )
        .innerJoin(schema.maker, eq(schema.product.makerId, schema.maker.id))
        .leftJoin(
          schema.productMaterial,
          eq(schema.product.id, schema.productMaterial.productId),
        )
        .leftJoin(
          schema.productMaterialComponent,
          eq(
            schema.productMaterial.id,
            schema.productMaterialComponent.productMaterialId,
          ),
        )
        .leftJoin(
          schema.material,
          eq(schema.productMaterialComponent.materialId, schema.material.id),
        )
        .where(
          and(
            eq(schema.product.productTypeId, productTypeId),
            eq(schema.product.approvalStatus, "approved"),
            eq(schema.product.isPrivate, false),
          ),
        );
  return await query.orderBy(asc(fields.id), asc(schema.material.name));
}

/**
 * Reconstructs one source record from repeated product-material join rows.
 *
 * @param rows - Joined Spinner rows.
 * @returns Deduplicated Spinner records.
 */
function joinedRowsToRecords(
  rows: SpinnerTrendJoinedRow[],
): SpinnerTrendSourceRecord[] {
  const records = new Map<number, SpinnerTrendSourceRecord>();
  for (const row of rows) {
    const record = records.get(row.id) ?? {
      bearing: row.bearing,
      buttonDiameter: dimensionMeasurement(
        row.buttonDiameter,
        row.buttonDiameterUnit,
      ),
      id: row.id,
      length: dimensionMeasurement(row.length, row.lengthUnit),
      maker: row.maker,
      materials: [],
      ownerId: row.ownerId,
      spinDiameter: dimensionMeasurement(
        row.spinDiameter,
        row.spinDiameterUnit,
      ),
      thickness: dimensionMeasurement(row.thickness, row.thicknessUnit),
      thicknessWithButton: dimensionMeasurement(
        row.thicknessWithButton,
        row.thicknessWithButtonUnit,
      ),
      weight: weightMeasurement(row.weight, row.weightUnit),
      width: dimensionMeasurement(row.width, row.widthUnit),
    };
    if (
      row.materialId !== null &&
      row.materialName !== null &&
      !record.materials.some(({ id }) => id === row.materialId)
    ) {
      record.materials.push({ id: row.materialId, name: row.materialName });
    }
    records.set(row.id, record);
  }
  return Array.from(records.values());
}

/**
 * Defines a categorical metric.
 *
 * @param metric - Stable metric identifier.
 * @param getCategories - Category extractor.
 * @returns Shared metric definition.
 */
function categoryMetric(
  metric: SpinnerTrendMetricId,
  getCategories: SpinnerCategoryExtractor,
): SpinnerMetricDefinition {
  return {
    /**
     * Normalizes extracted categories.
     *
     * @param record - Spinner source record.
     * @returns Normalized category values.
     */
    getValues: (record) =>
      getCategories(record).map(({ key, label }) => ({
        key: key.trim().toLocaleLowerCase("en-US"),
        label: label.trim(),
        numericValue: null,
      })),
    metric,
    unit: null,
  };
}

/**
 * Extracts categorical values from one Spinner record.
 *
 * @param record - Spinner source record.
 * @returns Zero or more category keys and labels.
 */
type SpinnerCategoryExtractor = (
  record: SpinnerTrendSourceRecord,
) => SpinnerMetricCategory[];

/**
 * Defines a canonical numeric metric.
 *
 * @param metric - Stable metric identifier.
 * @param unit - Canonical display unit.
 * @param getValue - Canonical numeric extractor.
 * @returns Shared metric definition.
 */
function measurementMetric(
  metric: SpinnerTrendMetricId,
  unit: "g" | "mm",
  getValue: SpinnerMeasurementExtractor,
): SpinnerMetricDefinition {
  return {
    /**
     * Wraps an available canonical measurement as a trend value.
     *
     * @param record - Spinner source record.
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
 * Extracts one canonical measurement from a Spinner record.
 *
 * @param record - Spinner source record.
 * @returns Canonical measurement, or null when absent.
 */
type SpinnerMeasurementExtractor = (
  record: SpinnerTrendSourceRecord,
) => number | null;

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
