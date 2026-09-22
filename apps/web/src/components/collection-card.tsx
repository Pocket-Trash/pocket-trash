import type { UserCollectionSummary } from "@package/services";
import { Badge } from "@/components/ui/badge";

export function CollectionCard({
  collection,
  coverAlt,
  itemCountLabel,
  privateLabel,
}: {
  collection: UserCollectionSummary;
  coverAlt: string;
  itemCountLabel: string;
  privateLabel: string;
}) {
  return (
    <article className="h-full overflow-hidden rounded-xl border border-border bg-card text-card-foreground transition-transform group-hover:-translate-y-0.5 group-hover:border-primary">
      {collection.coverImage ? (
        <img
          alt={coverAlt}
          className="aspect-4/3 w-full object-cover"
          src={collection.coverImage.url}
        />
      ) : null}
      <div className="grid gap-2 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="font-semibold">{collection.name}</h2>
          {collection.isPrivate ? (
            <Badge variant="secondary">{privateLabel}</Badge>
          ) : null}
        </div>
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
