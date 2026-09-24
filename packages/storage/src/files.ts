import { randomUUID } from "node:crypto";
import { readResponseBodyWithLimit } from "./body.js";
import { bunnyRequest } from "./bunny.js";
import {
  imageDeliveryUrl,
  inspectImage,
  maxImageBytes,
} from "./image-policy.js";

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
  createCatalogImageUploadTarget?(
    input: ResourceUploadMetadata,
    targetType: "collection" | "collection-item" | "product",
    targetId: number,
  ): ResourceUploadTarget;
  createUploadTarget(
    input: ResourceUploadMetadata,
    resourceId: number,
    kind?: "image" | "resource",
  ): ResourceUploadTarget;
  delete(objectPath: string): Promise<ResourceDeleteResult>;
  uploadStream(input: {
    body: ReadableStream | Uint8Array;
    contentLength: number;
    contentType: string;
    objectPath: string;
  }): Promise<void>;
  upload(
    input: ResourceUploadInput,
    resourceId: number,
  ): Promise<ResourceUploadResult>;
  uploadImage(
    input: ResourceUploadInput,
    resourceId: number,
  ): Promise<ResourceUploadResult>;
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
export const maxCatalogImageFiles = 20;
export const maxCatalogImageFileBytes = maxImageBytes;
export const maxCatalogImageSessionBytes = 200 * 1024 * 1024;
export const maxSessionFileBytes = 20 * 1024 * 1024;
export const maxSessionBytes = 100 * 1024 * 1024;
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
const allowedImageMimeTypes = {
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

export function createStorage(input: ResourceStorageConfig): ResourceStorage {
  const config = readConfig(input);

  return {
    createCatalogImageUploadTarget(metadata, targetType, targetId) {
      assertResourceId(targetId);
      const extension = validateUploadMetadata(
        metadata,
        allowedImageMimeTypes,
        maxCatalogImageFileBytes,
      );
      const objectPath = `${config.folderPrefix}/catalog/${targetType}/${targetId}/${config.randomUUID()}${extension}`;

      return {
        ...metadata,
        objectPath,
        url: imageDeliveryUrl(buildUrl(config.cdnBaseUrl, objectPath)),
      };
    },
    createUploadTarget(metadata, resourceId, kind = "resource") {
      assertResourceId(resourceId);
      const extension = validateUploadMetadata(
        metadata,
        kind === "image" ? allowedImageMimeTypes : allowedMimeTypes,
        kind === "image" ? maxImageBytes : maxSessionFileBytes,
      );
      const objectPath = `${config.folderPrefix}/${resourceId}/${config.randomUUID()}${extension}`;

      return {
        ...metadata,
        objectPath,
        url:
          kind === "image"
            ? imageDeliveryUrl(buildUrl(config.cdnBaseUrl, objectPath))
            : buildUrl(config.cdnBaseUrl, objectPath),
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

      if (contentType.startsWith("image/")) {
        if (
          !Object.values(allowedImageMimeTypes).some((types) =>
            types.some((type) => type === contentType),
          )
        )
          throw new Error("Invalid image upload target.");
        if (
          !Number.isSafeInteger(contentLength) ||
          contentLength <= 0 ||
          contentLength > maxImageBytes
        )
          throw new Error("Image exceeds the configured size limit.");
        const bytes =
          body instanceof Uint8Array
            ? body
            : await readResponseBodyWithLimit(
                new Response(body),
                contentLength,
                AbortSignal.timeout(30_000),
              );
        if (bytes.byteLength !== contentLength)
          throw new Error("Image content length mismatch.");
        const image = inspectImage(bytes);
        if (image.contentType !== contentType)
          throw new Error("Image content type mismatch.");
        body = bytes;
      }
      await bunnyRequest(config, normalizedPath, {
        body: body instanceof Uint8Array ? new Uint8Array(body) : body,
        expectedStatuses: [200, 201],
        headers: {
          "content-length": String(contentLength),
          "content-type": contentType,
        },
        method: "PUT",
      });
    },
    async upload(input, resourceId) {
      return upload(config, input, allowedMimeTypes, resourceId);
    },
    async uploadImage(input, resourceId) {
      const target = this.createUploadTarget(
        { ...input, size: input.bytes.byteLength },
        resourceId,
        "image",
      );
      await this.uploadStream({
        body: input.bytes,
        contentLength: input.bytes.byteLength,
        contentType: input.contentType,
        objectPath: target.objectPath,
      });
      return target;
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
  if (!cdnBaseUrl) throw new Error("BUNNY_CDN_BASE_URL is required.");
  if (!tokenKey) throw new Error("BUNNY_CDN_TOKEN_KEY is required.");

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
  resourceId: number,
): Promise<ResourceUploadResult> {
  assertResourceId(resourceId);
  const extension = validateUploadMetadata(
    { ...input, size: input.bytes.byteLength },
    allowedTypes,
    maxBufferedResourceBytes,
  );
  const objectPath = `${config.folderPrefix}/${resourceId}/${config.randomUUID()}${extension}`;
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

function assertResourceId(resourceId: number): void {
  if (!Number.isSafeInteger(resourceId) || resourceId <= 0) {
    throw new Error("Resource ID must be a positive integer.");
  }
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

function readConfig(input: ResourceStorageConfig): BunnyConfig {
  const accessKey = input.accessKey?.trim();
  const cdnBaseUrl = input.cdnBaseUrl?.trim();
  const endpoint = input.endpoint?.trim();
  const zoneName = input.zoneName?.trim();

  if (!accessKey) {
    throw new Error("BUNNY_STORAGE_ACCESS_KEY is required.");
  }

  if (!cdnBaseUrl) {
    throw new Error("BUNNY_CDN_BASE_URL is required.");
  }

  if (!endpoint) {
    throw new Error("BUNNY_STORAGE_ENDPOINT is required.");
  }

  if (!zoneName) {
    throw new Error("BUNNY_STORAGE_ZONE_NAME is required.");
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
    throw new Error("BUNNY_RESOURCE_FOLDER_PREFIX is invalid.");
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
