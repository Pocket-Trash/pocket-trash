import { auth } from "@clerk/tanstack-react-start/server";
import { formatTranslation } from "@pocket-trash/localizations";
import { createServerFn } from "@tanstack/react-start";

type ResourceIdInput = { resourceId: number };
type ResourceDownloadInput = ResourceIdInput & { fileId: number };

type SessionClaimsWithRole = {
  role?: unknown;
};

export const isResourceAdmin = createServerFn().handler(async () => {
  return (await getResourceViewer()).isAdmin;
});

export const createResource = createServerFn({ method: "POST" })
  .validator(parseResourceUpload)
  .handler(async ({ data }) => {
    const userId = await requireResourceUploader();
    const { s } = await import("@/lib/services");

    return await s.resources.create({
      ...data,
      files: await Promise.all(data.files.map(toUploadInput)),
      preview: data.preview ? await toUploadInput(data.preview) : undefined,
      uploaderClerkId: userId,
    });
  });

export const getResourceDetail = createServerFn({ method: "GET" })
  .validator(parseResourceId)
  .handler(async ({ data }) => {
    const { s } = await import("@/lib/services");
    const viewer = await getResourceViewer();
    const detail = await s.resources.getDetail(data.resourceId, viewer);
    return detail
      ? {
          ...detail,
          canAdminister: viewer.isAdmin,
          canEdit: viewer.isAdmin || detail.uploaderClerkId === viewer.clerkId,
          isOwner: detail.uploaderClerkId === viewer.clerkId,
        }
      : null;
  });

export const getEditableResourceDetail = createServerFn({ method: "GET" })
  .validator(parseResourceId)
  .handler(async ({ data }) => {
    const viewer = await getResourceViewer();
    if (!viewer.clerkId) throw invalidResourceRequest();
    const { s } = await import("@/lib/services");
    const detail = await s.resources.getDetail(data.resourceId, viewer);
    return detail &&
      (viewer.isAdmin || detail.uploaderClerkId === viewer.clerkId)
      ? {
          ...detail,
          canAdminister: viewer.isAdmin,
          isOwner: detail.uploaderClerkId === viewer.clerkId,
        }
      : null;
  });

export const getOwnedResourceDetail = createServerFn({ method: "GET" })
  .validator(parseResourceId)
  .handler(async ({ data }) => {
    const userId = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    const detail = await s.resources.getDetail(data.resourceId, {
      clerkId: userId,
    });
    return detail?.uploaderClerkId === userId ? detail : null;
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
      resources: directory.resources.map((resource) => ({
        ...resource,
        canEdit: viewer.isAdmin || resource.uploaderClerkId === viewer.clerkId,
      })),
    };
  });

export const listOwnedResources = createServerFn({ method: "GET" }).handler(
  async () => {
    const userId = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.resources.listOwned(userId);
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
    const actorClerkId = await requireResourceAdmin();
    const { s } = await import("@/lib/services");
    await s.resources.markNotificationRead(data.notificationId, actorClerkId);
  });

export const markResourcePrivate = createServerFn({ method: "POST" })
  .validator(parseMarkPrivate)
  .handler(async ({ data }) => {
    const actorClerkId = await requireResourceAdmin();
    const { s } = await import("@/lib/services");
    await s.resources.markPrivate({ ...data, actorClerkId });
  });

export const setResourceVisibility = createServerFn({ method: "POST" })
  .validator(parseResourceVisibility)
  .handler(async ({ data }) => {
    const viewer = await getResourceViewer();
    if (!viewer.clerkId) throw invalidResourceRequest();
    const { s } = await import("@/lib/services");
    await s.resources.setVisibility({
      ...data,
      actorClerkId: viewer.clerkId,
      actorIsAdmin: viewer.isAdmin,
    });
  });

export const updateResource = createServerFn({ method: "POST" })
  .validator(parseResourceUpdate)
  .handler(async ({ data }) => {
    const viewer = await getResourceViewer();
    if (!viewer.clerkId) throw invalidResourceRequest();
    const { s } = await import("@/lib/services");
    return await s.resources.update({
      ...data,
      actorClerkId: viewer.clerkId,
      actorIsAdmin: viewer.isAdmin,
      preview: data.preview ? await toUploadInput(data.preview) : undefined,
    });
  });

export const uploadResourceVersion = createServerFn({ method: "POST" })
  .validator(parseResourceVersionUpload)
  .handler(async ({ data }) => {
    const userId = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.resources.addVersion({
      files: await Promise.all(data.files.map(toUploadInput)),
      resourceId: data.resourceId,
      uploaderClerkId: userId,
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

export const downloadResource = createServerFn({ method: "POST" })
  .validator(parseResourceDownload)
  .handler(async ({ data }) => {
    const { s } = await import("@/lib/services");
    return await s.resources.download(
      data.resourceId,
      data.fileId,
      await getResourceViewer(),
    );
  });

export async function getResourceViewer(getAuth: typeof auth = auth) {
  const { isAuthenticated, sessionClaims, userId } = await getAuth();
  return {
    clerkId: isAuthenticated && userId ? userId : undefined,
    isAdmin: isAuthenticated && getRole(sessionClaims) === "admin",
  };
}

export async function requireResourceUploader(
  getAuth: typeof auth = auth,
): Promise<string> {
  const { isAuthenticated, userId } = await getAuth();
  if (!isAuthenticated || !userId) throw invalidResourceRequest();
  return userId;
}

export async function requireResourceAdmin(
  getAuth: typeof auth = auth,
): Promise<string> {
  const { isAuthenticated, sessionClaims, userId } = await getAuth();
  if (!isAuthenticated || !userId || getRole(sessionClaims) !== "admin") {
    throw invalidResourceRequest();
  }
  return userId;
}

export function parseResourceUpload(input: unknown) {
  if (!(input instanceof FormData)) throw invalidResourceRequest();
  const name = input.get("name");
  const description = input.get("description");
  const files = input.getAll("files");
  const previewValue = input.get("preview");
  const preview = isEmptyFile(previewValue) ? undefined : previewValue;
  const categories = input.getAll("categories");

  if (
    typeof name !== "string" ||
    typeof description !== "string" ||
    files.length === 0 ||
    files.length > 10 ||
    files.some((file) => !isFile(file)) ||
    (preview !== null && preview !== undefined && !isFile(preview)) ||
    categories.length === 0 ||
    categories.some((category) => typeof category !== "string")
  ) {
    throw invalidResourceRequest();
  }

  return {
    categories: categories as string[],
    description,
    files: files as File[],
    name,
    preview: preview ?? undefined,
  };
}

export function parseResourceUpdate(input: unknown) {
  if (!(input instanceof FormData)) throw invalidResourceRequest();
  const resourceId = Number(input.get("resourceId"));
  const name = input.get("name");
  const description = input.get("description");
  const previewValue = input.get("preview");
  const preview = isEmptyFile(previewValue) ? undefined : previewValue;
  const categories = input.getAll("categories");

  if (
    !Number.isSafeInteger(resourceId) ||
    resourceId <= 0 ||
    typeof name !== "string" ||
    typeof description !== "string" ||
    (preview !== null && preview !== undefined && !isFile(preview)) ||
    categories.length === 0 ||
    categories.some((category) => typeof category !== "string")
  ) {
    throw invalidResourceRequest();
  }

  return {
    categories: categories as string[],
    description,
    name,
    preview: preview ?? undefined,
    resourceId,
  };
}

export function parseResourceVersionUpload(input: unknown) {
  if (!(input instanceof FormData)) throw invalidResourceRequest();
  const resourceId = Number(input.get("resourceId"));
  const files = input.getAll("files");
  if (
    !Number.isSafeInteger(resourceId) ||
    resourceId <= 0 ||
    files.length === 0 ||
    files.length > 10 ||
    files.some((file) => !isFile(file))
  ) {
    throw invalidResourceRequest();
  }
  return { files: files as File[], resourceId };
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

export function parseResourceVisibility(input: unknown) {
  const { resourceId } = parseResourceId(input);
  const isPublic = (input as { isPublic?: unknown }).isPublic;
  if (typeof isPublic !== "boolean") throw invalidResourceRequest();
  return { isPublic, resourceId };
}

function getRole(sessionClaims: unknown): string | undefined {
  const claims = sessionClaims as SessionClaimsWithRole | null | undefined;
  return typeof claims?.role === "string" ? claims.role : undefined;
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

function isEmptyFile(value: FormDataEntryValue | null): boolean {
  return (
    typeof File !== "undefined" &&
    value instanceof File &&
    value.name === "" &&
    value.size === 0
  );
}

function invalidResourceRequest(): Error {
  return new Error(formatTranslation("error.generic"));
}
