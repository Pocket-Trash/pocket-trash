import { resourceUrlLifetimeSeconds } from "../constants.js";
import { buildCdnUrl, normalizeObjectPath } from "../lib/paths.js";
/**
 * Creates a short-lived Bunny token-authenticated resource URL.
 *
 * @param input - CDN origin, object key, token key, and optional Unix expiry.
 * @returns The CDN URL with URL-safe HMAC token and expiry query parameters.
 * @rejects When configuration, object-path validation, URL parsing, or signing fails.
 */
export async function signResourceUrl(input: {
  /** Public Bunny CDN base URL. */
  cdnBaseUrl?: string;
  /** Optional Unix expiry timestamp in seconds. */
  expiresAt?: number;
  /** Zone-relative resource object key. */
  objectPath: string;
  /** Bunny CDN token-authentication key. */
  tokenKey?: string;
}): Promise<string> {
  const cdnBaseUrl = input.cdnBaseUrl?.trim();
  const tokenKey = input.tokenKey?.trim();
  if (!cdnBaseUrl) throw new Error("BUNNY_CDN_BASE_URL is required.");
  if (!tokenKey) throw new Error("BUNNY_CDN_TOKEN_KEY is required.");

  const expiresAt =
    input.expiresAt ??
    Math.floor(Date.now() / 1000) + resourceUrlLifetimeSeconds;
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
    throw new Error("Resource URL expiry is invalid.");
  }

  const url = new URL(
    buildCdnUrl(cdnBaseUrl, normalizeObjectPath(input.objectPath)),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(tokenKey),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${decodeURIComponent(url.pathname)}${expiresAt}`),
  );
  const token = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

  url.searchParams.set("token", `HS256-${token}`);
  url.searchParams.set("expires", String(expiresAt));
  return url.toString();
}
