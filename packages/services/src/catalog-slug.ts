/** Pattern for lowercase alphanumeric slugs separated by single hyphens. */
export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Converts text to a lowercase hyphenated ASCII catalog slug.
 *
 * @param value - Text to normalize.
 * @returns The normalized slug, possibly empty.
 */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Builds a catalog slug and appends the first available numeric suffix.
 *
 * @param name - Human-readable catalog name.
 * @param existingSlugs - Slugs already in use.
 * @returns The available base slug or suffixed slug.
 * @throws When the name cannot produce an ASCII slug.
 */
export function nextAvailableSlug(
  name: string,
  existingSlugs: readonly string[],
): string {
  const base = slugify(name);
  if (!base) throw new Error("Catalog name must produce a slug.");
  const used = new Set(existingSlugs);
  if (!used.has(base)) return base;

  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
