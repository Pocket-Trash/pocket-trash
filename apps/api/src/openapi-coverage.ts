/** HTTP methods representable as OpenAPI operations. */
const operationMethods = new Set([
  "GET",
  "PUT",
  "POST",
  "DELETE",
  "OPTIONS",
  "HEAD",
  "PATCH",
  "TRACE",
]);

/** Registered HTTP method and Hono path, including its mounted prefix. */
type RegisteredRoute = {
  /** Registered HTTP method. */
  method: string;
  /** Full Hono route pattern. */
  path: string;
};

/**
 * Finds undocumented endpoints, stale operations, and unrepresentable registrations.
 * Middleware must be registered on concrete method/path pairs, not global ALL entries.
 *
 * @param routes - Independently inventoried application registrations.
 * @param paths - Paths from the live OpenAPI document.
 * @returns Sorted diagnostics; an empty array means complete coverage.
 */
export function findOpenApiCoverageErrors(
  routes: readonly RegisteredRoute[],
  paths: Record<string, Record<string, unknown>>,
): string[] {
  const errors = new Set<string>();
  const registered = new Set<string>();
  const documented = new Set<string>();

  for (const { method, path } of routes) {
    if (
      !operationMethods.has(method) ||
      /[?{}]/u.test(path) ||
      (path.includes("*") && !/^\/[^*]*\/\*$/u.test(path))
    ) {
      errors.add(
        `Unsupported route registration: ${method} ${path}. Use explicit methods and OpenAPI-compatible paths; attach middleware to endpoint registrations.`,
      );
      continue;
    }
    const normalized = path
      .replace(/:([A-Za-z0-9_]+)/gu, "{$1}")
      .replace(/\/\*$/u, "/{path}");
    registered.add(`${method} ${normalized}`);
    if (
      path.endsWith("/*") &&
      paths[normalized]?.[method.toLowerCase()] &&
      !isWildcardOperation(paths[normalized]?.[method.toLowerCase()], path)
    ) {
      errors.add(`Wildcard operation requires x-hono-path: ${method} ${path}`);
    }
  }
  for (const [path, item] of Object.entries(paths)) {
    for (const method of Object.keys(item)) {
      if (operationMethods.has(method.toUpperCase()))
        documented.add(`${method.toUpperCase()} ${path}`);
    }
  }
  for (const operation of registered) {
    if (!documented.has(operation))
      errors.add(`Missing OpenAPI operation: ${operation}`);
  }
  for (const operation of documented) {
    if (!registered.has(operation))
      errors.add(`Stale OpenAPI operation: ${operation}`);
  }
  return [...errors].sort();
}

/**
 * Verifies the exact Hono catch-all pattern recorded on an OpenAPI operation.
 *
 * @param operation - Candidate OpenAPI operation.
 * @param path - Registered wildcard pattern.
 * @returns Whether the extension records the actual pattern.
 */
function isWildcardOperation(operation: unknown, path: string): boolean {
  return (
    typeof operation === "object" &&
    operation !== null &&
    "x-hono-path" in operation &&
    operation["x-hono-path"] === path
  );
}
