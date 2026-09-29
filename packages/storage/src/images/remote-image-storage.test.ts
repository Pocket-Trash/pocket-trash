import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { createImageStorage } from "../index.js";
import { sha256 } from "../object-paths.js";

const bunnyConfig = {
  accessKey: "storage-key",
  endpoint: "https://ny.storage.bunnycdn.com",
  zoneName: "pocket-trash-storage",
  cdnBaseUrl: "https://cdn.pocket-trash.app",
};

describe("createImageStorage", () => {
  it.each([
    undefined,
    "",
    "image..id",
    "gid://shopify/ProductImage/1",
    "123",
    "safe_ID-1",
  ])("uses safe IDs or byte hashes for upstream ID %s", async (sourceImageId) => {
    const bytes = await sharp({
      create: { width: 1, height: 1, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const puts: string[] = [];
    const storage = createImageStorage({
      ...bunnyConfig,
      fetch: async (input, init) => {
        if (init?.method === "PUT") {
          puts.push(toUrl(input).pathname);
          return new Response(null, { status: 201 });
        }
        return new Response(bytes, {
          headers: {
            "content-length": String(bytes.length),
            "content-type": "image/png",
          },
        });
      },
    });
    await storage.uploadRemoteImage({
      prefix: "images/dev",
      entity: "products",
      entityId: 1000,
      sourceImageId,
      sourceUrl: "https://source.test/image.png",
    });
    const expected =
      sourceImageId === "123" || sourceImageId === "safe_ID-1"
        ? sourceImageId
        : await sha256(bytes);
    expect(puts).toEqual([
      `/pocket-trash-storage/images/dev/products/1000/${expected}.png`,
    ]);
  });

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
  });

  it("defaults to Bunny and requires Bunny config outside dry-run mode", () => {
    expect(() => createImageStorage({})).toThrow(
      "BUNNY_STORAGE_ACCESS_KEY is required.",
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

  it("overwrites an existing Bunny image with original bytes and dimensions", async () => {
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
        "/pocket-trash-storage/images/products/pens/123/source-image.jpg"
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
        fileName: "source-image.jpg",
        folder: "/images/products/pens/123",
        sourceUrl: "https://cdn.example.test/source-image.jpg",
      }),
    ).resolves.toEqual({
      fileId: "/images/products/pens/123/source-image.jpg",
      filePath: "/images/products/pens/123/source-image.jpg",
      height: 300,
      provider: "bunny",
      thumbnailUrl:
        "https://cdn.pocket-trash.app/images/products/pens/123/source-image.jpg?format=webp&quality=85&width=500",
      url: "https://cdn.pocket-trash.app/images/products/pens/123/source-image.jpg?format=webp&quality=85",
      width: 400,
    });
    expect(uploadedBodies).toHaveLength(1);
    expect(
      new Uint8Array(await new Response(uploadedBodies[0]).arrayBuffer()),
    ).toEqual(new Uint8Array(sourceImage));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uploads an original remote image when Bunny does not have the target path", async () => {
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
        "/pocket-trash-storage/images/products/pens/123/source-image.jpg"
      ) {
        expect(init?.method).toBe("PUT");
        expect(init?.headers).toMatchObject({
          AccessKey: "storage-key",
          "content-type": "image/jpeg",
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
        fileName: "source-image.jpg",
        folder: "/images/products/pens/123",
        sourceUrl: "https://cdn.example.test/source-image.jpg",
      }),
    ).resolves.toEqual({
      fileId: "/images/products/pens/123/source-image.jpg",
      filePath: "/images/products/pens/123/source-image.jpg",
      height: 3000,
      provider: "bunny",
      thumbnailUrl:
        "https://cdn.pocket-trash.app/images/products/pens/123/source-image.jpg?format=webp&quality=85&width=500",
      url: "https://cdn.pocket-trash.app/images/products/pens/123/source-image.jpg?format=webp&quality=85",
      width: 4000,
    });
    expect(uploadedBodies).toHaveLength(1);
    expect(
      new Uint8Array(await new Response(uploadedBodies[0]).arrayBuffer()),
    ).toEqual(new Uint8Array(sourceImage));
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
      url: "https://cdn.pocket-trash.app/dev/products/1000/42143344591035.webp?format=webp&quality=85",
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
        fileName: "source-image.jpg",
        folder: "/images/products/pens/123",
        sourceUrl: "https://cdn.example.test/source-image.jpg",
      }),
    ).rejects.toThrow("Response body exceeds the size limit.");
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
        fileName: "source-image.jpg",
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
        fileName: "source-image.jpg",
        folder: "/images/products/pens/123",
        sourceUrl: "https://cdn.example.test/source-image.jpg",
      }),
    ).rejects.toThrow("The operation was aborted.");
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
