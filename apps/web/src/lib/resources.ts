import { auth } from "@clerk/tanstack-react-start/server";
import { formatTranslation } from "@pocket-trash/localizations";
import { createServerFn } from "@tanstack/react-start";

type ResourceIdInput = { resourceId: number };
type ResourceDownloadInput = ResourceIdInput & { versionId: number };

export const createResource = createServerFn({ method: "POST" })
  .validator(parseResourceUpload)
  .handler(async ({ data }) => {
    const userId = await requireResourceUploader();
    const { s } = await import("@/lib/services");

    return await s.resources.create({
      ...data,
      file: await toUploadInput(data.file),
      preview: data.preview ? await toUploadInput(data.preview) : undefined,
      uploaderClerkId: userId,
    });
  });

export const getResourceDetail = createServerFn({ method: "GET" })
  .validator(parseResourceId)
  .handler(async ({ data }) => {
    const { s } = await import("@/lib/services");
    return await s.resources.getDetail(data.resourceId);
  });

export const getOwnedResourceDetail = createServerFn({ method: "GET" })
  .validator(parseResourceId)
  .handler(async ({ data }) => {
    const userId = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    const detail = await s.resources.getDetail(data.resourceId);
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
    return await s.resources.listDirectory(data.categorySlugs);
  });

export const listOwnedResources = createServerFn({ method: "GET" }).handler(
  async () => {
    const userId = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.resources.listOwned(userId);
  },
);

export const updateResource = createServerFn({ method: "POST" })
  .validator(parseResourceUpdate)
  .handler(async ({ data }) => {
    const userId = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.resources.update({
      ...data,
      preview: data.preview ? await toUploadInput(data.preview) : undefined,
      uploaderClerkId: userId,
    });
  });

export const uploadResourceVersion = createServerFn({ method: "POST" })
  .validator(parseResourceVersionUpload)
  .handler(async ({ data }) => {
    const userId = await requireResourceUploader();
    const { s } = await import("@/lib/services");
    return await s.resources.addVersion({
      file: await toUploadInput(data.file),
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
    return await s.resources.download(data.resourceId, data.versionId);
  });

export async function requireResourceUploader(
  getAuth: typeof auth = auth,
): Promise<string> {
  const { isAuthenticated, userId } = await getAuth();
  if (!isAuthenticated || !userId) throw invalidResourceRequest();
  return userId;
}

export function parseResourceUpload(input: unknown) {
  if (!(input instanceof FormData)) throw invalidResourceRequest();
  const name = input.get("name");
  const description = input.get("description");
  const file = input.get("file");
  const previewValue = input.get("preview");
  const preview = isEmptyFile(previewValue) ? undefined : previewValue;
  const categories = input.getAll("categories");

  if (
    typeof name !== "string" ||
    typeof description !== "string" ||
    !isFile(file) ||
    (preview !== null && preview !== undefined && !isFile(preview)) ||
    categories.length === 0 ||
    categories.some((category) => typeof category !== "string")
  ) {
    throw invalidResourceRequest();
  }

  return {
    categories: categories as string[],
    description,
    file,
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
  const file = input.get("file");
  if (!Number.isSafeInteger(resourceId) || resourceId <= 0 || !isFile(file)) {
    throw invalidResourceRequest();
  }
  return { file, resourceId };
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
  const versionId = Number((input as { versionId?: unknown }).versionId);
  if (!Number.isSafeInteger(versionId) || versionId <= 0) {
    throw invalidResourceRequest();
  }
  return { resourceId, versionId };
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
