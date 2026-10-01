/**
 * Trims outer slashes and validates a storage object path.
 *
 * @param objectPath - Candidate slash-delimited object key.
 * @returns The normalized object key.
 * @throws When the path is empty, contains backslashes, or has unsafe segments.
 * @internal
 */
export function normalizeObjectPath(objectPath: string): string {
  const normalized = objectPath.trim().replace(/^\/+|\/+$/gu, "");

  if (
    !normalized ||
    normalized.includes("\\") ||
    normalized
      .split("/")
      .some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Object path is unsafe.");
  }

  return normalized;
}

/**
 * Builds a CDN URL with each validated object-key segment encoded.
 *
 * @param baseUrl - CDN origin or base path.
 * @param objectPath - Valid storage object key.
 * @returns The joined CDN URL.
 * @throws When the object path is unsafe.
 * @internal
 */
export function buildCdnUrl(baseUrl: string, objectPath: string): string {
  return `${trimTrailingSlash(baseUrl)}/${normalizeObjectPath(objectPath)
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

/**
 * Removes trailing slash characters from a string.
 *
 * @param value - URL or path prefix.
 * @returns The value without trailing slashes.
 * @internal
 */
export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, "");
}
