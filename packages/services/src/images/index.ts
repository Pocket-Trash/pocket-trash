import { type Logger, loggerMessages } from "@package/logger";
import {
  createImageStorage,
  type ImageFileDeleteResult,
  type ImageStorage,
  type ImageStorageConfig,
  type ImageUpdateInput,
  type ImageUpdateResult,
  type ImageUploadInput,
  type ImageUploadResult,
  type RemoteImageUploadInput,
} from "@package/storage";
import { hashLogIdentifier } from "../logging.js";

export type ImagesService = {
  deleteFile(fileId: string): Promise<ImageFileDeleteResult>;
  updateFile(
    fileId: string,
    input: ImageUpdateInput,
  ): Promise<ImageUpdateResult | null>;
  uploadRemoteImage(
    input: RemoteImageUploadInput,
  ): Promise<ImageUploadResult | null>;
};

export function createImagesService(
  config: ImageStorageConfig,
  logger: Logger,
): ImagesService {
  return wrapImageStorage(createImageStorage(config), logger);
}

function wrapImageStorage(
  imageStorage: ImageStorage,
  logger: Logger,
): ImagesService {
  return {
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

function summarizeUploadInput(
  input: ImageUploadInput | RemoteImageUploadInput,
) {
  return {
    fileNameHash: hashLogIdentifier(input.fileName),
    folderHash: input.folder ? hashLogIdentifier(input.folder) : undefined,
    hasFolder: Boolean(input.folder),
    overwriteFile: input.overwriteFile,
    overwriteTags: input.overwriteTags,
    tagCount: input.tags?.length ?? 0,
    useUniqueFileName: input.useUniqueFileName,
  };
}
