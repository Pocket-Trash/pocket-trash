import type {
  CatalogProduct,
  PublicMakerDetail,
  UserCollectionItem,
} from "@package/services";
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ImageGallery } from "@/components/image-gallery";
import { MarkdownContent } from "@/components/markdown-content";
import { MaterialLink } from "@/components/material-link";
import { ProductCard } from "@/components/product-card";
import { buttonVariants } from "@/components/ui/button";
import { useCatalogCopy } from "@/lib/catalog-copy";
import { cn } from "@/lib/utils";
import { PaginatedCards } from "./catalog-pages";

/** Options attached to a maker detail page change. */
export interface MakerPageChangeOptions {
  /** Replace the current history entry instead of pushing a new entry. */
  replace: boolean;
}

/** Properties for a public maker detail page. */
interface MakerDetailPageProps {
  /** Zero-based collection-items page from the URL. */
  collectionItemsPage: number;
  /** Public maker profile and related catalog data. */
  maker: PublicMakerDetail;
  /**
   * Updates the collection-items page in the URL.
   *
   * @param page - Zero-based destination page.
   * @param options - Navigation history behavior.
   */
  onCollectionItemsPageChange(
    page: number,
    options: MakerPageChangeOptions,
  ): void;
  /**
   * Updates the products page in the URL.
   *
   * @param page - Zero-based destination page.
   * @param options - Navigation history behavior.
   */
  onProductsPageChange(page: number, options: MakerPageChangeOptions): void;
  /** Zero-based products page from the URL. */
  productsPage: number;
}

/** Responsive grid shared by both related-catalog sections. */
const relatedCatalogGridClassName =
  "grid grid-cols-1 gap-[18px] min-[481px]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(max(240px,calc((100%_-_3_*_18px)_/_4)),1fr))]";

/**
 * Renders a maker profile with independently paginated catalog grids.
 *
 * @param props - Maker detail and controlled pagination properties.
 * @returns The public maker profile page.
 */
export function MakerDetailPage({
  collectionItemsPage,
  maker,
  onCollectionItemsPageChange,
  onProductsPageChange,
  productsPage,
}: MakerDetailPageProps) {
  const t = useCatalogCopy();
  return (
    <AppShell
      breadcrumbItems={[{ label: t("web.navigation.makers"), to: "/makers" }]}
      meta={t("web.makers.detailDescription", { name: maker.name })}
      title={maker.name}
    >
      <main className="grid gap-8 p-4 md:p-[18px_22px_22px]">
        <h1 className="m-0 text-2xl font-semibold">{maker.name}</h1>
        {maker.images.length ? (
          <ImageGallery
            alt={t("web.makers.imageAlt", { name: maker.name })}
            closeLabel={t("web.resources.action.closeImage")}
            groups={[{ images: maker.images }]}
            label={t("web.resources.upload.imagesLabel")}
            nextLabel={t("web.resources.action.nextImage")}
            previousLabel={t("web.resources.action.previousImage")}
          />
        ) : null}
        {maker.description ? (
          <MarkdownContent
            className="rounded-xl border border-border bg-card p-6 text-[13.5px] leading-[1.6] text-card-foreground"
            markdown={maker.description}
          />
        ) : null}
        {maker.rootUrl ? (
          <div>
            <a
              className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
              href={maker.rootUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("web.makers.visitWebsite")}
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          </div>
        ) : null}
        <RelatedProducts
          onPageChange={onProductsPageChange}
          page={productsPage}
          products={maker.products}
        />
        <RelatedCollectionItems
          items={maker.collectionItems}
          onPageChange={onCollectionItemsPageChange}
          page={collectionItemsPage}
        />
      </main>
    </AppShell>
  );
}

/** Properties for a controlled related-products grid. */
interface RelatedProductsProps {
  /**
   * Handles controlled page changes.
   *
   * @param page - Zero-based destination page.
   * @param options - Navigation history behavior.
   */
  onPageChange(page: number, options: MakerPageChangeOptions): void;
  /** Zero-based current page. */
  page: number;
  /** Public products to display. */
  products: CatalogProduct[];
}

/**
 * Renders public maker products with controlled responsive pagination.
 *
 * @param props - Product grid properties.
 * @returns The products section.
 */
function RelatedProducts({
  onPageChange,
  page,
  products,
}: RelatedProductsProps) {
  const t = useCatalogCopy();
  return (
    <section aria-labelledby="maker-products" className="grid gap-4">
      <h2 className="text-xl font-semibold" id="maker-products">
        {t("web.makers.products")}
      </h2>
      <PaginatedCards
        ariaLabel={t("web.makers.productsPagination")}
        items={products}
        onPageChange={onPageChange}
        page={page}
        widePageSize={16}
      >
        {(visibleProducts) =>
          visibleProducts.length ? (
            <div className={relatedCatalogGridClassName}>
              {visibleProducts.map((product) => (
                <div
                  className="group relative h-full focus-within:ring-2 focus-within:ring-ring"
                  key={product.id}
                >
                  <Link
                    className="absolute inset-0 z-10 outline-none"
                    params={{
                      productSlug: product.slug,
                      productTypeSlug: product.productTypeSlug,
                    }}
                    to="/products/$productTypeSlug/$productSlug"
                  >
                    <span className="sr-only">{product.name}</span>
                  </Link>
                  <ProductCard
                    finishOptionCountLabel={t("web.catalog.finishOptionCount", {
                      count: product.finishOptions.length,
                    })}
                    imageAlt={t("web.resources.detail.imageAlt", {
                      name: product.name,
                    })}
                    imageCountLabel={t("web.makers.imageCount", {
                      count: product.imageCount,
                    })}
                    materialCountLabel={t("web.catalog.materialCount", {
                      count: product.materials.length,
                    })}
                    privateLabel={t("web.resources.moderation.privateBadge")}
                    product={product}
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyRelated>{t("web.makers.noProducts")}</EmptyRelated>
          )
        }
      </PaginatedCards>
    </section>
  );
}

/** Properties for a controlled related collection-items grid. */
interface RelatedCollectionItemsProps {
  /** Public collection items to display. */
  items: UserCollectionItem[];
  /**
   * Handles controlled page changes.
   *
   * @param page - Zero-based destination page.
   * @param options - Navigation history behavior.
   */
  onPageChange(page: number, options: MakerPageChangeOptions): void;
  /** Zero-based current page. */
  page: number;
}

/** Properties for a related-content empty state. */
interface EmptyRelatedProps {
  /** Localized empty-state message. */
  children: React.ReactNode;
}

/**
 * Renders public maker collection items with controlled responsive pagination.
 *
 * @param props - Collection-items grid properties.
 * @returns The collection-items section.
 */
function RelatedCollectionItems({
  items,
  onPageChange,
  page,
}: RelatedCollectionItemsProps) {
  const t = useCatalogCopy();
  return (
    <section aria-labelledby="maker-collection-items" className="grid gap-4">
      <h2 className="text-xl font-semibold" id="maker-collection-items">
        {t("web.makers.collectionItems")}
      </h2>
      <PaginatedCards
        ariaLabel={t("web.makers.collectionItemsPagination")}
        items={items}
        onPageChange={onPageChange}
        page={page}
        widePageSize={16}
      >
        {(visibleItems) =>
          visibleItems.length ? (
            <div className={relatedCatalogGridClassName}>
              {visibleItems.map((item) => (
                <CollectionItemCard item={item} key={item.collectionItemId} />
              ))}
            </div>
          ) : (
            <EmptyRelated>{t("web.makers.noCollectionItems")}</EmptyRelated>
          )
        }
      </PaginatedCards>
    </section>
  );
}

/** Properties for one related collection-item card. */
interface CollectionItemCardProps {
  /** Public collection item displayed by the card. */
  item: UserCollectionItem;
}

/**
 * Renders one compact collection-item card linked to its public detail.
 *
 * @param props - Collection-item card properties.
 * @returns The linked collection-item card.
 */
function CollectionItemCard({ item }: CollectionItemCardProps) {
  const t = useCatalogCopy();
  const image = [...item.images, ...item.productImages].find(
    ({ deletedAt }) => !deletedAt,
  );
  return (
    <article className="group relative flex h-[28rem] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground hover:border-primary focus-within:ring-2 focus-within:ring-ring">
      <Link
        className="absolute inset-0 z-10 outline-none"
        params={{
          collectionId: item.collectionId,
          collectionItemId: item.collectionItemId,
          userId: item.ownerUserId,
        }}
        to="/collections/$userId/$collectionId/$collectionItemId"
      >
        <span className="sr-only">{item.displayName}</span>
      </Link>
      {image ? (
        <img
          alt={t("web.resources.detail.imageAlt", { name: item.displayName })}
          className="aspect-4/3 w-full shrink-0 border-b border-border object-cover"
          loading="lazy"
          src={image.url}
        />
      ) : null}
      <div className="p-5">
        <h3 className="font-semibold">{item.displayName}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("web.makers.productMakerAttribution", {
            maker: item.makerName,
            productType: item.productTypeName,
          })}
        </p>
        {item.material ? (
          <p className="mt-3 text-xs text-muted-foreground">
            <MaterialLink material={item.material} />
          </p>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Renders a related-content empty state.
 *
 * @param props - Empty-state content.
 * @param props.children - Localized empty-state message.
 * @returns A bordered empty-state message.
 */
function EmptyRelated({ children }: EmptyRelatedProps) {
  return (
    <p className="rounded-lg border border-dashed border-border p-6 text-muted-foreground">
      {children}
    </p>
  );
}
