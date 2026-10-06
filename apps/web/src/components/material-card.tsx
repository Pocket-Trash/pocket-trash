import type { PublicMaterialSummary } from "@package/services";
import { cardImageUrl } from "@/lib/card-image";

/**
 * Renders a public material with its lead image and catalog usage counts.
 *
 * @param props - Material card properties.
 * @param props.collectionItemCountLabel - Localized collection-item count.
 * @param props.imageAlt - Alternative text for the lead image.
 * @param props.material - Material summary displayed by the card.
 * @param props.placeholderLabel - Accessible copy shown when no image exists.
 * @param props.productCountLabel - Localized product count.
 * @returns A material summary card.
 */
export function MaterialCard({
  collectionItemCountLabel,
  imageAlt,
  material,
  placeholderLabel,
  productCountLabel,
}: {
  /** Localized collection-item count. */
  collectionItemCountLabel: string;
  /** Alternative text for the lead image. */
  imageAlt: string;
  /** Material summary displayed by the card. */
  material: PublicMaterialSummary;
  /** Accessible copy shown when no image exists. */
  placeholderLabel: string;
  /** Localized product count. */
  productCountLabel: string;
}) {
  return (
    <article className="flex h-full min-h-64 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground transition-transform group-hover:-translate-y-0.5 group-hover:border-primary">
      {material.leadImage ? (
        <div className="aspect-4/3 w-full shrink-0 bg-muted">
          <img
            alt={imageAlt}
            className="h-full w-full object-cover"
            loading="lazy"
            src={cardImageUrl(material.leadImage.url)}
          />
        </div>
      ) : (
        <div className="flex aspect-4/3 w-full shrink-0 items-center justify-center bg-muted px-4 text-center text-sm text-muted-foreground">
          {placeholderLabel}
        </div>
      )}
      <div className="grid flex-1 content-start gap-2 p-4">
        <h3 className="font-semibold">{material.name}</h3>
        <p className="text-xs text-muted-foreground">{productCountLabel}</p>
        <p className="text-xs text-muted-foreground">
          {collectionItemCountLabel}
        </p>
      </div>
    </article>
  );
}
