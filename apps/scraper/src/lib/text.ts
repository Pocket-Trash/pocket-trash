/**
 * Supported HTML entities and their plain-text replacements.
 */
const htmlEntityMap: Record<string, string> = {
  "&amp;": "&",
  "&gt;": ">",
  "&lt;": "<",
  "&nbsp;": " ",
  "&quot;": '"',
  "&#39;": "'",
};

/**
 * Collapses whitespace runs and trims surrounding whitespace.
 *
 * @param value - Text to normalize.
 * @returns The normalized text.
 */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Converts limited source HTML into normalized plain text.
 *
 * @param value - Optional HTML fragment.
 * @returns Plain text, or `null` when the input or rendered text is empty.
 */
export function htmlToText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const withoutTags = value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const decoded = withoutTags.replace(
    /&(amp|gt|lt|nbsp|quot|#39);/g,
    (entity) => htmlEntityMap[entity] ?? entity,
  );
  const normalized = normalizeWhitespace(decoded);

  return normalized.length > 0 ? normalized : null;
}
