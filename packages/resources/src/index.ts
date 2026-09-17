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
  tokenKey?: string;
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

export type ResourceUploadMetadata = {
  contentType: string;
  fileName: string;
  size: number;
};

export type ResourceUploadTarget = ResourceUploadMetadata & {
  objectPath: string;
  url: string;
};

export type ResourceDeleteResult = "deleted" | "missing";

export type ResourceStorage = {
  createUploadTarget(
    input: ResourceUploadMetadata,
    kind?: "preview" | "resource",
  ): ResourceUploadTarget;
  delete(objectPath: string): Promise<ResourceDeleteResult>;
  uploadStream(input: {
    body: ReadableStream;
    contentLength: number;
    contentType: string;
    objectPath: string;
  }): Promise<void>;
  upload(input: ResourceUploadInput): Promise<ResourceUploadResult>;
  uploadPreview(input: ResourceUploadInput): Promise<ResourceUploadResult>;
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

export const maxBufferedResourceBytes = 4 * 1024 * 1024;
export const maxSessionFileBytes = 20 * 1024 * 1024;
export const maxSessionBytes = 50 * 1024 * 1024;
export const resourceUrlLifetimeSeconds = 120;
const allowedMimeTypes = {
  ".3mf": [
    "application/octet-stream",
    "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
  ],
  ".pdf": ["application/octet-stream", "application/pdf"],
  ".step": ["application/octet-stream", "application/step", "model/step"],
  ".stl": ["application/octet-stream", "application/sla", "model/stl"],
  ".stp": ["application/octet-stream", "application/step", "model/step"],
  ".txt": ["application/octet-stream", "text/plain"],
  ".zip": [
    "application/octet-stream",
    "application/x-zip-compressed",
    "application/zip",
  ],
} as const;
const allowedPreviewMimeTypes = {
  ".jpeg": ["image/jpeg"],
  ".jpg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
} as const;

export function buildResourceFolderPrefix(input: {
  environment: ResourceDeploymentEnvironment;
  isolatedPreviewPrNumber?: number;
}): string {
  if (input.environment === "production") {
    return "resources/files";
  }

  if (input.environment === "development") {
    return "resources/dev";
  }

  if (input.isolatedPreviewPrNumber === undefined) {
    return "resources/preview";
  }

  return buildPreviewFolderPath(input.isolatedPreviewPrNumber);
}

export function createResourceStorage(
  input: ResourceStorageConfig,
): ResourceStorage {
  const config = readConfig(input);

  return {
    createUploadTarget(metadata, kind = "resource") {
      const extension = validateUploadMetadata(
        metadata,
        kind === "preview" ? allowedPreviewMimeTypes : allowedMimeTypes,
        maxSessionFileBytes,
      );
      const objectPath = `${config.folderPrefix}/${config.randomUUID()}${extension}`;

      return {
        ...metadata,
        objectPath,
        url: buildUrl(config.cdnBaseUrl, objectPath),
      };
    },
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
    async uploadStream({ body, contentLength, contentType, objectPath }) {
      const normalizedPath = normalizeObjectPath(objectPath);
      if (!normalizedPath.startsWith(`${config.folderPrefix}/`)) {
        throw new Error(
          "Resource object path is outside the configured namespace.",
        );
      }

      await bunnyRequest(config, normalizedPath, {
        body,
        expectedStatuses: [200, 201],
        headers: {
          "content-length": String(contentLength),
          "content-type": contentType,
        },
        method: "PUT",
      });
    },
    async upload(input) {
      return upload(config, input, allowedMimeTypes);
    },
    async uploadPreview(input) {
      return upload(config, input, allowedPreviewMimeTypes);
    },
  };
}

export async function signResourceUrl(input: {
  cdnBaseUrl?: string;
  expiresAt?: number;
  objectPath: string;
  tokenKey?: string;
}): Promise<string> {
  const cdnBaseUrl = input.cdnBaseUrl?.trim();
  const tokenKey = input.tokenKey?.trim();
  if (!cdnBaseUrl) throw new Error("RESOURCE_CDN_BASE_URL is required.");
  if (!tokenKey) throw new Error("RESOURCE_CDN_TOKEN_KEY is required.");

  const expiresAt =
    input.expiresAt ??
    Math.floor(Date.now() / 1000) + resourceUrlLifetimeSeconds;
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
    throw new Error("Resource URL expiry is invalid.");
  }

  const url = new URL(
    buildUrl(cdnBaseUrl, normalizeObjectPath(input.objectPath)),
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

async function upload(
  config: BunnyConfig,
  input: ResourceUploadInput,
  allowedTypes: Readonly<Record<string, readonly string[]>>,
): Promise<ResourceUploadResult> {
  const extension = validateUploadMetadata(
    { ...input, size: input.bytes.byteLength },
    allowedTypes,
    maxBufferedResourceBytes,
  );
  const objectPath = `${config.folderPrefix}/${config.randomUUID()}${extension}`;
  await bunnyRequest(config, objectPath, {
    body: Uint8Array.from(input.bytes),
    expectedStatuses: [200, 201],
    headers: { "content-type": input.contentType },
    method: "PUT",
  });

  return {
    contentType: input.contentType,
    fileName: input.fileName,
    objectPath,
    size: input.bytes.byteLength,
    url: buildUrl(config.cdnBaseUrl, objectPath),
  };
}

export function validateUploadMetadata(
  input: ResourceUploadMetadata,
  allowedTypes: Readonly<Record<string, readonly string[]>>,
  maxBytes: number,
): string {
  if (!Number.isSafeInteger(input.size) || input.size <= 0) {
    throw new Error("Resource files cannot be empty.");
  }

  if (input.size > maxBytes) {
    throw new Error("Resource file exceeds the configured size limit.");
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
    .toLowerCase();
  const allowed = allowedTypes[extension];

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
    fetch: input.fetch ?? ((request, init) => fetch(request, init)),
    folderPrefix: normalizeFolderPrefix(input.folderPrefix),
    randomUUID: input.randomUUID ?? randomUUID,
    zoneName,
  };
}

function buildPreviewFolderPath(prNumber: number): string {
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error("Resource preview cleanup requires a positive PR number.");
  }

  return `resources/preview/pr-${prNumber}`;
}

function normalizeFolderPrefix(folderPrefix: string | undefined): string {
  const normalized = folderPrefix?.trim().replace(/^\/+|\/+$/gu, "");

  if (
    !normalized ||
    !/^resources\/(?:dev|files|preview(?:\/pr-[1-9]\d*)?)$/u.test(normalized)
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
