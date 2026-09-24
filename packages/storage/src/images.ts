import { readResponseBodyWithLimit } from "./body.js";
import { bunnyRequest } from "./bunny.js";
import {
  imageDeliveryUrl,
  inspectImage,
  maxImageBytes,
} from "./image-policy.js";

type FetchLike = typeof fetch;

export type ImageStorageProvider = "bunny";

export type ImageStorageConfig = {
  bunnyStorageAccessKey?: string;
  bunnyStorageEndpoint?: string;
  bunnyStorageZoneName?: string;
  cdnBaseUrl?: string;
  dryRun?: boolean;
  fetch?: FetchLike;
  fetchTimeoutMs?: number;
  maxInputPixels?: number;
  provider?: string;
  remoteImageMaxBytes?: number;
};

export type ImageUploadInput = {
  fileName: string;
  folder?: string;
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
  deleteFolder: (folderPath: string) => Promise<ImageFolderDeleteResult>;
  updateFile: (
    fileId: string,
    input: ImageUpdateInput,
  ) => Promise<ImageUpdateResult | null>;
  uploadRemoteImage: (
    input: RemoteImageUploadInput,
  ) => Promise<ImageUploadResult | null>;
};

type BunnyStorageConfig = {
  accessKey: string;
  cdnBaseUrl: string;
  endpoint: string;
  fetch: FetchLike;
  fetchTimeoutMs: number;
  maxInputPixels: number;
  remoteImageMaxBytes: number;
  zoneName: string;
};

type BunnyStorageObject = {
  IsDirectory?: boolean;
  ObjectName?: string;
};

type BunnyPrefixDeleteResult = {
  deletedFiles: number;
  foundFolder: boolean;
};

type ProcessedImage = {
  buffer: Buffer;
  contentType: string;
  extension: string;
  height: number;
  width: number;
};

const defaultImageStorageProvider = "bunny";
const defaultFetchTimeoutMs = 30_000;
const defaultMaxInputPixels = 80_000_000;
const defaultRemoteImageMaxBytes = maxImageBytes;
const thumbnailWidth = 500;

export function createImageStorage(config: ImageStorageConfig): ImageStorage {
  if (config.dryRun) {
    return createDryRunImageStorage();
  }

  normalizeProvider(config.provider);

  return createBunnyImageStorage(readBunnyConfig(config));
}

export async function deletePreviewImageFolder(input: {
  bunnyStorageAccessKey?: string;
  bunnyStorageEndpoint?: string;
  bunnyStorageZoneName?: string;
  cdnBaseUrl?: string;
  dryRun?: boolean;
  fetch?: FetchLike;
  prNumber: number;
}): Promise<{
  folderPath: string;
  status: ImageFolderDeleteResult;
}> {
  const folderPath = buildPreviewImageFolderPath(input.prNumber);
  const storage = createImageStorage({
    bunnyStorageAccessKey: input.bunnyStorageAccessKey,
    bunnyStorageEndpoint: input.bunnyStorageEndpoint,
    bunnyStorageZoneName: input.bunnyStorageZoneName,
    cdnBaseUrl: input.cdnBaseUrl,
    dryRun: input.dryRun,
    fetch: input.fetch,
  });
  const status = await storage.deleteFolder(folderPath);

  return {
    folderPath,
    status,
  };
}

export function buildPreviewImageFolderPath(prNumber: number): string {
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error("Image preview cleanup requires a positive PR number.");
  }

  return `/images/preview/pr-${prNumber}`;
}

function createBunnyImageStorage(config: BunnyStorageConfig): ImageStorage {
  return {
    async deleteFile(fileId) {
      const response = await bunnyRequest(
        config,
        normalizeBunnyObjectPath(fileId),
        {
          expectedStatuses: [200, 404],
          method: "DELETE",
        },
      );

      return response.status === 404 ? "missing" : "deleted";
    },
    async deleteFolder(folderPath) {
      const normalizedFolderPath = normalizePreviewFolderPath(folderPath);
      const result = await deleteBunnyPrefix(config, normalizedFolderPath);

      if (result.deletedFiles > 0) {
        return "deleted";
      }

      return result.foundFolder ? "deleted" : "missing";
    },
    async updateFile(fileId) {
      const filePath = normalizeImageFilePath(fileId);

      return {
        fileId: filePath,
        filePath,
        provider: "bunny",
        thumbnailUrl: imageDeliveryUrl(
          buildImageUrl(config.cdnBaseUrl, filePath),
          thumbnailWidth,
        ),
        url: imageDeliveryUrl(buildImageUrl(config.cdnBaseUrl, filePath)),
      };
    },
    async uploadRemoteImage(input) {
      const image = await fetchRemoteImage(config, input.sourceUrl);
      const targetFilePath = buildImageFilePath({
        ...input,
        fileName: `${input.fileName.replace(/\.[^.]+$/u, "")}.${image.extension}`,
      });
      await bunnyRequest(config, normalizeBunnyObjectPath(targetFilePath), {
        body: new Uint8Array(image.buffer),
        expectedStatuses: [200, 201],
        headers: {
          "content-type": image.contentType,
        },
        method: "PUT",
      });

      return mapBunnyImage(config, targetFilePath, image);
    },
  };
}

async function deleteBunnyPrefix(
  config: BunnyStorageConfig,
  folderPath: string,
): Promise<BunnyPrefixDeleteResult> {
  const objects = await listBunnyFolder(config, folderPath);

  if (!objects) {
    return {
      deletedFiles: 0,
      foundFolder: false,
    };
  }

  const result: BunnyPrefixDeleteResult = {
    deletedFiles: 0,
    foundFolder: true,
  };

  for (const object of objects) {
    if (!object.ObjectName) {
      continue;
    }

    const objectPath = `${normalizeBunnyObjectPath(folderPath)}/${object.ObjectName}`;

    if (object.IsDirectory) {
      const childResult = await deleteBunnyPrefix(config, objectPath);

      result.deletedFiles += childResult.deletedFiles;
      result.foundFolder ||= childResult.foundFolder;
      continue;
    }

    const response = await bunnyRequest(config, objectPath, {
      expectedStatuses: [200, 404],
      method: "DELETE",
    });

    if (response.status === 200) {
      result.deletedFiles += 1;
    }
  }

  return result;
}

async function listBunnyFolder(
  config: BunnyStorageConfig,
  folderPath: string,
): Promise<BunnyStorageObject[] | null> {
  const response = await bunnyRequest(
    config,
    normalizeBunnyFolderPath(folderPath),
    {
      expectedStatuses: [200, 404],
      method: "GET",
    },
  );

  if (response.status === 404) {
    return null;
  }

  const body = await response.json();

  if (!Array.isArray(body)) {
    throw new Error("Bunny storage list response was not an array.");
  }

  return body as BunnyStorageObject[];
}

async function fetchRemoteImage(
  config: BunnyStorageConfig,
  sourceUrl: string,
): Promise<ProcessedImage> {
  const inputBuffer = await withFetchTimeout(config, async (signal) => {
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

    return await readResponseBodyWithLimit(
      response,
      config.remoteImageMaxBytes,
      signal,
    );
  });

  if (inputBuffer.byteLength > config.remoteImageMaxBytes) {
    throw new Error("Remote image is larger than the configured maximum size.");
  }

  return {
    buffer: inputBuffer,
    ...inspectImage(inputBuffer, config.maxInputPixels),
  };
}

async function withFetchTimeout<T>(
  config: BunnyStorageConfig,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, config.fetchTimeoutMs);

  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

function readBunnyConfig(config: ImageStorageConfig): BunnyStorageConfig {
  const accessKey = config.bunnyStorageAccessKey?.trim();
  const endpoint = config.bunnyStorageEndpoint?.trim();
  const zoneName = config.bunnyStorageZoneName?.trim();
  const cdnBaseUrl = config.cdnBaseUrl?.trim();

  if (!accessKey) {
    throw new Error(
      "BUNNY_STORAGE_ACCESS_KEY is required unless dry-run is on.",
    );
  }

  if (!endpoint) {
    throw new Error("BUNNY_STORAGE_ENDPOINT is required unless dry-run is on.");
  }

  if (!zoneName) {
    throw new Error(
      "BUNNY_STORAGE_ZONE_NAME is required unless dry-run is on.",
    );
  }

  if (!cdnBaseUrl) {
    throw new Error("BUNNY_CDN_BASE_URL is required unless dry-run is on.");
  }

  return {
    accessKey,
    cdnBaseUrl: normalizeBaseUrl(cdnBaseUrl),
    endpoint: normalizeBaseUrl(endpoint),
    fetch: config.fetch ?? fetch,
    fetchTimeoutMs: config.fetchTimeoutMs ?? defaultFetchTimeoutMs,
    maxInputPixels: config.maxInputPixels ?? defaultMaxInputPixels,
    remoteImageMaxBytes:
      config.remoteImageMaxBytes ?? defaultRemoteImageMaxBytes,
    zoneName,
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
    input.fileName,
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

function normalizePreviewFolderPath(folderPath: string): string {
  const normalizedFolder = normalizeImageFolder(folderPath).replace(/\/$/u, "");

  if (!/^\/images\/preview\/pr-[1-9]\d*$/u.test(normalizedFolder)) {
    throw new Error(
      "Image preview cleanup can only delete /images/preview/pr-<number> folders.",
    );
  }

  return normalizedFolder;
}

function normalizeBunnyObjectPath(objectPath: string): string {
  const normalizedPath = objectPath.trim().replace(/^\/+|\/+$/gu, "");

  if (!normalizedPath) {
    throw new Error("Bunny object path is required.");
  }

  return normalizedPath;
}

function normalizeBunnyFolderPath(folderPath: string): string {
  const normalizedPath = folderPath.trim().replace(/^\/+|\/+$/gu, "");

  return normalizedPath ? `${normalizedPath}/` : "";
}

function buildImageUrl(
  cdnBaseUrl: string,
  filePath: string,
  query?: Record<string, string>,
): string {
  const relativeFilePath = filePath.trim().replace(/^\/+/u, "");
  const url = new URL(
    relativeFilePath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/"),
    `${cdnBaseUrl}/`,
  );

  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

function mapBunnyImage(
  config: BunnyStorageConfig,
  filePath: string,
  image: Pick<ProcessedImage, "height" | "width">,
): ImageUploadResult {
  return {
    fileId: filePath,
    filePath,
    height: image.height,
    provider: "bunny",
    thumbnailUrl: imageDeliveryUrl(
      buildImageUrl(config.cdnBaseUrl, filePath),
      thumbnailWidth,
    ),
    url: imageDeliveryUrl(buildImageUrl(config.cdnBaseUrl, filePath)),
    width: image.width,
  };
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/u, "");
}

function createDryRunImageStorage(): ImageStorage {
  return {
    async deleteFile() {
      return "skipped";
    },
    async deleteFolder() {
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
