import type { UserCollectionSummary } from "@package/services";
import { Badge } from "@/components/ui/badge";

export function CollectionCard({
  collection,
  coverAlt,
  itemCountLabel,
  ownerName,
  privateLabel,
}: {
  collection: UserCollectionSummary;
  coverAlt: string;
  itemCountLabel: string;
  ownerName?: string;
  privateLabel: string;
}) {
  return (
    <article className="flex h-[28rem] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground transition-transform group-hover:-translate-y-0.5 group-hover:border-primary">
      {collection.coverImage ? (
        <div className="aspect-4/3 w-full shrink-0 bg-muted">
          <img
            alt={coverAlt}
            className="h-full w-full object-cover"
            src={collection.coverImage.url}
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
          <p className="text-sm text-muted-foreground">{ownerName}</p>
        ) : null}
        {collection.description ? (
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {collection.description}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">{itemCountLabel}</p>
      </div>
    </article>
  );
}
