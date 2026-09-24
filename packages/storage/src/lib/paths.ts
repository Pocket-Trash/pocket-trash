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

export function buildCdnUrl(baseUrl: string, objectPath: string): string {
  return `${trimTrailingSlash(baseUrl)}/${normalizeObjectPath(objectPath)
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, "");
}
