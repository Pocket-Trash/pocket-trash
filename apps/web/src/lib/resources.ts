import type { ResourceTrashItem } from "@package/services";
import { hasPermission } from "@package/services/authorization";
import { formatTranslation } from "@pocket-trash/localizations";
import { createServerFn } from "@tanstack/react-start";
import { activeAuth as auth } from "@/lib/auth";
import { getActor, requireActor, requirePermission } from "@/lib/authorization";

/**
 * Validated resource identifier input.
 */
type ResourceIdInput = {
  /**
   * Stable resource identifier.
   */
  resourceId: number;
};
/**
 * Validated resource-file download input.
 */
type ResourceDownloadInput = ResourceIdInput & {
  /**
   * Stable resource-file identifier.
   */
  fileId: number;
};
/**
 * Validated resource-version download input.
 */
type ResourceVersionDownloadInput = ResourceIdInput & {
  /**
   * Stable resource-version identifier.
   */
  versionId: number;
};

/**
 * Reports whether the current viewer may manage resources.
 *
 * @returns Whether the viewer has resource-management permission.
 * @rejects If actor lookup fails.
 */
export const canManageResources = createServerFn().handler(async () => {
  return hasPermission(await getResourceViewer(), "resources.manage");
});

/**
 * Creates a resource from validated metadata and uploaded files.
 *
 * @returns The created resource identifier.
 * @rejects If validation, authentication, file reading, service loading, upload, persistence, auditing, or operation logging fails.
 */
export const createResource = createServerFn({ method: "POST" })
  .validator(parseResourceUpload)
  .handler(async ({ data }) => {
    const actor = await requireResourceUploader();
    const { s } = await import("@/lib/services");

    return await s.resources.create({
      ...data,
      files: await Promise.all(data.files.map(toUploadInput)),
      images: await Promise.all(data.images.map(toUploadInput)),
      actor,
    });
  });

/**
 * Loads a viewer-aware resource detail.
 *
 * @returns The visible detail with viewer capabilities, or `null` when unavailable.
 * @rejects If validation, service loading, actor lookup, database access, URL signing, or operation logging fails.
 */
export const getResourceDetail = createServerFn({ method: "GET" })
  .validator(parseResourceId)
  .handler(async ({ data }) => {
    const { s } = await import("@/lib/services");
    const viewer = await getResourceViewer();
    const detail = await s.resources.getDetail(data.resourceId, viewer);
    if (!detail) return null;
    const { uploaderClerkId, ...browserDetail } = detail;
    return {
      ...browserDetail,
      canAdminister: hasPermission(viewer, "resources.manage"),
      canEdit:
        uploaderClerkId === viewer?.clerkId ||
        hasPermission(viewer, "resources.manage"),
      isOwner: uploaderClerkId === viewer?.clerkId,
    };
  });

/**
 * Loads a resource detail only when the viewer may edit it.
 *
 * @returns The editable detail, or `null` when missing or unauthorized.
 * @rejects If validation, authentication, service loading, database access, URL signing, or operation logging fails.
 */
export const getEditableResourceDetail = createServerFn({ method: "GET" })
  .validator(parseResourceId)
  .handler(async ({ data }) => {
    const viewer = await getResourceViewer();
    if (!viewer) throw invalidResourceRequest();
    const { s } = await import("@/lib/services");
    const detail = await s.resources.getDetail(data.resourceId, viewer);
    if (!detail) return null;
    const { uploaderClerkId, ...browserDetail } = detail;
    return uploaderClerkId === viewer.clerkId ||
      hasPermission(viewer, "resources.manage")
      ? {
          ...browserDetail,
          canAdminister: hasPermission(viewer, "resources.manage"),
          isOwner: uploaderClerkId === viewer.clerkId,
        }
      : null;
  });

/**
 * Loads a resource detail only when the uploader owns it.
 *
 * @returns The owned detail, or `null` when missing or owned by another actor.
 * @rejects If validation, authentication, service loading, database access, URL signing, or operation logging fails.
 */
export const getOwnedResourceDetail = createServerFn({ method: "GET" })
  .validator(parseResourceId)
  .handler(async ({ data }) => {
    const actor = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    const detail = await s.resources.getDetail(data.resourceId, actor);
    if (!detail) return null;
    const { uploaderClerkId, ...browserDetail } = detail;
    if (uploaderClerkId !== actor.clerkId) return null;
    return browserDetail;
  });

/**
 * Searches resource categories using a bounded query.
 *
 * @returns Up to 20 matching categories in alphabetical order.
 * @rejects If validation, service loading, database access, or operation logging fails.
 */
export const listResourceCategories = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    if (input === undefined) return { search: "" };
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (
        input as {
          /**
           * Category search text, truncated to 60 characters.
           */
          search?: unknown;
        }
      ).search !== "string"
    ) {
      throw invalidResourceRequest();
    }
    return {
      search: (
        input as {
          /**
           * Category search text, truncated to 60 characters.
           */
          search: string;
        }
      ).search.slice(0, 60),
    };
  })
  .handler(async ({ data }) => {
    const { s } = await import("@/lib/services");
    return await s.resources.listCategories(data.search);
  });

/**
 * Lists the viewer-visible resource directory for selected categories.
 *
 * @returns The filtered directory with per-resource edit capability.
 * @rejects If validation, service loading, actor lookup, database access, URL signing, or operation logging fails.
 */
export const listResourceDirectory = createServerFn({ method: "GET" })
  .validator(parseResourceDirectoryInput)
  .handler(async ({ data }) => {
    const { s } = await import("@/lib/services");
    const viewer = await getResourceViewer();
    const directory = await s.resources.listDirectory(
      data.categorySlugs,
      viewer,
    );
    return {
      ...directory,
      resources: directory.resources.map(
        ({ uploaderClerkId, ...resource }) => ({
          ...resource,
          canEdit:
            uploaderClerkId === viewer?.clerkId ||
            hasPermission(viewer, "resources.manage"),
        }),
      ),
    };
  });

/**
 * Lists resources owned by the current uploader.
 *
 * @returns The actor's visible resources with edit capability enabled.
 * @rejects If authentication, service loading, database access, URL signing, or operation logging fails.
 */
export const listOwnedResources = createServerFn({ method: "GET" }).handler(
  async () => {
    const actor = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    const directory = await s.resources.listDirectory([], actor);
    return directory.resources.flatMap(({ uploaderClerkId, ...resource }) =>
      uploaderClerkId === actor.clerkId ? [{ ...resource, canEdit: true }] : [],
    );
  },
);

/**
 * Lists the current uploader's deleted resources.
 *
 * @returns Owner-deleted resources ordered newest-first.
 * @rejects If authentication, service loading, database access, or operation logging fails.
 */
export const listOwnerResourceTrash = createServerFn({ method: "GET" }).handler(
  async (): Promise<ResourceTrashItem[]> => {
    const actor = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.resources.listOwnerTrash(actor.clerkId);
  },
);

/**
 * Lists all deleted resources for a resource administrator.
 *
 * @returns Soft-deleted resources ordered newest-first.
 * @rejects If permission checking, service loading, database access, or operation logging fails.
 */
export const listAdminResourceTrash = createServerFn({ method: "GET" }).handler(
  async (): Promise<ResourceTrashItem[]> => {
    await requireResourceAdmin();
    const { s } = await import("@/lib/services");
    return await s.resources.listAdminTrash();
  },
);

/**
 * Lists resource moderation notifications for an administrator.
 *
 * @returns Resource notifications ordered newest-first.
 * @rejects If permission checking, service loading, database access, or operation logging fails.
 */
export const listResourceNotifications = createServerFn({
  method: "GET",
}).handler(async () => {
  await requireResourceAdmin();
  const { s } = await import("@/lib/services");
  return await s.resources.listNotifications();
});

/**
 * Marks one resource notification as read.
 *
 * @rejects If validation, permission checking, service loading, database access, or operation logging fails.
 */
export const markResourceNotificationRead = createServerFn({ method: "POST" })
  .validator(parseNotificationId)
  .handler(async ({ data }) => {
    const actor = await requireResourceAdmin();
    const { s } = await import("@/lib/services");
    await s.resources.markNotificationRead(data.notificationId, actor.clerkId);
  });

/**
 * Marks a resource private on behalf of staff.
 *
 * @rejects If validation, permission checking, service loading, authorization, persistence, auditing, or operation logging fails.
 */
export const markResourcePrivate = createServerFn({ method: "POST" })
  .validator(parseMarkPrivate)
  .handler(async ({ data }) => {
    const actor = await requireResourceAdmin();
    const { s } = await import("@/lib/services");
    await s.resources.markPrivate({ ...data, actor });
  });

/**
 * Changes a resource's public visibility.
 *
 * @rejects If validation, authentication, service loading, authorization, persistence, auditing, or operation logging fails.
 */
export const setResourceVisibility = createServerFn({ method: "POST" })
  .validator(parseResourceVisibility)
  .handler(async ({ data }) => {
    const viewer = await getResourceViewer();
    if (!viewer) throw invalidResourceRequest();
    const { s } = await import("@/lib/services");
    await s.resources.setVisibility({
      ...data,
      actor: viewer,
    });
  });

/**
 * Soft-deletes a resource with actor provenance.
 *
 * @returns Whether the deletion was recorded as an owner or administrator action.
 * @rejects If validation, authentication, service loading, authorization, persistence, auditing, or operation logging fails.
 */
export const softDeleteResource = createServerFn({ method: "POST" })
  .validator(parseResourceMutation)
  .handler(async ({ data }) => {
    const viewer = await getResourceViewer();
    if (!viewer) throw invalidResourceRequest();
    const { s } = await import("@/lib/services");
    return await s.resources.softDelete({
      actor: viewer,
      ...data,
    });
  });

/**
 * Permanently deletes a resource with a required staff reason.
 *
 * @rejects If validation, permission checking, service loading, authorization, persistence, deletion queuing, auditing, or operation logging fails.
 */
export const permanentlyDeleteResource = createServerFn({ method: "POST" })
  .validator(parseRequiredResourceMutation)
  .handler(async ({ data }) => {
    const actor = await requirePermission("resources.purge");
    const { s } = await import("@/lib/services");
    await s.resources.permanentlyDelete({
      actor,
      ...data,
    });
  });

/**
 * Restores a soft-deleted resource with actor provenance.
 *
 * @rejects If validation, authentication, service loading, authorization, persistence, auditing, or operation logging fails.
 */
export const restoreResource = createServerFn({ method: "POST" })
  .validator(parseResourceMutation)
  .handler(async ({ data }) => {
    const viewer = await getResourceViewer();
    if (!viewer) throw invalidResourceRequest();
    const { s } = await import("@/lib/services");
    await s.resources.restore({
      actor: viewer,
      ...data,
    });
  });

/**
 * Updates resource metadata and images.
 *
 * @returns The updated resource identifier.
 * @rejects If validation, authentication, file reading, service loading, authorization, upload, persistence, auditing, or operation logging fails.
 */
export const updateResource = createServerFn({ method: "POST" })
  .validator(parseResourceUpdate)
  .handler(async ({ data }) => {
    const viewer = await getResourceViewer();
    if (!viewer) throw invalidResourceRequest();
    const { s } = await import("@/lib/services");
    return await s.resources.update({
      ...data,
      actor: viewer,
      images: await Promise.all(data.images.map(toUploadInput)),
    });
  });

/**
 * Uploads a new resource version with actor provenance.
 *
 * @returns The created resource-version identity.
 * @rejects If validation, authentication, file reading, service loading, authorization, upload, persistence, auditing, or operation logging fails.
 */
export const uploadResourceVersion = createServerFn({ method: "POST" })
  .validator(parseResourceVersionUpload)
  .handler(async ({ data }) => {
    const actor = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.resources.addVersion({
      files: await Promise.all(data.files.map(toUploadInput)),
      resourceId: data.resourceId,
      reason: data.reason,
      actor,
    });
  });

/**
 * Validates optional resource-directory category filters.
 *
 * @param input - Untrusted directory input, or `undefined` for no category filters.
 * @returns An object containing up to ten category slug strings, defaulting to an empty array.
 * @throws When the input is not an object containing at most ten strings.
 */
export function parseResourceDirectoryInput(input: unknown) {
  if (input === undefined) return { categorySlugs: [] };
  if (typeof input !== "object" || input === null) {
    throw invalidResourceRequest();
  }
  const categorySlugs = (
    input as {
      /**
       * Category slugs used to filter the directory.
       */
      categorySlugs?: unknown;
    }
  ).categorySlugs;
  if (
    !Array.isArray(categorySlugs) ||
    categorySlugs.length > 10 ||
    categorySlugs.some((slug) => typeof slug !== "string")
  ) {
    throw invalidResourceRequest();
  }
  return { categorySlugs: categorySlugs as string[] };
}

/**
 * Creates a download response for one resource file.
 *
 * @returns The signed download URL, or `null` when the file is unavailable.
 * @rejects If validation, service loading, actor lookup, database access, URL signing, download recording, or operation logging fails.
 */
export const downloadResourceFile = createServerFn({ method: "POST" })
  .validator(parseResourceDownload)
  .handler(async ({ data }) => {
    const { s } = await import("@/lib/services");
    return await s.resources.downloadFile(
      data.resourceId,
      data.fileId,
      await getResourceViewer(),
    );
  });

/**
 * Creates a download response for one resource version.
 *
 * @returns The signed archive URL, or `null` when unavailable or containing fewer than two files.
 * @rejects If validation, service loading, actor lookup, database access, storage, URL signing, download recording, or operation logging fails.
 */
export const downloadResourceVersion = createServerFn({ method: "POST" })
  .validator(parseResourceVersionDownload)
  .handler(async ({ data }) => {
    const { s } = await import("@/lib/services");
    return await s.resources.downloadVersion(
      data.resourceId,
      data.versionId,
      await getResourceViewer(),
    );
  });

/**
 * Resolves the optional actor viewing a resource.
 *
 * @param getAuth - Authentication lookup, replaceable by tests.
 * @returns The authenticated actor, or `undefined` for an anonymous viewer.
 * @rejects If authentication lookup fails.
 */
export async function getResourceViewer(getAuth: typeof auth = auth) {
  return await getActor(getAuth);
}

/**
 * Requires an authenticated actor for resource uploads.
 *
 * @param getAuth - Authentication lookup, replaceable by tests.
 * @returns The authenticated resource uploader.
 * @rejects If the request is unauthenticated or authentication lookup fails.
 */
export async function requireResourceUploader(getAuth: typeof auth = auth) {
  return await requireActor(getAuth);
}

/**
 * Requires resource-management permission.
 *
 * @param getAuth - Authentication lookup, replaceable by tests.
 * @returns The authenticated resource administrator.
 * @rejects If the actor lacks resource-management permission or authentication lookup fails.
 */
export async function requireResourceAdmin(getAuth: typeof auth = auth) {
  return await requirePermission("resources.manage", getAuth);
}

/**
 * Validates a resource-creation form and its required files, images, and categories.
 *
 * @param input - Untrusted resource-creation form.
 * @returns Creation metadata with string fields, one to ten nonempty files, one to ten nonempty images, and at least one category.
 * @throws When string fields, files, images, or categories are missing or malformed.
 */
export function parseResourceUpload(input: unknown) {
  if (!(input instanceof FormData)) throw invalidResourceRequest();
  const name = input.get("name");
  const description = input.get("description");
  const files = input.getAll("files");
  const images = input.getAll("images");
  const categories = input.getAll("categories");

  if (
    typeof name !== "string" ||
    typeof description !== "string" ||
    files.length === 0 ||
    files.length > 10 ||
    files.some((file) => !isFile(file)) ||
    images.length === 0 ||
    images.length > 10 ||
    images.some((image) => !isFile(image)) ||
    categories.length === 0 ||
    categories.some((category) => typeof category !== "string")
  ) {
    throw invalidResourceRequest();
  }

  return {
    categories: categories as string[],
    description,
    files: files as File[],
    images: images as File[],
    name,
  };
}

/**
 * Parses a resource update form.
 * Non-file image entries are ignored; retained and new images must total one to ten.
 *
 * @param input - Untrusted form input.
 * @returns The validated resource update.
 * @throws When the input is invalid.
 */
export function parseResourceUpdate(input: unknown) {
  if (!(input instanceof FormData)) throw invalidResourceRequest();
  const resourceId = Number(input.get("resourceId"));
  const name = input.get("name");
  const description = input.get("description");
  const images = input.getAll("images").filter(isFile);
  const retainedImageIds = input.getAll("retainedImageIds").map(Number);
  const categories = input.getAll("categories");
  const reason = parseReason(input.get("reason"));

  if (
    !Number.isSafeInteger(resourceId) ||
    resourceId <= 0 ||
    typeof name !== "string" ||
    typeof description !== "string" ||
    images.length > 10 ||
    retainedImageIds.some(
      (imageId) => !Number.isSafeInteger(imageId) || imageId <= 0,
    ) ||
    images.length + retainedImageIds.length === 0 ||
    images.length + retainedImageIds.length > 10 ||
    categories.length === 0 ||
    categories.some((category) => typeof category !== "string")
  ) {
    throw invalidResourceRequest();
  }

  return {
    categories: categories as string[],
    description,
    images: images as File[],
    name,
    retainedImageIds,
    reason,
    resourceId,
  };
}

/**
 * Parses a resource version upload form.
 * The form must contain a positive safe resource ID and one to ten nonempty files.
 *
 * @param input - Untrusted form input.
 * @returns The validated version upload.
 * @throws When the input is invalid.
 */
export function parseResourceVersionUpload(input: unknown) {
  if (!(input instanceof FormData)) throw invalidResourceRequest();
  const resourceId = Number(input.get("resourceId"));
  const files = input.getAll("files");
  const reason = parseReason(input.get("reason"));
  if (
    !Number.isSafeInteger(resourceId) ||
    resourceId <= 0 ||
    files.length === 0 ||
    files.length > 10 ||
    files.some((file) => !isFile(file))
  ) {
    throw invalidResourceRequest();
  }
  return { files: files as File[], reason, resourceId };
}

/**
 * Parses a positive safe resource identifier.
 *
 * @param input - Untrusted resource identifier input.
 * @returns An object containing the positive safe resource identifier.
 * @throws When the input lacks a positive safe resource identifier.
 */
function parseResourceId(input: unknown): ResourceIdInput {
  if (typeof input !== "object" || input === null) {
    throw invalidResourceRequest();
  }
  const resourceId = Number(
    (
      input as {
        /**
         * Stable resource identifier.
         */
        resourceId?: unknown;
      }
    ).resourceId,
  );
  if (!Number.isSafeInteger(resourceId) || resourceId <= 0) {
    throw invalidResourceRequest();
  }
  return { resourceId };
}

/**
 * Parses positive safe resource and file identifiers.
 *
 * @param input - Untrusted resource-file download input.
 * @returns An object containing positive safe resource and file identifiers.
 * @throws When either identifier is not a positive safe integer.
 */
function parseResourceDownload(input: unknown): ResourceDownloadInput {
  const { resourceId } = parseResourceId(input);
  const fileId = Number(
    (
      input as {
        /**
         * Stable resource-file identifier.
         */
        fileId?: unknown;
      }
    ).fileId,
  );
  if (!Number.isSafeInteger(fileId) || fileId <= 0) {
    throw invalidResourceRequest();
  }
  return { fileId, resourceId };
}

/**
 * Parses positive safe resource and version identifiers.
 *
 * @param input - Untrusted resource-version download input.
 * @returns An object containing positive safe resource and version identifiers.
 * @throws When either identifier is not a positive safe integer.
 */
function parseResourceVersionDownload(
  input: unknown,
): ResourceVersionDownloadInput {
  const { resourceId } = parseResourceId(input);
  const versionId = Number(
    (
      input as {
        /**
         * Stable resource-version identifier.
         */
        versionId?: unknown;
      }
    ).versionId,
  );
  if (!Number.isSafeInteger(versionId) || versionId <= 0) {
    throw invalidResourceRequest();
  }
  return { resourceId, versionId };
}

/**
 * Parses a positive safe resource-notification identifier.
 *
 * @param input - Untrusted notification input.
 * @returns An object containing the positive safe notification identifier.
 * @throws When the notification identifier is not a positive safe integer.
 */
function parseNotificationId(input: unknown) {
  if (typeof input !== "object" || input === null) {
    throw invalidResourceRequest();
  }
  const notificationId = Number(
    (
      input as {
        /**
         * Stable resource-notification identifier.
         */
        notificationId?: unknown;
      }
    ).notificationId,
  );
  if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
    throw invalidResourceRequest();
  }
  return { notificationId };
}

/**
 * Parses a staff privacy action with a required trimmed reason.
 *
 * @param input - Untrusted staff privacy input.
 * @returns The positive resource identifier and trimmed reason.
 * @throws When the identifier is invalid or the reason is blank or exceeds 1,000 characters.
 */
export function parseMarkPrivate(input: unknown) {
  const { resourceId } = parseResourceId(input);
  const reason = (
    input as {
      /**
       * Optional moderation or audit reason.
       */
      reason?: unknown;
    }
  ).reason;
  if (typeof reason !== "string" || !reason.trim() || reason.length > 1000) {
    throw invalidResourceRequest();
  }
  return { reason: reason.trim(), resourceId };
}

/**
 * Parses a resource visibility mutation.
 *
 * @param input - Untrusted mutation input.
 * @returns The validated visibility mutation.
 * @throws When the input is invalid.
 */
export function parseResourceVisibility(input: unknown) {
  const { resourceId } = parseResourceId(input);
  const isPublic = (
    input as {
      /**
       * Requested public visibility.
       */
      isPublic?: unknown;
    }
  ).isPublic;
  if (typeof isPublic !== "boolean") throw invalidResourceRequest();
  return {
    isPublic,
    reason: parseReason(
      (
        input as {
          /** Optional moderation reason. */
          reason?: unknown;
        }
      ).reason,
    ),
    resourceId,
  };
}

/**
 * Parses a resource mutation with an optional reason.
 *
 * @param input - Untrusted mutation input.
 * @returns The validated mutation.
 * @throws When the input is invalid.
 */
function parseResourceMutation(input: unknown) {
  const { resourceId } = parseResourceId(input);
  const reason = parseReason(
    (
      input as {
        /** Optional moderation reason. */
        reason?: unknown;
      }
    ).reason,
  );
  return { reason, resourceId };
}

/**
 * Parses a resource mutation with a required reason.
 *
 * @param input - Untrusted mutation input.
 * @returns The validated mutation.
 * @throws When the input is invalid or lacks a reason.
 */
function parseRequiredResourceMutation(input: unknown) {
  const { reason, resourceId } = parseResourceMutation(input);
  if (!reason) throw invalidResourceRequest();
  return { reason, resourceId };
}

/**
 * Normalizes an optional moderation reason.
 * `null`, `undefined`, and the empty string map to `undefined`; whitespace-only strings are invalid.
 * Supplied reasons may contain at most 1,000 characters before trimming.
 *
 * @param value - Untrusted reason input.
 * @returns The trimmed reason when supplied.
 * @throws When the reason is invalid.
 */
function parseReason(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value !== "string" || value.length > 1000 || !value.trim()) {
    throw invalidResourceRequest();
  }
  return value.trim();
}

/**
 * Reads a browser file into the service upload shape.
 *
 * @param file - Browser file to read.
 * @returns The service upload input.
 * @rejects If the browser cannot read the file.
 */
async function toUploadInput(file: File) {
  return {
    bytes: new Uint8Array(await file.arrayBuffer()),
    contentType: file.type,
    fileName: file.name,
  };
}

/**
 * Checks that a form value is a nonempty browser file.
 *
 * @param value - Form value to inspect.
 * @returns Whether the value is a nonempty browser file.
 */
function isFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File && value.size > 0;
}

/**
 * Creates the generic localized resource-request error.
 *
 * @returns A generic localized error.
 */
function invalidResourceRequest(): Error {
  return new Error(formatTranslation("error.generic"));
}
