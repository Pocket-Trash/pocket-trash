import type {
  CatalogProduct,
  PublicMaterial,
  PublicMaterialSummary,
  UserCollectionItem,
} from "@package/services";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ImageGallery } from "@/components/image-gallery";
import { MarkdownContent } from "@/components/markdown-content";
import { MaterialCard } from "@/components/material-card";
import { MaterialLink } from "@/components/material-link";
import { ProductCard } from "@/components/product-card";
import { PublicProfileAvatar } from "@/components/public-profile-avatar";
import { Button } from "@/components/ui/button";
import { cardImageUrl } from "@/lib/card-image";
import { useCatalogCopy } from "@/lib/catalog-copy";
import {
  clampMaterialPage,
  getMaterialInitial,
  getMaterialPageSize,
  groupMaterials,
  MATERIAL_INITIALS,
  OTHER_MATERIALS,
  sortPopularMaterials,
} from "@/lib/materials";
import { cn } from "@/lib/utils";

/**
 * Creates localized material-card properties shared by both pages.
 *
 * @param material - Material whose counts and name should be described.
 * @param t - Localized catalog-copy formatter.
 * @returns Localized material-card properties.
 */
function materialCardCopy(
  material: PublicMaterialSummary,
  t: ReturnType<typeof useCatalogCopy>,
) {
  return {
    collectionItemCountLabel: t("web.materials.count.collectionItems", {
      count: material.collectionItemCount,
    }),
    imageAlt: t("web.materials.image.alt", { name: material.name }),
    placeholderLabel: t("web.materials.image.placeholder", {
      name: material.name,
    }),
    productCountLabel: t("web.materials.count.products", {
      count: material.productCount,
    }),
  };
}

/**
 * Renders the public material directory and responsive popularity grid.
 *
 * @param props - Directory properties.
 * @param props.materials - Every material and its public usage counts.
 * @returns The materials directory page.
 */
export function MaterialsPage({
  materials,
}: {
  /** Every material and its public usage counts. */
  materials: PublicMaterialSummary[];
}) {
  const t = useCatalogCopy();
  const groups = groupMaterials(materials);
  const populated = new Set(
    materials.map(({ name }) => getMaterialInitial(name)),
  );
  const popular = sortPopularMaterials(materials).slice(0, 8);

  return (
    <AppShell
      meta={t("web.materials.directory.description")}
      title={t("web.materials.directory.title")}
    >
      {materials.length ? (
        <main className="grid gap-10 p-4 md:p-[18px_22px_22px]">
          <section aria-labelledby="popular-materials" className="grid gap-4">
            <h2 className="text-xl font-semibold" id="popular-materials">
              {t("web.materials.directory.popular")}
            </h2>
            <div className="grid grid-cols-2 gap-3 min-[481px]:grid-cols-3 min-[1281px]:grid-cols-4">
              {popular.map((material, index) => (
                <div
                  className={cn(
                    "group relative focus-within:ring-2 focus-within:ring-ring",
                    index >= 4 && "hidden min-[481px]:block",
                    index >= 6 && "min-[481px]:hidden min-[1281px]:block",
                  )}
                  key={material.id}
                >
                  <Link
                    className="absolute inset-0 z-10 outline-none"
                    params={{ materialSlug: material.slug }}
                    search={{ collectionItemsPage: 1, productsPage: 1 }}
                    to="/materials/$materialSlug"
                  >
                    <span className="sr-only">{material.name}</span>
                  </Link>
                  <MaterialCard
                    {...materialCardCopy(material, t)}
                    material={material}
                  />
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="materials-a-to-z" className="grid gap-6">
            <div className="grid gap-3">
              <h2 className="text-xl font-semibold" id="materials-a-to-z">
                {t("web.materials.directory.tableOfContents")}
              </h2>
              <nav
                aria-label={t("web.materials.directory.tableOfContents")}
                className="flex flex-wrap gap-2"
              >
                {MATERIAL_INITIALS.map((initial) =>
                  populated.has(initial) ? (
                    <a
                      className="rounded-md border border-border px-2.5 py-1.5 text-sm hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      href={`#materials-${initial}`}
                      key={initial}
                    >
                      {initial}
                    </a>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="rounded-md border border-border/50 px-2.5 py-1.5 text-sm text-muted-foreground/50"
                      key={initial}
                    >
                      {initial}
                    </span>
                  ),
                )}
                {populated.has(OTHER_MATERIALS) ? (
                  <a
                    className="rounded-md border border-border px-2.5 py-1.5 text-sm hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    href="#materials-Other"
                  >
                    {t("web.materials.directory.other")}
                  </a>
                ) : null}
              </nav>
            </div>

            {groups.map(([initial, sectionMaterials]) => (
              <section
                aria-labelledby={`materials-heading-${initial}`}
                className="scroll-mt-24 grid gap-3"
                id={`materials-${initial}`}
                key={initial}
              >
                <h3
                  className="border-b border-border pb-2 text-lg font-semibold"
                  id={`materials-heading-${initial}`}
                >
                  {initial === OTHER_MATERIALS
                    ? t("web.materials.directory.other")
                    : initial}
                </h3>
                <div className="grid grid-cols-1 gap-3 min-[481px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {sectionMaterials.map((material) => (
                    <div
                      className="group relative focus-within:ring-2 focus-within:ring-ring"
                      key={material.id}
                    >
                      <Link
                        className="absolute inset-0 z-10 outline-none"
                        params={{ materialSlug: material.slug }}
                        search={{ collectionItemsPage: 1, productsPage: 1 }}
                        to="/materials/$materialSlug"
                      >
                        <span className="sr-only">{material.name}</span>
                      </Link>
                      <MaterialCard
                        {...materialCardCopy(material, t)}
                        material={material}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </section>
        </main>
      ) : (
        <main className="p-4 md:p-[18px_22px_22px]">
          <EmptyState>{t("web.materials.directory.empty")}</EmptyState>
        </main>
      )}
    </AppShell>
  );
}

/**
 * Properties for a controlled responsive material-detail card page.
 *
 * @template T - Related material record type.
 */
type MaterialResultPageProps<T> = {
  /** Accessible pagination name. */
  ariaLabel: string;
  /**
   * Renders the current page.
   *
   * @param items - Records on the current page.
   * @returns Rendered cards for the records.
   */
  children(items: T[]): ReactNode;
  /** Complete related result set. */
  items: T[];
  /**
   * Updates the one-based URL page parameter.
   *
   * @param page - Next one-based page.
   */
  onPageChange(page: number): void;
  /** Requested one-based URL page. */
  requestedPage: number;
};

/**
 * Renders controlled, viewport-aware card pagination.
 *
 * @param props - Responsive pagination properties.
 * @returns The current card page and pagination controls.
 * @template T - Related material record type.
 */
export function MaterialResultPage<T>({
  ariaLabel,
  children,
  items,
  onPageChange,
  requestedPage,
}: MaterialResultPageProps<T>) {
  const t = useCatalogCopy();
  const [pageSize, setPageSize] = useState<number | null>(null);
  useEffect(() => {
    /**
     * Synchronizes the page size with the active viewport tier.
     *
     * @returns Nothing.
     */
    const updatePageSize = () => setPageSize(getMaterialPageSize(innerWidth));
    updatePageSize();
    addEventListener("resize", updatePageSize);
    return () => removeEventListener("resize", updatePageSize);
  }, []);
  const renderedPageSize = pageSize ?? 12;
  const page = clampMaterialPage(requestedPage, items.length, renderedPageSize);
  const pageCount = Math.max(1, Math.ceil(items.length / renderedPageSize));
  useEffect(() => {
    if (pageSize !== null && page !== requestedPage) onPageChange(page);
  }, [onPageChange, page, pageSize, requestedPage]);

  return (
    <>
      {children(
        items.slice((page - 1) * renderedPageSize, page * renderedPageSize),
      )}
      {pageCount > 1 ? (
        <nav
          aria-label={ariaLabel}
          className="flex items-center justify-center gap-3 pt-2"
        >
          <Button
            aria-label={t("web.collections.gallery.previousPage")}
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronLeft />
          </Button>
          <output aria-live="polite" className="text-sm">
            {t("web.collections.gallery.pageStatus", { page, pageCount })}
          </output>
          <Button
            aria-label={t("web.collections.gallery.nextPage")}
            disabled={page === pageCount}
            onClick={() => onPageChange(page + 1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronRight />
          </Button>
        </nav>
      ) : null}
    </>
  );
}

/** Properties for a material's public product card. */
type MaterialProductCardProps = {
  /** Public product to render. */
  product: CatalogProduct;
};

/**
 * Renders one public product card with a typed detail link.
 *
 * @param props - Product-card properties.
 * @param props.product - Public product to render.
 * @returns A linked public product card.
 */
function MaterialProductCard({ product }: MaterialProductCardProps) {
  const t = useCatalogCopy();
  return (
    <div className="group relative focus-within:ring-2 focus-within:ring-ring">
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
        imageAlt={t("web.resources.detail.imageAlt", { name: product.name })}
        imageCountLabel={`${t("web.resources.upload.imagesLabel")}: ${product.imageCount}`}
        materialCountLabel={t("web.catalog.materialCount", {
          count: product.materials.length,
        })}
        privateLabel={t("web.resources.moderation.privateBadge")}
        product={product}
      />
      <ul className="flex flex-wrap gap-x-3 gap-y-1 p-3 text-sm">
        {product.materials.map((material) => (
          <li key={material.assignmentId}>
            <MaterialLink material={material} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Properties for a material's public collection-item card. */
type MaterialCollectionItemCardProps = {
  /** Public collection item to render. */
  item: UserCollectionItem;
};

/**
 * Renders one public collection-item card.
 *
 * @param props - Collection-item-card properties.
 * @param props.item - Public collection item to render.
 * @returns A public collection-item card.
 */
function MaterialCollectionItemCard({ item }: MaterialCollectionItemCardProps) {
  const t = useCatalogCopy();
  const image = item.images[0] ?? item.productImages[0];
  return (
    <article className="flex h-full min-h-72 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
      {image ? (
        <img
          alt={t("web.resources.detail.imageAlt", { name: item.displayName })}
          className="aspect-4/3 w-full object-cover"
          loading="lazy"
          src={cardImageUrl(image.url)}
        />
      ) : null}
      <div className="grid flex-1 content-start gap-2 p-4">
        <h3 className="font-semibold">{item.displayName}</h3>
        {item.material ? (
          <p className="text-sm text-muted-foreground">
            <MaterialLink material={item.material} />
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {item.collectionName}
          {item.ownerUsername ? (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden="true"> · </span>
              <PublicProfileAvatar
                imageUrl={item.ownerImageUrl}
                username={item.ownerUsername}
              />
              {item.ownerUsername}
            </span>
          ) : null}
        </p>
        <Link
          className="mt-2 w-fit text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          params={{
            collectionId: item.collectionId,
            collectionItemId: item.collectionItemId,
            userId: item.ownerUserId,
          }}
          to="/collections/$userId/$collectionId/$collectionItemId"
        >
          {t("web.action.viewItem")}
        </Link>
      </div>
    </article>
  );
}

/**
 * Renders one material's content and independently paginated public relations.
 *
 * @param props - Material detail properties.
 * @returns The public material detail page.
 */
export function MaterialDetailPage({
  collectionItemsPage,
  material,
  onCollectionItemsPageChange,
  onProductsPageChange,
  productsPage,
}: {
  /** Requested one-based collection-item page. */
  collectionItemsPage: number;
  /** Material and its public relations. */
  material: PublicMaterial;
  /**
   * Updates the collection-item page without replacing product pagination.
   *
   * @param page - Next one-based collection-item page.
   */
  onCollectionItemsPageChange(page: number): void;
  /**
   * Updates the product page without replacing collection-item pagination.
   *
   * @param page - Next one-based product page.
   */
  onProductsPageChange(page: number): void;
  /** Requested one-based product page. */
  productsPage: number;
}) {
  const t = useCatalogCopy();
  const name = material.specific?.name ?? material.name;
  return (
    <AppShell
      breadcrumbItems={[
        { label: t("web.navigation.materials"), to: "/materials" },
        ...(material.specific
          ? [
              {
                label: material.name,
                to: "/materials/$materialSlug" as const,
                params: { materialSlug: material.slug },
              },
            ]
          : []),
      ]}
      meta={
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>
            {t("web.materials.count.products", {
              count: material.productCount,
            })}
          </span>
          <span>
            {t("web.materials.count.collectionItems", {
              count: material.collectionItemCount,
            })}
          </span>
        </div>
      }
      title={name}
    >
      <main className="mx-auto grid w-full max-w-7xl gap-10 p-4 md:p-6">
        {material.images.length ? (
          <ImageGallery
            alt={t("web.materials.image.alt", { name })}
            closeLabel={t("web.resources.action.closeImage")}
            groups={[{ images: material.images }]}
            label={t("web.resources.upload.imagesLabel")}
            nextLabel={t("web.resources.action.nextImage")}
            previousLabel={t("web.resources.action.previousImage")}
          />
        ) : material.specific ? (
          <EmptyState>{t("web.materials.specific.noImages")}</EmptyState>
        ) : null}
        {material.specifics.length ? (
          <section aria-labelledby="material-specifics" className="grid gap-3">
            <h2 id="material-specifics" className="text-xl font-semibold">
              {t("web.materials.specific.title")}
            </h2>
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {material.specifics.map((specific) => (
                <li key={specific.id}>
                  <MaterialLink material={{ ...material, specific }} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {material.description ? (
          <MarkdownContent
            className="rounded-xl border border-border bg-card p-6 text-[13.5px] leading-[1.6] text-card-foreground"
            markdown={material.description}
          />
        ) : null}

        <section aria-labelledby="material-products" className="grid gap-4">
          <h2 className="text-xl font-semibold" id="material-products">
            {t("web.materials.detail.products")}
          </h2>
          {material.products.length ? (
            <MaterialResultPage
              ariaLabel={t("web.materials.detail.productsPagination")}
              items={material.products}
              onPageChange={onProductsPageChange}
              requestedPage={productsPage}
            >
              {(products) => (
                <div className="grid grid-cols-1 gap-[18px] min-[481px]:grid-cols-2 lg:grid-cols-3 min-[1281px]:grid-cols-4">
                  {products.map((product) => (
                    <MaterialProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </MaterialResultPage>
          ) : (
            <EmptyState>
              {t(
                material.specific
                  ? "web.materials.specific.noProducts"
                  : "web.materials.detail.noProducts",
              )}
            </EmptyState>
          )}
        </section>

        <section
          aria-labelledby="material-collection-items"
          className="grid gap-4"
        >
          <h2 className="text-xl font-semibold" id="material-collection-items">
            {t("web.materials.detail.collectionItems")}
          </h2>
          {material.collectionItems.length ? (
            <MaterialResultPage
              ariaLabel={t("web.materials.detail.collectionItemsPagination")}
              items={material.collectionItems}
              onPageChange={onCollectionItemsPageChange}
              requestedPage={collectionItemsPage}
            >
              {(items) => (
                <div className="grid grid-cols-1 gap-[18px] min-[481px]:grid-cols-2 lg:grid-cols-3 min-[1281px]:grid-cols-4">
                  {items.map((item) => (
                    <MaterialCollectionItemCard
                      item={item}
                      key={item.collectionItemId}
                    />
                  ))}
                </div>
              )}
            </MaterialResultPage>
          ) : (
            <EmptyState>
              {t(
                material.specific
                  ? "web.materials.specific.noCollectionItems"
                  : "web.materials.detail.noCollectionItems",
              )}
            </EmptyState>
          )}
        </section>
      </main>
    </AppShell>
  );
}

/** Properties for a bordered empty state. */
type EmptyStateProps = {
  /** Empty-state copy. */
  children: ReactNode;
};

/**
 * Renders a bordered empty state.
 *
 * @param props - Empty-state properties.
 * @param props.children - Empty-state copy.
 * @returns A bordered empty state.
 */
function EmptyState({ children }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
      {children}
    </div>
  );
}
