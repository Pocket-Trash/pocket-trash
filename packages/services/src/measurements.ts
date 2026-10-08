/** Supported units for linear measurements. */
export type DimensionUnit = "in" | "mm";
/** Supported units for weight measurements. */
export type WeightUnit = "g" | "oz";
/** User preference controlling secondary measurement conversions. */
export type MeasurementSystem = "imperial" | "metric";

/** A stored linear value and the unit in which it was entered. */
export type DimensionMeasurement = {
  /** Unit in which the value was entered. */
  unit: DimensionUnit;
  /** Positive decimal text preserved from input. */
  value: string;
};

/** A stored weight value and the unit in which it was entered. */
export type WeightMeasurement = {
  /** Unit in which the value was entered. */
  unit: WeightUnit;
  /** Positive decimal text preserved from input. */
  value: string;
};

/** Any supported product measurement. */
export type Measurement = DimensionMeasurement | WeightMeasurement;

/** Exact number of millimetres in one inch. */
export const millimetersPerInch = 25.4;
/** Exact number of grams in one avoirdupois ounce. */
export const gramsPerOunce = 28.349523125;

/**
 * Converts a linear value between inches and millimetres.
 *
 * @param value - Finite decimal text or number to convert.
 * @param from - Stored source unit.
 * @param to - Requested target unit.
 * @returns Converted numeric value.
 */
export function convertDimension(
  value: string | number,
  from: DimensionUnit,
  to: DimensionUnit,
) {
  const numeric = Number(value);
  if (from === to) return numeric;
  return from === "in"
    ? numeric * millimetersPerInch
    : numeric / millimetersPerInch;
}

/**
 * Converts a weight between grams and ounces.
 *
 * @param value - Finite decimal text or number to convert.
 * @param from - Stored source unit.
 * @param to - Requested target unit.
 * @returns Converted numeric value.
 */
export function convertWeight(
  value: string | number,
  from: WeightUnit,
  to: WeightUnit,
) {
  const numeric = Number(value);
  if (from === to) return numeric;
  return from === "oz" ? numeric * gramsPerOunce : numeric / gramsPerOunce;
}

/**
 * Reports whether two dimension measurements describe the same physical size.
 *
 * @param left - First stored dimension.
 * @param right - Second stored dimension.
 * @returns Whether the values are equal after canonical millimetre conversion.
 */
export function measurementsEqual(
  left: DimensionMeasurement,
  right: DimensionMeasurement,
) {
  const leftMm = convertDimension(left.value, left.unit, "mm");
  const rightMm = convertDimension(right.value, right.unit, "mm");
  return Math.abs(leftMm - rightMm) <= 1e-9;
}

/**
 * Formats a stored measurement with an optional preference-driven conversion.
 *
 * @param measurement - Stored value and source unit.
 * @param system - Viewer system used only for the secondary value.
 * @param locale - Locale used for number separators.
 * @returns Stored value first and a converted parenthetical value when needed.
 */
export function formatMeasurement(
  measurement: Measurement,
  system: MeasurementSystem,
  locale: string,
) {
  const targetUnit =
    measurement.unit === "g" || measurement.unit === "oz"
      ? system === "metric"
        ? "g"
        : "oz"
      : system === "metric"
        ? "mm"
        : "in";
  const primary = `${formatNumber(measurement.value, locale)} ${measurement.unit}`;
  if (targetUnit === measurement.unit) return primary;

  const converted =
    measurement.unit === "g" || measurement.unit === "oz"
      ? convertWeight(
          measurement.value,
          measurement.unit,
          targetUnit as WeightUnit,
        )
      : convertDimension(
          measurement.value,
          measurement.unit,
          targetUnit as DimensionUnit,
        );
  return `${primary} (${formatNumber(converted, locale, 2)} ${targetUnit})`;
}

/**
 * Formats finite numeric input with locale separators and bounded precision.
 *
 * @param value - Numeric text or value.
 * @param locale - Requested number-format locale.
 * @param maximumFractionDigits - Maximum displayed decimal precision.
 * @returns Locale-formatted numeric text.
 */
function formatNumber(
  value: string | number,
  locale: string,
  maximumFractionDigits = 20,
) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    useGrouping: true,
  }).format(Number(value));
}
