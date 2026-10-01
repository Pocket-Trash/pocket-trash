/**
 * Counts whitespace-separated words.
 *
 * @param value - Text to measure.
 * @returns The number of words in the trimmed value.
 */
export function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}
