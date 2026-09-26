import type {
  CatalogFinishOption,
  CatalogProduct,
  PublicCollectionOwner,
  UserCollectionItem,
  UserCollectionSummary,
} from "@package/services";
import type { TranslationKey } from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  CatalogFilterBar,
  type CatalogFilterCopy,
} from "@/components/catalog-filter-bar";
import { CollectionCard } from "@/components/collection-card";
import { ImageGallery } from "@/components/image-gallery";
import { MakerLink } from "@/components/maker-link";
import { MarkdownContent } from "@/components/markdown-content";
import { ProductCard } from "@/components/product-card";
import { PublicResourceSwitch } from "@/components/resource-visibility-toggle";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { finishOptionLabel } from "@/lib/catalog";
import {
  setCollectionItemVisibility,
  setCollectionVisibility,
  setProductVisibility,
} from "@/lib/catalog-api";
import { useCatalogCopy } from "@/lib/catalog-copy";
import {
  buildCatalogFacets,
  type CatalogFilters,
  collectionFilterItem,
  emptyCatalogFilters,
  hasCatalogFilters,
  matchesCatalogFilters,
  productFilterItem,
} from "@/lib/catalog-filters";
import { cn } from "@/lib/utils";

function catalogFilterCopy(
  t: ReturnType<typeof useCatalogCopy>,
): CatalogFilterCopy {
  return {
    all: t("web.archive.filter.all"),
    any: t("web.archive.filter.any"),
    apply: t("action.save"),
    clear: t("web.action.clearAllFilters"),
    close: t("web.action.close"),
    colors: t("web.catalog.field.colors"),
    description: t("web.catalog.filter.description"),
    fadeName: (colors) => t("web.catalog.filter.fadeName", { colors }),
    filters: t("web.archive.filters"),
    finishes: t("web.catalog.field.finishes"),
    maker: t("web.catalog.field.maker"),
    matchMode: t("web.archive.filter.matchMode"),
    materials: t("web.catalog.field.materials"),
    more: t("web.action.more"),
    moreFilters: t("web.action.moreFilters"),
    moreOptions: (label) => t("web.catalog.filter.moreOptions", { label }),
    productType: t("web.catalog.field.productType"),
    productTypeAll: t("web.catalog.filter.productTypeAll"),
    selectMaker: t("web.catalog.selectMaker"),
    selectProductType: t("web.catalog.selectProductType"),
  };
}

export function HomePage() {
  const t = useCatalogCopy();
  const cards = [
    {
      image: "https://cdn.pocket-trash.app/assets/products.webp",
      key: "web.navigation.products" as const,
      to: "/products" as const,
    },
    {
      image: "https://cdn.pocket-trash.app/assets/collections.webp",
      key: "web.navigation.collections" as const,
      to: "/collections" as const,
    },
    {
      image: "https://cdn.pocket-trash.app/assets/resosurces.webp",
      key: "web.navigation.resources" as const,
      to: "/resources" as const,
    },
  ];

  return (
    <AppShell title={t("web.site.name")}>
      <main className="grid gap-[18px] p-4 md:grid-cols-3 md:p-[18px_22px_22px]">
        {cards.map(({ image, key, to }) => (
          <Link
            className="group overflow-hidden rounded-xl border border-border bg-card text-card-foreground transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            key={to}
            to={to}
          >
            <img
              alt=""
              className="aspect-4/3 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              sizes="(min-width: 96rem) 480px, (min-width: 48rem) 33vw, 100vw"
              src={`${image}?width=640`}
              srcSet={`${image}?width=320 320w, ${image}?width=480 480w, ${image}?width=640 640w, ${image}?width=960 960w, ${image}?width=1440 1440w`}
            />
            <div className="p-5 text-xl font-semibold">{t(key)}</div>
          </Link>
        ))}
      </main>
    </AppShell>
  );
}

export function ResourcesPage() {
  const t = useCatalogCopy();
  return (
    <AppShell title={t("web.navigation.resources")}>
      <main className="mx-auto max-w-3xl p-6 text-muted-foreground">
        {t("web.page.resources.stub")}
      </main>
    </AppShell>
  );
}

export function ProductsPage({
  filters = emptyCatalogFilters(),
  onFiltersChange,
  products,
}: {
  filters?: CatalogFilters;
  onFiltersChange?: React.Dispatch<React.SetStateAction<CatalogFilters>>;
  products: CatalogProduct[];
}) {
  const t = useCatalogCopy();
  const filtered = products.filter((product) =>
    matchesCatalogFilters(productFilterItem(product), filters),
  );
  const facets = buildCatalogFacets(
    products.map(productFilterItem),
    filters.productType,
  );
  return (
    <AppShell
      headerActions={
        onFiltersChange ? (
          <CatalogFilterBar
            action={
              <Link
                className={buttonVariants({ size: "sm" })}
                to="/products/add"
              >
                {t("web.action.addProduct")}
              </Link>
            }
            copy={catalogFilterCopy(t)}
            facets={facets}
            filters={filters}
            onChange={onFiltersChange}
          />
        ) : undefined
      }
      title={t("web.navigation.products")}
    >
      <ProductGrid products={filtered} />
    </AppShell>
  );
}

export function ProductDetailPage({
  collectionItems = [],
  product,
}: {
  collectionItems?: UserCollectionItem[];
  product: CatalogProduct;
}) {
  const t = useCatalogCopy();
  if (
    product.productTypeSlug !== "spinner" &&
    product.productTypeSlug !== "spinner-button"
  ) {
    return (
      <AppShell
        breadcrumbItems={[
          { label: t("web.navigation.products"), to: "/products" },
        ]}
        title={product.name}
      >
        <main className="mx-auto max-w-3xl p-6">
          <EmptyState>{t("web.catalog.notImplemented")}</EmptyState>
        </main>
      </AppShell>
    );
  }
  const specs: Array<[TranslationKey, string | null, string]> =
    product.productTypeSlug === "spinner"
      ? [
          ["web.archive.spec.weight", product.weightG, "g"],
          ["web.archive.spec.length", product.lengthMm, "mm"],
          ["web.catalog.field.width", product.widthMm, "mm"],
          ["web.catalog.field.thickness", product.thicknessMm, "mm"],
          [
            "web.catalog.field.thicknessWithButton",
            product.thicknessWithButtonMm,
            "mm",
          ],
          ["web.catalog.field.buttonDiameter", product.buttonDiameterMm, "mm"],
          ["web.catalog.field.spinDiameter", product.spinDiameterMm, "mm"],
        ]
      : [
          ["web.archive.spec.weight", product.weightG, "g"],
          ["web.archive.spec.diameter", product.diameterMm, "mm"],
          ["web.catalog.field.thickness", product.thicknessMm, "mm"],
        ];

  return (
    <AppShell
      breadcrumbItems={[
        { label: t("web.navigation.products"), to: "/products" },
      ]}
      headerActions={
        <div className="flex items-center gap-2">
          <Link
            className={buttonVariants({ variant: "outline" })}
            search={{ product: product.id }}
            to="/collections/add"
          >
            {t("web.action.addToCollection")}
          </Link>
          {product.canEdit ? (
            <>
              <Link
                className={buttonVariants({ variant: "outline" })}
                params={{
                  productSlug: product.slug,
                  productTypeSlug: product.productTypeSlug,
                }}
                to="/products/$productTypeSlug/$productSlug/edit"
              >
                {t("web.action.edit")}
              </Link>
              <VisibilityButton
                canAdminister={product.canAdminister}
                initialPrivate={product.isPrivate}
                isAdminPrivate={product.isAdminPrivate}
                isOwner={Boolean(product.isOwner)}
                onChange={(isPrivate, reason) =>
                  setProductVisibility({
                    data: { isPrivate, productId: product.id, reason },
                  })
                }
                t={t}
              />
            </>
          ) : null}
        </div>
      }
      title={product.name}
    >
      <main className="mx-auto grid max-w-5xl gap-6 p-6">
        {product.isPrivate ? (
          <Badge className="w-fit" variant="secondary">
            {t("web.resources.moderation.privateBadge")}
          </Badge>
        ) : null}
        {product.images.find(({ deletedAt }) => !deletedAt) ? (
          <img
            alt={t("web.resources.detail.imageAlt", { name: product.name })}
            className="aspect-4/3 w-full rounded-xl border border-border object-cover"
            src={product.images.find(({ deletedAt }) => !deletedAt)?.url}
          />
        ) : null}
        <ImageGallery
          alt={t("web.resources.detail.imageAlt", { name: product.name })}
          closeLabel={t("web.resources.action.closeImage")}
          groups={[
            { images: product.images.filter(({ deletedAt }) => !deletedAt) },
          ]}
          label={t("web.resources.upload.imagesLabel")}
          nextLabel={t("web.resources.action.nextImage")}
          previousLabel={t("web.resources.action.previousImage")}
        />
        {product.description ? (
          <MarkdownContent
            className="rounded-xl border border-border bg-card p-6 text-card-foreground"
            markdown={product.description}
          />
        ) : null}
        <dl className="grid gap-4 rounded-xl border border-border bg-card p-6 sm:grid-cols-2">
          <Detail label={t("web.catalog.field.productType")}>
            {product.productTypeName}
          </Detail>
          <Detail label={t("web.catalog.field.maker")}>
            <MakerLink name={product.makerName} url={product.makerUrl} />
          </Detail>
          {product.makerProductUrl && product.makerProductUrlValid ? (
            <Detail label={t("web.catalog.field.makerProductUrl")}>
              <MakerLink
                name={t("web.action.visitProductPage")}
                url={product.makerProductUrl}
              />
            </Detail>
          ) : null}
          <Detail label={t("web.catalog.field.materials")}>
            {product.materials.map(({ name }) => name).join(", ")}
          </Detail>
          {product.finishOptions.length ? (
            <Detail label={t("web.catalog.field.finishOptions")}>
              <ul className="grid gap-1">
                {product.finishOptions.map((option) => (
                  <li key={option.id}>{localizedFinishLabel(option, t)}</li>
                ))}
              </ul>
            </Detail>
          ) : null}
          {product.productTypeSlug === "spinner" ? (
            <Detail label={t("web.catalog.field.button")}>
              {product.compatibleButtonName ?? t("web.catalog.defaultButton")}
            </Detail>
          ) : null}
          {product.productTypeSlug === "spinner" && product.bearing ? (
            <Detail label={t("web.catalog.field.bearing")}>
              {product.bearing}
            </Detail>
          ) : null}
          {specs.map(([key, value, unit]) =>
            value ? (
              <Detail key={key} label={t(key)}>
                {value} {unit}
              </Detail>
            ) : null,
          )}
        </dl>
        <section className="grid gap-4">
          <h2 className="text-lg font-semibold">
            {t("web.catalog.collectionsWithProduct")}
          </h2>
          {collectionItems.length ? (
            <ul className="grid gap-3 lg:grid-cols-2">
              {collectionItems.map((item) => (
                <li
                  className="grid gap-3 rounded-xl border border-border bg-card p-4"
                  key={item.collectionItemId}
                >
                  <div>
                    <h3 className="font-semibold">{item.collectionName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {item.displayName}
                      {item.ownerUsername ? ` · ${item.ownerUsername}` : ""}
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Link
                      className={buttonVariants({
                        size: "sm",
                        variant: "outline",
                      })}
                      params={{
                        collectionId: item.collectionId,
                        collectionItemId: item.collectionItemId,
                        userId: item.ownerUserId,
                      }}
                      to="/collections/$userId/$collectionId/$collectionItemId"
                    >
                      <span className="sm:hidden">{t("web.action.view")}</span>
                      <span className="hidden sm:inline">
                        {t("web.action.viewItem")}
                      </span>
                    </Link>
                    <Link
                      className={buttonVariants({
                        size: "sm",
                        variant: "outline",
                      })}
                      params={{
                        collectionId: item.collectionId,
                        userId: item.ownerUserId,
                      }}
                      to="/collections/$userId/$collectionId"
                    >
                      <span className="sm:hidden">
                        {t("web.collections.field.collection")}
                      </span>
                      <span className="hidden sm:inline">
                        {t("web.action.viewCollection")}
                      </span>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </main>
    </AppShell>
  );
}

export function PublicCollectionsPage({
  filters = emptyCatalogFilters(),
  onFiltersChange,
  owners,
}: {
  filters?: CatalogFilters;
  onFiltersChange?: React.Dispatch<React.SetStateAction<CatalogFilters>>;
  owners: PublicCollectionOwner[];
}) {
  const t = useCatalogCopy();
  const publicItems = owners.flatMap(({ items }) =>
    items.filter(
      ({ collectionIsPrivate, isPrivate }) =>
        !(collectionIsPrivate || isPrivate),
    ),
  );
  const matchingCollectionIds = new Set(
    publicItems
      .filter((item) =>
        matchesCatalogFilters(collectionFilterItem(item), filters),
      )
      .map(({ collectionId }) => collectionId),
  );
  const collections = owners
    .flatMap((owner) =>
      owner.collections
        .filter(({ isPrivate }) => !isPrivate)
        .map((collection) => ({ collection, owner })),
    )
    .filter(
      ({ collection }) =>
        !hasCatalogFilters(filters) || matchingCollectionIds.has(collection.id),
    )
    .sort(
      (left, right) =>
        right.collection.updatedAt.getTime() -
        left.collection.updatedAt.getTime(),
    );
  const facets = buildCatalogFacets(
    publicItems.map(collectionFilterItem),
    filters.productType,
  );
  return (
    <AppShell
      headerActions={
        onFiltersChange ? (
          <CatalogFilterBar
            copy={catalogFilterCopy(t)}
            facets={facets}
            filters={filters}
            onChange={onFiltersChange}
          />
        ) : undefined
      }
      title={t("web.navigation.collections")}
    >
      <main className="grid gap-[18px] p-4 sm:grid-cols-2 lg:grid-cols-3 md:p-[18px_22px_22px]">
        {collections.length ? (
          collections.map(({ collection, owner }) => (
            <Link
              className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              key={collection.id}
              params={{ collectionId: collection.id, userId: owner.userId }}
              to="/collections/$userId/$collectionId"
            >
              <CollectionCard
                collection={collection}
                coverAlt={t("web.resources.detail.imageAlt", {
                  name: collection.name,
                })}
                itemCountLabel={t("web.collections.directory.itemCount", {
                  count: collection.itemCount,
                })}
                ownerName={owner.username}
                privateLabel={t("web.resources.visibility.private")}
              />
            </Link>
          ))
        ) : (
          <EmptyState>{t("web.collections.empty")}</EmptyState>
        )}
      </main>
    </AppShell>
  );
}

export function PublicCollectionPage({
  owner,
}: {
  owner: PublicCollectionOwner;
}) {
  const t = useCatalogCopy();
  return (
    <AppShell
      breadcrumbItems={[
        { label: t("web.navigation.collections"), to: "/collections" },
      ]}
      meta={t("web.collections.directory.itemCount", {
        count: owner.itemCount,
      })}
      title={owner.username}
    >
      <main className="grid grid-cols-1 gap-[18px] p-3 min-[481px]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(max(240px,calc((100%_-_4_*_18px)_/_5)),1fr))] md:p-[18px_22px_22px]">
        {owner.collections.map((collection) => (
          <Link
            className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            key={collection.id}
            params={{ collectionId: collection.id, userId: owner.userId }}
            to="/collections/$userId/$collectionId"
          >
            <CollectionCard
              collection={collection}
              coverAlt={t("web.resources.detail.imageAlt", {
                name: collection.name,
              })}
              itemCountLabel={t("web.collections.directory.itemCount", {
                count: collection.itemCount,
              })}
              privateLabel={t("web.resources.visibility.private")}
            />
          </Link>
        ))}
      </main>
    </AppShell>
  );
}

export function UserCollectionsPage({
  collections,
  filters = emptyCatalogFilters(),
  items,
  onFiltersChange,
}: {
  collections: UserCollectionSummary[];
  filters?: CatalogFilters;
  items: UserCollectionItem[];
  onFiltersChange?: React.Dispatch<React.SetStateAction<CatalogFilters>>;
}) {
  const t = useCatalogCopy();
  const matchingIds = new Set(
    items
      .filter((item) =>
        matchesCatalogFilters(collectionFilterItem(item), filters),
      )
      .map(({ collectionId }) => collectionId),
  );
  const filtered = hasCatalogFilters(filters)
    ? collections.filter(({ id }) => matchingIds.has(id))
    : collections;
  const facets = buildCatalogFacets(
    items.map(collectionFilterItem),
    filters.productType,
  );
  return (
    <AppShell
      breadcrumbItems={[{ label: t("web.navigation.user"), to: "/user" }]}
      headerActions={
        <>
          {onFiltersChange ? (
            <CatalogFilterBar
              copy={catalogFilterCopy(t)}
              facets={facets}
              filters={filters}
              onChange={onFiltersChange}
            />
          ) : null}
          <Link
            className={buttonVariants({ variant: "outline" })}
            to="/user/collections/add"
          >
            {t("web.action.addCollection")}
          </Link>
        </>
      }
      title={t("web.navigation.collections")}
    >
      <main className="grid grid-cols-1 gap-[18px] p-3 min-[481px]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(max(240px,calc((100%_-_4_*_18px)_/_5)),1fr))] md:p-[18px_22px_22px]">
        {filtered.length ? (
          filtered.map((collection) => (
            <Link
              className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              key={collection.id}
              params={{ collectionId: collection.id }}
              to="/user/collections/$collectionId"
            >
              <CollectionCard
                collection={collection}
                coverAlt={t("web.resources.detail.imageAlt", {
                  name: collection.name,
                })}
                itemCountLabel={t("web.collections.directory.itemCount", {
                  count: collection.itemCount,
                })}
                privateLabel={t("web.resources.visibility.private")}
              />
            </Link>
          ))
        ) : (
          <EmptyState>{t("web.collections.emptyCollections")}</EmptyState>
        )}
      </main>
    </AppShell>
  );
}

export function CollectionPage({
  collection,
  filters = emptyCatalogFilters(),
  items,
  onFiltersChange,
  ownerUsername,
}: {
  collection: UserCollectionSummary;
  filters?: CatalogFilters;
  items: UserCollectionItem[];
  onFiltersChange?: React.Dispatch<React.SetStateAction<CatalogFilters>>;
  ownerUsername?: string;
}) {
  const t = useCatalogCopy();
  const filtered = items.filter((item) =>
    matchesCatalogFilters(collectionFilterItem(item), filters),
  );
  const facets = buildCatalogFacets(
    items.map(collectionFilterItem),
    filters.productType,
  );
  return (
    <AppShell
      breadcrumbItems={[
        {
          label: t("web.navigation.collections"),
          to: collection.isOwner ? "/user/collections" : "/collections",
        },
        ...(ownerUsername
          ? [
              {
                label: ownerUsername,
                params: { userId: collection.ownerUserId },
                to: "/collections/$userId" as const,
              },
            ]
          : []),
      ]}
      headerActions={
        <>
          {onFiltersChange ? (
            <CatalogFilterBar
              copy={catalogFilterCopy(t)}
              facets={facets}
              filters={filters}
              onChange={onFiltersChange}
            />
          ) : null}
          {collection.canEdit ? (
            <>
              <Link className={buttonVariants()} to="/collections/add">
                {t("web.action.addToCollection")}
              </Link>
              <Link
                className={buttonVariants({ variant: "outline" })}
                params={{ collectionId: collection.id }}
                to="/user/collections/$collectionId/edit"
              >
                {t("web.action.edit")}
              </Link>
              <VisibilityButton
                canAdminister={Boolean(collection.canAdminister)}
                initialPrivate={collection.isPrivate}
                isAdminPrivate={collection.isAdminPrivate}
                isOwner={Boolean(collection.isOwner)}
                onChange={(isPrivate, reason) =>
                  setCollectionVisibility({
                    data: { collectionId: collection.id, isPrivate, reason },
                  })
                }
                t={t}
              />
            </>
          ) : null}
        </>
      }
      meta={t("web.collections.directory.itemCount", {
        count: collection.itemCount,
      })}
      title={collection.name}
    >
      <main className="grid gap-6 p-3 md:p-[18px_22px_22px]">
        {collection.coverImage ? (
          <img
            alt={t("web.resources.detail.imageAlt", {
              name: collection.name,
            })}
            className="mx-auto aspect-4/3 w-full max-w-5xl rounded-xl border border-border object-cover"
            src={collection.coverImage.url}
          />
        ) : null}
        <section className="grid grid-cols-1 gap-[18px] min-[481px]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(max(240px,calc((100%_-_4_*_18px)_/_5)),1fr))]">
          {filtered.length ? (
            filtered.map((item) => (
              <article
                className="group relative flex h-[28rem] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground hover:border-primary focus-within:ring-2 focus-within:ring-ring"
                key={item.collectionItemId}
              >
                <Link
                  className="absolute inset-0 z-10 outline-none"
                  params={{
                    collectionId: collection.id,
                    collectionItemId: item.collectionItemId,
                    userId: item.ownerUserId,
                  }}
                  to="/collections/$userId/$collectionId/$collectionItemId"
                >
                  <span className="sr-only">{item.displayName}</span>
                </Link>
                {[...item.images, ...item.productImages].find(
                  ({ deletedAt }) => !deletedAt,
                ) ? (
                  <img
                    alt={t("web.resources.detail.imageAlt", {
                      name: item.displayName,
                    })}
                    className="aspect-4/3 w-full shrink-0 border-b border-border object-cover"
                    src={
                      [...item.images, ...item.productImages].find(
                        ({ deletedAt }) => !deletedAt,
                      )?.url
                    }
                  />
                ) : null}
                <div className="p-5">
                  <h2 className="font-semibold">{item.displayName}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.productTypeName} · {item.makerName}
                  </p>
                  {item.material ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {item.material.name}
                    </p>
                  ) : null}
                  {item.finishOption ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {localizedFinishLabel(item.finishOption, t)}
                    </p>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <EmptyState>{t("web.collections.empty")}</EmptyState>
          )}
        </section>
      </main>
    </AppShell>
  );
}

export function ProductGrid({ products }: { products: CatalogProduct[] }) {
  const t = useCatalogCopy();
  if (!products.length) {
    return <EmptyState>{t("web.catalog.noProducts")}</EmptyState>;
  }
  return (
    <section className="grid grid-cols-1 gap-[18px] p-3 min-[481px]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(max(240px,calc((100%_-_4_*_18px)_/_5)),1fr))] md:p-[18px_22px_22px]">
      {products.map((product) => (
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
            imageCountLabel={`${t("web.resources.upload.imagesLabel")}: ${product.imageCount}`}
            materialCountLabel={t("web.catalog.materialCount", {
              count: product.materials.length,
            })}
            privateLabel={t("web.resources.moderation.privateBadge")}
            product={product}
          />
        </div>
      ))}
    </section>
  );
}

export function CollectionItemDetailPage({
  installedButton = null,
  item,
}: {
  installedButton?: UserCollectionItem | null;
  item: UserCollectionItem;
}) {
  const t = useCatalogCopy();
  const ownImages = item.images.filter(({ deletedAt }) => !deletedAt);
  const productImages = item.productImages.filter(
    ({ deletedAt }) => !deletedAt,
  );
  return (
    <AppShell
      breadcrumbItems={[
        { label: t("web.navigation.collections"), to: "/collections" },
        ...(item.ownerUsername
          ? [
              {
                label: item.ownerUsername,
                params: { userId: item.ownerUserId },
                to: "/collections/$userId" as const,
              },
              { label: item.collectionName },
            ]
          : []),
      ]}
      headerActions={
        item.canEdit ? (
          <div className="flex items-center gap-2">
            <Link
              className={buttonVariants({ variant: "outline" })}
              params={{ collectionItemId: item.collectionItemId }}
              to="/collections/edit/$collectionItemId"
            >
              {t("web.action.edit")}
            </Link>
            <VisibilityButton
              canAdminister={item.canAdminister}
              disabled={item.collectionIsPrivate}
              initialPrivate={item.isPrivate}
              isAdminPrivate={item.isAdminPrivate}
              isOwner={Boolean(item.isOwner)}
              onChange={(isPrivate, reason) =>
                setCollectionItemVisibility({
                  data: {
                    collectionItemId: item.collectionItemId,
                    isPrivate,
                    reason,
                  },
                })
              }
              t={t}
            />
          </div>
        ) : null
      }
      title={item.displayName}
    >
      <main className="mx-auto grid w-full max-w-5xl gap-6 p-6">
        {item.isPrivate || item.collectionIsPrivate ? (
          <Badge className="w-fit" variant="secondary">
            {t("web.resources.moderation.privateBadge")}
          </Badge>
        ) : null}
        {[...ownImages, ...productImages][0] ? (
          <img
            alt={t("web.resources.detail.imageAlt", {
              name: item.displayName,
            })}
            className="aspect-4/3 w-full rounded-xl border border-border object-cover"
            src={[...ownImages, ...productImages][0]?.url}
          />
        ) : null}
        <dl className="grid gap-4 rounded-xl border border-border bg-card p-6 sm:grid-cols-2">
          <Detail label={t("web.catalog.field.name")}>{item.name}</Detail>
          <Detail label={t("web.catalog.field.productType")}>
            {item.productTypeName}
          </Detail>
          <Detail label={t("web.catalog.field.maker")}>
            <MakerLink name={item.makerName} url={item.makerUrl} />
          </Detail>
          {item.material ? (
            <Detail label={t("web.catalog.field.materials")}>
              {item.material.name}
            </Detail>
          ) : null}
          {item.finishOption ? (
            <Detail label={t("web.catalog.field.finishOptions")}>
              {localizedFinishLabel(item.finishOption, t)}
            </Detail>
          ) : null}
          {item.productTypeSlug === "spinner" ? (
            <Detail label={t("web.catalog.field.button")}>
              {installedButton ? (
                <div className="grid gap-1">
                  <span>{installedButton.displayName}</span>
                  {installedButton.material ? (
                    <span className="text-sm text-muted-foreground">
                      {installedButton.material.name}
                    </span>
                  ) : null}
                  {installedButton.finishOption ? (
                    <span className="text-sm text-muted-foreground">
                      {localizedFinishLabel(installedButton.finishOption, t)}
                    </span>
                  ) : null}
                </div>
              ) : (
                t("web.catalog.defaultButton")
              )}
            </Detail>
          ) : null}
          {item.productTypeSlug === "spinner" && item.bearing ? (
            <Detail label={t("web.catalog.field.bearing")}>
              {item.bearing}
            </Detail>
          ) : null}
        </dl>
        {item.description ? (
          <MarkdownContent
            className="rounded-xl border border-border bg-card p-6 text-card-foreground"
            markdown={item.description}
          />
        ) : null}
        <Link
          className={buttonVariants({ variant: "outline" })}
          params={{
            productSlug: item.productSlug,
            productTypeSlug: item.productTypeSlug,
          }}
          to="/products/$productTypeSlug/$productSlug"
        >
          {t("web.action.viewProductDetails")}
        </Link>
        <ImageGallery
          alt={t("web.resources.detail.imageAlt", {
            name: item.displayName,
          })}
          closeLabel={t("web.resources.action.closeImage")}
          groups={[
            { images: ownImages },
            { images: productImages, label: t("web.navigation.products") },
          ]}
          label={t("web.resources.upload.imagesLabel")}
          nextLabel={t("web.resources.action.nextImage")}
          previousLabel={t("web.resources.action.previousImage")}
        />
      </main>
    </AppShell>
  );
}

function VisibilityButton({
  canAdminister,
  disabled = false,
  initialPrivate,
  isAdminPrivate,
  isOwner,
  onChange,
  t,
}: {
  canAdminister: boolean;
  disabled?: boolean;
  initialPrivate: boolean;
  isAdminPrivate: boolean;
  isOwner: boolean;
  onChange(isPrivate: boolean, reason?: string): Promise<unknown>;
  t: ReturnType<typeof useCatalogCopy>;
}) {
  const [isPrivate, setIsPrivate] = useState(initialPrivate);
  const actorIsModerating = canAdminister && !isOwner;
  const locked = disabled || (isAdminPrivate && !actorIsModerating);

  if (!actorIsModerating) {
    return (
      <PublicResourceSwitch
        checked={!isPrivate}
        disabled={locked}
        onCheckedChange={(isPublic) => {
          void onChange(!isPublic).then(() => setIsPrivate(!isPublic));
        }}
      />
    );
  }

  return (
    <button
      aria-pressed={!isPrivate}
      className={buttonVariants({ variant: "outline" })}
      disabled={locked}
      onClick={async () => {
        const nextPrivate = !isPrivate;
        const reason =
          actorIsModerating && nextPrivate
            ? window.prompt(t("web.resources.moderation.reasonLabel"))?.trim()
            : undefined;
        if (actorIsModerating && nextPrivate && !reason) return;
        await onChange(nextPrivate, reason);
        setIsPrivate(nextPrivate);
      }}
      title={
        disabled
          ? t("web.resources.visibility.private")
          : isAdminPrivate
            ? t("web.resources.visibility.adminPrivateTooltip")
            : undefined
      }
      type="button"
    >
      {t(
        isPrivate
          ? "web.resources.visibility.private"
          : "web.resources.visibility.public",
      )}
    </button>
  );
}

function Detail({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "col-span-full rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground",
      )}
    >
      {children}
    </div>
  );
}

function localizedFinishLabel(
  option: CatalogFinishOption,
  t: ReturnType<typeof useCatalogCopy>,
) {
  return finishOptionLabel({
    ...option,
    colorEffect: option.colorEffect
      ? {
          ...option.colorEffect,
          name:
            option.colorEffect.slug === "fade"
              ? t("web.catalog.colorEffect.fade")
              : option.colorEffect.slug === "solid"
                ? t("web.catalog.colorEffect.solid")
                : option.colorEffect.name,
        }
      : null,
  });
}
