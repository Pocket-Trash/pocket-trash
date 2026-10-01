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

/** Supported dimension units for display preferences. */
export const dimensionUnits = ["in", "mm"] as const;
/** Supported audiences targeted by feature flags. */
export const featureFlagAudiences = ["global", "admin", "user"] as const;
/** Actors allowed to create feature-flag overrides. */
export const featureFlagOverrideSources = ["admin", "user"] as const;
/** Supported interface theme preferences. */
export const themeModes = ["dark", "light", "system"] as const;
/** Supported weight units for display preferences. */
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
/** Supported weight unit value. */
export type WeightUnit = (typeof weightUnits)[number];
