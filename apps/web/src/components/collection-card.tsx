import type { UserCollectionSummary } from "@package/services";
import { PublicProfileAvatar } from "@/components/public-profile-avatar";
import { Badge } from "@/components/ui/badge";
import { cardImageUrl } from "@/lib/card-image";

/**
 * Renders a collection summary with its optional cover, owner, item count, and privacy badge.
 *
 * @param props - Collection card properties.
 * @param props.collection - Collection summary to present.
 * @param props.coverAlt - Alternative text for the cover image.
 * @param props.itemCountLabel - Localized item-count text.
 * @param props.ownerImageUrl - Selected public Clerk picture URL.
 * @param props.ownerName - Optional collection owner name.
 * @param props.privateLabel - Localized label for private collections.
 * @returns The collection card UI.
 */
export function CollectionCard({
  collection,
  coverAlt,
  itemCountLabel,
  ownerName,
  ownerImageUrl = null,
  privateLabel,
}: {
  /**
   * Collection summary to present.
   */
  collection: UserCollectionSummary;
  /**
   * Alternative text for the cover image.
   */
  coverAlt: string;
  /**
   * Localized item-count text.
   */
  itemCountLabel: string;
  /**
   * Optional collection owner name.
   */
  ownerName?: string;
  /** Selected public Clerk picture URL, or null when absent. */
  ownerImageUrl?: string | null;
  /**
   * Localized label for private collections.
   */
  privateLabel: string;
}) {
  return (
    <article className="flex h-[28rem] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground transition-transform group-hover:-translate-y-0.5 group-hover:border-primary">
      {collection.coverImage ? (
        <div className="aspect-4/3 w-full shrink-0 bg-muted">
          <img
            alt={coverAlt}
            className="h-full w-full object-cover"
            loading="lazy"
            src={cardImageUrl(collection.coverImage.url)}
          />
        </div>
      ) : null}
      <div className="grid flex-1 content-start gap-2 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="font-semibold">{collection.name}</h2>
          {collection.isPrivate ? (
            <Badge variant="secondary">{privateLabel}</Badge>
          ) : null}
        </div>
        {ownerName ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <PublicProfileAvatar
              imageUrl={ownerImageUrl}
              username={ownerName}
            />
            {ownerName}
          </p>
        ) : null}
        {collection.summary ? (
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {collection.summary}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">{itemCountLabel}</p>
      </div>
    </article>
  );
}
