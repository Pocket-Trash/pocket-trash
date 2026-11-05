/**
 * Produces the stable comparison form used for catalog aliases and text search.
 *
 * @param value - User-visible catalog text.
 * @returns Lowercase, diacritic-free text with collapsed whitespace.
 */
export function normalizeCatalogSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replaceAll(/\p{Mark}/gu, "")
    .toLocaleLowerCase("en-US")
    .trim()
    .replaceAll(/\s+/gu, " ");
}

/**
 * Builds a case-insensitive collection-name key.
 *
 * Trims whitespace, removes diacritics and punctuation, and lowercases letters.
 *
 * @param name - Display name to convert into a comparison key.
 * @returns Normalized collection name.
 */
export function normalizeCollectionName(name: string) {
  return name
    .trim()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** Stable status selections shared by services and URL state. */
export const collectionItemStatusSearches = [
  "grail",
  "favorite",
  "want-to-sell",
  "want-to-trade",
  "sold",
  "unstatused",
] as const;

/** One selectable collection-item status bucket. */
export type CollectionItemStatusSearch =
  (typeof collectionItemStatusSearches)[number];

/** Maps each Pen-part product type to its standard interchangeability answer. */
export const penPartInterchangeabilityKeys = {
  "pen-tip": "tip",
  "pen-clip": "clip",
  "pen-top-cap": "topCap",
  "pen-actuator": "actuator",
  "pen-mechanism": "mechanism",
} as const;

/** Canonical functional roles supported by physical Pen parts. */
export const penPartRoles = [
  "tip",
  "clip",
  "top-cap",
  "actuator",
  "mechanism",
] as const;
/** One canonical functional Pen-part role. */
export type PenPartRole = (typeof penPartRoles)[number];
/** Primary catalog types representing physical Pen parts. */
export type PenPartProductType = `pen-${PenPartRole}`;
/**
 * Resolves complete roles in a stable order, retaining the primary type role.
 * @param product - Physical part identity and optionally reviewed assignments.
 * @returns Its canonical roles, or none for another product type.
 */
export function getPenPartRoles(product: {
  /** Canonical primary product type. */
  productTypeSlug: string;
  /** Authored additional roles. */
  penPartRoles?: readonly PenPartRole[];
}): PenPartRole[] {
  if (!Object.hasOwn(penPartInterchangeabilityKeys, product.productTypeSlug))
    return [];
  const selected = new Set([
    product.productTypeSlug.slice(4),
    ...(product.penPartRoles ?? []),
  ]);
  return penPartRoles.filter((role) => selected.has(role));
}
/**
 * Checks every functional role of one physical part against a standard Pen.
 * @param part - Physical part identity and roles.
 * @param answers - Reviewed interchangeability answers, defaulting to No.
 * @returns Whether any of its roles requires customization.
 */
export function penPartNeedsCustomization(
  part: Parameters<typeof getPenPartRoles>[0],
  answers?: Partial<
    Record<(typeof penPartInterchangeabilityKeys)[PenPartProductType], boolean>
  >,
): boolean {
  return getPenPartRoles(part).some((role) => {
    const type: PenPartProductType = `pen-${role}`;
    return !answers?.[penPartInterchangeabilityKeys[type]];
  });
}
