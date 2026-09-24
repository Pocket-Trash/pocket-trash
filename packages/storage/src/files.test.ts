import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import {
  buildResourceFolderPrefix,
  createStorage,
  deletePreviewResourceFolder,
  signResourceUrl,
} from "./index.js";

const config = {
  accessKey: "storage-key",
  cdnBaseUrl: "https://cdn.pocket-trash.app",
  endpoint: "https://ny.storage.bunnycdn.com",
  folderPrefix: "resources/dev",
  randomUUID: () => "00000000-0000-4000-8000-000000000001",
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
        "https://ny.storage.bunnycdn.com/pocket-trash-storage/resources/dev/1005/00000000-0000-4000-8000-000000000001.stl",
      );
      expect(init).toMatchObject({
        body: new Uint8Array([1, 2, 3]),
        headers: {
          AccessKey: "storage-key",
          "content-type": "application/octet-stream",
        },
        method: "PUT",
      });

      return new Response(null, { status: 201 });
    });
    const storage = createStorage({ ...config, fetch: fetchMock });

    await expect(
      storage.upload(
        {
          bytes: new Uint8Array([1, 2, 3]),
          contentType: "application/octet-stream",
          fileName: "clip.stl",
        },
        1005,
      ),
    ).resolves.toEqual({
      contentType: "application/octet-stream",
      fileName: "clip.stl",
      objectPath: "resources/dev/1005/00000000-0000-4000-8000-000000000001.stl",
      size: 3,
      url: "https://cdn.pocket-trash.app/resources/dev/1005/00000000-0000-4000-8000-000000000001.stl",
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
        "/pocket-trash-storage/resources/dev/1005/00000000-0000-4000-8000-000000000001.stl",
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
    const storage = createStorage({ ...config, fetch: fetchMock });
    const target = storage.createUploadTarget(
      {
        contentType: "application/octet-stream",
        fileName: "clip.stl",
        size: 3,
      },
      1005,
    );

    expect(target.objectPath).toBe(
      "resources/dev/1005/00000000-0000-4000-8000-000000000001.stl",
    );
    await expect(
      storage.uploadStream({
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
      const storage = createStorage(config);
      await expect(
        storage.uploadStream({
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
    const storage = createStorage(config);

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
        storage.createUploadTarget(
          {
            contentType: "application/octet-stream",
            fileName: `resource.${extension}`,
            size: 1,
          },
          1005,
        ),
      ).not.toThrow();
    }
  });

  it("uploads a resource image through a separate allowlist", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      expect(toUrl(input).pathname).toBe(
        "/pocket-trash-storage/resources/dev/1005/00000000-0000-4000-8000-000000000001.png",
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
    const storage = createStorage({ ...config, fetch: fetchMock });

    await expect(
      storage.uploadImage(
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
      objectPath: "resources/dev/1005/00000000-0000-4000-8000-000000000001.png",
    });

    await expect(
      storage.upload(
        {
          bytes: new Uint8Array([1]),
          contentType: "image/png",
          fileName: "clip.png",
        },
        1005,
      ),
    ).rejects.toThrow("Resource file extension and MIME type do not match.");
  });

  it("rejects oversized, mismatched, and unsafe uploads before Bunny", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const storage = createStorage({ ...config, fetch: fetchMock });

    await expect(
      storage.upload(
        {
          bytes: new Uint8Array(4 * 1024 * 1024 + 1),
          contentType: "model/stl",
          fileName: "clip.stl",
        },
        1005,
      ),
    ).rejects.toThrow("Resource file exceeds the configured size limit.");
    await expect(
      storage.upload(
        {
          bytes: new Uint8Array([1]),
          contentType: "application/pdf",
          fileName: "clip.stl",
        },
        1005,
      ),
    ).rejects.toThrow("Resource file extension and MIME type do not match.");
    await expect(
      storage.upload(
        {
          bytes: new Uint8Array([1]),
          contentType: "model/stl",
          fileName: "../clip.stl",
        },
        1005,
      ),
    ).rejects.toThrow("Resource file name is unsafe.");
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
    const storage = createStorage({ ...config, fetch: fetchMock });

    await expect(storage.delete("resources/dev/resource.stl")).resolves.toBe(
      "deleted",
    );
    await expect(
      storage.delete("resources/files/resource.stl"),
    ).rejects.toThrow(
      "Resource object path is outside the configured namespace.",
    );
  });

  it("cleans only the matching isolated preview prefix", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = toUrl(input).pathname;

      if (path === "/pocket-trash-storage/resources/preview/pr-52/") {
        return jsonResponse([{ IsDirectory: false, ObjectName: "clip.stl" }]);
      }

      if (path === "/pocket-trash-storage/resources/preview/pr-52/clip.stl") {
        expect(init?.method).toBe("DELETE");
        return new Response(null, { status: 200 });
      }

      throw new Error(`Unexpected Bunny request: ${path}`);
    });

    await expect(
      deletePreviewResourceFolder({
        ...config,
        fetch: fetchMock,
        prNumber: 52,
      }),
    ).resolves.toEqual({
      folderPath: "resources/preview/pr-52",
      status: "deleted",
    });
    await expect(
      deletePreviewResourceFolder({ ...config, fetch: fetchMock, prNumber: 0 }),
    ).rejects.toThrow(
      "Resource preview cleanup requires a positive PR number.",
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
