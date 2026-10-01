import { imageDeliveryUrl } from "@package/storage";
/**
 * Adds signed delivery URLs to stored image records.
 *
 * @param images - Image records containing storage object paths.
 * @param signUrl - Signs one storage object path.
 * @returns Image records in input order with delivery URLs.
 * @template T - Image record type preserved in each result.
 * @rejects When signing fails or a signed URL is invalid.
 */
export async function signImages<
  T extends {
    /** Storage object path to sign. */
    objectPath: string;
  },
>(
  images: T[],
  signUrl: (path: string) => Promise<string>,
): Promise<
  (T & {
    /** Public image delivery URL backed by a signed storage URL. */
    url: string;
  })[]
> {
  return Promise.all(
    images.map(async (image) => ({
      ...image,
      url: imageDeliveryUrl(await signUrl(image.objectPath)),
    })),
  );
}
