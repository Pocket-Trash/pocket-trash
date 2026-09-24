import { imageDeliveryUrl } from "@package/storage";
export async function signImages<T extends { objectPath: string }>(
  images: T[],
  signUrl: (path: string) => Promise<string>,
): Promise<(T & { url: string })[]> {
  return Promise.all(
    images.map(async (image) => ({
      ...image,
      url: imageDeliveryUrl(await signUrl(image.objectPath)),
    })),
  );
}
