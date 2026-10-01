import { type ImageEntity, imageEntities } from "./constants.js";
import { normalizeObjectPath } from "./lib/paths.js";
/**
 * Validates and normalizes an image namespace prefix.
 *
 * @param value - Configured image folder prefix.
 * @returns The normalized production, development, or preview prefix.
 * @throws When the prefix is outside the allowed image namespaces.
 */
export function imageFolderPrefix(value: string | undefined): string {
  const prefix = normalizeObjectPath(value ?? "");
  if (!/^images(?:\/dev|\/preview(?:\/pr-[1-9]\d*)?)?$/u.test(prefix))
    throw new Error("BUNNY_IMAGE_FOLDER_PREFIX is invalid.");
  return prefix;
}
/**
 * Validates and normalizes a resource namespace prefix.
 *
 * @param value - Configured resource folder prefix.
 * @returns The normalized files, development, or preview prefix.
 * @throws When the prefix is outside the allowed resource namespaces.
 */
export function resourceFolderPrefix(value: string | undefined): string {
  const prefix = normalizeObjectPath(value ?? "");
  if (!/^resources\/(?:files|dev|preview(?:\/pr-[1-9]\d*)?)$/u.test(prefix))
    throw new Error("BUNNY_RESOURCE_FOLDER_PREFIX is invalid.");
  return prefix;
}
/**
 * Converts a value into a safe single object-path segment.
 *
 * @param value - Candidate identifier segment.
 * @returns The safe string segment.
 * @throws When the segment contains unsupported characters.
 */
function segment(value: string | number): string {
  const result = String(value);
  if (!/^[a-zA-Z0-9_-]+$/u.test(result))
    throw new Error("Invalid storage path segment.");
  return result;
}
/**
 * Normalizes a file extension without its leading dot.
 *
 * @param value - Candidate extension.
 * @returns The lowercase extension.
 * @throws When the extension contains non-alphanumeric characters.
 */
function extension(value: string): string {
  const result = value.replace(/^\./u, "").toLowerCase();
  if (!/^[a-z0-9]+$/u.test(result)) throw new Error("Invalid file extension.");
  return result;
}
/**
 * Builds a validated image object key.
 *
 * @param input - Image namespace, owner, name, and extension.
 * @returns An object key shaped as `prefix/entity/entityId/name.extension`.
 * @throws When any path component is unsafe or unsupported.
 */
export function buildImageObjectPath(input: {
  /** Image namespace prefix. */
  prefix: string;
  /** Image-owning namespace. */
  entity: ImageEntity;
  /** Owning record identifier. */
  entityId: number | string;
  /** File name without extension. */
  name: string;
  /** File extension with or without a leading dot. */
  extension: string;
}): string {
  if (!imageEntities.includes(input.entity))
    throw new Error("Invalid image entity.");
  return `${imageFolderPrefix(input.prefix)}/${input.entity}/${segment(input.entityId)}/${segment(input.name)}.${extension(input.extension)}`;
}
/**
 * Builds a content-addressed resource file object key.
 *
 * @param input - Resource namespace, version, digest, and extension.
 * @returns An object key scoped to the resource version and SHA-256 digest.
 * @throws When identifiers, digest, prefix, or extension are invalid.
 */
export function buildResourceFileObjectPath(input: {
  /** Resource namespace prefix. */
  prefix: string;
  /** Positive resource identifier. */
  resourceId: number;
  /** Positive resource version. */
  version: number;
  /** Lowercase hexadecimal SHA-256 digest. */
  sha256: string;
  /** File extension with or without a leading dot. */
  extension: string;
}): string {
  if (
    !Number.isSafeInteger(input.resourceId) ||
    input.resourceId <= 0 ||
    !Number.isSafeInteger(input.version) ||
    input.version <= 0 ||
    !/^[a-f0-9]{64}$/u.test(input.sha256)
  )
    throw new Error("Invalid resource file path.");
  return `${resourceFolderPrefix(input.prefix)}/${input.resourceId}/v${input.version}/${input.sha256}.${extension(input.extension)}`;
}
/**
 * Builds a candidate-scoped resource archive object key.
 *
 * @param input - Candidate, namespace, resource, and version identifiers.
 * @returns An archive key ending in `resource-{id}-v{version}.zip`.
 * @throws When identifiers or the namespace prefix are invalid.
 */
export function buildResourceArchiveObjectPath(input: {
  /** Safe archive candidate identifier. */
  candidateId: string;
  /** Resource namespace prefix. */
  prefix: string;
  /** Positive resource identifier. */
  resourceId: number;
  /** Positive resource version. */
  version: number;
}): string {
  if (
    !Number.isSafeInteger(input.resourceId) ||
    input.resourceId <= 0 ||
    !Number.isSafeInteger(input.version) ||
    input.version <= 0
  )
    throw new Error("Invalid resource archive path.");
  return `${resourceFolderPrefix(input.prefix)}/${input.resourceId}/archives/${segment(input.candidateId)}/resource-${input.resourceId}-v${input.version}.zip`;
}
/**
 * Computes a lowercase hexadecimal SHA-256 digest.
 *
 * @param bytes - Bytes to hash.
 * @returns The 64-character digest.
 * @rejects When the Web Crypto digest operation fails.
 */
export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
