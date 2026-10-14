export type { MeasurementSystem } from "@package/services";
/**
 * Supported display currencies.
 */
export type CurrencyCode =
  | "CAD"
  | "USD"
  | "EUR"
  | "GBP"
  | "AUD"
  | "JPY"
  | "CHF"
  | "NZD";

/**
 * Currencies available for price display.
 */
export const currencies: CurrencyCode[] = [
  "CAD",
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "JPY",
  "CHF",
  "NZD",
];
