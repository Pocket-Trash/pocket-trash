import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import {
  createStorage,
  imageDeliveryUrl,
  maxImageBytes,
  signResourceUrl,
} from "./index.js";

describe("original image storage and Bunny delivery", () => {
  it("preserves a 25 MiB image and rejects oversized or mismatched bytes before upload", async () => {
    const png = await sharp({
      create: { width: 2, height: 1, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const bytes = new Uint8Array(maxImageBytes);
    bytes.set(png);
    const fetchMock = vi.fn<typeof fetch>(async (_request, init) => {
      expect(Buffer.compare(Buffer.from(init?.body as Uint8Array), bytes)).toBe(
        0,
      );
      expect(init?.headers).toMatchObject({
        "content-type": "image/png",
        "content-length": String(maxImageBytes),
      });
      return new Response(null, { status: 201 });
    });
    const storage = createStorage({
      accessKey: "key",
      cdnBaseUrl: "https://cdn.example.test",
      endpoint: "https://storage.example.test",
      folderPrefix: "resources/dev",
      zoneName: "zone",
      fetch: fetchMock,
    });
    const upload = {
      body: bytes,
      contentLength: bytes.length,
      contentType: "image/png",
      objectPath: "resources/dev/image.png",
    };
    await storage.uploadStream(upload);
    await expect(
      storage.uploadStream({ ...upload, contentLength: maxImageBytes + 1 }),
    ).rejects.toThrow("size limit");
    await expect(
      storage.uploadStream({ ...upload, contentType: "image/jpeg" }),
    ).rejects.toThrow("content type mismatch");
    await expect(
      storage.uploadStream({
        ...upload,
        body: new Uint8Array([0]),
        contentLength: 1,
      }),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("adds Dynamic Image API parameters without changing the signed path or expiry", async () => {
    const signed = await signResourceUrl({
      cdnBaseUrl: "https://cdn.example.test",
      objectPath: "resources/files/photo.jpg",
      tokenKey: "key",
      expiresAt: 2_000_000_000,
    });
    const result = new URL(imageDeliveryUrl(signed, 500));
    const original = new URL(signed);
    expect(result.pathname).toBe(original.pathname);
    expect(result.searchParams.get("token")).toBe(
      original.searchParams.get("token"),
    );
    expect(result.searchParams.get("expires")).toBe(
      original.searchParams.get("expires"),
    );
    expect(result.searchParams.get("width")).toBe("500");
    expect(result.searchParams.get("format")).toBe("webp");
    expect(result.searchParams.get("quality")).toBe("85");
    expect(new URL(imageDeliveryUrl(signed)).searchParams.has("width")).toBe(
      false,
    );
  });
});
