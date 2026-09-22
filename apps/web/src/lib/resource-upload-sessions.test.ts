import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/env/client", () => ({
  clientEnv: { VITE_API_URL: "https://api.example.test" },
}));

import {
  appendResourceUploadFiles,
  getResourceUploadErrorTranslation,
  ResourceUploadRequestError,
  uploadResourceSession,
  validateResourceUpload,
} from "./resource-upload-sessions";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("resource upload sessions", () => {
  it("appends files selected in separate picker or drop actions", () => {
    const first = file("one.stl", 1);
    const second = file("two.stl", 1);

    expect(appendResourceUploadFiles([first], [second])).toEqual([
      first,
      second,
    ]);
  });

  it("normalizes an STL with no browser MIME type to octet-stream", async () => {
    const stl = file("GUIDE TRIM TOOL_No-Text.stl", 3, "");
    const requests: Array<{ init?: RequestInit; url: string }> = [];
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      requests.push({ init, url });
      if (url.endsWith("/resource-upload-sessions")) {
        return jsonResponse({
          expiresAt: "2026-09-17T01:00:00.000Z",
          id: "session-id",
          uploads: [
            {
              contentType: "application/octet-stream",
              fileName: stl.name,
              id: "file-1",
              kind: "resource",
              size: stl.size,
            },
          ],
        });
      }
      if (url.endsWith("/complete")) {
        return jsonResponse({ resourceId: 1000, version: 1 });
      }
      return new Response(null, { status: 204 });
    });

    expect(validateResourceUpload([stl])).toBeUndefined();
    await uploadResourceSession({
      categories: ["Tools"],
      description: "Description",
      fetch: fetchMock,
      files: [stl],
      getToken: async () => "token",
      isPrivate: true,
      name: "Tool",
      operation: "create",
    });

    expect(JSON.parse(String(requests[0]?.init?.body))).toMatchObject({
      files: [{ contentType: "application/octet-stream" }],
      isPrivate: true,
    });
    expect(requests[1]?.init?.headers).toMatchObject({
      "content-type": "application/octet-stream",
    });
  });

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
        file("four.stl", 18 * 1024 * 1024),
        file("five.stl", 18 * 1024 * 1024),
        file("six.stl", 18 * 1024 * 1024),
      ]),
    ).toEqual({
      key: "web.resources.validation.sessionTooLarge",
      params: { maxSize: "100 MiB" },
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
              id: "image-file",
              kind: "image",
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
        images: [preview],
        name: "Tool",
        operation: "create",
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

  it("forwards measured upload progress from the file transport", async () => {
    const stl = file("tool.stl", 4);
    const progress: number[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      return url.endsWith("/resource-upload-sessions")
        ? jsonResponse({
            expiresAt: "2026-09-17T01:00:00.000Z",
            id: "session-id",
            uploads: [
              {
                contentType: stl.type,
                fileName: stl.name,
                id: "file-1",
                kind: "resource",
                size: stl.size,
              },
            ],
          })
        : jsonResponse({ resourceId: 1000, version: 1 });
    });

    await uploadResourceSession({
      fetch: fetchMock,
      files: [stl],
      getToken: async () => "token",
      onProgress: (_fileName, percent) => progress.push(percent),
      operation: "version",
      resourceId: 1000,
      uploadFile: async ({ onProgress }) => {
        onProgress(25);
        onProgress(75);
        return new Response(null, { status: 204 });
      },
    });

    expect(progress).toEqual([25, 75]);
  });

  it("retries idempotent completion after a server failure", async () => {
    const stl = file("tool.stl", 3);
    let completionAttempts = 0;
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/resource-upload-sessions")) {
        return jsonResponse({
          expiresAt: "2026-09-17T01:00:00.000Z",
          id: "session-id",
          uploads: [
            {
              contentType: stl.type,
              fileName: stl.name,
              id: "file-1",
              kind: "resource",
              size: stl.size,
            },
          ],
        });
      }
      if (url.endsWith("/complete")) {
        completionAttempts += 1;
        return completionAttempts === 1
          ? jsonResponse({ error: "internal_error" }, 502)
          : jsonResponse({ resourceId: 1001, version: 2 });
      }
      return new Response(null, { status: 204 });
    });

    await expect(
      uploadResourceSession({
        fetch: fetchMock,
        files: [stl],
        getToken: async () => "token",
        operation: "version",
        resourceId: 1001,
      }),
    ).resolves.toEqual({ resourceId: 1001, version: 2 });
    expect(completionAttempts).toBe(2);
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
