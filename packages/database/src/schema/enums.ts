/** Supported ISO currency codes for user preferences. */
export const currencyCodes = [
  "CAD",
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "JPY",
  "CHF",
  "NZD",
] as const;

/** Supported units for stored linear measurements. */
export const dimensionUnits = ["in", "mm"] as const;
/** Supported audiences targeted by feature flags. */
export const featureFlagAudiences = ["global", "admin", "user"] as const;
/** Actors allowed to create feature-flag overrides. */
export const featureFlagOverrideSources = ["admin", "user"] as const;
/** Supported interface theme preferences. */
export const themeModes = ["dark", "light", "system"] as const;
/** Supported app-wide measurement display systems. */
export const measurementSystems = ["metric", "imperial"] as const;
/** Supported units for stored weight measurements. */
export const weightUnits = ["g", "oz"] as const;

/** Supported currency code value. */
export type CurrencyCode = (typeof currencyCodes)[number];
/** Supported dimension unit value. */
export type DimensionUnit = (typeof dimensionUnits)[number];
/** Supported feature flag audience value. */
export type FeatureFlagAudience = (typeof featureFlagAudiences)[number];
/** Supported feature flag override source value. */
export type FeatureFlagOverrideSource =
  (typeof featureFlagOverrideSources)[number];
/** Supported theme mode value. */
export type ThemeMode = (typeof themeModes)[number];
/** Supported measurement display system value. */
export type MeasurementSystem = (typeof measurementSystems)[number];
/** Supported weight unit value. */
export type WeightUnit = (typeof weightUnits)[number];
