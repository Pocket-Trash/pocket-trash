import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import {
  buildResourceFolderPrefix,
  createUploadStorage,
  sha256,
  signResourceUrl,
  type UploadInput,
  type UploadStorage,
} from "../index.js";

const hash = await sha256(new Uint8Array([1, 2, 3]));
const config = {
  accessKey: "storage-key",
  cdnBaseUrl: "https://cdn.pocket-trash.app",
  endpoint: "https://ny.storage.bunnycdn.com",
  folderPrefix: "resources/dev",
  imageFolderPrefix: "images/dev",
  zoneName: "pocket-trash-storage",
};

describe("resource storage", () => {
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
});

function toUrl(input: Parameters<typeof fetch>[0]): URL {
  if (typeof input === "string") {
    return new URL(input);
  }

  if (input instanceof URL) {
    return input;
  }

  return new URL(input.url);
}

async function putFile(
  storage: UploadStorage,
  input: UploadInput,
  resourceId: number,
) {
  const target = storage.createFileTarget(
    { ...input, size: input.bytes.length, sha256: await sha256(input.bytes) },
    { resourceId, version: 1 },
  );
  await storage.putFile({
    body: new Response(new Uint8Array(input.bytes)).body!,
    contentLength: target.size,
    contentType: target.contentType,
    objectPath: target.objectPath,
  });
  return target;
}
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
