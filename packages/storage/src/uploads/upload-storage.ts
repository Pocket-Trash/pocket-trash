import type { ImageEntity } from "../constants.js";

type PutInput = {
  body: ReadableStream;
  contentLength: number;
  contentType: string;
  objectPath: string;
};

import {
  imageMimeTypesByExtension,
  maxImageBytes,
  maxResourceFileBytes,
  resourceMimeTypesByExtension,
  storageFetchTimeoutMs,
} from "../constants.js";
import { imageDeliveryUrl } from "../images/delivery-url.js";
import { inspectImage } from "../images/validate-image.js";
import {
  type BunnyConfig,
  type BunnyStorageConfig,
  bunnyRequest,
  readBunnyConfig,
} from "../lib/bunny-client.js";
import { buildCdnUrl, normalizeObjectPath } from "../lib/paths.js";
import { readBodyWithLimit } from "../lib/read-body-with-limit.js";
import {
  buildImageObjectPath,
  buildResourceFileObjectPath,
  imageFolderPrefix,
  resourceFolderPrefix,
} from "../object-paths.js";
import { signResourceUrl } from "./signed-url.js";

export type ResourceDeploymentEnvironment =
  | "development"
  | "preview"
  | "production";

export type UploadStorageConfig = BunnyStorageConfig & {
  apiKey?: string;
  folderPrefix?: string;
  imageFolderPrefix?: string;
  pullZoneId?: number | string;
  tokenKey?: string;
};

export type UploadInput = {
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
};

export type UploadResult = {
  contentType: string;
  fileName: string;
  objectPath: string;
  size: number;
  url: string;
};

export type UploadMetadata = {
  contentType: string;
  fileName: string;
  size: number;
  sha256: string;
};

export type UploadTarget = UploadMetadata & {
  objectPath: string;
  url: string;
};

export type UploadDeleteResult = "deleted" | "missing";

export type UploadStorage = {
  createImageTarget(
    input: UploadMetadata,
    target: {
      entity: ImageEntity;
      entityId: number;
    },
  ): UploadTarget;
  createFileTarget(
    input: UploadMetadata,
    target: { resourceId: number; version: number },
  ): UploadTarget;
  delete(objectPath: string): Promise<UploadDeleteResult>;
  assertErasureReady(): Promise<void>;
  erase(objectPath: string): Promise<void>;
  putFile(input: PutInput): Promise<void>;
  putImage(
    input: Omit<PutInput, "body"> & { body: ReadableStream | Uint8Array },
  ): Promise<void>;
};

type UploadBunnyConfig = BunnyConfig & {
  apiKey?: string;
  folderPrefix: string;
  imageFolderPrefix: string;
  pullZoneId?: number;
  tokenKey?: string;
};

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

export function createUploadStorage(input: UploadStorageConfig): UploadStorage {
  const config = readConfig(input);

  return {
    async assertErasureReady() {
      const { apiKey, pullZoneId } = erasureConfig(config);
      const response = await config.fetch(
        `https://api.bunny.net/pullzone/${pullZoneId}`,
        {
          headers: { AccessKey: apiKey },
          method: "GET",
          signal: AbortSignal.timeout(config.fetchTimeoutMs),
        },
      );
      if (!response.ok)
        throw new Error(`Bunny Pull Zone request failed: ${response.status}.`);
      const value: unknown = await response.json();
      if (
        !value ||
        typeof value !== "object" ||
        !("PermaCacheStorageZoneId" in value) ||
        ((value as { PermaCacheStorageZoneId?: unknown })
          .PermaCacheStorageZoneId !== null &&
          (value as { PermaCacheStorageZoneId?: unknown })
            .PermaCacheStorageZoneId !== 0)
      ) {
        throw new Error("Bunny Perma-Cache must be disabled before erasure.");
      }
    },
    createImageTarget(metadata, { entity, entityId }) {
      assertEntityId(entityId);
      const extension = validateUploadMetadata(
        metadata,
        imageMimeTypesByExtension,
        maxImageBytes,
      );
      if (!/^[a-f0-9]{64}$/u.test(metadata.sha256))
        throw new Error("Invalid file hash.");
      const objectPath = buildImageObjectPath({
        prefix: config.imageFolderPrefix,
        entity,
        entityId,
        name: metadata.sha256,
        extension,
      });
      return {
        ...metadata,
        objectPath,
        url: imageDeliveryUrl(buildCdnUrl(config.cdnBaseUrl, objectPath)),
      };
    },
    createFileTarget(metadata, { resourceId, version }) {
      assertEntityId(resourceId);
      const extension = validateUploadMetadata(
        metadata,
        resourceMimeTypesByExtension,
        maxResourceFileBytes,
      );
      const objectPath = buildResourceFileObjectPath({
        prefix: config.folderPrefix,
        resourceId,
        version,
        sha256: metadata.sha256,
        extension,
      });
      return {
        ...metadata,
        objectPath,
        url: buildCdnUrl(config.cdnBaseUrl, objectPath),
      };
    },
    async delete(objectPath) {
      const normalizedPath = normalizeObjectPath(objectPath);

      if (
        !normalizedPath.startsWith(`${config.folderPrefix}/`) &&
        !normalizedPath.startsWith(`${config.imageFolderPrefix}/`)
      ) {
        throw new Error(
          "Upload object path is outside the configured namespace.",
        );
      }

      const response = await bunnyRequest(config, normalizedPath, {
        expectedStatuses: [200, 404],
        method: "DELETE",
      });

      return response.status === 404 ? "missing" : "deleted";
    },
    async erase(objectPath) {
      const normalizedPath = normalizeObjectPath(objectPath);
      if (!isErasablePath(config, normalizedPath))
        throw new Error("Object path is outside an erasable namespace.");
      const { apiKey, tokenKey } = erasureConfig(config);
      const cdnUrl = buildCdnUrl(config.cdnBaseUrl, normalizedPath);

      await bunnyRequest(config, normalizedPath, {
        expectedStatuses: [200, 404],
        method: "DELETE",
      });
      const purgeUrl = new URL("https://api.bunny.net/purge");
      purgeUrl.searchParams.set("url", cdnUrl);
      purgeUrl.searchParams.set("async", "false");
      const purge = await config.fetch(purgeUrl, {
        headers: { AccessKey: apiKey },
        method: "POST",
        signal: AbortSignal.timeout(config.fetchTimeoutMs),
      });
      if (![200, 204].includes(purge.status))
        throw new Error(`Bunny cache purge failed: ${purge.status}.`);

      await bunnyRequest(config, normalizedPath, {
        expectedStatuses: [404],
        method: "GET",
      });
      const delivery = await config.fetch(
        await signResourceUrl({
          cdnBaseUrl: config.cdnBaseUrl,
          objectPath: normalizedPath,
          tokenKey,
        }),
        {
          headers: { "cache-control": "no-cache, no-store" },
          method: "GET",
          signal: AbortSignal.timeout(config.fetchTimeoutMs),
        },
      );
      if (![404, 410].includes(delivery.status))
        throw new Error(`Bunny CDN verification failed: ${delivery.status}.`);
    },
    async putFile({ body, contentLength, contentType, objectPath }) {
      const normalizedPath = normalizeObjectPath(objectPath);
      if (
        !normalizedPath.startsWith(`${config.folderPrefix}/`) &&
        !normalizedPath.startsWith(`${config.imageFolderPrefix}/`)
      )
        throw new Error(
          "Upload object path is outside the configured namespace.",
        );
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
    async putImage({ body, contentLength, contentType, objectPath }) {
      if (
        !Object.values(imageMimeTypesByExtension).some((types) =>
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
          : await readBodyWithLimit(
              new Response(body),
              contentLength,
              AbortSignal.timeout(storageFetchTimeoutMs),
            );
      if (bytes.byteLength !== contentLength)
        throw new Error("Image content length mismatch.");
      const image = inspectImage(bytes);
      if (image.contentType !== contentType)
        throw new Error("Image content type mismatch.");
      const stream = new Response(new Uint8Array(bytes)).body;
      if (!stream) throw new Error("Image body is missing.");
      await this.putFile({
        body: stream,
        contentLength,
        contentType,
        objectPath,
      });
    },
  };
}

export function validateUploadMetadata(
  input: UploadMetadata,
  allowedTypes: Readonly<Record<string, readonly string[]>>,
  maxBytes: number,
): string {
  if (!Number.isSafeInteger(input.size) || input.size <= 0) {
    throw new Error("Upload files cannot be empty.");
  }

  if (input.size > maxBytes) {
    throw new Error("Upload file exceeds the configured size limit.");
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
    throw new Error("Upload file name is unsafe.");
  }

  const extension = input.fileName
    .slice(input.fileName.lastIndexOf("."))
    .toLowerCase();
  const allowed = allowedTypes[extension];

  if (!allowed?.some((contentType) => contentType === input.contentType)) {
    throw new Error("Upload file extension and MIME type do not match.");
  }

  return extension;
}

function readConfig(input: UploadStorageConfig): UploadBunnyConfig {
  const pullZoneId = Number(input.pullZoneId);
  return {
    ...readBunnyConfig(input),
    apiKey: input.apiKey?.trim() || undefined,
    folderPrefix: resourceFolderPrefix(input.folderPrefix),
    imageFolderPrefix: imageFolderPrefix(input.imageFolderPrefix),
    pullZoneId:
      Number.isSafeInteger(pullZoneId) && pullZoneId > 0
        ? pullZoneId
        : undefined,
    tokenKey: input.tokenKey?.trim() || undefined,
  };
}

function erasureConfig(config: UploadBunnyConfig) {
  if (!config.apiKey) throw new Error("BUNNY_API_KEY is required for erasure.");
  if (!config.pullZoneId)
    throw new Error("BUNNY_PULL_ZONE_ID is required for erasure.");
  if (!config.tokenKey)
    throw new Error("BUNNY_CDN_TOKEN_KEY is required for erasure.");
  return {
    apiKey: config.apiKey,
    pullZoneId: config.pullZoneId,
    tokenKey: config.tokenKey,
  };
}

function isErasablePath(config: UploadBunnyConfig, objectPath: string) {
  return (
    objectPath.startsWith(`${config.folderPrefix}/`) ||
    ["collections", "collection-items", "resources"].some((entity) =>
      objectPath.startsWith(`${config.imageFolderPrefix}/${entity}/`),
    )
  );
}

function buildPreviewFolderPath(prNumber: number): string {
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error("Resource preview cleanup requires a positive PR number.");
  }

  return `resources/preview/pr-${prNumber}`;
}

function assertEntityId(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new Error("Entity ID must be a positive integer.");
}
