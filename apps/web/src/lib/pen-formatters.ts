import type { MeasurementSystem } from "@package/services";
import type { PenProduct } from "./pen-data";

export type { MeasurementSystem } from "@package/services";
/**
 * Supported archive display currencies.
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
 * Currencies available for archive price display.
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

/**
 * Currency used by source archive prices and exchange rates.
 */
export const baseCurrency: CurrencyCode = "CAD";
/**
 * Markup applied after conversion away from the base currency.
 */
const shopifyMarketsMarkup = 1.025;

/**
 * Optional conversion rates from the base currency.
 */
export type CurrencyRates = Partial<Record<CurrencyCode, number>>;

/**
 * Formats an ISO-like calendar date in fixed English month-day-year form, or `"-"` when incomplete.
 *
 * @param iso - ISO-like calendar date string.
 * @returns The formatted date or `"-"` for empty or incomplete input.
 */
export function formatDate(iso: string) {
  if (!iso) return "-";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return "-";

  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Formats product diameter in the requested unit, converting inches to millimetres when needed.
 *
 * @param product - Product whose diameter should be displayed.
 * @param system - Requested display system.
 * @returns The formatted diameter or `null` when unavailable.
 */
export function formatDiameter(product: PenProduct, system: MeasurementSystem) {
  if (system === "metric") {
    const mm =
      product.diameter_mm ??
      (product.diameter_in == null
        ? null
        : Number((product.diameter_in * 25.4).toFixed(1)));
    return mm == null ? null : `${mm} mm`;
  }

  return product.diameter_in == null ? null : `${product.diameter_in}"`;
}

/**
 * Formats product length in the requested unit, converting inches to millimetres when needed.
 *
 * @param product - Product whose length should be displayed.
 * @param system - Requested display system.
 * @returns The formatted length or `null` when unavailable.
 */
export function formatLength(product: PenProduct, system: MeasurementSystem) {
  if (system === "metric") {
    const mm =
      product.length_in == null
        ? null
        : Number((product.length_in * 25.4).toFixed(1));
    return mm == null ? null : `${mm} mm`;
  }

  return product.length_in == null ? null : `${product.length_in}"`;
}

/**
 * Formats product weight in grams or converted ounces.
 *
 * @param product - Product whose weight should be displayed.
 * @param system - Requested display system.
 * @returns The formatted weight or `null` when unavailable.
 */
export function formatWeight(product: PenProduct, system: MeasurementSystem) {
  if (product.weight_g == null) return null;
  if (system === "imperial") {
    return `${Number((product.weight_g / 28.3495).toFixed(2))} oz`;
  }
  return `${product.weight_g} g`;
}

/**
 * Formats a single price or converted price range, using `"-"` when the minimum is absent.
 * Non-CAD conversions include the 2.5% Shopify Markets markup.
 *
 * @param min - Minimum base-currency price, or `null` when unavailable.
 * @param max - Maximum base-currency price, or `null` when unavailable.
 * @param currency - Target display currency.
 * @param rates - Conversion rates from the base currency; a missing target rate defaults to `1`.
 * @returns The formatted price or range.
 */
export function formatPrice(
  min: number | null,
  max: number | null,
  currency: CurrencyCode,
  rates: CurrencyRates,
) {
  if (min == null) return "-";
  if (max == null || min === max) return formatMoney(min, currency, rates);

  return `${formatMoney(min, currency, rates)}-${formatMoney(
    max,
    currency,
    rates,
  )}`;
}

/**
 * Converts and formats a base-currency amount, falling back to plain rounded text if Intl formatting fails.
 *
 * @param baseAmount - Amount in the base currency.
 * @param currency - Target display currency.
 * @param rates - Conversion rates from the base currency; a missing target rate defaults to `1`.
 * @returns The converted currency text.
 */
function formatMoney(
  baseAmount: number,
  currency: CurrencyCode,
  rates: CurrencyRates,
) {
  const rate = rates[currency] ?? 1;
  const markup = currency === baseCurrency ? 1 : shopifyMarketsMarkup;
  const value = baseAmount * rate * markup;

  try {
    return new Intl.NumberFormat("en-CA", {
      currency,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
      style: "currency",
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value)}`;
  }
}

/**
 * Returns today's UTC calendar date as `YYYY-MM-DD`.
 *
 * @returns Today's UTC date string.
 */
export function todayUTCDateString() {
  const date = new Date();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}
