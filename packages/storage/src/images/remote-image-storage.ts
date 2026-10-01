import type { ImageEntity } from "../constants.js";
import {
  imageThumbnailWidth,
  maxImageBytes,
  maxImageInputPixels,
} from "../constants.js";
import {
  type BunnyConfig,
  type BunnyStorageConfig,
  bunnyRequest,
  readBunnyConfig,
} from "../lib/bunny-client.js";
import { buildCdnUrl, normalizeObjectPath } from "../lib/paths.js";
import { readBodyWithLimit } from "../lib/read-body-with-limit.js";
import { buildImageObjectPath, sha256 } from "../object-paths.js";
import { imageDeliveryUrl } from "./delivery-url.js";
import { inspectImage } from "./validate-image.js";

/** Supported remote image storage provider. */
export type ImageStorageProvider = "bunny";

/** Remote image storage settings and validation limits. */
export type RemoteImageStorageConfig = BunnyStorageConfig & {
  /** Whether mutating operations should be skipped. */
  dryRun?: boolean;
  /** Maximum decoded source image pixel count. */
  maxInputPixels?: number;
  /** Image storage provider name. */
  provider?: string;
  /** Maximum downloaded source image size in bytes. */
  remoteImageMaxBytes?: number;
};

/** Target naming and ownership options for an image upload. */
export type ImageUploadInput = {
  /** Optional target file name for legacy folder-based uploads. */
  fileName?: string;
  /** Optional target folder for legacy folder-based uploads. */
  folder?: string;
  /** Validated image namespace prefix. */
  prefix?: string;
  /** Image-owning namespace. */
  entity?: ImageEntity;
  /** Owning record identifier. */
  entityId?: string | number;
  /** Preferred stable source image identifier. */
  sourceImageId?: string;
  /** Ignored legacy provider compatibility flag. */
  overwriteFile?: boolean;
  /** Ignored legacy provider compatibility flag. */
  overwriteTags?: boolean;
  /** Ignored legacy provider metadata retained for compatibility. */
  tags?: string[];
  /** Ignored legacy provider naming flag. */
  useUniqueFileName?: boolean;
};

/** Remote image source plus target upload options. */
export type RemoteImageUploadInput = ImageUploadInput & {
  /** Absolute source image URL. */
  sourceUrl: string;
};

/** Legacy image update metadata retained for provider compatibility. */
export type ImageUpdateInput = {
  /** Ignored legacy provider metadata retained for compatibility. */
  tags?: string[];
};

/** Persisted image identity, dimensions, and delivery URLs. */
export type ImageUploadResult = {
  /** Provider file identifier. */
  fileId: string;
  /** Provider-relative file path. */
  filePath: string;
  /** Decoded image height in pixels. */
  height: number;
  /** Storage provider. */
  provider: ImageStorageProvider;
  /** Thumbnail delivery URL. */
  thumbnailUrl: string;
  /** Full-size delivery URL. */
  url: string;
  /** Decoded image width in pixels. */
  width: number;
};

/** Updated image identity and delivery URLs. */
export type ImageUpdateResult = {
  /** Provider file identifier. */
  fileId: string;
  /** Provider-relative file path. */
  filePath: string;
  /** Storage provider. */
  provider: ImageStorageProvider;
  /** Thumbnail delivery URL, when available. */
  thumbnailUrl?: string;
  /** Full-size delivery URL. */
  url: string;
};

/** Outcome of deleting an image folder. */
export type ImageFolderDeleteResult = "deleted" | "missing" | "skipped";
/** Outcome of deleting an image file. */
export type ImageFileDeleteResult = "deleted" | "missing" | "skipped";

/** Image storage operations used by scraper and service workflows. */
export type ImageStorage = {
  /**
   * Deletes a stored image file.
   *
   * @param fileId - Provider-relative file identifier.
   * @returns Whether the file was deleted, missing, or skipped.
   * @rejects When path validation or provider deletion fails.
   */
  deleteFile: (fileId: string) => Promise<ImageFileDeleteResult>;
  /**
   * Resolves updated delivery metadata for a stored image.
   *
   * @param fileId - Provider-relative file identifier.
   * @param input - Ignored legacy metadata update request.
   * @returns Updated image metadata, or `null` in dry-run mode.
   * @rejects When path or delivery URL validation fails.
   */
  updateFile: (
    fileId: string,
    input: ImageUpdateInput,
  ) => Promise<ImageUpdateResult | null>;
  /**
   * Downloads, validates, and stores a remote image.
   *
   * @param input - Source URL and target naming options.
   * @returns Stored image metadata, or `null` in dry-run mode.
   * @rejects When download, validation, hashing, path building, or upload fails.
   */
  uploadRemoteImage: (
    input: RemoteImageUploadInput,
  ) => Promise<ImageUploadResult | null>;
};

/** Validated Bunny settings plus remote image limits. */
type RemoteBunnyConfig = BunnyConfig & {
  /** Maximum decoded source image pixel count. */
  maxInputPixels: number;
  /** Maximum downloaded source image size in bytes. */
  remoteImageMaxBytes: number;
};

/** Downloaded and validated source image. */
type FetchedImage = {
  /** Encoded image bytes. */
  buffer: Buffer;
  /** Normalized image MIME type. */
  contentType: string;
  /** Normalized image extension without a dot. */
  extension: string;
  /** Decoded image height in pixels. */
  height: number;
  /** Decoded image width in pixels. */
  width: number;
};

/** Provider selected when configuration omits one. */
const defaultImageStorageProvider = "bunny";

/** Default maximum remote image download size in bytes. */
const defaultRemoteImageMaxBytes = maxImageBytes;

/**
 * Creates dry-run or Bunny-backed remote image storage.
 *
 * @param config - Provider credentials, mode, and image limits.
 * @returns Configured image storage operations.
 * @throws When the provider or Bunny configuration is invalid.
 */
export function createImageStorage(
  config: RemoteImageStorageConfig,
): ImageStorage {
  if (config.dryRun) {
    return createDryRunImageStorage();
  }

  normalizeProvider(config.provider);

  return createBunnyImageStorage({
    ...readBunnyConfig(config),
    maxInputPixels: config.maxInputPixels ?? maxImageInputPixels,
    remoteImageMaxBytes:
      config.remoteImageMaxBytes ?? defaultRemoteImageMaxBytes,
  });
}

/**
 * Creates Bunny-backed remote image storage operations.
 *
 * @param config - Validated Bunny settings and image limits.
 * @returns Bunny-backed image storage.
 */
function createBunnyImageStorage(config: RemoteBunnyConfig): ImageStorage {
  return {
    /**
     * Deletes one Bunny image object.
     *
     * @param fileId - Bunny-relative image path.
     * @returns Whether the object was deleted or missing.
     * @rejects When path validation or Bunny deletion fails.
     */
    async deleteFile(fileId) {
      const response = await bunnyRequest(config, normalizeObjectPath(fileId), {
        expectedStatuses: [200, 404],
        method: "DELETE",
      });

      return response.status === 404 ? "missing" : "deleted";
    },
    /**
     * Resolves normalized Bunny delivery metadata for a stored image.
     *
     * @param fileId - Bunny-relative image path.
     * @returns Updated delivery metadata.
     * @rejects When path or delivery URL validation fails.
     */
    async updateFile(fileId) {
      const filePath = normalizeImageFilePath(fileId);

      return {
        fileId: filePath,
        filePath,
        provider: "bunny",
        thumbnailUrl: imageDeliveryUrl(
          buildCdnUrl(config.cdnBaseUrl, filePath),
          imageThumbnailWidth,
        ),
        url: imageDeliveryUrl(buildCdnUrl(config.cdnBaseUrl, filePath)),
      };
    },
    /**
     * Downloads, validates, hashes, and uploads a remote image to Bunny.
     *
     * @param input - Remote source URL and target naming options.
     * @returns Stored image identity, dimensions, and delivery URLs.
     * @rejects When download, validation, hashing, path building, or upload fails.
     */
    async uploadRemoteImage(input) {
      const image = await fetchRemoteImage(config, input.sourceUrl);
      const targetFilePath =
        input.prefix && input.entity && input.entityId !== undefined
          ? `/${buildImageObjectPath({ prefix: input.prefix, entity: input.entity, entityId: input.entityId, name: input.sourceImageId && /^[a-zA-Z0-9_-]+$/u.test(input.sourceImageId) ? input.sourceImageId : await sha256(image.buffer), extension: image.extension })}`
          : buildImageFilePath({
              ...input,
              fileName: `${(input.fileName ?? (await sha256(image.buffer))).replace(/\.[^.]+$/u, "")}.${image.extension}`,
            });
      await bunnyRequest(config, normalizeObjectPath(targetFilePath), {
        body: new Uint8Array(image.buffer),
        expectedStatuses: [200, 201],
        headers: {
          "content-type": image.contentType,
        },
        method: "PUT",
      });

      return toImageUploadResult(config, targetFilePath, image);
    },
  };
}

/**
 * Downloads and validates a remote image within configured byte and pixel limits.
 *
 * @param config - Bunny fetch settings and image limits.
 * @param sourceUrl - Absolute remote image URL.
 * @returns Encoded bytes and normalized image metadata.
 * @rejects When fetching, buffering, size checks, or image inspection fails.
 */
async function fetchRemoteImage(
  config: RemoteBunnyConfig,
  sourceUrl: string,
): Promise<FetchedImage> {
  const signal = AbortSignal.timeout(config.fetchTimeoutMs);
  const inputBuffer = await (async () => {
    const response = await config.fetch(sourceUrl, { signal });

    if (!response.ok) {
      throw new Error(`Failed to fetch remote image: ${response.status}.`);
    }

    const contentLength = response.headers.get("content-length");

    if (contentLength && Number(contentLength) > config.remoteImageMaxBytes) {
      throw new Error(
        "Remote image is larger than the configured maximum size.",
      );
    }

    return await readBodyWithLimit(
      response,
      config.remoteImageMaxBytes,
      signal,
    );
  })();

  if (inputBuffer.byteLength > config.remoteImageMaxBytes) {
    throw new Error("Remote image is larger than the configured maximum size.");
  }

  return {
    buffer: inputBuffer,
    ...inspectImage(inputBuffer, config.maxInputPixels),
  };
}

/**
 * Resolves and validates the configured image storage provider.
 *
 * @param provider - Optional provider name.
 * @returns The supported provider.
 * @throws When the provider is not Bunny.
 */
function normalizeProvider(provider: string | undefined): ImageStorageProvider {
  const normalizedProvider = provider?.trim() || defaultImageStorageProvider;

  if (normalizedProvider === "bunny") {
    return normalizedProvider;
  }

  throw new Error(`Unsupported image storage provider: ${normalizedProvider}.`);
}

/**
 * Builds a normalized legacy folder-and-file image path.
 *
 * @param input - Optional folder and required normalized file name.
 * @returns Provider path with a leading slash.
 * @throws When the file name is empty after normalization or contains a remaining forward slash.
 */
function buildImageFilePath(
  input: Pick<ImageUploadInput, "fileName" | "folder">,
) {
  return `${normalizeImageFolder(input.folder)}${normalizeImageFileName(
    input.fileName ?? "",
  )}`;
}

/**
 * Normalizes an optional legacy image folder with surrounding slashes.
 *
 * @param folder - Optional folder path.
 * @returns `/` for an empty folder or a slash-wrapped trimmed path.
 */
function normalizeImageFolder(folder: string | undefined): string {
  const trimmedFolder = folder?.trim();

  if (!trimmedFolder) {
    return "/";
  }

  return `/${trimmedFolder.replace(/^\/+|\/+$/gu, "")}/`;
}

/**
 * Validates a legacy image file name as one path segment.
 *
 * @param fileName - Candidate image file name.
 * @returns The trimmed name without leading slashes.
 * @throws When the name is empty after normalization or contains a remaining forward slash.
 */
function normalizeImageFileName(fileName: string): string {
  const normalizedFileName = fileName.trim().replace(/^\/+/u, "");

  if (!normalizedFileName || normalizedFileName.includes("/")) {
    throw new Error("Image file name must be a single path segment.");
  }

  return normalizedFileName;
}

/**
 * Normalizes a Bunny image file path with one leading slash.
 *
 * @param filePath - Candidate provider file path.
 * @returns The normalized path.
 * @throws When the path is empty.
 */
function normalizeImageFilePath(filePath: string): string {
  const normalizedPath = `/${filePath.trim().replace(/^\/+|\/+$/gu, "")}`;

  if (normalizedPath === "/") {
    throw new Error("Image file path is required.");
  }

  return normalizedPath;
}

/**
 * Builds persisted upload metadata and Bunny delivery URLs.
 *
 * @param config - Bunny configuration containing the CDN base URL.
 * @param filePath - Stored provider-relative image path.
 * @param image - Decoded image dimensions.
 * @returns Stored image identity, dimensions, and delivery URLs.
 * @throws When a delivery URL is invalid.
 */
function toImageUploadResult(
  config: RemoteBunnyConfig,
  filePath: string,
  image: Pick<FetchedImage, "height" | "width">,
): ImageUploadResult {
  return {
    fileId: filePath,
    filePath,
    height: image.height,
    provider: "bunny",
    thumbnailUrl: imageDeliveryUrl(
      buildCdnUrl(config.cdnBaseUrl, filePath),
      imageThumbnailWidth,
    ),
    url: imageDeliveryUrl(buildCdnUrl(config.cdnBaseUrl, filePath)),
    width: image.width,
  };
}

/**
 * Creates image storage that reports skipped mutations without external effects.
 *
 * @returns Dry-run image storage.
 */
function createDryRunImageStorage(): ImageStorage {
  return {
    /**
     * Skips a dry-run deletion.
     *
     * @returns The `skipped` deletion outcome.
     */
    async deleteFile() {
      return "skipped";
    },
    /**
     * Skips a dry-run update.
     *
     * @returns `null` because no update occurs.
     */
    async updateFile() {
      return null;
    },
    /**
     * Skips a dry-run upload.
     *
     * @returns `null` because no upload occurs.
     */
    async uploadRemoteImage() {
      return null;
    },
  };
}
