import {
  imageMimeTypesByExtension,
  maxImageBytes,
  maxImageSessionBytes,
  maxImageSessionFiles,
  maxResourceFileBytes,
  maxResourceFiles,
  maxResourceImages,
  maxResourceSessionBytes,
  resourceMimeTypesByExtension,
  type UploadTargetType,
} from "@package/services/constants";
import type { TranslationKey } from "@pocket-trash/localizations";
import { clientEnv } from "@/env/client";

const imageTypes = new Set<string>(
  Object.values(imageMimeTypesByExtension).flat(),
);
const formatMiB = (bytes: number) => `${bytes / 1024 / 1024} MiB`;

const resourceContentType = "application/octet-stream";
type UploadMetadata = {
  contentType: string;
  fileName: string;
  size: number;
};

type FileUploadRequest = {
  file: File;
  headers: Record<string, string>;
  onProgress(percent: number): void;
  url: string;
};

type FileUploader = (request: FileUploadRequest) => Promise<Response>;

type SessionResponse = {
  expiresAt: string;
  id: string;
  uploads: Array<
    UploadMetadata & {
      id: string;
      kind: "image" | "file";
    }
  >;
};

export type ResourceUploadValidationError = {
  key: TranslationKey;
  params?: Record<string, number | string>;
};

export class UploadRequestError extends Error {
  constructor(
    readonly stage: "complete" | "file" | "session",
    readonly code?: string,
    readonly fileName?: string,
    readonly imageId?: number,
    readonly sha256?: string,
  ) {
    super(code ?? stage);
    this.name = "UploadRequestError";
  }
}

export function appendResourceUploadFiles(
  current: File[],
  additions: Iterable<File>,
): File[] {
  return [...current, ...additions];
}

export function getUploadErrorTranslation(
  error: unknown,
): ResourceUploadValidationError {
  if (!(error instanceof UploadRequestError)) {
    return { key: "web.resources.error.saveFailed" };
  }
  if (error.code === "session_expired") {
    return { key: "web.resources.upload.expired" };
  }
  if (error.stage === "file") {
    return {
      key: "web.resources.upload.fileFailure",
      params: { filename: error.fileName ?? "" },
    };
  }
  if (error.stage === "complete") {
    return { key: "web.resources.upload.finalizationFailure" };
  }
  return { key: "web.resources.upload.sessionFailure" };
}

export function validateResourceUpload(
  files: File[],
  images: File[] = [],
  requireImages = false,
): ResourceUploadValidationError | undefined {
  if (files.length === 0) {
    return { key: "web.resources.validation.requiredFile" };
  }
  if (files.length > maxResourceFiles) {
    return {
      key: "web.resources.validation.tooManyFiles",
      params: { maxFiles: maxResourceFiles },
    };
  }

  const names = new Set<string>();
  for (const file of files) {
    const unsafe = validateFile(
      file,
      resourceMimeTypesByExtension,
      resourceContentType,
    );
    if (unsafe) return unsafe;
    const normalizedName = file.name.toLocaleLowerCase();
    if (names.has(normalizedName)) {
      return {
        key: "web.resources.validation.duplicateFilename",
        params: { filename: file.name },
      };
    }
    names.add(normalizedName);
  }

  const imageError = validateResourceImages(
    images,
    images.length,
    requireImages,
  );
  if (imageError) return imageError;

  const totalSize = [...files, ...images].reduce(
    (total, file) => total + file.size,
    0,
  );
  if (totalSize > maxResourceSessionBytes) {
    return {
      key: "web.resources.validation.sessionTooLarge",
      params: { maxSize: formatMiB(maxResourceSessionBytes) },
    };
  }
}

export function validateResourceImages(
  images: File[],
  totalCount = images.length,
  required = true,
): ResourceUploadValidationError | undefined {
  if (required && totalCount === 0) {
    return { key: "web.resources.validation.requiredImage" };
  }
  if (totalCount > maxResourceImages) {
    return {
      key: "web.resources.validation.tooManyImages",
      params: { maxImages: maxResourceImages },
    };
  }
  const imageNames = new Set<string>();
  for (const image of images) {
    const error = validateFile(
      image,
      imageMimeTypesByExtension,
      image.type,
      maxImageBytes,
    );
    if (error?.key === "web.resources.validation.invalidFileType") {
      return {
        key: "web.resources.validation.imageInvalidType",
      };
    }
    if (error?.key === "web.resources.validation.fileTooLarge") {
      return {
        key: "web.resources.validation.imageTooLarge",
        params: { maxSize: formatMiB(maxImageBytes) },
      };
    }
    if (error) return error;
    const normalizedName = image.name.toLocaleLowerCase();
    if (imageNames.has(normalizedName)) {
      return {
        key: "web.resources.validation.duplicateFilename",
        params: { filename: image.name },
      };
    }
    imageNames.add(normalizedName);
  }

  const totalSize = images.reduce((total, file) => total + file.size, 0);
  if (totalSize > maxResourceSessionBytes) {
    return {
      key: "web.resources.validation.sessionTooLarge",
      params: { maxSize: formatMiB(maxResourceSessionBytes) },
    };
  }
}

export async function uploadResourceSession(input: {
  categories?: string[];
  description?: string;
  fetch?: typeof fetch;
  files: File[];
  getToken(): Promise<string | null>;
  images?: File[];
  isPrivate?: boolean;
  name?: string;
  onProgress?(fileName: string, percent: number): void;
  onStage?(stage: "complete" | "upload"): void;
  operation: "create" | "version";
  resourceId?: number;
  uploadFile?: FileUploader;
}): Promise<{ resourceId: number; version: number }> {
  return (await uploadSession({
    ...input,
    target: {
      type: "resource",
      ...(input.operation === "version" ? { id: input.resourceId } : {}),
    },
    payload:
      input.operation === "create"
        ? {
            operation: "create",
            categories: input.categories,
            description: input.description,
            isPrivate: Boolean(input.isPrivate),
            name: input.name,
          }
        : { operation: "version" },
  })) as { resourceId: number; version: number };
}

async function uploadSession(input: {
  target: {
    type: UploadTargetType;
    id?: number;
  };
  payload?: Record<string, unknown>;
  fetch?: typeof fetch;
  files: File[];
  images?: File[];
  getToken(): Promise<string | null>;
  onProgress?(fileName: string, percent: number): void;
  onStage?(stage: "complete" | "upload"): void;
  uploadFile?: FileUploader;
}): Promise<{ resourceId?: number; version?: number; targetId?: number }> {
  const fetcher = input.fetch ?? fetch;
  const uploadFile =
    input.uploadFile ??
    (input.fetch
      ? (request: FileUploadRequest) => uploadFileWithFetch(fetcher, request)
      : uploadFileWithProgress);
  const token = await input.getToken();
  if (!token) throw new UploadRequestError("session", "unauthorized");

  const response = await fetcher(
    `${trimTrailingSlash(clientEnv.VITE_API_URL)}/api/v0/storage/upload-sessions`,
    {
      body: JSON.stringify({
        target: input.target,
        payload: input.payload,
        files: await Promise.all(
          [
            ...input.files.map((file) => ({ file, kind: "file" })),
            ...(input.images ?? []).map((file) => ({ file, kind: "image" })),
          ].map(async ({ file, kind }) => ({
            ...toMetadata(
              file,
              kind === "file" ? resourceContentType : file.type,
            ),
            kind,
            sha256: await hashFile(file),
          })),
        ),
      }),
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      method: "POST",
    },
  );
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      error?: string;
      imageId?: number;
      sha256?: string;
    };
    throw new UploadRequestError(
      "session",
      error.error,
      undefined,
      error.imageId,
      error.sha256,
    );
  }
  const session = (await response.json()) as SessionResponse;

  input.onStage?.("upload");
  for (const upload of session.uploads) {
    const file = (upload.kind === "image" ? input.images : input.files)?.find(
      ({ name }) => name === upload.fileName,
    );
    if (!file) {
      throw new UploadRequestError("file", "invalid_request", upload.fileName);
    }

    const uploadResponse = await uploadFile({
      file,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": upload.contentType,
      },
      onProgress: (percent) => input.onProgress?.(file.name, percent),
      url: `${trimTrailingSlash(clientEnv.VITE_API_URL)}/api/v0/storage/upload-sessions/${encodeURIComponent(session.id)}/files/${encodeURIComponent(upload.id)}`,
    });
    if (!uploadResponse.ok) {
      throw new UploadRequestError(
        "file",
        await readErrorCode(uploadResponse),
        file.name,
      );
    }
  }

  input.onStage?.("complete");
  const complete = () =>
    fetcher(
      `${trimTrailingSlash(clientEnv.VITE_API_URL)}/api/v0/storage/upload-sessions/${encodeURIComponent(session.id)}/complete`,
      {
        headers: { authorization: `Bearer ${token}` },
        method: "POST",
      },
    );
  let completeResponse = await complete();
  if (completeResponse.status >= 500) {
    completeResponse = await complete();
  }
  if (!completeResponse.ok) {
    throw new UploadRequestError(
      "complete",
      await readErrorCode(completeResponse),
    );
  }
  return (await completeResponse.json()) as {
    resourceId: number;
    version: number;
  };
}

async function uploadFileWithFetch(
  fetcher: typeof fetch,
  input: FileUploadRequest,
): Promise<Response> {
  input.onProgress(0);
  const response = await fetcher(input.url, {
    body: input.file,
    headers: input.headers,
    method: "PUT",
  });
  input.onProgress(100);
  return response;
}

function uploadFileWithProgress(input: FileUploadRequest): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    let lastPercent = -1;
    const report = (percent: number) => {
      const nextPercent = Math.max(0, Math.min(100, Math.round(percent)));
      if (nextPercent === lastPercent) return;
      lastPercent = nextPercent;
      input.onProgress(nextPercent);
    };

    request.open("PUT", input.url);
    for (const [name, value] of Object.entries(input.headers)) {
      request.setRequestHeader(name, value);
    }
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) {
        report((event.loaded / event.total) * 100);
      }
    });
    request.addEventListener("load", () => {
      report(100);
      resolve(
        new Response(
          request.status === 204 || request.status === 205
            ? null
            : request.responseText,
          { status: request.status, statusText: request.statusText },
        ),
      );
    });
    const rejectUpload = () =>
      reject(new UploadRequestError("file", "upload_failed", input.file.name));
    request.addEventListener("abort", rejectUpload);
    request.addEventListener("error", rejectUpload);
    report(0);
    request.send(input.file);
  });
}

function validateFile(
  file: File,
  allowedTypes: Readonly<Record<string, readonly string[]>>,
  contentType = file.type,
  maxBytes = maxResourceFileBytes,
): ResourceUploadValidationError | undefined {
  if (
    !file.name ||
    file.name.length > 255 ||
    file.name === "." ||
    file.name === ".." ||
    file.name.includes("/") ||
    file.name.includes("\\") ||
    [...file.name].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 31 || codePoint === 127;
    })
  ) {
    return {
      key: "web.resources.validation.unsafeFilename",
      params: { filename: file.name },
    };
  }
  if (file.size > maxBytes) {
    return {
      key: "web.resources.validation.fileTooLarge",
      params: { filename: file.name, maxSize: formatMiB(maxBytes) },
    };
  }
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!allowedTypes[extension]?.includes(contentType)) {
    return {
      key: "web.resources.validation.invalidFileType",
      params: { filename: file.name },
    };
  }
}

function toMetadata(file: File, contentType = file.type): UploadMetadata {
  return {
    contentType,
    fileName: file.name,
    size: file.size,
  };
}

async function readErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : undefined;
  } catch {
    return undefined;
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, "");
}

export type ImageUploadError = ResourceUploadValidationError;

export function validateImages(files: File[]): ImageUploadError | undefined {
  if (files.length > maxImageSessionFiles) {
    return {
      key: "web.resources.validation.tooManyImages",
      params: { maxImages: maxImageSessionFiles },
    };
  }
  if (
    files.reduce((total, file) => total + file.size, 0) > maxImageSessionBytes
  ) {
    return {
      key: "web.resources.validation.sessionTooLarge",
      params: { maxSize: formatMiB(maxImageSessionBytes) },
    };
  }
  for (const file of files) {
    if (!imageTypes.has(file.type))
      return { key: "web.resources.validation.imageInvalidType" };
    if (file.size > maxImageBytes) {
      return {
        key: "web.resources.validation.imageTooLarge",
        params: { maxSize: formatMiB(maxImageBytes) },
      };
    }
  }
}

export async function uploadImages(input: {
  files: File[];
  getToken(): Promise<string | null>;
  onOwnerDeletedDuplicate?(imageId: number): Promise<boolean>;
  targetId: number;
  targetType: Exclude<UploadTargetType, "resource">;
}): Promise<{ uploaded: File[]; failed: File[] }> {
  if (!input.files.length) return { uploaded: [], failed: [] };
  const validation = validateImages(input.files);
  if (validation) throw validation;
  try {
    await uploadSession({
      target: { type: input.targetType, id: input.targetId },
      files: [],
      images: input.files,
      getToken: input.getToken,
    });
    return { uploaded: input.files, failed: [] };
  } catch (error) {
    if (
      error instanceof UploadRequestError &&
      error.code === "duplicate_owner_deleted" &&
      error.imageId &&
      error.sha256 &&
      input.onOwnerDeletedDuplicate &&
      (await input.onOwnerDeletedDuplicate(error.imageId))
    ) {
      const hashes = await Promise.all(input.files.map(hashFile));
      const remaining = input.files.filter(
        (_file, index) => hashes[index] !== error.sha256,
      );
      const restored = input.files.filter(
        (_file, index) => hashes[index] === error.sha256,
      );
      const result = await uploadImages({ ...input, files: remaining });
      return { ...result, uploaded: [...restored, ...result.uploaded] };
    }
    throw getUploadErrorTranslation(error);
  }
}
export async function deleteCollectionCover(input: {
  imageId: number;
  getToken(): Promise<string | null>;
}) {
  const token = await input.getToken();
  if (!token) throw { key: "error.generic" } satisfies ImageUploadError;
  const response = await fetch(
    `${trimTrailingSlash(clientEnv.VITE_API_URL)}/api/v0/storage/file/collection_image/${input.imageId}`,
    { method: "DELETE", headers: { authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw { key: "error.generic" } satisfies ImageUploadError;
}
async function hashFile(file: File) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
