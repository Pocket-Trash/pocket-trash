import type { TranslationKey } from "@pocket-trash/localizations";
import { clientEnv } from "@/env/client";

const maxFileBytes = 20 * 1024 * 1024;
const maxSessionBytes = 100 * 1024 * 1024;
const resourceContentType = "application/octet-stream";
const fileMimeTypes: Readonly<Record<string, readonly string[]>> = {
  ".3mf": [
    resourceContentType,
    "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
  ],
  ".pdf": [resourceContentType, "application/pdf"],
  ".step": [resourceContentType, "application/step", "model/step"],
  ".stl": ["application/octet-stream", "application/sla", "model/stl"],
  ".stp": [resourceContentType, "application/step", "model/step"],
  ".txt": [resourceContentType, "text/plain"],
  ".zip": [
    resourceContentType,
    "application/x-zip-compressed",
    "application/zip",
  ],
};
const imageMimeTypes: Readonly<Record<string, readonly string[]>> = {
  ".jpeg": ["image/jpeg"],
  ".jpg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
};

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
      kind: "image" | "resource";
    }
  >;
};

export type ResourceUploadValidationError = {
  key: TranslationKey;
  params?: Record<string, number | string>;
};

export class ResourceUploadRequestError extends Error {
  constructor(
    readonly stage: "complete" | "file" | "session",
    readonly code?: string,
    readonly fileName?: string,
  ) {
    super(code ?? stage);
    this.name = "ResourceUploadRequestError";
  }
}

export function appendResourceUploadFiles(
  current: File[],
  additions: Iterable<File>,
): File[] {
  return [...current, ...additions];
}

export function getResourceUploadErrorTranslation(
  error: unknown,
): ResourceUploadValidationError {
  if (!(error instanceof ResourceUploadRequestError)) {
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
  if (files.length > 10) {
    return {
      key: "web.resources.validation.tooManyFiles",
      params: { maxFiles: 10 },
    };
  }

  const names = new Set<string>();
  for (const file of files) {
    const unsafe = validateFile(file, fileMimeTypes, resourceContentType);
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
  if (totalSize > maxSessionBytes) {
    return {
      key: "web.resources.validation.sessionTooLarge",
      params: { maxSize: "100 MiB" },
    };
  }
}

export function validateResourceImages(
  images: File[],
  totalCount = images.length,
  required = true,
): ResourceUploadValidationError | undefined {
  if (required && totalCount === 0) {
    return { key: "web.resources.validation.requiredImage" as TranslationKey };
  }
  if (totalCount > 10) {
    return {
      key: "web.resources.validation.tooManyImages" as TranslationKey,
      params: { maxImages: 10 },
    };
  }
  const imageNames = new Set<string>();
  for (const image of images) {
    const error = validateFile(image, imageMimeTypes);
    if (error?.key === "web.resources.validation.invalidFileType") {
      return {
        key: "web.resources.validation.imageInvalidType" as TranslationKey,
      };
    }
    if (error?.key === "web.resources.validation.fileTooLarge") {
      return {
        key: "web.resources.validation.imageTooLarge" as TranslationKey,
        params: { maxSize: "20 MiB" },
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
  if (totalSize > maxSessionBytes) {
    return {
      key: "web.resources.validation.sessionTooLarge",
      params: { maxSize: "100 MiB" },
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
  const fetcher = input.fetch ?? fetch;
  const uploadFile =
    input.uploadFile ??
    (input.fetch
      ? (request: FileUploadRequest) => uploadFileWithFetch(fetcher, request)
      : uploadFileWithProgress);
  const token = await input.getToken();
  if (!token) throw new ResourceUploadRequestError("session", "unauthorized");

  const response = await fetcher(
    `${trimTrailingSlash(clientEnv.VITE_API_URL)}/api/v0/resource-upload-sessions`,
    {
      body: JSON.stringify({
        ...(input.operation === "create"
          ? {
              categories: input.categories,
              description: input.description,
              images: (input.images ?? []).map((image) => toMetadata(image)),
              isPrivate: Boolean(input.isPrivate),
              name: input.name,
            }
          : { resourceId: input.resourceId }),
        files: input.files.map((file) => toMetadata(file, resourceContentType)),
        operation: input.operation,
      }),
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new ResourceUploadRequestError(
      "session",
      await readErrorCode(response),
    );
  }
  const session = (await response.json()) as SessionResponse;

  input.onStage?.("upload");
  for (const upload of session.uploads) {
    const file = (upload.kind === "image" ? input.images : input.files)?.find(
      ({ name }) => name === upload.fileName,
    );
    if (!file) {
      throw new ResourceUploadRequestError(
        "file",
        "invalid_request",
        upload.fileName,
      );
    }

    const uploadResponse = await uploadFile({
      file,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": upload.contentType,
      },
      onProgress: (percent) => input.onProgress?.(file.name, percent),
      url: `${trimTrailingSlash(clientEnv.VITE_API_URL)}/api/v0/resource-upload-sessions/${encodeURIComponent(session.id)}/files/${encodeURIComponent(upload.id)}`,
    });
    if (!uploadResponse.ok) {
      throw new ResourceUploadRequestError(
        "file",
        await readErrorCode(uploadResponse),
        file.name,
      );
    }
  }

  input.onStage?.("complete");
  const complete = () =>
    fetcher(
      `${trimTrailingSlash(clientEnv.VITE_API_URL)}/api/v0/resource-upload-sessions/${encodeURIComponent(session.id)}/complete`,
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
    throw new ResourceUploadRequestError(
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
      reject(
        new ResourceUploadRequestError(
          "file",
          "upload_failed",
          input.file.name,
        ),
      );
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
  if (file.size > maxFileBytes) {
    return {
      key: "web.resources.validation.fileTooLarge",
      params: { filename: file.name, maxSize: "20 MiB" },
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
