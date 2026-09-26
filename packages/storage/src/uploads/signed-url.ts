import { resourceUrlLifetimeSeconds } from "../constants.js";
import { buildCdnUrl, normalizeObjectPath } from "../lib/paths.js";
export async function signResourceUrl(input: {
  cdnBaseUrl?: string;
  expiresAt?: number;
  objectPath: string;
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
