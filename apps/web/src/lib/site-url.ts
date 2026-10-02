/**
 * Absolute site origin for shareable, crawler-facing URLs (Open Graph, canonical).
 *
 * - Client: the live browser origin.
 * - Server (SSR / prerender): an explicit `SITE_URL` override, else the Vercel
 *   production domain (`VERCEL_PROJECT_PRODUCTION_URL`) for deployed
 *   environments — so previews and production both canonicalize to the prod URL.
 *   In local dev neither is set, so the origin resolves to "" (relative): links
 *   resolve against whatever host/port the dev server runs on, so nothing is
 *   hardcoded and a changed dev port can never produce a wrong URL.
 *
 * Deriving an absolute dev origin from the request `Host` header is a possible
 * follow-up; relative URLs are fine in dev, where no crawler consumes them.
 *
 * @returns The configured canonical server origin without a trailing slash, or an empty string.
 */
function serverOrigin(): string {
  const env = typeof process !== "undefined" ? process.env : undefined;

  const explicit = env?.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelProduction = env?.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction) {
    return `https://${vercelProduction.replace(/\/+$/, "")}`;
  }

  return "";
}

/** Resolves the current browser or canonical server origin.
 *
 * @returns The active origin, or an empty string during unconfigured local SSR.
 */
export function getOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return serverOrigin();
}

/** Converts an application path to an absolute canonical URL when possible.
 *
 * @param path - Relative application path or existing absolute URL.
 * @returns The unchanged absolute URL, canonical URL, or local relative path.
 */
export function absoluteUrl(path: string): string {
  if (path.startsWith("http")) return path;
  const origin = getOrigin();
  // No absolute origin in dev → keep the URL relative rather than guess a host.
  return origin ? `${origin}${path}` : path;
}
