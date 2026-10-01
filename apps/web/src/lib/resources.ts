import type { ResourceTrashItem } from "@package/services";
import { hasPermission } from "@package/services/authorization";
import { formatTranslation } from "@pocket-trash/localizations";
import { createServerFn } from "@tanstack/react-start";
import { activeAuth as auth } from "@/lib/auth";
import { getActor, requireActor, requirePermission } from "@/lib/authorization";

type ResourceIdInput = { resourceId: number };
type ResourceDownloadInput = ResourceIdInput & { fileId: number };
type ResourceVersionDownloadInput = ResourceIdInput & { versionId: number };

export const canManageResources = createServerFn().handler(async () => {
  return hasPermission(await getResourceViewer(), "resources.manage");
});

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

export const listResourceCategories = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    if (input === undefined) return { search: "" };
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as { search?: unknown }).search !== "string"
    ) {
      throw invalidResourceRequest();
    }
    return { search: (input as { search: string }).search.slice(0, 60) };
  })
  .handler(async ({ data }) => {
    const { s } = await import("@/lib/services");
    return await s.resources.listCategories(data.search);
  });

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

export const listOwnerResourceTrash = createServerFn({ method: "GET" }).handler(
  async (): Promise<ResourceTrashItem[]> => {
    const actor = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.resources.listOwnerTrash(actor.clerkId);
  },
);

export const listAdminResourceTrash = createServerFn({ method: "GET" }).handler(
  async (): Promise<ResourceTrashItem[]> => {
    await requireResourceAdmin();
    const { s } = await import("@/lib/services");
    return await s.resources.listAdminTrash();
  },
);

export const listResourceNotifications = createServerFn({
  method: "GET",
}).handler(async () => {
  await requireResourceAdmin();
  const { s } = await import("@/lib/services");
  return await s.resources.listNotifications();
});

export const markResourceNotificationRead = createServerFn({ method: "POST" })
  .validator(parseNotificationId)
  .handler(async ({ data }) => {
    const actor = await requireResourceAdmin();
    const { s } = await import("@/lib/services");
    await s.resources.markNotificationRead(data.notificationId, actor.clerkId);
  });

/** Marks a resource private on behalf of staff. */
export const markResourcePrivate = createServerFn({ method: "POST" })
  .validator(parseMarkPrivate)
  .handler(async ({ data }) => {
    const actor = await requireResourceAdmin();
    const { s } = await import("@/lib/services");
    await s.resources.markPrivate({ ...data, actor });
  });

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

/** Soft-deletes a resource with actor provenance. */
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

/** Permanently deletes a resource with a required staff reason. */
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

/** Restores a soft-deleted resource with actor provenance. */
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

/** Uploads a new resource version with actor provenance. */
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

export function parseResourceDirectoryInput(input: unknown) {
  if (input === undefined) return { categorySlugs: [] };
  if (typeof input !== "object" || input === null) {
    throw invalidResourceRequest();
  }
  const categorySlugs = (input as { categorySlugs?: unknown }).categorySlugs;
  if (
    !Array.isArray(categorySlugs) ||
    categorySlugs.length > 10 ||
    categorySlugs.some((slug) => typeof slug !== "string")
  ) {
    throw invalidResourceRequest();
  }
  return { categorySlugs: categorySlugs as string[] };
}

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

export async function getResourceViewer(getAuth: typeof auth = auth) {
  return await getActor(getAuth);
}

export async function requireResourceUploader(getAuth: typeof auth = auth) {
  return await requireActor(getAuth);
}

export async function requireResourceAdmin(getAuth: typeof auth = auth) {
  return await requirePermission("resources.manage", getAuth);
}

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

function parseResourceId(input: unknown): ResourceIdInput {
  if (typeof input !== "object" || input === null) {
    throw invalidResourceRequest();
  }
  const resourceId = Number((input as { resourceId?: unknown }).resourceId);
  if (!Number.isSafeInteger(resourceId) || resourceId <= 0) {
    throw invalidResourceRequest();
  }
  return { resourceId };
}

function parseResourceDownload(input: unknown): ResourceDownloadInput {
  const { resourceId } = parseResourceId(input);
  const fileId = Number((input as { fileId?: unknown }).fileId);
  if (!Number.isSafeInteger(fileId) || fileId <= 0) {
    throw invalidResourceRequest();
  }
  return { fileId, resourceId };
}

function parseResourceVersionDownload(
  input: unknown,
): ResourceVersionDownloadInput {
  const { resourceId } = parseResourceId(input);
  const versionId = Number((input as { versionId?: unknown }).versionId);
  if (!Number.isSafeInteger(versionId) || versionId <= 0) {
    throw invalidResourceRequest();
  }
  return { resourceId, versionId };
}

function parseNotificationId(input: unknown) {
  if (typeof input !== "object" || input === null) {
    throw invalidResourceRequest();
  }
  const notificationId = Number(
    (input as { notificationId?: unknown }).notificationId,
  );
  if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
    throw invalidResourceRequest();
  }
  return { notificationId };
}

export function parseMarkPrivate(input: unknown) {
  const { resourceId } = parseResourceId(input);
  const reason = (input as { reason?: unknown }).reason;
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
  const isPublic = (input as { isPublic?: unknown }).isPublic;
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

async function toUploadInput(file: File) {
  return {
    bytes: new Uint8Array(await file.arrayBuffer()),
    contentType: file.type,
    fileName: file.name,
  };
}

function isFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File && value.size > 0;
}

function invalidResourceRequest(): Error {
  return new Error(formatTranslation("error.generic"));
}
