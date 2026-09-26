import {
  type BunnyStorageConfig,
  deleteFolderRecursive,
  readBunnyConfig,
} from "../lib/bunny-client.js";
export async function deletePreviewFolders(
  input: BunnyStorageConfig & { prNumber: number },
) {
  if (!Number.isInteger(input.prNumber) || input.prNumber <= 0)
    throw new Error("Preview cleanup requires a positive PR number.");
  const config = readBunnyConfig(input);
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
