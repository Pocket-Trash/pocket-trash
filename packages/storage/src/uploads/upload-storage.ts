import type { ImageEntity } from "../constants.js";

/** Validated upload body and destination metadata. */
type PutInput = {
  /** Byte stream uploaded to Bunny Storage. */
  body: ReadableStream;
  /** Exact body size in bytes. */
  contentLength: number;
  /** Declared body MIME type. */
  contentType: string;
  /** Zone-relative destination object key. */
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
  buildResourceArchiveObjectPath,
  buildResourceFileObjectPath,
  imageFolderPrefix,
  resourceFolderPrefix,
} from "../object-paths.js";
import { signResourceUrl } from "./signed-url.js";

/** Deployment environment that selects the resource object namespace. */
export type ResourceDeploymentEnvironment =
  | "development"
  | "preview"
  | "production";

/** Bunny upload, delivery, and erasure configuration. */
export type UploadStorageConfig = BunnyStorageConfig & {
  /** Bunny account API key required for verified erasure. */
  apiKey?: string;
  /** Resource object namespace prefix. */
  folderPrefix?: string;
  /** Image object namespace prefix. */
  imageFolderPrefix?: string;
  /** Bunny pull-zone identifier required for erasure. */
  pullZoneId?: number | string;
  /** Bunny CDN token key required for signed erasure verification. */
  tokenKey?: string;
};

/** Buffered file supplied to an upload workflow. */
export type UploadInput = {
  /** Complete file bytes. */
  bytes: Uint8Array;
  /** Declared file MIME type. */
  contentType: string;
  /** Client-visible file name. */
  fileName: string;
};

/** Persisted upload identity and public delivery metadata. */
export type UploadResult = {
  /** Validated file MIME type. */
  contentType: string;
  /** Original validated file name. */
  fileName: string;
  /** Zone-relative storage object key. */
  objectPath: string;
  /** File size in bytes. */
  size: number;
  /** Public delivery URL. */
  url: string;
};

/** Validated metadata used to create a server-owned upload target. */
export type UploadMetadata = {
  /** Declared file MIME type. */
  contentType: string;
  /** Client-visible file name. */
  fileName: string;
  /** File size in bytes. */
  size: number;
  /** Lowercase hexadecimal SHA-256 digest. */
  sha256: string;
};

/** Upload metadata plus its server-owned object key and delivery URL. */
export type UploadTarget = UploadMetadata & {
  /** Zone-relative storage object key. */
  objectPath: string;
  /** Public delivery URL. */
  url: string;
};

/** Outcome of deleting an upload object. */
export type UploadDeleteResult = "deleted" | "missing";

/** Server-owned destination for a generated resource ZIP archive. */
export type ArchiveTarget = {
  /** ZIP archive MIME type. */
  contentType: "application/zip";
  /** Download file name. */
  fileName: string;
  /** Candidate-scoped archive object key. */
  objectPath: string;
  /** Exact archive size in bytes. */
  size: number;
  /** Public archive delivery URL. */
  url: string;
};

/**
 * Validated object-key, byte-transfer, and Bunny I/O operations. Callers own
 * authorization, upload-session state, and attachment records.
 */
export type UploadStorage = {
  /**
   * Creates a candidate-scoped archive destination.
   *
   * @param resourceId - Positive resource identifier.
   * @param version - Positive resource version.
   * @param size - Exact archive size in bytes.
   * @returns Server-owned archive target.
   * @throws When identifiers, size, or path configuration are invalid.
   */
  createArchiveTarget(
    resourceId: number,
    version: number,
    size: number,
  ): ArchiveTarget;
  /**
   * Creates a content-addressed image destination.
   *
   * @param input - Validated image metadata and digest.
   * @param target - Image-owning entity and positive identifier.
   * @returns Server-owned image upload target.
   * @throws When metadata, ownership, digest, or path configuration are invalid.
   */
  createImageTarget(
    input: UploadMetadata,
    target: {
      /** Image-owning namespace. */
      entity: ImageEntity;
      /** Positive owning record identifier. */
      entityId: number;
    },
  ): UploadTarget;
  /**
   * Creates a content-addressed resource file destination.
   *
   * @param input - Validated resource file metadata and digest.
   * @param target - Positive resource identifier and version.
   * @returns Server-owned resource file target.
   * @throws When metadata, identifiers, digest, or path configuration are invalid.
   */
  createFileTarget(
    input: UploadMetadata,
    target: {
      /** Positive resource identifier. */
      resourceId: number;
      /** Positive resource version. */
      version: number;
    },
  ): UploadTarget;
  /**
   * Deletes an object within a configured upload namespace.
   *
   * @param objectPath - Zone-relative upload object key.
   * @returns Whether the object was deleted or missing.
   * @rejects When validation or Bunny deletion fails.
   */
  delete(objectPath: string): Promise<UploadDeleteResult>;
  /**
   * Verifies that Bunny Perma-Cache is disabled before erasure.
   *
   * @returns Completion when erasure prerequisites are satisfied.
   * @rejects When credentials, the pull-zone request, response shape, or Perma-Cache state is invalid.
   */
  assertErasureReady(): Promise<void>;
  /**
   * Deletes an erasable object, purges CDN cache, and verifies absence.
   *
   * @param objectPath - Zone-relative resource or non-product image key.
   * @returns Completion after storage and CDN verification.
   * @rejects When configuration, deletion, purge, signing, or verification fails.
   */
  erase(objectPath: string): Promise<void>;
  /**
   * Opens a resource object body for streaming.
   *
   * @param objectPath - Zone-relative resource object key.
   * @returns The object byte stream.
   * @rejects When validation, fetching, or body access fails.
   */
  readFile(objectPath: string): Promise<ReadableStream<Uint8Array>>;
  /**
   * Uploads a fixed-length stream to a configured namespace.
   *
   * @param input - Body stream, length, MIME type, and destination key.
   * @returns Completion after Bunny accepts the upload.
   * @rejects When validation or Bunny upload fails.
   */
  putFile(input: PutInput): Promise<void>;
  /**
   * Validates encoded image bytes before uploading them.
   *
   * @param input - Image bytes or stream plus exact metadata and destination.
   * @returns Completion after validation and upload.
   * @rejects When metadata, buffering, image inspection, or upload fails.
   */
  putImage(
    input: Omit<PutInput, "body"> & {
      /** Buffered or streaming encoded image body. */
      body: ReadableStream | Uint8Array;
    },
  ): Promise<void>;
};

/** Validated Bunny settings plus upload namespaces and erasure credentials. */
type UploadBunnyConfig = BunnyConfig & {
  /** Bunny account API key. */
  apiKey?: string;
  /** Validated resource object namespace prefix. */
  folderPrefix: string;
  /** Validated image object namespace prefix. */
  imageFolderPrefix: string;
  /** Positive Bunny pull-zone identifier. */
  pullZoneId?: number;
  /** Bunny CDN token key. */
  tokenKey?: string;
};

/**
 * Selects the resource object namespace for a deployment.
 *
 * @param input - Deployment environment and optional isolated preview number.
 * @returns The normalized resource folder prefix.
 * @throws When an isolated preview number is not a positive integer.
 */
export function buildResourceFolderPrefix(input: {
  /** Deployment environment that owns the namespace. */
  environment: ResourceDeploymentEnvironment;
  /** Pull-request number for an isolated preview namespace. */
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

/**
 * Creates Bunny-backed resource and image upload operations.
 *
 * @param input - Bunny connection, namespace, and erasure settings.
 * @returns Validated upload storage operations.
 * @throws When Bunny or namespace configuration is invalid.
 */
export function createUploadStorage(input: UploadStorageConfig): UploadStorage {
  const config = readConfig(input);

  return {
    /**
     * Creates a candidate-scoped archive destination.
     *
     * @param resourceId - Positive resource identifier.
     * @param version - Positive resource version.
     * @param size - Exact archive size in bytes.
     * @returns Server-owned archive target.
     * @throws When identifiers, size, or path configuration are invalid.
     */
    createArchiveTarget(resourceId, version, size) {
      if (!Number.isSafeInteger(size) || size <= 0 || size > 0xffffffff)
        throw new Error("Resource archive metadata is invalid.");
      const fileName = `resource-${resourceId}-v${version}.zip`;
      const objectPath = buildResourceArchiveObjectPath({
        candidateId: crypto.randomUUID(),
        prefix: config.folderPrefix,
        resourceId,
        version,
      });
      return {
        contentType: "application/zip",
        fileName,
        objectPath,
        size,
        url: buildCdnUrl(config.cdnBaseUrl, objectPath),
      };
    },
    /**
     * Verifies that Bunny Perma-Cache is disabled before erasure.
     *
     * @returns Completion when erasure prerequisites are satisfied.
     * @rejects When credentials, the pull-zone request, response shape, or Perma-Cache state is invalid.
     */
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
        ((
          value as {
            /** Storage zone backing Perma-Cache, or a disabled sentinel. */
            PermaCacheStorageZoneId?: unknown;
          }
        ).PermaCacheStorageZoneId !== null &&
          (
            value as {
              /** Storage zone backing Perma-Cache, or a disabled sentinel. */
              PermaCacheStorageZoneId?: unknown;
            }
          ).PermaCacheStorageZoneId !== 0)
      ) {
        throw new Error("Bunny Perma-Cache must be disabled before erasure.");
      }
    },
    /**
     * Creates a content-addressed image destination.
     *
     * @param metadata - Validated image metadata and digest.
     * @param target - Image-owning entity and positive identifier.
     * @returns Server-owned image upload target.
     * @throws When metadata, ownership, digest, or path configuration are invalid.
     */
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
    /**
     * Creates a content-addressed resource file destination.
     *
     * @param metadata - Validated resource file metadata and digest.
     * @param target - Positive resource identifier and version.
     * @returns Server-owned resource file target.
     * @throws When metadata, identifiers, digest, or path configuration are invalid.
     */
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
    /**
     * Deletes an object within a configured upload namespace.
     *
     * @param objectPath - Zone-relative upload object key.
     * @returns Whether the object was deleted or missing.
     * @rejects When validation or Bunny deletion fails.
     */
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
    /**
     * Deletes an erasable object, purges CDN cache, and verifies absence.
     *
     * @param objectPath - Zone-relative resource or non-product image key.
     * @returns Completion after storage and CDN verification.
     * @rejects When configuration, deletion, purge, signing, or verification fails.
     */
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
    /**
     * Opens a resource object body for streaming.
     *
     * @param objectPath - Zone-relative resource object key.
     * @returns The object byte stream.
     * @rejects When validation, fetching, or body access fails.
     */
    async readFile(objectPath) {
      const normalizedPath = normalizeObjectPath(objectPath);
      if (!normalizedPath.startsWith(`${config.folderPrefix}/`))
        throw new Error(
          "Upload object path is outside the configured namespace.",
        );
      const response = await bunnyRequest(config, normalizedPath, {
        expectedStatuses: [200],
        method: "GET",
      });
      if (!response.body) throw new Error("Upload object body is unavailable.");
      return response.body;
    },
    /**
     * Uploads a fixed-length stream to a configured namespace.
     *
     * @param input - Body stream, length, MIME type, and destination key.
     * @returns Completion after Bunny accepts the upload.
     * @rejects When validation or Bunny upload fails.
     */
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
    /**
     * Validates encoded image bytes before uploading them.
     *
     * @param input - Image bytes or stream plus exact metadata and destination.
     * @returns Completion after validation and upload.
     * @rejects When metadata, buffering, image inspection, or upload fails.
     */
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

/**
 * Validates upload size, file name, extension, and MIME type.
 *
 * @param input - Upload metadata supplied by the caller.
 * @param allowedTypes - MIME allowlist keyed by file extension.
 * @param maxBytes - Maximum accepted file size in bytes.
 * @returns The validated lowercase file extension.
 * @throws When the upload metadata violates a storage constraint.
 */
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

/**
 * Normalizes upload storage settings into Bunny runtime configuration.
 *
 * @param input - Raw upload storage settings.
 * @returns Validated Bunny settings and normalized namespaces.
 * @throws When Bunny or namespace configuration is invalid.
 */
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

/**
 * Reads credentials required for storage erasure.
 *
 * @param config - Validated upload storage configuration.
 * @returns Bunny account, pull-zone, and CDN signing credentials.
 * @throws When any erasure credential is absent.
 */
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

/**
 * Checks whether an object belongs to an erasable namespace.
 *
 * @param config - Validated upload storage configuration.
 * @param objectPath - Normalized zone-relative object key.
 * @returns Whether the object may be erased.
 */
function isErasablePath(config: UploadBunnyConfig, objectPath: string) {
  return (
    objectPath.startsWith(`${config.folderPrefix}/`) ||
    ["collections", "collection-items", "resources"].some((entity) =>
      objectPath.startsWith(`${config.imageFolderPrefix}/${entity}/`),
    )
  );
}

/**
 * Builds an isolated preview resource namespace.
 *
 * @param prNumber - Positive pull-request number.
 * @returns Preview resource folder prefix.
 * @throws When the pull-request number is invalid.
 */
function buildPreviewFolderPath(prNumber: number): string {
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error("Resource preview cleanup requires a positive PR number.");
  }

  return `resources/preview/pr-${prNumber}`;
}

/**
 * Requires a positive safe entity identifier.
 *
 * @param id - Candidate entity identifier.
 * @throws When the identifier is not a positive safe integer.
 */
function assertEntityId(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new Error("Entity ID must be a positive integer.");
}
