import { randomUUID } from "node:crypto";

type FetchLike = typeof fetch;

export type ResourceDeploymentEnvironment =
  | "development"
  | "preview"
  | "production";

export type ResourceStorageConfig = {
  accessKey?: string;
  cdnBaseUrl?: string;
  endpoint?: string;
  fetch?: FetchLike;
  folderPrefix?: string;
  randomUUID?: () => string;
  zoneName?: string;
};

export type ResourceUploadInput = {
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
};

export type ResourceUploadResult = {
  contentType: string;
  fileName: string;
  objectPath: string;
  size: number;
  url: string;
};

export type ResourceDeleteResult = "deleted" | "missing";

export type ResourceStorage = {
  delete(objectPath: string): Promise<ResourceDeleteResult>;
  upload(input: ResourceUploadInput): Promise<ResourceUploadResult>;
};

type BunnyConfig = {
  accessKey: string;
  cdnBaseUrl: string;
  endpoint: string;
  fetch: FetchLike;
  folderPrefix: string;
  randomUUID: () => string;
  zoneName: string;
};

type BunnyObject = {
  IsDirectory?: boolean;
  ObjectName?: string;
};

const maxResourceBytes = 4 * 1024 * 1024;
const allowedMimeTypes = {
  ".3mf": ["application/vnd.ms-package.3dmanufacturing-3dmodel+xml"],
  ".pdf": ["application/pdf"],
  ".step": ["application/step", "model/step"],
  ".stl": ["application/sla", "model/stl"],
  ".stp": ["application/step", "model/step"],
  ".txt": ["text/plain"],
  ".zip": ["application/x-zip-compressed", "application/zip"],
} as const;

export function buildResourceFolderPrefix(input: {
  environment: ResourceDeploymentEnvironment;
  isolatedPreviewPrNumber?: number;
}): string {
  if (input.environment === "production") {
    return "files";
  }

  if (input.environment === "development") {
    return "dev";
  }

  if (input.isolatedPreviewPrNumber === undefined) {
    return "preview";
  }

  return buildPreviewFolderPath(input.isolatedPreviewPrNumber);
}

export function createResourceStorage(
  input: ResourceStorageConfig,
): ResourceStorage {
  const config = readConfig(input);

  return {
    async delete(objectPath) {
      const normalizedPath = normalizeObjectPath(objectPath);

      if (!normalizedPath.startsWith(`${config.folderPrefix}/`)) {
        throw new Error(
          "Resource object path is outside the configured namespace.",
        );
      }

      const response = await bunnyRequest(config, normalizedPath, {
        expectedStatuses: [200, 404],
        method: "DELETE",
      });

      return response.status === 404 ? "missing" : "deleted";
    },
    async upload(upload) {
      const extension = validateUpload(upload);
      const objectPath = `${config.folderPrefix}/${config.randomUUID()}${extension}`;
      await bunnyRequest(config, objectPath, {
        body: Uint8Array.from(upload.bytes),
        expectedStatuses: [200, 201],
        headers: { "content-type": upload.contentType },
        method: "PUT",
      });

      return {
        contentType: upload.contentType,
        fileName: upload.fileName,
        objectPath,
        size: upload.bytes.byteLength,
        url: buildUrl(config.cdnBaseUrl, objectPath),
      };
    },
  };
}

export async function deletePreviewResourceFolder(
  input: ResourceStorageConfig & { prNumber: number },
): Promise<{
  folderPath: string;
  status: ResourceDeleteResult;
}> {
  const folderPath = buildPreviewFolderPath(input.prNumber);
  const config = readConfig({ ...input, folderPrefix: folderPath });
  const found = await deleteBunnyFolder(config, folderPath);

  return { folderPath, status: found ? "deleted" : "missing" };
}

function validateUpload(input: ResourceUploadInput): string {
  if (input.bytes.byteLength > maxResourceBytes) {
    throw new Error("Resource files cannot exceed 4 MiB.");
  }

  if (
    !input.fileName ||
    input.fileName.length > 255 ||
    input.fileName === "." ||
    input.fileName === ".." ||
    input.fileName.includes("/") ||
    input.fileName.includes("\\") ||
    [...input.fileName].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 31 || codePoint === 127;
    })
  ) {
    throw new Error("Resource file name is unsafe.");
  }

  const extension = input.fileName
    .slice(input.fileName.lastIndexOf("."))
    .toLowerCase() as keyof typeof allowedMimeTypes;
  const allowed = allowedMimeTypes[extension];

  if (!allowed?.some((contentType) => contentType === input.contentType)) {
    throw new Error("Resource file extension and MIME type do not match.");
  }

  return extension;
}

async function deleteBunnyFolder(
  config: BunnyConfig,
  folderPath: string,
): Promise<boolean> {
  const response = await bunnyRequest(config, `${folderPath}/`, {
    expectedStatuses: [200, 404],
    method: "GET",
  });

  if (response.status === 404) {
    return false;
  }

  const objects: unknown = await response.json();

  if (!Array.isArray(objects)) {
    throw new Error("Bunny storage list response was not an array.");
  }

  for (const object of objects as BunnyObject[]) {
    if (!object.ObjectName) {
      continue;
    }

    const objectPath = `${folderPath}/${normalizeObjectName(object.ObjectName)}`;

    if (object.IsDirectory) {
      await deleteBunnyFolder(config, objectPath);
    } else {
      await bunnyRequest(config, objectPath, {
        expectedStatuses: [200, 404],
        method: "DELETE",
      });
    }
  }

  return true;
}

async function bunnyRequest(
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
    buildUrl(`${config.endpoint}/${config.zoneName}`, objectPath),
    {
      body: input.body,
      headers: { AccessKey: config.accessKey, ...input.headers },
      method: input.method,
    },
  );

  if (!input.expectedStatuses.includes(response.status)) {
    throw new Error(`Bunny storage request failed: ${response.status}.`);
  }

  return response;
}

function readConfig(input: ResourceStorageConfig): BunnyConfig {
  const accessKey = input.accessKey?.trim();
  const cdnBaseUrl = input.cdnBaseUrl?.trim();
  const endpoint = input.endpoint?.trim();
  const zoneName = input.zoneName?.trim();

  if (!accessKey) {
    throw new Error("RESOURCE_STORAGE_ACCESS_KEY is required.");
  }

  if (!cdnBaseUrl) {
    throw new Error("RESOURCE_CDN_BASE_URL is required.");
  }

  if (!endpoint) {
    throw new Error("RESOURCE_STORAGE_ENDPOINT is required.");
  }

  if (!zoneName) {
    throw new Error("RESOURCE_STORAGE_ZONE_NAME is required.");
  }

  return {
    accessKey,
    cdnBaseUrl: trimTrailingSlash(cdnBaseUrl),
    endpoint: trimTrailingSlash(endpoint),
    fetch: input.fetch ?? fetch,
    folderPrefix: normalizeFolderPrefix(input.folderPrefix),
    randomUUID: input.randomUUID ?? randomUUID,
    zoneName,
  };
}

function buildPreviewFolderPath(prNumber: number): string {
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error("Resource preview cleanup requires a positive PR number.");
  }

  return `preview/pr-${prNumber}`;
}

function normalizeFolderPrefix(folderPrefix: string | undefined): string {
  const normalized = folderPrefix?.trim().replace(/^\/+|\/+$/gu, "");

  if (
    !normalized ||
    !/^(?:dev|files|preview(?:\/pr-[1-9]\d*)?)$/u.test(normalized)
  ) {
    throw new Error("RESOURCE_FOLDER_PREFIX is invalid.");
  }

  return normalized;
}

function normalizeObjectPath(objectPath: string): string {
  const normalized = objectPath.trim().replace(/^\/+|\/+$/gu, "");

  if (
    !normalized ||
    normalized.includes("\\") ||
    normalized
      .split("/")
      .some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Resource object path is unsafe.");
  }

  return normalized;
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

function buildUrl(baseUrl: string, objectPath: string): string {
  return `${trimTrailingSlash(baseUrl)}/${objectPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, "");
}
