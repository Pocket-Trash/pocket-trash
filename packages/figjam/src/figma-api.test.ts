import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FigmaApiError,
  fetchFigjamSnapshot,
  getFigmaConfigFromEnv,
  postFigmaComment,
} from "./figma-api.js";

/** Figma API configuration shared by request-behavior tests. */
const config = {
  accessToken: "figma-token",
  allowedFileKeys: ["board123"],
  defaultFileKey: "board123",
};

describe("Figma API config", () => {
  it("rejects preview and production environments", () => {
    expect(() =>
      getFigmaConfigFromEnv({
        FIGMA_ACCESS_TOKEN: "figma-token",
        FIGMA_FIGJAM_ALLOWED_FILE_KEYS: "board123",
        FIGMA_FIGJAM_FILE_KEY: "board123",
        VERCEL_ENV: "preview",
      }),
    ).toThrow("must only run locally");

    expect(() =>
      getFigmaConfigFromEnv({
        FIGMA_ACCESS_TOKEN: "figma-token",
        FIGMA_FIGJAM_ALLOWED_FILE_KEYS: "board123",
        FIGMA_FIGJAM_FILE_KEY: "board123",
        NODE_ENV: "production",
      }),
    ).toThrow("must only run locally");
  });
});

describe("Figma API responses", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves Figma status details for non-JSON error responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response("<html>unavailable</html>", {
          headers: { "Retry-After": "30" },
          status: 503,
        });
      }),
    );

    await expect(
      postFigmaComment(config, { message: "Review note" }),
    ).rejects.toMatchObject({
      message: "Figma API request failed with 503. Retry after 30 seconds.",
      status: 503,
    });
  });

  it("continues when comments are forbidden", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (String(input).endsWith("/comments")) {
          return new Response("Forbidden", { status: 403 });
        }

        return Response.json({ document: { id: "root" } });
      }),
    );

    await expect(fetchFigjamSnapshot(config)).resolves.toMatchObject({
      comments: [],
      file: { document: { id: "root" } },
      fileKey: "board123",
    });
  });

  it("throws FigmaApiError for failed requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Unauthorized", { status: 401 })),
    );

    await expect(
      postFigmaComment(config, { message: "Review note" }),
    ).rejects.toBeInstanceOf(FigmaApiError);
  });
});
