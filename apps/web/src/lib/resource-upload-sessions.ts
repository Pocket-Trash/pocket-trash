import type { TranslationKey } from "@pocket-trash/localizations";
import { clientEnv } from "@/env/client";

const maxFileBytes = 20 * 1024 * 1024;
const maxSessionBytes = 50 * 1024 * 1024;
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
const previewMimeTypes: Readonly<Record<string, readonly string[]>> = {
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

type SessionResponse = {
  expiresAt: string;
  id: string;
  uploads: Array<
    UploadMetadata & {
      id: string;
      kind: "preview" | "resource";
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
  preview?: File,
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

  if (preview) {
    const error = validateFile(preview, previewMimeTypes);
    if (error?.key === "web.resources.validation.invalidFileType") {
      return { key: "web.resources.validation.previewInvalidType" };
    }
    if (error?.key === "web.resources.validation.fileTooLarge") {
      return {
        key: "web.resources.validation.previewTooLarge",
        params: { maxSize: "20 MiB" },
      };
    }
    if (error) return error;
  }

  const totalSize =
    files.reduce((total, file) => total + file.size, 0) + (preview?.size ?? 0);
  if (totalSize > maxSessionBytes) {
    return {
      key: "web.resources.validation.sessionTooLarge",
      params: { maxSize: "50 MiB" },
    };
  }
}

export async function uploadResourceSession(input: {
  categories?: string[];
  description?: string;
  fetch?: typeof fetch;
  files: File[];
  getToken(): Promise<string | null>;
  isPrivate?: boolean;
  name?: string;
  onProgress?(fileName: string, percent: number): void;
  onStage?(stage: "complete" | "upload"): void;
  operation: "create" | "version";
  preview?: File;
  resourceId?: number;
}): Promise<{ resourceId: number; version: number }> {
  const fetcher = input.fetch ?? fetch;
  const token = await input.getToken();
  if (!token) throw new ResourceUploadRequestError("session", "unauthorized");

  const response = await fetcher(
    `${trimTrailingSlash(clientEnv.VITE_RESOURCE_API_BASE_URL)}/api/v0/resource-upload-sessions`,
    {
      body: JSON.stringify({
        ...(input.operation === "create"
          ? {
              categories: input.categories,
              description: input.description,
              isPrivate: Boolean(input.isPrivate),
              name: input.name,
            }
          : { resourceId: input.resourceId }),
        files: input.files.map((file) => toMetadata(file, resourceContentType)),
        operation: input.operation,
        preview: input.preview ? toMetadata(input.preview) : undefined,
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
    const file =
      upload.kind === "preview"
        ? input.preview
        : input.files.find(({ name }) => name === upload.fileName);
    if (!file) {
      throw new ResourceUploadRequestError(
        "file",
        "invalid_request",
        upload.fileName,
      );
    }

    input.onProgress?.(file.name, 0);
    const uploadResponse = await fetcher(
      `${trimTrailingSlash(clientEnv.VITE_RESOURCE_API_BASE_URL)}/api/v0/resource-upload-sessions/${encodeURIComponent(session.id)}/files/${encodeURIComponent(upload.id)}`,
      {
        body: file,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": upload.contentType,
        },
        method: "PUT",
      },
    );
    if (!uploadResponse.ok) {
      throw new ResourceUploadRequestError(
        "file",
        await readErrorCode(uploadResponse),
        file.name,
      );
    }
    input.onProgress?.(file.name, 100);
  }

  input.onStage?.("complete");
  const complete = () =>
    fetcher(
      `${trimTrailingSlash(clientEnv.VITE_RESOURCE_API_BASE_URL)}/api/v0/resource-upload-sessions/${encodeURIComponent(session.id)}/complete`,
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
