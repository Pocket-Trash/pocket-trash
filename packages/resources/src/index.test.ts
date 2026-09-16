import { describe, expect, it, vi } from "vitest";
import {
  buildResourceFolderPrefix,
  createResourceStorage,
  deletePreviewResourceFolder,
} from "./index.js";

const config = {
  accessKey: "storage-key",
  cdnBaseUrl: "https://pocket-trash-resources.b-cdn.net",
  endpoint: "https://ny.storage.bunnycdn.com",
  folderPrefix: "dev",
  randomUUID: () => "00000000-0000-4000-8000-000000000001",
  zoneName: "pocket-trash-resources",
};

describe("resource storage", () => {
  it("selects the object namespace for each deployment environment", () => {
    expect(buildResourceFolderPrefix({ environment: "production" })).toBe(
      "files",
    );
    expect(buildResourceFolderPrefix({ environment: "development" })).toBe(
      "dev",
    );
    expect(buildResourceFolderPrefix({ environment: "preview" })).toBe(
      "preview",
    );
    expect(
      buildResourceFolderPrefix({
        environment: "preview",
        isolatedPreviewPrNumber: 52,
      }),
    ).toBe("preview/pr-52");
  });

  it("uploads an allowed file without accepting an object path", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      expect(toUrl(input).href).toBe(
        "https://ny.storage.bunnycdn.com/pocket-trash-resources/dev/00000000-0000-4000-8000-000000000001.stl",
      );
      expect(init).toMatchObject({
        body: new Uint8Array([1, 2, 3]),
        headers: {
          AccessKey: "storage-key",
          "content-type": "model/stl",
        },
        method: "PUT",
      });

      return new Response(null, { status: 201 });
    });
    const storage = createResourceStorage({ ...config, fetch: fetchMock });

    await expect(
      storage.upload({
        bytes: new Uint8Array([1, 2, 3]),
        contentType: "model/stl",
        fileName: "clip.stl",
      }),
    ).resolves.toEqual({
      contentType: "model/stl",
      fileName: "clip.stl",
      objectPath: "dev/00000000-0000-4000-8000-000000000001.stl",
      size: 3,
      url: "https://pocket-trash-resources.b-cdn.net/dev/00000000-0000-4000-8000-000000000001.stl",
    });
  });

  it("uploads an optional preview image through a separate allowlist", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      expect(toUrl(input).pathname).toBe(
        "/pocket-trash-resources/dev/00000000-0000-4000-8000-000000000001.webp",
      );
      expect(init?.headers).toMatchObject({ "content-type": "image/webp" });
      return new Response(null, { status: 201 });
    });
    const storage = createResourceStorage({ ...config, fetch: fetchMock });

    await expect(
      storage.uploadPreview({
        bytes: new Uint8Array([1, 2, 3]),
        contentType: "image/webp",
        fileName: "clip.webp",
      }),
    ).resolves.toMatchObject({
      contentType: "image/webp",
      objectPath: "dev/00000000-0000-4000-8000-000000000001.webp",
    });

    await expect(
      storage.upload({
        bytes: new Uint8Array([1]),
        contentType: "image/webp",
        fileName: "clip.webp",
      }),
    ).rejects.toThrow("Resource file extension and MIME type do not match.");
  });

  it("rejects oversized, mismatched, and unsafe uploads before Bunny", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const storage = createResourceStorage({ ...config, fetch: fetchMock });

    await expect(
      storage.upload({
        bytes: new Uint8Array(4 * 1024 * 1024 + 1),
        contentType: "model/stl",
        fileName: "clip.stl",
      }),
    ).rejects.toThrow("Resource files cannot exceed 4 MiB.");
    await expect(
      storage.upload({
        bytes: new Uint8Array([1]),
        contentType: "application/pdf",
        fileName: "clip.stl",
      }),
    ).rejects.toThrow("Resource file extension and MIME type do not match.");
    await expect(
      storage.upload({
        bytes: new Uint8Array([1]),
        contentType: "model/stl",
        fileName: "../clip.stl",
      }),
    ).rejects.toThrow("Resource file name is unsafe.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes only objects in the configured namespace", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      expect(toUrl(input).pathname).toBe(
        "/pocket-trash-resources/dev/resource.stl",
      );
      expect(init?.method).toBe("DELETE");
      return new Response(null, { status: 200 });
    });
    const storage = createResourceStorage({ ...config, fetch: fetchMock });

    await expect(storage.delete("dev/resource.stl")).resolves.toBe("deleted");
    await expect(storage.delete("files/resource.stl")).rejects.toThrow(
      "Resource object path is outside the configured namespace.",
    );
  });

  it("cleans only the matching isolated preview prefix", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = toUrl(input).pathname;

      if (path === "/pocket-trash-resources/preview/pr-52/") {
        return jsonResponse([{ IsDirectory: false, ObjectName: "clip.stl" }]);
      }

      if (path === "/pocket-trash-resources/preview/pr-52/clip.stl") {
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
      folderPath: "preview/pr-52",
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
