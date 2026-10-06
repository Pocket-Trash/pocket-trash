import type { PublicMaterialSummary } from "@package/services";

/** Directory section used for names that do not begin with A-Z. */
export const OTHER_MATERIALS = "Other" as const;
/** Ordered directory initials. */
export const MATERIAL_INITIALS = Array.from({ length: 26 }, (_, index) =>
  String.fromCharCode(65 + index),
);

/**
 * Returns the normalized A-Z initial for a material name.
 *
 * @param name - Material display name.
 * @returns An uppercase ASCII initial, or `Other`.
 */
export function getMaterialInitial(name: string) {
  const initial = name
    .trim()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .charAt(0)
    .toUpperCase();
  return /^[A-Z]$/u.test(initial) ? initial : OTHER_MATERIALS;
}

/**
 * Groups name-sorted materials into populated A-Z sections followed by Other.
 *
 * @param materials - Public material summaries.
 * @returns Populated directory sections.
 */
export function groupMaterials(materials: PublicMaterialSummary[]) {
  const groups = new Map<string, PublicMaterialSummary[]>();
  for (const material of [...materials].sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const initial = getMaterialInitial(material.name);
    groups.set(initial, [...(groups.get(initial) ?? []), material]);
  }
  return [...MATERIAL_INITIALS, OTHER_MATERIALS].flatMap((initial) => {
    const items = groups.get(initial);
    return items ? ([[initial, items]] as const) : [];
  });
}

/**
 * Sorts materials by public collection-item usage, then display name.
 *
 * @param materials - Public material summaries.
 * @returns A new popularity-ranked array.
 */
export function sortPopularMaterials(materials: PublicMaterialSummary[]) {
  return [...materials].sort(
    (left, right) =>
      right.collectionItemCount - left.collectionItemCount ||
      left.name.localeCompare(right.name),
  );
}

/**
 * Resolves material-detail card count from viewport width.
 *
 * @param viewportWidth - Browser viewport width in CSS pixels.
 * @returns Cards per page for the active responsive tier.
 */
export function getMaterialPageSize(viewportWidth: number) {
  if (viewportWidth <= 480) return 8;
  if (viewportWidth <= 1280) return 12;
  return 20;
}

/**
 * Clamps a one-based material page to the available result range.
 *
 * @param requestedPage - Requested one-based page.
 * @param itemCount - Total related records.
 * @param pageSize - Current responsive page size.
 * @returns A valid one-based page.
 */
export function clampMaterialPage(
  requestedPage: number,
  itemCount: number,
  pageSize: number,
) {
  return Math.min(
    Math.max(1, Math.trunc(requestedPage) || 1),
    Math.max(1, Math.ceil(itemCount / pageSize)),
  );
}
