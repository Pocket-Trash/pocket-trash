import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import {
  buildPreviewImageFolderPath,
  createImageStorage,
  deletePreviewImageFolder,
} from "./index.js";

const bunnyConfig = {
  bunnyStorageAccessKey: "storage-key",
  bunnyStorageEndpoint: "https://ny.storage.bunnycdn.com",
  bunnyStorageZoneName: "pocket-trash-storage",
  cdnBaseUrl: "https://cdn.pocket-trash.app",
};

describe("createImageStorage", () => {
  it("skips image mutations in dry-run mode", async () => {
    const storage = createImageStorage({ dryRun: true });

    await expect(
      storage.uploadRemoteImage({
        fileName: "test.webp",
        sourceUrl: "https://cdn.example.test/image.jpg",
      }),
    ).resolves.toBeNull();
    await expect(
      storage.updateFile("/products/1000/test.webp", {}),
    ).resolves.toBeNull();
    await expect(storage.deleteFile("/products/1000/test.webp")).resolves.toBe(
      "skipped",
    );
    await expect(storage.deleteFolder("/images/preview/pr-52")).resolves.toBe(
      "skipped",
    );
  });

  it("defaults to Bunny and requires Bunny config outside dry-run mode", () => {
    expect(() => createImageStorage({})).toThrow(
      "BUNNY_STORAGE_ACCESS_KEY is required unless dry-run is on.",
    );
  });

  it("rejects unsupported image storage providers", () => {
    expect(() =>
      createImageStorage({
        ...bunnyConfig,
        provider: "imagekit",
      }),
    ).toThrow("Unsupported image storage provider: imagekit.");
  });

  it("overwrites an existing Bunny image with processed dimensions", async () => {
    const sourceImage = await sharp({
      create: {
        background: "red",
        channels: 3,
        height: 300,
        width: 400,
      },
    })
      .jpeg()
      .toBuffer();
    const uploadedBodies: BodyInit[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = toUrl(input);

      if (url.href === "https://cdn.example.test/source-image.jpg") {
        return new Response(sourceImage, {
          headers: { "content-length": String(sourceImage.byteLength) },
        });
      }

      if (
        url.pathname ===
        "/pocket-trash-storage/images/products/pens/123/source-image.webp"
      ) {
        if (init?.body) {
          uploadedBodies.push(init.body);
        }

        return jsonResponse({});
      }

      throw new Error(`Unexpected Bunny request: ${url.href}`);
    });
    const storage = createImageStorage({
      ...bunnyConfig,
      fetch: fetchMock,
    });

    await expect(
      storage.uploadRemoteImage({
        fileName: "source-image.webp",
        folder: "/images/products/pens/123",
        sourceUrl: "https://cdn.example.test/source-image.jpg",
      }),
    ).resolves.toEqual({
      fileId: "/images/products/pens/123/source-image.webp",
      filePath: "/images/products/pens/123/source-image.webp",
      height: 300,
      provider: "bunny",
      thumbnailUrl:
        "https://cdn.pocket-trash.app/images/products/pens/123/source-image.webp?format=webp&quality=85&width=500",
      url: "https://cdn.pocket-trash.app/images/products/pens/123/source-image.webp",
      width: 400,
    });
    expect(uploadedBodies).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uploads an optimized remote image when Bunny does not have the target path", async () => {
    const sourceImage = await sharp({
      create: {
        background: "red",
        channels: 3,
        height: 3_000,
        width: 4_000,
      },
    })
      .jpeg()
      .toBuffer();
    const uploadedBodies: BodyInit[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = toUrl(input);

      if (url.href === "https://cdn.example.test/source-image.jpg") {
        return new Response(sourceImage, {
          headers: { "content-length": String(sourceImage.byteLength) },
        });
      }

      if (url.pathname === "/pocket-trash-storage/images/products/pens/123/") {
        return jsonResponse([]);
      }

      if (
        url.pathname ===
        "/pocket-trash-storage/images/products/pens/123/source-image.webp"
      ) {
        expect(init?.method).toBe("PUT");
        expect(init?.headers).toMatchObject({
          AccessKey: "storage-key",
          "content-type": "image/webp",
        });
        if (init?.body) {
          uploadedBodies.push(init.body);
        }

        return jsonResponse({});
      }

      throw new Error(`Unexpected Bunny request: ${url.href}`);
    });
    const storage = createImageStorage({
      ...bunnyConfig,
      fetch: fetchMock,
    });

    await expect(
      storage.uploadRemoteImage({
        fileName: "source-image.webp",
        folder: "/images/products/pens/123",
        sourceUrl: "https://cdn.example.test/source-image.jpg",
      }),
    ).resolves.toEqual({
      fileId: "/images/products/pens/123/source-image.webp",
      filePath: "/images/products/pens/123/source-image.webp",
      height: 1500,
      provider: "bunny",
      thumbnailUrl:
        "https://cdn.pocket-trash.app/images/products/pens/123/source-image.webp?format=webp&quality=85&width=500",
      url: "https://cdn.pocket-trash.app/images/products/pens/123/source-image.webp",
      width: 2000,
    });
    expect(uploadedBodies).toHaveLength(1);
  });

  it("preserves the Bunny zone when the CDN base URL includes it", async () => {
    const storage = createImageStorage({
      ...bunnyConfig,
      cdnBaseUrl: "https://cdn.pocket-trash.app/",
      fetch: vi.fn<typeof fetch>(),
    });

    await expect(
      storage.updateFile("/dev/products/1000/42143344591035.webp", {}),
    ).resolves.toMatchObject({
      thumbnailUrl:
        "https://cdn.pocket-trash.app/dev/products/1000/42143344591035.webp?format=webp&quality=85&width=500",
      url: "https://cdn.pocket-trash.app/dev/products/1000/42143344591035.webp",
    });
  });

  it("deletes preview image folders", async () => {
    const deletedPaths: string[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = toUrl(input);

      if (url.pathname === "/pocket-trash-storage/images/preview/pr-52/") {
        return jsonResponse([
          {
            IsDirectory: true,
            ObjectName: "products",
          },
        ]);
      }

      if (
        url.pathname === "/pocket-trash-storage/images/preview/pr-52/products/"
      ) {
        return jsonResponse([
          {
            IsDirectory: false,
            ObjectName: "image.webp",
          },
        ]);
      }

      if (
        url.pathname ===
        "/pocket-trash-storage/images/preview/pr-52/products/image.webp"
      ) {
        expect(init?.method).toBe("DELETE");
        deletedPaths.push(url.pathname);

        return jsonResponse({});
      }

      throw new Error(`Unexpected Bunny request: ${url.href}`);
    });

    await expect(
      deletePreviewImageFolder({
        ...bunnyConfig,
        fetch: fetchMock,
        prNumber: 52,
      }),
    ).resolves.toEqual({
      folderPath: "/images/preview/pr-52",
      status: "deleted",
    });
    expect(deletedPaths).toEqual([
      "/pocket-trash-storage/images/preview/pr-52/products/image.webp",
    ]);
  });

  it("treats missing preview image folders as already cleaned up", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = toUrl(input);

      if (url.pathname === "/pocket-trash-storage/images/preview/pr-52/") {
        return jsonResponse({ message: "Not Found" }, 404);
      }

      throw new Error(`Unexpected Bunny request: ${url.href}`);
    });

    await expect(
      deletePreviewImageFolder({
        ...bunnyConfig,
        fetch: fetchMock,
        prNumber: 52,
      }),
    ).resolves.toEqual({
      folderPath: "/images/preview/pr-52",
      status: "missing",
    });
  });

  it("treats empty preview image folders as cleaned up", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = toUrl(input);

      if (url.pathname === "/pocket-trash-storage/images/preview/pr-52/") {
        return jsonResponse([]);
      }

      throw new Error(`Unexpected Bunny request: ${url.href}`);
    });

    await expect(
      deletePreviewImageFolder({
        ...bunnyConfig,
        fetch: fetchMock,
        prNumber: 52,
      }),
    ).resolves.toEqual({
      folderPath: "/images/preview/pr-52",
      status: "deleted",
    });
  });

  it("reports missing files separately from deleted files", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = toUrl(input);

      if (
        url.pathname ===
        "/pocket-trash-storage/images/products/pens/123/image.webp"
      ) {
        expect(init?.method).toBe("DELETE");

        return jsonResponse({ message: "Not Found" }, 404);
      }

      throw new Error(`Unexpected Bunny request: ${url.href}`);
    });
    const storage = createImageStorage({
      ...bunnyConfig,
      fetch: fetchMock,
    });

    await expect(
      storage.deleteFile("/images/products/pens/123/image.webp"),
    ).resolves.toBe("missing");
  });

  it("stops reading remote images after the configured byte limit", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = toUrl(input);

      if (url.href === "https://cdn.example.test/source-image.jpg") {
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array(4));
              controller.enqueue(new Uint8Array(4));
              controller.close();
            },
          }),
        );
      }

      throw new Error(`Unexpected Bunny request: ${url.href}`);
    });
    const storage = createImageStorage({
      ...bunnyConfig,
      fetch: fetchMock,
      remoteImageMaxBytes: 6,
    });

    await expect(
      storage.uploadRemoteImage({
        fileName: "source-image.webp",
        folder: "/images/products/pens/123",
        sourceUrl: "https://cdn.example.test/source-image.jpg",
      }),
    ).rejects.toThrow(
      "Remote image is larger than the configured maximum size.",
    );
  });

  it("aborts remote image fetches after the configured timeout", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async (_input, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(
              new DOMException("The operation was aborted.", "AbortError"),
            );
          });
        }),
    );
    const storage = createImageStorage({
      ...bunnyConfig,
      fetch: fetchMock,
      fetchTimeoutMs: 1,
    });

    await expect(
      storage.uploadRemoteImage({
        fileName: "source-image.webp",
        folder: "/images/products/pens/123",
        sourceUrl: "https://cdn.example.test/source-image.jpg",
      }),
    ).rejects.toThrow("The operation was aborted.");
  });

  it("aborts remote image body reads after the configured timeout", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = toUrl(input);

      if (url.href === "https://cdn.example.test/source-image.jpg") {
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array(1));
            },
          }),
        );
      }

      throw new Error(`Unexpected Bunny request: ${url.href}`);
    });
    const storage = createImageStorage({
      ...bunnyConfig,
      fetch: fetchMock,
      fetchTimeoutMs: 1,
    });

    await expect(
      storage.uploadRemoteImage({
        fileName: "source-image.webp",
        folder: "/images/products/pens/123",
        sourceUrl: "https://cdn.example.test/source-image.jpg",
      }),
    ).rejects.toThrow("The operation was aborted.");
  });

  it("only builds positive PR preview folder paths", () => {
    expect(buildPreviewImageFolderPath(52)).toBe("/images/preview/pr-52");
    expect(() => buildPreviewImageFolderPath(0)).toThrow(
      "Image preview cleanup requires a positive PR number.",
    );
  });

  it("refuses to delete non-PR image folders", async () => {
    const storage = createImageStorage({
      ...bunnyConfig,
      fetch: vi.fn<typeof fetch>(),
    });

    await expect(storage.deleteFolder("/images/preview")).rejects.toThrow(
      "Image preview cleanup can only delete /images/preview/pr-<number> folders.",
    );
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function toUrl(input: Parameters<typeof fetch>[0]): URL {
  if (typeof input === "string") {
    return new URL(input);
  }

  if (input instanceof URL) {
    return input;
  }

  return new URL(input.url);
}
