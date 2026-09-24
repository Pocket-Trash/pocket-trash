import { normalizeObjectPath } from "./lib/paths.js";
export type ImageEntity =
  | "products"
  | "collections"
  | "collection-items"
  | "resources";
export function imageFolderPrefix(value: string | undefined): string {
  const prefix = normalizeObjectPath(value ?? "");
  if (!/^images(?:\/dev|\/preview(?:\/pr-[1-9]\d*)?)?$/u.test(prefix))
    throw new Error("BUNNY_IMAGE_FOLDER_PREFIX is invalid.");
  return prefix;
}
export function resourceFolderPrefix(value: string | undefined): string {
  const prefix = normalizeObjectPath(value ?? "");
  if (!/^resources\/(?:files|dev|preview(?:\/pr-[1-9]\d*)?)$/u.test(prefix))
    throw new Error("BUNNY_RESOURCE_FOLDER_PREFIX is invalid.");
  return prefix;
}
function segment(value: string | number): string {
  const result = String(value);
  if (!/^[a-zA-Z0-9_-]+$/u.test(result))
    throw new Error("Invalid storage path segment.");
  return result;
}
function extension(value: string): string {
  const result = value.replace(/^\./u, "").toLowerCase();
  if (!/^[a-z0-9]+$/u.test(result)) throw new Error("Invalid file extension.");
  return result;
}
export function buildImageObjectPath(input: {
  prefix: string;
  entity: ImageEntity;
  entityId: number | string;
  name: string;
  extension: string;
}): string {
  if (
    !["products", "collections", "collection-items", "resources"].includes(
      input.entity,
    )
  )
    throw new Error("Invalid image entity.");
  return `${imageFolderPrefix(input.prefix)}/${input.entity}/${segment(input.entityId)}/${segment(input.name)}.${extension(input.extension)}`;
}
export function buildResourceFileObjectPath(input: {
  prefix: string;
  resourceId: number;
  version: number;
  sha256: string;
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
export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
