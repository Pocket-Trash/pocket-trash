import { z } from "zod";

export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function nextAvailableSlug(
  name: string,
  existingSlugs: readonly string[],
): string {
  const base = slugify(name);
  const used = new Set(existingSlugs);
  if (!used.has(base)) return base;

  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function normalizeOptionalUrl(value: string): string | null {
  const normalized = value.trim().replace(/\/+$/, "");
  return normalized || null;
}

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

export function sortMaterials<T extends { name: string }>(
  materials: readonly T[],
): T[] {
  return [...materials].sort((a, b) => a.name.localeCompare(b.name));
}

export function filterButtonsByDiameter<
  T extends { diameterMm: string | null; name: string },
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
