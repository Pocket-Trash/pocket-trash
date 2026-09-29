import { describe, expect, it, vi } from "vitest";
import { deletePreviewFolders } from "./delete-preview-folders.js";

const config = {
  accessKey: "key",
  endpoint: "https://storage.example",
  zoneName: "zone",
  cdnBaseUrl: "https://cdn.example",
};
describe("preview cleanup", () => {
  it("recursively removes both namespaces and treats missing folders as clean", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      if (init?.method === "DELETE") return new Response(null, { status: 200 });
      if (String(url).endsWith("resources/preview/pr-52/"))
        return new Response(null, { status: 404 });
      return Response.json(
        String(url).endsWith("images/preview/pr-52/")
          ? [{ ObjectName: "products", IsDirectory: true }]
          : [{ ObjectName: "photo.jpg" }],
      );
    });
    await expect(
      deletePreviewFolders({ ...config, prNumber: 52, fetch: fetchMock }),
    ).resolves.toEqual({
      images: { folderPath: "images/preview/pr-52", status: "deleted" },
      resources: { folderPath: "resources/preview/pr-52", status: "missing" },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://storage.example/zone/images/preview/pr-52/products/photo.jpg",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
  it("rejects unsafe PRs and directory entries before deleting", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json([{ ObjectName: "../escape" }]),
    );
    await expect(
      deletePreviewFolders({ ...config, prNumber: 0, fetch: fetchMock }),
    ).rejects.toThrow("positive PR number");
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(
      deletePreviewFolders({ ...config, prNumber: 52, fetch: fetchMock }),
    ).rejects.toThrow("unsafe object name");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
