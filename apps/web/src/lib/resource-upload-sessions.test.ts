import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/env/client", () => ({
  clientEnv: { VITE_RESOURCE_API_BASE_URL: "https://api.example.test" },
}));

import {
  getResourceUploadErrorTranslation,
  ResourceUploadRequestError,
  uploadResourceSession,
  validateResourceUpload,
} from "./resource-upload-sessions";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("resource upload sessions", () => {
  it("rejects duplicate names and declared size limits before the API", () => {
    expect(
      validateResourceUpload([file("Tool.stl", 1), file("tool.STL", 1)]),
    ).toEqual({
      key: "web.resources.validation.duplicateFilename",
      params: { filename: "tool.STL" },
    });
    expect(
      validateResourceUpload([file("large.stl", 20 * 1024 * 1024 + 1)]),
    ).toEqual({
      key: "web.resources.validation.fileTooLarge",
      params: { filename: "large.stl", maxSize: "20 MiB" },
    });
    expect(
      validateResourceUpload([
        file("one.stl", 18 * 1024 * 1024),
        file("two.stl", 18 * 1024 * 1024),
        file("three.stl", 18 * 1024 * 1024),
      ]),
    ).toEqual({
      key: "web.resources.validation.sessionTooLarge",
      params: { maxSize: "50 MiB" },
    });
  });

  it("uses one raw PUT per file before idempotent completion", async () => {
    const files = [file("one.stl", 3), file("two.stl", 3)];
    const preview = file("preview.webp", 3, "image/webp");
    const requests: Array<{ init?: RequestInit; url: string }> = [];
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      requests.push({ init, url });
      if (url.endsWith("/resource-upload-sessions")) {
        return jsonResponse({
          expiresAt: "2026-09-17T01:00:00.000Z",
          id: "session-id",
          uploads: files
            .map((upload, index) => ({
              contentType: upload.type,
              fileName: upload.name,
              id: `file-${index + 1}`,
              kind: "resource",
              size: upload.size,
            }))
            .concat({
              contentType: preview.type,
              fileName: preview.name,
              id: "preview-file",
              kind: "preview",
              size: preview.size,
            }),
        });
      }
      if (url.endsWith("/complete")) {
        return jsonResponse({ resourceId: 1000, version: 1 });
      }
      return new Response(null, { status: 204 });
    });

    await expect(
      uploadResourceSession({
        categories: ["Tools"],
        description: "Description",
        fetch: fetchMock,
        files,
        getToken: async () => "token",
        name: "Tool",
        operation: "create",
        preview,
      }),
    ).resolves.toEqual({ resourceId: 1000, version: 1 });

    expect(requests.map(({ init }) => init?.method)).toEqual([
      "POST",
      "PUT",
      "PUT",
      "PUT",
      "POST",
    ]);
    expect(requests[1]?.init?.body).toBe(files[0]);
    expect(requests[2]?.init?.body).toBe(files[1]);
    expect(requests[3]?.init?.body).toBe(preview);
  });

  it("maps stable API codes to localized upload messages", () => {
    expect(
      getResourceUploadErrorTranslation(
        new ResourceUploadRequestError("complete", "session_expired"),
      ),
    ).toEqual({ key: "web.resources.upload.expired" });
    expect(
      getResourceUploadErrorTranslation(
        new ResourceUploadRequestError("file", "upload_failed", "tool.stl"),
      ),
    ).toEqual({
      key: "web.resources.upload.fileFailure",
      params: { filename: "tool.stl" },
    });
  });
});

function file(name: string, size: number, type = "application/octet-stream") {
  return { name, size, type } as File;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}
