import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import {
  buildResourceFolderPrefix,
  createUncompressedZip,
  createUploadStorage,
  sha256,
  signResourceUrl,
  type UploadInput,
  type UploadStorage,
} from "../index.js";

/** Stable digest used by upload storage fixtures. */
const hash = await sha256(new Uint8Array([1, 2, 3]));
/** Complete Bunny configuration used by upload storage tests. */
const config = {
  accessKey: "storage-key",
  apiKey: "account-key",
  cdnBaseUrl: "https://cdn.pocket-trash.app",
  endpoint: "https://ny.storage.bunnycdn.com",
  folderPrefix: "resources/dev",
  imageFolderPrefix: "images/dev",
  pullZoneId: 123,
  tokenKey: "cdn-token-key",
  zoneName: "pocket-trash-storage",
};

describe("resource storage", () => {
  it("streams an uncompressed ZIP with root files in stored order", async () => {
    const firstBytes = new Uint8Array([1, 2, 3]);
    const secondBytes = new TextEncoder().encode("notes");
    const files = [
      { bytes: firstBytes, fileName: "first.stl" },
      { bytes: secondBytes, fileName: "notes.txt" },
    ];
    const archive = createUncompressedZip(
      files.map(({ bytes, fileName }) => ({
        fileName,
        /**
         * Opens the fixture body stream.
         *
         * @returns A stream over the fixture bytes.
         */
        open: async () => new Blob([bytes]).stream(),
        size: bytes.byteLength,
      })),
    );
    const bytes = new Uint8Array(
      await new Response(archive.body).arrayBuffer(),
    );
    const view = new DataView(bytes.buffer);
    const firstNameLength = view.getUint16(26, true);
    const firstDataOffset = 30 + firstNameLength;
    const secondHeaderOffset = firstDataOffset + firstBytes.length + 16;
    const secondNameLength = view.getUint16(secondHeaderOffset + 26, true);
    const secondDataOffset = secondHeaderOffset + 30 + secondNameLength;

    expect(bytes.byteLength).toBe(archive.contentLength);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(new TextDecoder().decode(bytes.slice(30, firstDataOffset))).toBe(
      "first.stl",
    );
    expect(bytes.slice(firstDataOffset, firstDataOffset + 3)).toEqual(
      firstBytes,
    );
    expect(view.getUint32(firstDataOffset + 3, true)).toBe(0x08074b50);
    expect(view.getUint32(firstDataOffset + 7, true)).toBe(0x55bc801d);
    expect(view.getUint32(secondHeaderOffset, true)).toBe(0x04034b50);
    expect(
      new TextDecoder().decode(
        bytes.slice(secondHeaderOffset + 30, secondDataOffset),
      ),
    ).toBe("notes.txt");
    expect(
      new TextDecoder().decode(
        bytes.slice(secondDataOffset, secondDataOffset + secondBytes.length),
      ),
    ).toBe("notes");
    expect(view.getUint32(bytes.byteLength - 22, true)).toBe(0x06054b50);
  });

  it("signs one exact URL for 120 seconds, including decoded spaces", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T00:00:00Z"));

    await expect(
      signResourceUrl({
        cdnBaseUrl: config.cdnBaseUrl,
        objectPath: "resources/files/GUIDE TRIM TOOL_No-Text.stl",
        tokenKey: "SecurityKey",
      }),
    ).resolves.toBe(
      "https://cdn.pocket-trash.app/resources/files/GUIDE%20TRIM%20TOOL_No-Text.stl?token=HS256-0A4ptLSSga50TjJtK9zDMr-nesE6Ax0ArcdvIwj3bis&expires=1789603320",
    );

    vi.useRealTimers();
  });

  it("selects the object namespace for each deployment environment", () => {
    expect(buildResourceFolderPrefix({ environment: "production" })).toBe(
      "resources/files",
    );
    expect(buildResourceFolderPrefix({ environment: "development" })).toBe(
      "resources/dev",
    );
    expect(buildResourceFolderPrefix({ environment: "preview" })).toBe(
      "resources/preview",
    );
    expect(
      buildResourceFolderPrefix({
        environment: "preview",
        isolatedPreviewPrNumber: 52,
      }),
    ).toBe("resources/preview/pr-52");
  });

  it("creates isolated preview images as copy-on-write objects", () => {
    const storage = createUploadStorage({
      ...config,
      imageFolderPrefix: "images/preview/pr-42",
    });

    expect(
      storage.createImageTarget(
        {
          contentType: "image/png",
          fileName: "replacement.png",
          sha256: hash,
          size: 3,
        },
        { entity: "products", entityId: 1000 },
      ),
    ).toMatchObject({
      objectPath: `images/preview/pr-42/products/1000/${hash}.png`,
      url: `https://cdn.pocket-trash.app/images/preview/pr-42/products/1000/${hash}.png?format=webp&quality=85`,
    });
  });

  it("uploads an allowed file without accepting an object path", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      expect(toUrl(input).href).toBe(
        `https://ny.storage.bunnycdn.com/pocket-trash-storage/resources/dev/1005/v1/${hash}.stl`,
      );
      expect(init).toMatchObject({
        body: expect.any(ReadableStream),
        headers: {
          AccessKey: "storage-key",
          "content-type": "application/octet-stream",
        },
        method: "PUT",
      });

      return new Response(null, { status: 201 });
    });
    const storage = createUploadStorage({ ...config, fetch: fetchMock });

    await expect(
      putFile(
        storage,
        {
          bytes: new Uint8Array([1, 2, 3]),
          contentType: "application/octet-stream",
          fileName: "clip.stl",
        },
        1005,
      ),
    ).resolves.toMatchObject({
      contentType: "application/octet-stream",
      fileName: "clip.stl",
      objectPath: `resources/dev/1005/v1/${hash}.stl`,
      size: 3,
      url: `https://cdn.pocket-trash.app/resources/dev/1005/v1/${hash}.stl`,
    });
  });

  it("creates a server-owned target and streams a fixed-length body", async () => {
    const body = new ReadableStream({
      /**
       * Enqueues the fixed upload fixture.
       *
       * @param controller - Stream controller receiving fixture bytes.
       */
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      expect(toUrl(input).pathname).toBe(
        `/pocket-trash-storage/resources/dev/1005/v1/${hash}.stl`,
      );
      expect(init).toMatchObject({
        body,
        headers: {
          AccessKey: "storage-key",
          "content-length": "3",
          "content-type": "application/octet-stream",
        },
        method: "PUT",
      });
      return new Response(null, { status: 201 });
    });
    const storage = createUploadStorage({ ...config, fetch: fetchMock });
    const target = storage.createFileTarget(
      {
        contentType: "application/octet-stream",
        fileName: "clip.stl",
        size: 3,
        sha256: hash,
      },
      { resourceId: 1005, version: 1 },
    );

    expect(target.objectPath).toBe(`resources/dev/1005/v1/${hash}.stl`);
    await expect(
      storage.putFile({
        body,
        contentLength: 3,
        contentType: target.contentType,
        objectPath: target.objectPath,
      }),
    ).resolves.toBeUndefined();
  });

  it("creates uniquely named archive candidates and reads stored objects", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      expect(toUrl(input).pathname).toBe(
        "/pocket-trash-storage/resources/dev/1005/source.stl",
      );
      expect(init?.method).toBe("GET");
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    });
    const storage = createUploadStorage({ ...config, fetch: fetchMock });

    expect(storage.createArchiveTarget(1005, 3, 123)).toEqual({
      contentType: "application/zip",
      fileName: "resource-1005-v3.zip",
      objectPath: expect.stringMatching(
        /^resources\/dev\/1005\/archives\/[a-f0-9-]+\/resource-1005-v3\.zip$/u,
      ),
      size: 123,
      url: expect.stringMatching(
        /^https:\/\/cdn\.pocket-trash\.app\/resources\/dev\/1005\/archives\/[a-f0-9-]+\/resource-1005-v3\.zip$/u,
      ),
    });
    await expect(
      new Response(await storage.readFile("resources/dev/1005/source.stl"))
        .arrayBuffer()
        .then((bytes) => [...new Uint8Array(bytes)]),
    ).resolves.toEqual([1, 2, 3]);
  });

  it("calls the Workers runtime fetch without rebinding it", async () => {
    const runtimeFetch = vi.fn(async function (this: unknown) {
      if (this && typeof this === "object" && "accessKey" in this) {
        throw new TypeError("Illegal invocation");
      }
      return new Response(null, { status: 201 });
    });
    vi.stubGlobal("fetch", runtimeFetch);

    try {
      const storage = createUploadStorage(config);
      await expect(
        storage.putFile({
          body: new ReadableStream(),
          contentLength: 3,
          contentType: "application/octet-stream",
          objectPath: "resources/dev/resource.stl",
        }),
      ).resolves.toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("creates a valid Node request for a streamed upload", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      new Request(input, init);
      return new Response(null, { status: 201 });
    });
    const storage = createUploadStorage({ ...config, fetch: fetchMock });

    await expect(
      storage.putFile({
        body: new Blob([new Uint8Array([1, 2, 3])]).stream(),
        contentLength: 3,
        contentType: "application/octet-stream",
        objectPath: "resources/dev/resource.stl",
      }),
    ).resolves.toBeUndefined();
  });

  it("accepts octet-stream for every supported resource extension", () => {
    const storage = createUploadStorage(config);

    for (const extension of [
      "3mf",
      "pdf",
      "step",
      "stl",
      "stp",
      "txt",
      "zip",
    ]) {
      expect(() =>
        storage.createFileTarget(
          {
            contentType: "application/octet-stream",
            fileName: `resource.${extension}`,
            size: 1,
            sha256: hash,
          },
          { resourceId: 1005, version: 1 },
        ),
      ).not.toThrow();
    }
  });

  it("uploads a resource image through a separate allowlist", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      expect(toUrl(input).pathname).toMatch(
        /^\/pocket-trash-storage\/images\/dev\/resources\/1005\/[a-f0-9]{64}\.png$/u,
      );
      expect(init?.headers).toMatchObject({ "content-type": "image/png" });
      const bytes = await new Response(init?.body).arrayBuffer();
      expect(await sharp(bytes).metadata()).toMatchObject({
        format: "png",
        width: 3000,
        height: 1500,
        hasAlpha: true,
      });
      return new Response(null, { status: 201 });
    });
    const storage = createUploadStorage({ ...config, fetch: fetchMock });

    await expect(
      putImage(
        storage,
        {
          bytes: await sharp({
            create: {
              width: 3000,
              height: 1500,
              channels: 4,
              background: { r: 255, g: 0, b: 0, alpha: 0.5 },
            },
          })
            .png()
            .toBuffer(),
          contentType: "image/png",
          fileName: "clip.png",
        },
        1005,
      ),
    ).resolves.toMatchObject({
      contentType: "image/png",
      fileName: "clip.png",
      objectPath: expect.stringMatching(
        /^images\/dev\/resources\/1005\/[a-f0-9]{64}\.png$/u,
      ),
    });

    await expect(
      putFile(
        storage,
        {
          bytes: new Uint8Array([1]),
          contentType: "image/gif",
          fileName: "clip.gif",
        },
        1005,
      ),
    ).rejects.toThrow("Upload file extension and MIME type do not match.");
  });

  it("rejects oversized, mismatched, and unsafe uploads before Bunny", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const storage = createUploadStorage({ ...config, fetch: fetchMock });

    await expect(
      putFile(
        storage,
        {
          bytes: new Uint8Array(20 * 1024 * 1024 + 1),
          contentType: "model/stl",
          fileName: "clip.stl",
        },
        1005,
      ),
    ).rejects.toThrow("Upload file exceeds the configured size limit.");
    await expect(
      putFile(
        storage,
        {
          bytes: new Uint8Array([1]),
          contentType: "application/pdf",
          fileName: "clip.stl",
        },
        1005,
      ),
    ).rejects.toThrow("Upload file extension and MIME type do not match.");
    await expect(
      putFile(
        storage,
        {
          bytes: new Uint8Array([1]),
          contentType: "model/stl",
          fileName: "../clip.stl",
        },
        1005,
      ),
    ).rejects.toThrow("Upload file name is unsafe.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes only objects in the configured namespace", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      expect(toUrl(input).pathname).toBe(
        "/pocket-trash-storage/resources/dev/resource.stl",
      );
      expect(init?.method).toBe("DELETE");
      return new Response(null, { status: 200 });
    });
    const storage = createUploadStorage({ ...config, fetch: fetchMock });

    await expect(storage.delete("resources/dev/resource.stl")).resolves.toBe(
      "deleted",
    );
    await expect(
      storage.delete("resources/files/resource.stl"),
    ).rejects.toThrow(
      "Upload object path is outside the configured namespace.",
    );
  });

  it("deletes an erasure target, purges its exact CDN URL, and proves it is gone", async () => {
    const objectPath = "images/dev/collections/1005/photo.png";
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = toUrl(input);
      if (url.pathname === "/pullzone/123") {
        expect(init).toMatchObject({
          headers: { AccessKey: "account-key" },
          method: "GET",
        });
        return Response.json({ PermaCacheStorageZoneId: 0 });
      }
      if (url.pathname === "/purge") {
        expect(init).toMatchObject({
          headers: { AccessKey: "account-key" },
          method: "POST",
        });
        expect(url.searchParams.get("url")).toBe(
          `https://cdn.pocket-trash.app/${objectPath}`,
        );
        expect(url.searchParams.get("async")).toBe("false");
        return new Response(null, { status: 204 });
      }
      if (url.hostname === "cdn.pocket-trash.app") {
        expect(url.pathname).toBe(`/${objectPath}`);
        expect(url.searchParams.get("token")).toMatch(/^HS256-/u);
        return new Response(null, { status: 404 });
      }
      expect(url.pathname).toBe(`/pocket-trash-storage/${objectPath}`);
      return new Response(null, {
        status: init?.method === "DELETE" ? 200 : 404,
      });
    });
    const storage = createUploadStorage({ ...config, fetch: fetchMock });

    await expect(storage.assertErasureReady()).resolves.toBeUndefined();
    await expect(storage.erase(objectPath)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("fails closed for Perma-Cache and product objects", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ PermaCacheStorageZoneId: 456 }),
    );
    const storage = createUploadStorage({ ...config, fetch: fetchMock });

    await expect(storage.assertErasureReady()).rejects.toThrow(
      "Bunny Perma-Cache must be disabled before erasure.",
    );
    await expect(
      storage.erase("images/dev/products/1005/photo.png"),
    ).rejects.toThrow("Object path is outside an erasable namespace.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

/**
 * Normalizes a Fetch input into a URL for assertions.
 *
 * @param input - Fetch URL, request, or URL object.
 * @returns Parsed request URL.
 * @throws When a string or request URL is invalid.
 */
function toUrl(input: Parameters<typeof fetch>[0]): URL {
  if (typeof input === "string") {
    return new URL(input);
  }

  if (input instanceof URL) {
    return input;
  }

  return new URL(input.url);
}

/**
 * Uploads a resource file in storage tests.
 *
 * @param storage - Upload storage under test.
 * @param input - File metadata and bytes.
 * @param resourceId - Target resource identifier.
 * @returns The created file target.
 * @rejects When the response body is unavailable or storage rejects the upload.
 */
async function putFile(
  storage: UploadStorage,
  input: UploadInput,
  resourceId: number,
) {
  const target = storage.createFileTarget(
    { ...input, size: input.bytes.length, sha256: await sha256(input.bytes) },
    { resourceId, version: 1 },
  );
  const body = new Response(new Uint8Array(input.bytes)).body;
  if (!body) throw new Error("No response body");
  await storage.putFile({
    body,
    contentLength: target.size,
    contentType: target.contentType,
    objectPath: target.objectPath,
  });
  return target;
}

/**
 * Uploads a resource image in storage tests.
 *
 * @param storage - Upload storage under test.
 * @param input - Image metadata and bytes.
 * @param resourceId - Target resource identifier.
 * @returns The created image target.
 * @rejects When hashing, image validation, or storage upload fails.
 */
async function putImage(
  storage: UploadStorage,
  input: UploadInput,
  resourceId: number,
) {
  const target = storage.createImageTarget(
    { ...input, size: input.bytes.length, sha256: await sha256(input.bytes) },
    { entity: "resources", entityId: resourceId },
  );
  await storage.putImage({
    body: input.bytes,
    contentLength: target.size,
    contentType: target.contentType,
    objectPath: target.objectPath,
  });
  return target;
}
