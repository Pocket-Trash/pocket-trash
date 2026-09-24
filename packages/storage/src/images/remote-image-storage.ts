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

export type ImageStorageProvider = "bunny";

export type RemoteImageStorageConfig = BunnyStorageConfig & {
  dryRun?: boolean;
  maxInputPixels?: number;
  provider?: string;
  remoteImageMaxBytes?: number;
};

export type ImageUploadInput = {
  fileName?: string;
  folder?: string;
  prefix?: string;
  entity?: ImageEntity;
  entityId?: string | number;
  sourceImageId?: string;
  overwriteFile?: boolean;
  overwriteTags?: boolean;
  tags?: string[];
  useUniqueFileName?: boolean;
};

export type RemoteImageUploadInput = ImageUploadInput & {
  sourceUrl: string;
};

export type ImageUpdateInput = {
  tags?: string[];
};

export type ImageUploadResult = {
  fileId: string;
  filePath: string;
  height: number;
  provider: ImageStorageProvider;
  thumbnailUrl: string;
  url: string;
  width: number;
};

export type ImageUpdateResult = {
  fileId: string;
  filePath: string;
  provider: ImageStorageProvider;
  thumbnailUrl?: string;
  url: string;
};

export type ImageFolderDeleteResult = "deleted" | "missing" | "skipped";
export type ImageFileDeleteResult = "deleted" | "missing" | "skipped";

export type ImageStorage = {
  deleteFile: (fileId: string) => Promise<ImageFileDeleteResult>;
  updateFile: (
    fileId: string,
    input: ImageUpdateInput,
  ) => Promise<ImageUpdateResult | null>;
  uploadRemoteImage: (
    input: RemoteImageUploadInput,
  ) => Promise<ImageUploadResult | null>;
};

type RemoteBunnyConfig = BunnyConfig & {
  maxInputPixels: number;
  remoteImageMaxBytes: number;
};

type FetchedImage = {
  buffer: Buffer;
  contentType: string;
  extension: string;
  height: number;
  width: number;
};

const defaultImageStorageProvider = "bunny";

const defaultRemoteImageMaxBytes = maxImageBytes;

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

function createBunnyImageStorage(config: RemoteBunnyConfig): ImageStorage {
  return {
    async deleteFile(fileId) {
      const response = await bunnyRequest(config, normalizeObjectPath(fileId), {
        expectedStatuses: [200, 404],
        method: "DELETE",
      });

      return response.status === 404 ? "missing" : "deleted";
    },
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
    async uploadRemoteImage(input) {
      const image = await fetchRemoteImage(config, input.sourceUrl);
      const targetFilePath =
        input.prefix && input.entity && input.entityId !== undefined
          ? `/${buildImageObjectPath({ prefix: input.prefix, entity: input.entity, entityId: input.entityId, name: input.sourceImageId ?? (await sha256(image.buffer)), extension: image.extension })}`
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

function normalizeProvider(provider: string | undefined): ImageStorageProvider {
  const normalizedProvider = provider?.trim() || defaultImageStorageProvider;

  if (normalizedProvider === "bunny") {
    return normalizedProvider;
  }

  throw new Error(`Unsupported image storage provider: ${normalizedProvider}.`);
}

function buildImageFilePath(
  input: Pick<ImageUploadInput, "fileName" | "folder">,
) {
  return `${normalizeImageFolder(input.folder)}${normalizeImageFileName(
    input.fileName ?? "",
  )}`;
}

function normalizeImageFolder(folder: string | undefined): string {
  const trimmedFolder = folder?.trim();

  if (!trimmedFolder) {
    return "/";
  }

  return `/${trimmedFolder.replace(/^\/+|\/+$/gu, "")}/`;
}

function normalizeImageFileName(fileName: string): string {
  const normalizedFileName = fileName.trim().replace(/^\/+/u, "");

  if (!normalizedFileName || normalizedFileName.includes("/")) {
    throw new Error("Image file name must be a single path segment.");
  }

  return normalizedFileName;
}

function normalizeImageFilePath(filePath: string): string {
  const normalizedPath = `/${filePath.trim().replace(/^\/+|\/+$/gu, "")}`;

  if (normalizedPath === "/") {
    throw new Error("Image file path is required.");
  }

  return normalizedPath;
}

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

function createDryRunImageStorage(): ImageStorage {
  return {
    async deleteFile() {
      return "skipped";
    },
    async updateFile() {
      return null;
    },
    async uploadRemoteImage() {
      return null;
    },
  };
}
