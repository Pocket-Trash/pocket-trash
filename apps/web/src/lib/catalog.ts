import {
  nextAvailableSlug,
  slugify,
  slugPattern,
} from "@package/services/catalog-slug";
import { z } from "zod";

export { nextAvailableSlug, slugify, slugPattern };

/**
 * Trims a URL, removes trailing slashes, and maps an empty result to `null`.
 *
 * @param value - Optional URL text to normalize.
 * @returns The normalized URL or `null`.
 */
export function normalizeOptionalUrl(value: string): string | null {
  const normalized = value.trim().replace(/\/+$/, "");
  return normalized || null;
}

/**
 * Schema that maps blank optional numeric input to `null` and accepts only positive finite values.
 */
export const positiveDecimalSchema = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) =>
    value == null || String(value).trim() === "" ? null : String(value).trim(),
  )
  .refine((value) => {
    if (value === null) return true;
    const number = Number(value);
    return Number.isFinite(number) && number > 0;
  }, "web.catalog.error.positive");

/**
 * Returns a name-sorted copy of the material list.
 *
 * @param materials - Materials to sort.
 * @returns A new name-sorted material array.
 * @template T - Lookup or item shape preserved by the operation.
 */
export function sortMaterials<
  T extends {
    /**
     * Human-readable display name.
     */
    name: string;
  },
>(materials: readonly T[]): T[] {
  return [...materials].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Returns name-sorted buttons matching the requested diameter, or all buttons when it is empty.
 *
 * @param buttons - Buttons to filter and sort.
 * @param diameterMm - Requested diameter, or `null` or an empty string to include every diameter.
 * @returns A new filtered and name-sorted button array.
 * @template T - Lookup or item shape preserved by the operation.
 */
export function filterButtonsByDiameter<
  T extends {
    /** Button diameter in millimetres, or `null` when unspecified. */
    diameterMm: string | null;
    /** Human-readable button name. */
    name: string;
  },
>(buttons: readonly T[], diameterMm: string | null): T[] {
  const diameter = diameterMm ? Number(diameterMm) : null;
  return [...buttons]
    .filter(
      (button) =>
        diameter === null ||
        (button.diameterMm !== null && Number(button.diameterMm) === diameter),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Builds a finish label from finish, color, and color-effect names.
 *
 * @param option - Finish option to label.
 * @returns The composed finish label, possibly empty.
 */
export function finishOptionLabel(option: {
  /** Color effect applied to the option, or `null` for uncolored options. */
  colorEffect: {
    /**
     * Human-readable display name.
     */
    name: string;
    /** Stable color-effect slug. */
    slug: string;
  } | null;
  /** Colors composing the option. */
  colors: Array<{
    /**
     * Human-readable display name.
     */
    name: string;
  }>;
  /** Finishes composing the option. */
  finishes: Array<{
    /**
     * Human-readable display name.
     */
    name: string;
  }>;
}): string {
  const colors = option.colors.map(({ name }) => name);
  const colorLabel =
    option.colorEffect?.slug === "fade"
      ? `${colors.join(" → ")} ${option.colorEffect.name}`
      : colors.join(" + ");
  return [option.finishes.map(({ name }) => name).join(" + "), colorLabel]
    .filter(Boolean)
    .join(" · ");
}
