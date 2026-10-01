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
import {
  DEFAULT_LOCALE,
  formatTranslation,
  type SupportedLocale,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { clientEnv } from "@/env/client";

/**
 * Accepted MIME types for image upload sessions.
 */
const imageTypes = new Set<string>(
  Object.values(imageMimeTypesByExtension).flat(),
);
/**
 * Formats a byte count as localized mebibytes.
 *
 * @param bytes - Byte count to format.
 * @param locale - Locale used to format values and messages.
 * @returns Localized mebibyte text.
 */
export function formatMiB(
  bytes: number,
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  return formatTranslation(
    "web.storage.sizeMiB",
    {
      value: new Intl.NumberFormat(locale).format(bytes / 1024 / 1024),
    },
    locale,
  );
}

/**
 * Metadata sent when creating an upload session.
 */
type UploadMetadata = {
  /**
   * MIME type sent for the upload.
   */
  contentType: string;
  /**
   * Original browser filename.
   */
  fileName: string;
  /**
   * File size in bytes.
   */
  size: number;
};

/**
 * Request passed to an upload transport for one file.
 */
type FileUploadRequest = {
  /**
   * Browser file to upload.
   */
  file: File;
  /**
   * HTTP headers required by the upload endpoint.
   */
  headers: Record<string, string>;
  /**
   * Reports progress for one upload.
   *
   * @param percent - Upload completion percentage.
   */
  onProgress(percent: number): void;
  /**
   * Upload endpoint URL.
   */
  url: string;
};

/**
 * Transport that uploads one file for an active session.
 *
 * @param request - File upload request.
 * @returns The upload endpoint response.
 * @rejects If the file transport fails.
 */
type FileUploader = (request: FileUploadRequest) => Promise<Response>;

/**
 * Upload-session metadata returned by the storage API.
 */
type SessionResponse = {
  /**
   * Upload-session expiry timestamp.
   */
  expiresAt: string;
  /**
   * Opaque upload-session identifier.
   */
  id: string;
  /**
   * Files authorized for this upload session.
   */
  uploads: Array<
    UploadMetadata & {
      /**
       * Opaque file-upload identifier within the session.
       */
      id: string;
      /**
       * Whether the upload is a resource file or image.
       */
      kind: "image" | "file";
    }
  >;
};

/**
 * Localized resource-upload validation failure.
 */
export type ResourceUploadValidationError = {
  /**
   * Localization key describing the failure.
   */
  key: TranslationKey;
  /**
   * Values interpolated into the localized failure message.
   */
  params?: Record<string, number | string>;
};

/**
 * Failure raised for a specific upload-session stage.
 */
export class UploadRequestError extends Error {
  /**
   * Creates an upload failure with optional API and file context.
   *
   * @param stage - Upload stage that failed.
   * @param code - Stable API error code.
   * @param fileName - File associated with the failure.
   * @param imageId - Existing duplicate image identifier.
   * @param sha256 - Duplicate file digest.
   */
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

/**
 * Appends newly selected files without discarding earlier selections.
 *
 * @param current - Files already selected.
 * @param additions - Newly selected files to append.
 * @returns A new array containing current and added files.
 */
export function appendResourceUploadFiles(
  current: File[],
  additions: Iterable<File>,
): File[] {
  return [...current, ...additions];
}

/**
 * Maps upload failures to stable localization keys and parameters.
 *
 * @param error - Failure to translate.
 * @returns The localized validation error payload.
 */
export function getUploadErrorTranslation(
  error: unknown,
): ResourceUploadValidationError {
  if (!(error instanceof UploadRequestError)) {
    return { key: "web.upload.saveFailed" };
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
    return { key: "web.upload.finalizationFailure" };
  }
  return { key: "web.resources.upload.sessionFailure" };
}

/**
 * Validates resource files, images, per-group case-insensitive duplicate names, and aggregate size.
 *
 * @param files - Files to validate.
 * @param images - Images to validate.
 * @param requireImages - Whether at least one image is required.
 * @param locale - Locale used to format values and messages.
 * @returns The first validation failure, or `undefined` when valid.
 */
export function validateResourceUpload(
  files: File[],
  images: File[] = [],
  requireImages = false,
  locale: SupportedLocale = DEFAULT_LOCALE,
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
      resourceContentType(file.name),
      maxResourceFileBytes,
      locale,
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
    locale,
  );
  if (imageError) return imageError;

  const totalSize = [...files, ...images].reduce(
    (total, file) => total + file.size,
    0,
  );
  if (totalSize > maxResourceSessionBytes) {
    return {
      key: "web.resources.validation.sessionTooLarge",
      params: { maxSize: formatMiB(maxResourceSessionBytes, locale) },
    };
  }
}

/**
 * Validates required resource images, case-insensitive duplicate names, types, counts, and sizes.
 *
 * @param images - Images to validate.
 * @param totalCount - Total retained and newly selected image count.
 * @param required - Whether at least one retained or new image is required.
 * @param locale - Locale used to format values and messages.
 * @returns The first image validation failure, or `undefined` when valid.
 */
export function validateResourceImages(
  images: File[],
  totalCount = images.length,
  required = true,
  locale: SupportedLocale = DEFAULT_LOCALE,
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
      locale,
    );
    if (error?.key === "web.resources.validation.invalidFileType") {
      return {
        key: "web.resources.validation.imageInvalidType",
      };
    }
    if (error?.key === "web.resources.validation.fileTooLarge") {
      return {
        key: "web.resources.validation.imageTooLarge",
        params: { maxSize: formatMiB(maxImageBytes, locale) },
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
      params: { maxSize: formatMiB(maxResourceSessionBytes, locale) },
    };
  }
}

/**
 * Uploads a resource creation or version session.
 * Completion is retried once after a server error.
 *
 * @param input - Resource upload files, metadata, and callbacks.
 * @returns The created resource and version identifiers.
 * @rejects If authentication, hashing, session creation, file transfer, or completion fails.
 */
export async function uploadResourceSession(input: {
  /**
   * Categories assigned when creating a resource.
   */
  categories?: string[];
  /**
   * Description assigned when creating a resource.
   */
  description?: string;
  /**
   * Optional fetch implementation used for requests and tests.
   */
  fetch?: typeof fetch;
  /**
   * Files uploaded for the resource or new version.
   */
  files: File[];
  /**
   * Returns the current authentication token.
   *
   * @returns An authentication token, or `null` when signed out.
   * @rejects If token lookup fails.
   */
  getToken(): Promise<string | null>;
  /**
   * Preview images included in the operation.
   */
  images?: File[];
  /**
   * Whether a newly created resource is private.
   */
  isPrivate?: boolean;
  /**
   * Resource display name.
   */
  name?: string;
  /**
   * Reports progress for one upload.
   *
   * @param fileName - File whose progress changed.
   * @param percent - Upload completion percentage.
   */
  onProgress?(fileName: string, percent: number): void;
  /**
   * Reports the active upload-session stage.
   *
   * @param stage - Stage that has started.
   */
  onStage?(stage: "complete" | "upload"): void;
  /**
   * Whether to create a resource or add a version.
   */
  operation: "create" | "version";
  /** Staff reason for a cross-owner version upload. */
  reason?: string;
  /**
   * Existing resource identifier required for version uploads.
   */
  resourceId?: number;
  /**
   * Optional per-file upload transport.
   */
  uploadFile?: FileUploader;
}): Promise<{
  /**
   * Stable resource identifier.
   */
  resourceId: number;
  /** Created resource version number. */
  version: number;
}> {
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
        : { operation: "version", reason: input.reason },
  })) as {
    /**
     * Stable resource identifier.
     */
    resourceId: number;
    /** Created resource version number. */
    version: number;
  };
}

/**
 * Creates an authenticated upload session, transfers every file, and completes it.
 * Completion is retried once after a server error.
 *
 * @param input - Target, files, authentication, transport, and progress callbacks.
 * @returns Identifiers returned by the completed target operation.
 * @rejects If authentication, hashing, session creation, file transfer, or completion fails.
 */
async function uploadSession(input: {
  /**
   * Storage target receiving uploaded files.
   */
  target: {
    /**
     * Storage target type.
     */
    type: UploadTargetType;
    /**
     * Existing target identifier, omitted when the operation creates it.
     */
    id?: number;
  };
  /**
   * Target-specific metadata committed with the upload.
   */
  payload?: Record<string, unknown>;
  /**
   * Optional fetch implementation used for requests and tests.
   */
  fetch?: typeof fetch;
  /**
   * Resource files included in the operation.
   */
  files: File[];
  /**
   * Preview images included in the operation.
   */
  images?: File[];
  /**
   * Returns the current authentication token.
   *
   * @returns An authentication token, or `null` when signed out.
   * @rejects If token lookup fails.
   */
  getToken(): Promise<string | null>;
  /**
   * Reports progress for one upload.
   *
   * @param fileName - File whose progress changed.
   * @param percent - Upload completion percentage.
   */
  onProgress?(fileName: string, percent: number): void;
  /**
   * Reports the active upload-session stage.
   *
   * @param stage - Stage that has started.
   */
  onStage?(stage: "complete" | "upload"): void;
  /**
   * Optional per-file upload transport.
   */
  uploadFile?: FileUploader;
}): Promise<{
  /**
   * Stable resource identifier.
   */
  resourceId?: number;
  /** Created resource version number. */
  version?: number;
  /** Identifier produced for a non-resource upload target. */
  targetId?: number;
}> {
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
              kind === "file" ? resourceContentType(file.name) : file.type,
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
      /**
       * Stable storage API error code.
       */
      error?: string;
      /**
       * Existing image identifier associated with a duplicate.
       */
      imageId?: number;
      /**
       * SHA-256 digest associated with a duplicate.
       */
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
  /**
   * Sends the idempotent session-completion request.
   *
   * @returns The completion response.
   * @rejects If the completion request fails.
   */
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
    /**
     * Stable resource identifier.
     */
    resourceId: number;
    /**
     * Created resource version number.
     */
    version: number;
  };
}

/**
 * Uploads one file with fetch and reports start and completion progress.
 *
 * @param fetcher - Fetch implementation used to send the request.
 * @param input - File, endpoint, headers, and progress callback.
 * @returns The upload endpoint response.
 * @rejects If fetch rejects.
 */
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

/**
 * Uploads one file with XMLHttpRequest progress events.
 *
 * @param input - File, endpoint, headers, and progress callback.
 * @returns The upload endpoint response.
 * @rejects If the request is aborted or encounters a network error.
 */
function uploadFileWithProgress(input: FileUploadRequest): Promise<Response> {
  return new Promise((resolve, rejectPromise) => {
    const request = new XMLHttpRequest();
    let lastPercent = -1;
    /**
     * Reports a new rounded and clamped progress percentage once.
     *
     * @param percent - Upload completion percentage.
     */
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
    /**
     * Rejects the pending upload after a transport abort or error.
     */
    const rejectUpload = () => {
      rejectPromise(
        new UploadRequestError("file", "upload_failed", input.file.name),
      );
    };
    request.addEventListener("abort", rejectUpload);
    request.addEventListener("error", rejectUpload);
    report(0);
    request.send(input.file);
  });
}

/**
 * Validates a file name, size, extension, and content type.
 *
 * @param file - Browser file to validate.
 * @param allowedTypes - Allowed MIME types keyed by lowercase extension.
 * @param contentType - MIME type to validate against the file extension.
 * @param maxBytes - Maximum permitted file size in bytes.
 * @param locale - Locale used to format values and messages.
 * @returns The validation failure, or `undefined` when valid.
 */
function validateFile(
  file: File,
  allowedTypes: Readonly<Record<string, readonly string[]>>,
  contentType = file.type,
  maxBytes = maxResourceFileBytes,
  locale: SupportedLocale = DEFAULT_LOCALE,
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
      params: { filename: file.name, maxSize: formatMiB(maxBytes, locale) },
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

/**
 * Selects the canonical resource MIME type from its filename extension.
 *
 * @param fileName - Filename whose extension selects a content type.
 * @returns The configured MIME type, or `application/octet-stream` when unknown.
 */
function resourceContentType(fileName: string): string {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  const allowedTypes: Readonly<Record<string, readonly string[]>> =
    resourceMimeTypesByExtension;
  return allowedTypes[extension]?.[0] ?? "application/octet-stream";
}

/**
 * Builds storage upload metadata for a browser file.
 *
 * @param file - Browser file whose metadata is needed.
 * @param contentType - MIME type sent to storage.
 * @returns Upload metadata for the file.
 */
function toMetadata(file: File, contentType = file.type): UploadMetadata {
  return {
    contentType,
    fileName: file.name,
    size: file.size,
  };
}

/**
 * Reads an optional stable error code from an API response.
 *
 * @param response - API response whose error body may be parsed.
 * @returns The stable error code, or `undefined` when absent or unreadable.
 */
async function readErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as {
      /**
       * Stable storage API error code.
       */
      error?: unknown;
    };
    return typeof body.error === "string" ? body.error : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Removes trailing slashes from a URL base.
 *
 * @param value - URL base to normalize.
 * @returns The URL base without trailing slashes.
 */
function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, "");
}

/**
 * Localized image-upload validation failure.
 */
export type ImageUploadError = ResourceUploadValidationError;

/**
 * Validates catalog image count, aggregate size, type, and per-file size.
 *
 * @param files - Files to validate.
 * @param locale - Locale used to format values and messages.
 * @returns The validation failure, or `undefined` when valid.
 */
export function validateImages(
  files: File[],
  locale: SupportedLocale = DEFAULT_LOCALE,
): ImageUploadError | undefined {
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
      params: { maxSize: formatMiB(maxImageSessionBytes, locale) },
    };
  }
  for (const file of files) {
    if (!imageTypes.has(file.type))
      return { key: "web.resources.validation.imageInvalidType" };
    if (file.size > maxImageBytes) {
      return {
        key: "web.resources.validation.imageTooLarge",
        params: { maxSize: formatMiB(maxImageBytes, locale) },
      };
    }
  }
}

/**
 * Uploads catalog images while reusing exact-byte active images.
 * Session completion is retried once after a response with status 500 or higher.
 *
 * @param input - Images, target, authentication, locale, and restore callback.
 * @returns Successfully uploaded, restored, or reused files and an empty failure list.
 * @rejects If validation, authentication, hashing, restoration, or storage fails.
 */
export async function uploadImages(input: {
  /**
   * Locale used for validation messages.
   */
  locale: SupportedLocale;
  /**
   * Images to upload or reuse.
   */
  files: File[];
  /**
   * Returns the current authentication token.
   *
   * @returns An authentication token, or `null` when signed out.
   * @rejects If token lookup fails.
   */
  getToken(): Promise<string | null>;
  /**
   * Attempts to restore an owner-deleted duplicate image.
   *
   * @param imageId - Existing duplicate image identifier.
   * @returns Whether the deleted duplicate was restored.
   * @rejects If restoring the deleted duplicate fails.
   */
  onOwnerDeletedDuplicate?(imageId: number): Promise<boolean>;
  /**
   * Optional moderation or audit reason.
   */
  reason?: string;
  /**
   * Identifier of the upload target.
   */
  targetId: number;
  /**
   * Non-resource image target type.
   */
  targetType: Exclude<UploadTargetType, "resource">;
}): Promise<{
  /**
   * Files uploaded, restored, or reused successfully.
   */
  uploaded: File[];
  /** Files that could not be uploaded. */
  failed: File[];
}> {
  if (!input.files.length) return { uploaded: [], failed: [] };
  const validation = validateImages(input.files, input.locale);
  if (validation) throw validation;
  try {
    await uploadSession({
      target: { type: input.targetType, id: input.targetId },
      files: [],
      images: input.files,
      getToken: input.getToken,
      payload: input.reason ? { reason: input.reason } : undefined,
    });
    return { uploaded: input.files, failed: [] };
  } catch (error) {
    if (
      error instanceof UploadRequestError &&
      error.sha256 &&
      (error.code === "duplicate_active" ||
        (error.code === "duplicate_owner_deleted" &&
          error.imageId &&
          input.onOwnerDeletedDuplicate &&
          (await input.onOwnerDeletedDuplicate(error.imageId))))
    ) {
      const hashes = await Promise.all(input.files.map(hashFile));
      const remaining = input.files.filter(
        (_file, index) => hashes[index] !== error.sha256,
      );
      const restored = input.files.filter(
        (_file, index) => hashes[index] === error.sha256,
      );
      if (restored.length) {
        const result = await uploadImages({ ...input, files: remaining });
        return { ...result, uploaded: [...restored, ...result.uploaded] };
      }
    }
    throw getUploadErrorTranslation(error);
  }
}
/**
 * Deletes a collection cover image with optional moderation context.
 *
 * @param input - Cover identifier, authentication callback, and optional moderation reason.
 * @rejects If authentication is unavailable, the request fails, or the API rejects deletion.
 */
export async function deleteCollectionCover(input: {
  /**
   * Collection-cover image identifier to delete.
   */
  imageId: number;
  /**
   * Returns the current authentication token.
   *
   * @returns An authentication token, or `null` when signed out.
   * @rejects If token lookup fails.
   */
  getToken(): Promise<string | null>;
  /**
   * Optional moderation or audit reason.
   */
  reason?: string;
}) {
  const token = await input.getToken();
  if (!token) throw { key: "error.generic" } satisfies ImageUploadError;
  const response = await fetch(
    `${trimTrailingSlash(clientEnv.VITE_API_URL)}/api/v0/storage/file/collection_image/${input.imageId}`,
    {
      body: JSON.stringify({ reason: input.reason }),
      method: "DELETE",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
    },
  );
  if (!response.ok) throw { key: "error.generic" } satisfies ImageUploadError;
}
/**
 * Computes a lowercase hexadecimal SHA-256 digest for a browser file.
 *
 * @param file - Browser file to hash.
 * @returns The file's lowercase hexadecimal SHA-256 digest.
 * @rejects If file reading or Web Crypto hashing fails.
 */
async function hashFile(file: File) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
