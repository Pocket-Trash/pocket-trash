import { describe, expect, it } from "vitest";
import {
  parseResourceDirectoryInput,
  parseResourceUpload,
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

  it("accepts upload metadata only when a file and category are present", () => {
    const form = new FormData();
    form.set("name", "Pocket clip");
    form.set("description", "A useful clip.");
    form.set(
      "file",
      new File([new Uint8Array([1])], "clip.stl", { type: "model/stl" }),
    );
    form.append("categories", "3D printing");
    form.set("preview", new File([], "", { type: "application/octet-stream" }));

    expect(parseResourceUpload(form)).toEqual({
      categories: ["3D printing"],
      description: "A useful clip.",
      file: expect.any(File),
      name: "Pocket clip",
      preview: undefined,
    });

    form.delete("file");
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
});
