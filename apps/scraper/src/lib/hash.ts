import { createHash } from "node:crypto";

/**
 * Hashes a value after deterministic JSON serialization.
 *
 * @param value - JSON-compatible value to hash.
 * @returns A `sha256:`-prefixed hexadecimal digest.
 */
export function hashObject(value: unknown): string {
  return hashString(stableStringify(value));
}

/**
 * Hashes the UTF-8 bytes of a string with SHA-256.
 *
 * @param value - Text to hash.
 * @returns A `sha256:`-prefixed hexadecimal digest.
 */
export function hashString(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

/**
 * Serializes a value with recursively sorted object keys.
 *
 * @param value - JSON-compatible value to serialize.
 * @returns Deterministic JSON text for equivalent object key orderings.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

/**
 * Recursively sorts object keys while preserving array order.
 *
 * @param value - Value to normalize for deterministic serialization.
 * @returns The normalized value.
 */
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, sortValue(nestedValue)]),
    );
  }

  return value;
}
