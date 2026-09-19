import { describe, expect, it } from "vitest";
import {
  getResourceViewer,
  parseMarkPrivate,
  parseResourceDirectoryInput,
  parseResourceUpdate,
  parseResourceUpload,
  parseResourceVersionUpload,
  parseResourceVisibility,
  requireResourceAdmin,
  requireResourceUploader,
} from "./resources.js";

describe("resource server functions", () => {
  it("rejects unauthenticated uploaders", async () => {
    await expect(
      requireResourceUploader(
        async () =>
          ({
            isAuthenticated: false,
            userId: null,
          }) as never,
      ),
    ).rejects.toThrow();
  });

  it("allows only admins to review resource notifications", async () => {
    await expect(
      requireResourceAdmin(
        async () =>
          ({
            isAuthenticated: true,
            sessionClaims: { role: "user" },
            userId: "user_123",
          }) as never,
      ),
    ).rejects.toThrow();

    await expect(
      requireResourceAdmin(
        async () =>
          ({
            isAuthenticated: true,
            sessionClaims: { role: "admin" },
            userId: "admin_123",
          }) as never,
      ),
    ).resolves.toBe("admin_123");
  });

  it("derives resource visibility from the signed-in role", async () => {
    await expect(
      getResourceViewer(
        async () =>
          ({
            isAuthenticated: true,
            sessionClaims: { role: "admin" },
            userId: "admin_123",
          }) as never,
      ),
    ).resolves.toEqual({ clerkId: "admin_123", isAdmin: true });
  });

  it("requires a trimmed moderation reason", () => {
    expect(
      parseMarkPrivate({
        reason: "  Inappropriate content  ",
        resourceId: 1000,
      }),
    ).toEqual({ reason: "Inappropriate content", resourceId: 1000 });
    expect(() =>
      parseMarkPrivate({ reason: "   ", resourceId: 1000 }),
    ).toThrow();
  });

  it("accepts only explicit resource visibility", () => {
    expect(
      parseResourceVisibility({ isPublic: false, resourceId: 1000 }),
    ).toEqual({ isPublic: false, resourceId: 1000 });
    expect(() =>
      parseResourceVisibility({ isPublic: "false", resourceId: 1000 }),
    ).toThrow();
  });

  it("accepts upload metadata only when a file and category are present", () => {
    const form = new FormData();
    form.set("name", "Pocket clip");
    form.set("description", "A useful clip.");
    form.set(
      "files",
      new File([new Uint8Array([1])], "clip.stl", { type: "model/stl" }),
    );
    form.append("categories", "3D printing");
    form.set(
      "images",
      new File([new Uint8Array([2])], "clip.webp", { type: "image/webp" }),
    );

    expect(parseResourceUpload(form)).toEqual({
      categories: ["3D printing"],
      description: "A useful clip.",
      files: [expect.any(File)],
      images: [expect.any(File)],
      name: "Pocket clip",
    });

    form.delete("files");
    expect(() => parseResourceUpload(form)).toThrow();
  });

  it("accepts at most ten category filters", () => {
    expect(
      parseResourceDirectoryInput({
        categorySlugs: ["3d-printing", "accessories"],
      }),
    ).toEqual({ categorySlugs: ["3d-printing", "accessories"] });
    expect(() =>
      parseResourceDirectoryInput({
        categorySlugs: Array.from(
          { length: 11 },
          (_, index) => `filter-${index}`,
        ),
      }),
    ).toThrow();
  });

  it("parses metadata edits separately from immutable version uploads", () => {
    const update = new FormData();
    update.set("resourceId", "1000");
    update.set("name", "Updated clip");
    update.set("description", "Updated description.");
    update.append("categories", "3D printing");
    update.set("retainedImageIds", "1001");

    expect(parseResourceUpdate(update)).toEqual({
      categories: ["3D printing"],
      description: "Updated description.",
      images: [],
      name: "Updated clip",
      retainedImageIds: [1001],
      resourceId: 1000,
    });

    const version = new FormData();
    version.set("resourceId", "1000");
    version.set(
      "files",
      new File([new Uint8Array([1])], "clip.stl", { type: "model/stl" }),
    );
    expect(parseResourceVersionUpload(version)).toMatchObject({
      files: [expect.any(File)],
      resourceId: 1000,
    });
  });
});
