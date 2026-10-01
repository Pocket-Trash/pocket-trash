/**
 * Parses an optional timestamp into a valid date.
 *
 * @param value - Timestamp text from a source payload.
 * @returns The parsed date, or `null` for empty or invalid input.
 */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}
