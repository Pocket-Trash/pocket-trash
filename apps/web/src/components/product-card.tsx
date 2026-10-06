import type { CatalogProduct } from "@package/services";
import { Badge } from "@/components/ui/badge";
import { cardImageUrl } from "@/lib/card-image";

/**
 * Renders a catalog product summary with its first active image and counts.
 *
 * @param props - Product card properties.
 * @param props.approvalLabel - Localized review state shown to authorized viewers.
 * @param props.finishOptionCountLabel - Preformatted finish-option count.
 * @param props.imageAlt - Alternative text for the first active image.
 * @param props.imageCountLabel - Preformatted image count.
 * @param props.materialCountLabel - Preformatted material count.
 * @param props.privateLabel - Label shown for a private product.
 * @param props.product - Catalog product to summarize.
 * @param props.productTypeLabel - Localized canonical or maker-preferred type label.
 * @param props.searchContext - Optional context explaining a non-name search match.
 * @returns The product summary card.
 */
export function ProductCard({
  approvalLabel,
  finishOptionCountLabel,
  imageAlt,
  imageCountLabel,
  materialCountLabel,
  privateLabel,
  product,
  productTypeLabel = product.productTypeName,
  searchContext,
}: {
  /** Localized review state shown to authorized viewers. */
  approvalLabel?: string;
  /**
   * Preformatted finish-option count.
   */
  finishOptionCountLabel: string;
  /**
   * Alternative text for the first active image.
   */
  imageAlt: string;
  /**
   * Preformatted image count.
   */
  imageCountLabel: string;
  /**
   * Preformatted material count.
   */
  materialCountLabel: string;
  /**
   * Label shown when the product is private.
   */
  privateLabel: string;
  /**
   * Catalog product displayed by the card.
   */
  product: CatalogProduct;
  /** Localized canonical or maker-preferred product-type label. */
  productTypeLabel?: string;
  /** Context explaining a type, alias, or owner search match. */
  searchContext?: string;
}) {
  const image = product.images.find(({ deletedAt }) => !deletedAt);

  return (
    <article className="flex h-[28rem] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground transition-transform group-hover:-translate-y-0.5 group-hover:border-primary">
      {image ? (
        <div className="aspect-4/3 w-full shrink-0 bg-muted">
          <img
            alt={imageAlt}
            className="h-full w-full object-cover"
            loading="lazy"
            src={cardImageUrl(image.url)}
          />
        </div>
      ) : null}
      <div className="flex-1 p-5">
        {approvalLabel ? (
          <Badge className="mb-2" variant="secondary">
            {approvalLabel}
          </Badge>
        ) : null}
        {product.isPrivate ? (
          <Badge className="mb-2" variant="secondary">
            {privateLabel}
          </Badge>
        ) : null}
        <h2 className="line-clamp-2 min-h-[2.6em] text-[15px] leading-[1.3] font-semibold">
          {product.name}
        </h2>
        <p className="mt-1 min-h-[2.9em] text-[12.5px] leading-[1.45] text-muted-foreground">
          {productTypeLabel} · {product.makerName}
        </p>
        {searchContext ? (
          <p className="mt-1 text-xs text-primary">{searchContext}</p>
        ) : null}
        <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
          <span>{materialCountLabel}</span>
          <span>{finishOptionCountLabel}</span>
          <span>{imageCountLabel}</span>
        </div>
      </div>
    </article>
  );
}
