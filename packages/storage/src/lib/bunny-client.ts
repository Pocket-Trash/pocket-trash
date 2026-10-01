import { storageFetchTimeoutMs } from "../constants.js";
import { normalizeObjectPath, trimTrailingSlash } from "./paths.js";
/**
 * Sends an authenticated Bunny Storage request to an encoded object path.
 *
 * @param config - Validated Bunny Storage connection settings.
 * @param objectPath - Zone-relative object or folder path.
 * @param input - Request body, method, headers, and accepted statuses.
 * @returns The accepted Bunny response.
 * @rejects When the request times out, fetch fails, or the status is unexpected.
 * @internal
 */
export async function bunnyRequest(
  config: BunnyConfig,
  objectPath: string,
  input: {
    /** Optional request body. */
    body?: BodyInit;
    /** HTTP statuses considered successful for this operation. */
    expectedStatuses: number[];
    /** Additional request headers. */
    headers?: HeadersInit;
    /** Bunny Storage HTTP method. */
    method: "DELETE" | "GET" | "PUT";
  },
): Promise<Response> {
  const requestInit = {
    body: input.body,
    ...(input.body instanceof ReadableStream
      ? { duplex: "half" as const }
      : {}),
    signal: AbortSignal.timeout(config.fetchTimeoutMs ?? storageFetchTimeoutMs),
    headers: { AccessKey: config.accessKey, ...input.headers },
    method: input.method,
  };
  const response = await config.fetch(
    `${config.endpoint}/${config.zoneName}/${objectPath.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/")}`,
    requestInit,
  );

  if (!input.expectedStatuses.includes(response.status)) {
    throw new Error(`Bunny storage request failed: ${response.status}.`);
  }

  return response;
}

/**
 * Optional Bunny Storage settings before validation and defaults.
 *
 * @internal
 */
export type BunnyStorageConfig = {
  /** Bunny Storage access key. */
  accessKey?: string;
  /** Bunny Storage API endpoint. */
  endpoint?: string;
  /** Bunny Storage zone name. */
  zoneName?: string;
  /** Public CDN base URL. */
  cdnBaseUrl?: string;
  /** Optional fetch implementation. */
  fetch?: typeof fetch;
  /** Optional request timeout in milliseconds. */
  fetchTimeoutMs?: number;
};
/**
 * Validated Bunny Storage settings used for requests.
 *
 * @internal
 */
export type BunnyConfig = {
  /** Bunny Storage access key. */
  accessKey: string;
  /** Bunny Storage API endpoint without trailing slash. */
  endpoint: string;
  /** Bunny Storage zone name. */
  zoneName: string;
  /** Public CDN base URL without trailing slash. */
  cdnBaseUrl: string;
  /** Fetch implementation. */
  fetch: typeof fetch;
  /** Request timeout in milliseconds. */
  fetchTimeoutMs: number;
};
/**
 * Bunny Storage folder listing entry.
 *
 * @internal
 */
export type BunnyObject = {
  /** Whether the entry represents a directory. */
  IsDirectory?: boolean;
  /** Entry name relative to the listed folder. */
  ObjectName?: string;
};
/**
 * Validates Bunny Storage settings and applies fetch and timeout defaults.
 *
 * @param input - Optional storage settings.
 * @returns Complete normalized Bunny configuration.
 * @throws When a required credential or endpoint is missing.
 * @internal
 */
export function readBunnyConfig(input: BunnyStorageConfig): BunnyConfig {
  const accessKey = input.accessKey?.trim();
  const endpoint = input.endpoint?.trim();
  const zoneName = input.zoneName?.trim();
  const cdnBaseUrl = input.cdnBaseUrl?.trim();
  if (!accessKey) throw new Error("BUNNY_STORAGE_ACCESS_KEY is required.");
  if (!endpoint) throw new Error("BUNNY_STORAGE_ENDPOINT is required.");
  if (!zoneName) throw new Error("BUNNY_STORAGE_ZONE_NAME is required.");
  if (!cdnBaseUrl) throw new Error("BUNNY_CDN_BASE_URL is required.");
  return {
    accessKey,
    endpoint: trimTrailingSlash(endpoint),
    zoneName,
    cdnBaseUrl: trimTrailingSlash(cdnBaseUrl),
    fetch: input.fetch ?? ((request, init) => fetch(request, init)),
    fetchTimeoutMs: input.fetchTimeoutMs ?? storageFetchTimeoutMs,
  };
}
/**
 * Recursively deletes a Bunny Storage folder and all files below it.
 * Directories are emptied through listing before each directory entry is deleted.
 *
 * @param config - Validated Bunny Storage settings.
 * @param folderPath - Zone-relative folder path.
 * @returns Whether the folder existed and the number of deleted files.
 * @rejects When listing, validation, or deletion fails.
 * @internal
 */
export async function deleteFolderRecursive(
  config: BunnyConfig,
  folderPath: string,
): Promise<{
  /** Whether the requested folder existed. */
  found: boolean;
  /** Number of files deleted recursively. */
  deletedFiles: number;
}> {
  const path = normalizeObjectPath(folderPath);
  const objects = await listFolder(config, path);
  if (!objects) return { found: false, deletedFiles: 0 };
  let deletedFiles = 0;
  for (const object of objects) {
    if (!object.ObjectName) continue;
    const objectPath = `${path}/${normalizeObjectName(object.ObjectName)}`;
    if (object.IsDirectory)
      deletedFiles += (await deleteFolderRecursive(config, objectPath))
        .deletedFiles;
    else {
      const response = await bunnyRequest(config, objectPath, {
        expectedStatuses: [200, 404],
        method: "DELETE",
      });
      if (response.status === 200) deletedFiles++;
    }
  }
  await bunnyRequest(config, `${path}/`, {
    expectedStatuses: [200, 404],
    method: "DELETE",
  });
  return { found: true, deletedFiles };
}
/**
 * Lists a Bunny Storage folder.
 *
 * @param config - Validated Bunny Storage settings.
 * @param folderPath - Zone-relative folder path.
 * @returns Folder entries, or `null` when the folder does not exist.
 * @rejects When the request fails or returns a non-array body.
 * @internal
 */
export async function listFolder(
  config: BunnyConfig,
  folderPath: string,
): Promise<BunnyObject[] | null> {
  const response = await bunnyRequest(
    config,
    `${normalizeObjectPath(folderPath)}/`,
    { expectedStatuses: [200, 404], method: "GET" },
  );
  if (response.status === 404) return null;
  const objects: unknown = await response.json();
  if (!Array.isArray(objects))
    throw new Error("Bunny storage list response was not an array.");
  return objects as BunnyObject[];
}
/**
 * Validates a single object name returned by Bunny Storage.
 *
 * @param objectName - Folder-relative Bunny entry name.
 * @returns The unchanged safe entry name.
 * @throws When the name is empty, traverses directories, or contains separators.
 */
function normalizeObjectName(objectName: string): string {
  if (
    !objectName ||
    objectName === "." ||
    objectName === ".." ||
    objectName.includes("/") ||
    objectName.includes("\\")
  ) {
    throw new Error("Bunny storage returned an unsafe object name.");
  }

  return objectName;
}
