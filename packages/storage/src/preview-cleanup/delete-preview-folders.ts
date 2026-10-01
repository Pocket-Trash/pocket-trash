import {
  type BunnyStorageConfig,
  deleteFolderRecursive,
  readBunnyConfig,
} from "../lib/bunny-client.js";
/**
 * Recursively deletes image and resource folders for one preview PR.
 *
 * @param input - Bunny Storage settings and positive pull-request number.
 * @returns Deletion or missing status for both preview namespaces.
 * @rejects When configuration, path validation, listing, or deletion fails.
 */
export async function deletePreviewFolders(
  input: BunnyStorageConfig & {
    /** Positive pull-request number whose preview folders are removed. */
    prNumber: number;
  },
) {
  if (!Number.isInteger(input.prNumber) || input.prNumber <= 0)
    throw new Error("Preview cleanup requires a positive PR number.");
  const config = readBunnyConfig(input);
  /**
   * Deletes one validated preview namespace.
   *
   * @param root - Image or resource namespace root.
   * @returns Folder path and deletion status.
   * @rejects When path validation, listing, or deletion fails.
   */
  async function remove(root: "images" | "resources") {
    const folderPath = `${root}/preview/pr-${input.prNumber}`;
    if (!/^(images|resources)\/preview\/pr-[1-9]\d*$/u.test(folderPath))
      throw new Error("Invalid preview folder.");
    const result = await deleteFolderRecursive(config, folderPath);
    return { folderPath, status: result.found ? "deleted" : "missing" };
  }
  return {
    images: await remove("images"),
    resources: await remove("resources"),
  };
}
