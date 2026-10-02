/** Card image width balances five-column layouts with high-density displays. */
const cardImageWidth = 640;

/**
 * Adds the catalog-card width transform to an absolute image URL.
 *
 * @param value - Signed or public image delivery URL.
 * @returns The URL requesting a card-sized image.
 * @throws When the value is not a valid absolute URL.
 */
export function cardImageUrl(value: string): string {
  const url = new URL(value);
  url.searchParams.set("width", String(cardImageWidth));
  return url.toString();
}
