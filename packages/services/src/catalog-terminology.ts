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
