import { storageFetchTimeoutMs } from "../constants.js";
import { normalizeObjectPath, trimTrailingSlash } from "./paths.js";
export async function bunnyRequest(
  config: BunnyConfig,
  objectPath: string,
  input: {
    body?: BodyInit;
    expectedStatuses: number[];
    headers?: HeadersInit;
    method: "DELETE" | "GET" | "PUT";
  },
): Promise<Response> {
  const response = await config.fetch(
    `${config.endpoint}/${config.zoneName}/${objectPath.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/")}`,
    {
      body: input.body,
      signal: AbortSignal.timeout(
        config.fetchTimeoutMs ?? storageFetchTimeoutMs,
      ),
      headers: { AccessKey: config.accessKey, ...input.headers },
      method: input.method,
    },
  );

  if (!input.expectedStatuses.includes(response.status)) {
    throw new Error(`Bunny storage request failed: ${response.status}.`);
  }

  return response;
}

export type BunnyStorageConfig = {
  accessKey?: string;
  endpoint?: string;
  zoneName?: string;
  cdnBaseUrl?: string;
  fetch?: typeof fetch;
  fetchTimeoutMs?: number;
};
export type BunnyConfig = {
  accessKey: string;
  endpoint: string;
  zoneName: string;
  cdnBaseUrl: string;
  fetch: typeof fetch;
  fetchTimeoutMs: number;
};
export type BunnyObject = { IsDirectory?: boolean; ObjectName?: string };
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
export async function deleteFolderRecursive(
  config: BunnyConfig,
  folderPath: string,
): Promise<{ found: boolean; deletedFiles: number }> {
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
  return { found: true, deletedFiles };
}
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
