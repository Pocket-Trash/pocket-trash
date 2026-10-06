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
