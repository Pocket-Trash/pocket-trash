import { type Logger, loggerMessages } from "@package/logger";
import {
  createImageStorage,
  type ImageFileDeleteResult,
  type ImageStorage,
  type ImageUpdateInput,
  type ImageUpdateResult,
  type ImageUploadInput,
  type ImageUploadResult,
  type RemoteImageStorageConfig,
  type RemoteImageUploadInput,
} from "@package/storage";
import { hashLogIdentifier } from "../logging.js";

/** Logged remote-image storage operations exposed to applications. */
export type ImagesService = {
  /**
   * Deletes a remote image file.
   *
   * @param fileId - Remote storage file identifier.
   * @returns `deleted`, `missing`, or `skipped` in dry-run mode.
   * @rejects When path validation, storage deletion, or operation logging fails.
   */
  deleteFile(fileId: string): Promise<ImageFileDeleteResult>;
  /**
   * Resolves normalized delivery metadata for a stored image.
   *
   * @param fileId - Remote storage file identifier.
   * @param input - Ignored legacy metadata update request.
   * @returns Updated image result, or `null` in dry-run mode.
   * @rejects When path or delivery URL validation, or operation logging fails.
   */
  updateFile(
    fileId: string,
    input: ImageUpdateInput,
  ): Promise<ImageUpdateResult | null>;
  /**
   * Uploads an image fetched from a remote URL.
   *
   * @param input - Remote image source and upload options.
   * @returns Uploaded image result, or `null` in dry-run mode.
   * @rejects When remote upload or operation logging fails.
   */
  uploadRemoteImage(
    input: RemoteImageUploadInput,
  ): Promise<ImageUploadResult | null>;
};

/**
 * Creates logged remote-image storage operations.
 *
 * @param config - Remote image storage configuration.
 * @param logger - Application logger for image operations.
 * @returns Configured image service.
 * @throws When the provider or Bunny configuration is invalid outside dry-run mode.
 */
export function createImagesService(
  config: RemoteImageStorageConfig,
  logger: Logger,
): ImagesService {
  return wrapImageStorage(createImageStorage(config), logger);
}

/**
 * Wraps image storage operations with safe structured logging.
 *
 * @param imageStorage - Remote image storage implementation.
 * @param logger - Application logger for image operations.
 * @returns Logged image service.
 */
function wrapImageStorage(
  imageStorage: ImageStorage,
  logger: Logger,
): ImagesService {
  return {
    /**
     * Deletes a remote image while logging only a hash of its identifier.
     *
     * @param fileId - Remote storage file identifier.
     * @returns `deleted`, `missing`, or `skipped` in dry-run mode.
     * @rejects When path validation, storage deletion, or operation logging fails.
     */
    async deleteFile(fileId) {
      return await logger.operation(
        loggerMessages.images.delete,
        () => imageStorage.deleteFile(fileId),
        {
          attributes: {
            fileIdHash: hashLogIdentifier(fileId),
          },
        },
      );
    },
    /**
     * Resolves delivery metadata while logging its hashed identifier and legacy keys.
     *
     * @param fileId - Remote storage file identifier.
     * @param input - Ignored legacy metadata update request.
     * @returns Updated image result, or `null` in dry-run mode.
     * @rejects When path or delivery URL validation, or operation logging fails.
     */
    async updateFile(fileId, input) {
      return await logger.operation(
        loggerMessages.images.update,
        () => imageStorage.updateFile(fileId, input),
        {
          attributes: {
            fileIdHash: hashLogIdentifier(fileId),
            updateKeys: Object.keys(input),
          },
        },
      );
    },
    /**
     * Uploads a remote image while logging only summarized, hashed input values.
     *
     * @param input - Remote image source and upload options.
     * @returns Uploaded image result, or `null` in dry-run mode.
     * @rejects When remote upload or operation logging fails.
     */
    async uploadRemoteImage(input) {
      return await logger.operation(
        loggerMessages.images.upload,
        () => imageStorage.uploadRemoteImage(input),
        {
          attributes: {
            ...summarizeUploadInput(input),
            sourceUrlHash: hashLogIdentifier(input.sourceUrl),
          },
        },
      );
    },
  };
}

/**
 * Summarizes image upload options without exposing object names or folders.
 *
 * @param input - Local or remote image upload options.
 * @returns Safe structured logging attributes.
 */
function summarizeUploadInput(
  input: ImageUploadInput | RemoteImageUploadInput,
) {
  return {
    fileNameHash: input.fileName
      ? hashLogIdentifier(input.fileName)
      : undefined,
    folderHash: input.folder ? hashLogIdentifier(input.folder) : undefined,
    hasFolder: Boolean(input.folder),
    overwriteFile: input.overwriteFile,
    overwriteTags: input.overwriteTags,
    tagCount: input.tags?.length ?? 0,
    useUniqueFileName: input.useUniqueFileName,
  };
}
