import type { TranslationKey } from "@pocket-trash/localizations";
import { clientEnv } from "@/env/client";

const maxFiles = 20;
const maxFileBytes = 25 * 1024 * 1024;
const maxTotalBytes = 200 * 1024 * 1024;
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export type CatalogImageUploadError = {
  key: TranslationKey;
  params?: Record<string, number | string>;
};

export function validateCatalogImages(
  files: File[],
): CatalogImageUploadError | undefined {
  if (files.length > maxFiles) {
    return {
      key: "web.resources.validation.tooManyImages",
      params: { maxImages: maxFiles },
    };
  }
  if (files.reduce((total, file) => total + file.size, 0) > maxTotalBytes) {
    return {
      key: "web.resources.validation.sessionTooLarge",
      params: { maxSize: "200 MiB" },
    };
  }
  for (const file of files) {
    if (!imageTypes.has(file.type))
      return { key: "web.resources.validation.imageInvalidType" };
    if (file.size > maxFileBytes) {
      return {
        key: "web.resources.validation.imageTooLarge",
        params: { maxSize: "25 MiB" },
      };
    }
  }
}

export async function uploadCatalogImages(input: {
  files: File[];
  getToken(): Promise<string | null>;
  onOwnerDeletedDuplicate?(imageId: number): Promise<boolean>;
  targetId: number;
  targetType: "collection_item" | "product";
}): Promise<{ failed: File[]; uploaded: File[] }> {
  if (!input.files.length)
    return { failed: [] as File[], uploaded: [] as File[] };
  const validation = validateCatalogImages(input.files);
  if (validation) throw validation;
  const token = await input.getToken();
  if (!token) throw { key: "error.generic" } satisfies CatalogImageUploadError;
  const files = await Promise.all(
    input.files.map(async (file) => ({
      contentType: file.type,
      file,
      fileName: file.name,
      sha256: await sha256(file),
      size: file.size,
    })),
  );
  if (new Set(files.map(({ sha256: hash }) => hash)).size !== files.length) {
    throw {
      key: "web.resources.upload.sessionFailure",
    } satisfies CatalogImageUploadError;
  }
  const baseUrl = `${clientEnv.VITE_API_URL.replace(/\/$/u, "")}/api/v0/catalog-image-upload-sessions`;
  const response = await fetch(baseUrl, {
    body: JSON.stringify({
      files: files.map(({ contentType, fileName, sha256: hash, size }) => ({
        contentType,
        fileName,
        sha256: hash,
        size,
      })),
      targetId: input.targetId,
      targetType: input.targetType,
    }),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      imageId?: number;
      sha256?: string;
    };
    if (
      body.error === "duplicate_owner_deleted" &&
      body.imageId &&
      body.sha256 &&
      input.onOwnerDeletedDuplicate &&
      (await input.onOwnerDeletedDuplicate(body.imageId))
    ) {
      const restored = files.find(
        ({ sha256: hash }) => hash === body.sha256,
      )?.file;
      const remaining = files
        .filter(({ sha256: hash }) => hash !== body.sha256)
        .map(({ file }) => file);
      const result = await uploadCatalogImages({ ...input, files: remaining });
      return {
        failed: result.failed,
        uploaded: [...(restored ? [restored] : []), ...result.uploaded],
      };
    }
    throw {
      key: "web.resources.upload.sessionFailure",
    } satisfies CatalogImageUploadError;
  }
  const session = (await response.json()) as {
    id: string;
    uploads: Array<{ fileName: string; id: string }>;
  };
  const results = await Promise.all(
    session.uploads.map(async (upload) => {
      const file = files.find(
        ({ fileName }) => fileName === upload.fileName,
      )?.file;
      if (!file) return null;
      const uploadResponse = await fetch(
        `${baseUrl}/${encodeURIComponent(session.id)}/files/${encodeURIComponent(upload.id)}`,
        {
          body: file,
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": file.type,
          },
          method: "PUT",
        },
      );
      return { file, uploaded: uploadResponse.ok };
    }),
  );
  await fetch(`${baseUrl}/${encodeURIComponent(session.id)}/complete`, {
    headers: { authorization: `Bearer ${token}` },
    method: "POST",
  });
  return {
    failed: results.flatMap((result) =>
      result && !result.uploaded ? [result.file] : [],
    ),
    uploaded: results.flatMap((result) =>
      result?.uploaded ? [result.file] : [],
    ),
  };
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
