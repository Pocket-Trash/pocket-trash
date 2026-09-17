import { describe, expect, it } from "vitest";
import {
  getResourceViewer,
  parseMarkPrivate,
  parseResourceDirectoryInput,
  parseResourceUpdate,
  parseResourceUpload,
  parseResourceVersionUpload,
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

  it("accepts upload metadata only when a file and category are present", () => {
    const form = new FormData();
    form.set("name", "Pocket clip");
    form.set("description", "A useful clip.");
    form.set(
      "files",
      new File([new Uint8Array([1])], "clip.stl", { type: "model/stl" }),
    );
    form.append("categories", "3D printing");
    form.set("preview", new File([], "", { type: "application/octet-stream" }));

    expect(parseResourceUpload(form)).toEqual({
      categories: ["3D printing"],
      description: "A useful clip.",
      files: [expect.any(File)],
      name: "Pocket clip",
      preview: undefined,
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
    update.set(
      "preview",
      new File([], "", { type: "application/octet-stream" }),
    );

    expect(parseResourceUpdate(update)).toEqual({
      categories: ["3D printing"],
      description: "Updated description.",
      name: "Updated clip",
      preview: undefined,
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
