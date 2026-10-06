import type {
  CatalogApprovalAction,
  CatalogApprovalStatus,
  CatalogFinishOption,
  CatalogProduct,
  PublicCollectionOwner,
  UserCollectionItem,
  UserCollectionSummary,
} from "@package/services";
import type { TranslationKey } from "@pocket-trash/localizations";
import { Link, useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  CatalogFilterBar,
  type CatalogFilterCopy,
} from "@/components/catalog-filter-bar";
import { CollectionCard } from "@/components/collection-card";
import { CollectionGallery } from "@/components/collection-gallery";
import { ImageGallery } from "@/components/image-gallery";
import { MakerLink } from "@/components/maker-link";
import { MarkdownContent } from "@/components/markdown-content";
import { PaginatedCards } from "@/components/paginated-cards";
import { PermanentDeletionControls } from "@/components/permanent-deletion-controls";
import { ProductCard } from "@/components/product-card";
import { PublicResourceSwitch } from "@/components/resource-visibility-toggle";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { UserPageShell } from "@/components/user-page-shell";
import { finishOptionLabel } from "@/lib/catalog";
import {
  decideCatalogProductApproval,
  decideCollectionItemApproval,
  deleteCatalogProduct,
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

export {
  getCatalogPageSize,
  PaginatedCards,
} from "@/components/paginated-cards";

/**
 * Builds localized copy for catalog filters.
 *
 * @param t - Catalog translation formatter.
 * @returns Localized catalog filter copy.
 */
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
    /**
     * Formats a fade option name.
     *
     * @param colors - Colors included in the fade.
     * @returns The localized fade name.
     */
    fadeName: (colors) => t("web.catalog.filter.fadeName", { colors }),
    filters: t("web.archive.filters"),
    finishes: t("web.catalog.field.finishes"),
    maker: t("web.catalog.field.maker"),
    matchMode: t("web.archive.filter.matchMode"),
    materials: t("web.catalog.field.materials"),
    more: t("web.action.more"),
    moreFilters: t("web.action.moreFilters"),
    /**
     * Formats the label for additional filter options.
     *
     * @param label - Filter label receiving additional options.
     * @returns The localized additional-options label.
     */
    moreOptions: (label) => t("web.catalog.filter.moreOptions", { label }),
    productType: t("web.catalog.field.productType"),
    productTypeAll: t("web.catalog.filter.productTypeAll"),
    selectMaker: t("web.catalog.selectMaker"),
    selectProductType: t("web.catalog.selectProductType"),
  };
}

/**
 * Renders the primary catalog navigation cards.
 *
 * @returns The home page.
 */
export function HomePage() {
  const t = useCatalogCopy();
  const cards = [
    {
      image:
        "https://cdn.pocket-trash.app/assets/static/hero-cards/products.webp",
      key: "web.navigation.products" as const,
      to: "/products" as const,
    },
    {
      image:
        "https://cdn.pocket-trash.app/assets/static/hero-cards/collections.jpg",
      key: "web.navigation.collections" as const,
      to: "/collections" as const,
    },
    {
      image:
        "https://cdn.pocket-trash.app/assets/static/hero-cards/products.webp",
      key: "web.navigation.makers" as const,
      to: "/makers" as const,
    },
    {
      image:
        "https://cdn.pocket-trash.app/assets/static/hero-cards/products.webp",
      key: "web.navigation.materials" as const,
      to: "/materials" as const,
    },
    {
      image:
        "https://cdn.pocket-trash.app/assets/static/hero-cards/resosurces.webp",
      key: "web.navigation.resources" as const,
      to: "/resources" as const,
    },
  ];

  return (
    <AppShell title={t("web.site.name")}>
      <main className="grid gap-[18px] p-4 sm:grid-cols-2 xl:grid-cols-4 md:p-[18px_22px_22px]">
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

/**
 * Renders the resources placeholder page.
 *
 * @returns The resources page.
 */
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

/**
 * Renders the filterable catalog product index.
 *
 * @param props - Product index properties.
 * @param props.filters - Active catalog filters.
 * @param props.onFiltersChange - Optional filter state updater.
 * @param props.products - Catalog products to display.
 * @returns The product index page.
 */
export function ProductsPage({
  filters = emptyCatalogFilters(),
  onFiltersChange,
  products,
}: {
  /** Active catalog filters. */
  filters?: CatalogFilters;
  /** Optional filter state updater. */
  onFiltersChange?: React.Dispatch<React.SetStateAction<CatalogFilters>>;
  /** Catalog products to display. */
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

/**
 * Renders a catalog product and its matching collection items.
 *
 * @param props - Product detail data and related collection items.
 * @param props.collectionItems - Collection items matching the product.
 * @param props.product - Catalog product to display.
 * @returns The catalog product detail page.
 */
export function ProductDetailPage({
  collectionItems = [],
  product,
}: {
  /** Collection items matching the product. */
  collectionItems?: UserCollectionItem[];
  /** Catalog product to display. */
  product: CatalogProduct;
}) {
  const t = useCatalogCopy();
  const navigate = useNavigate();
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
              <PermanentDeletionControls
                name={product.name}
                reasonRequired={!product.isOwner}
                onDelete={async (reason) => {
                  const result = await deleteCatalogProduct({
                    data: { confirmed: true, productId: product.id, reason },
                  });
                  if (!result.ok) throw new Error(result.formError);
                  await navigate({ to: "/products" });
                }}
              />
            </>
          ) : null}
        </div>
      }
      title={product.name}
    >
      <main className="mx-auto grid max-w-5xl gap-6 p-6">
        {product.canAdminister ? (
          <CatalogApprovalControls
            initialStatus={product.approvalStatus}
            onDecide={async ({ action, reason }) => {
              const result = await decideCatalogProductApproval({
                data: { action, productId: product.id, reason },
              });
              if (!result.ok) throw new Error(result.formError);
              return result.approvalStatus;
            }}
          />
        ) : product.approvalStatus !== "approved" ? (
          <Badge className="w-fit" variant="secondary">
            {approvalStatusLabel(t, product.approvalStatus)}
          </Badge>
        ) : null}
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
            className="rounded-xl border border-border bg-card p-6 text-[13.5px] leading-[1.6] text-card-foreground"
            markdown={product.description}
          />
        ) : null}
        <dl className="grid gap-4 rounded-xl border border-border bg-card p-6 sm:grid-cols-2">
          <Detail label={t("web.catalog.field.productType")}>
            {product.productTypeName}
          </Detail>
          <Detail label={t("web.catalog.field.maker")}>
            <MakerLink name={product.makerName} slug={product.makerSlug} />
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

/**
 * Renders public collections with optional catalog filtering.
 *
 * @param props - Public collection directory properties.
 * @param props.filters - Active catalog filters.
 * @param props.onFiltersChange - Optional filter state updater.
 * @param props.owners - Owners and public collections to display.
 * @returns The public collection directory.
 */
export function PublicCollectionsPage({
  filters = emptyCatalogFilters(),
  onFiltersChange,
  owners,
}: {
  /** Active catalog filters. */
  filters?: CatalogFilters;
  /** Optional filter state updater. */
  onFiltersChange?: React.Dispatch<React.SetStateAction<CatalogFilters>>;
  /** Owners and public collections to display. */
  owners: PublicCollectionOwner[];
}) {
  const t = useCatalogCopy();
  const publicItems = owners.flatMap(({ items }) =>
    items.filter(
      ({ approvalStatus, collectionIsPrivate, isPrivate }) =>
        approvalStatus === "approved" && !(collectionIsPrivate || isPrivate),
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
      {collections.length ? (
        <PaginatedCards
          ariaLabel={t("web.navigation.collections")}
          items={collections}
          widePageSize={15}
        >
          {(page) => (
            <main className="grid gap-[18px] p-4 sm:grid-cols-2 lg:grid-cols-3 md:p-[18px_22px_22px]">
              {page.map(({ collection, owner }) => (
                <Link
                  className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  key={collection.id}
                  params={{
                    collectionId: collection.id,
                    userId: owner.userId,
                  }}
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
              ))}
            </main>
          )}
        </PaginatedCards>
      ) : (
        <main className="p-4 md:p-[18px_22px_22px]">
          <EmptyState>{t("web.collections.empty")}</EmptyState>
        </main>
      )}
    </AppShell>
  );
}

/**
 * Renders one owner's public collection cards.
 *
 * @param props - Public collection owner properties.
 * @param props.owner - Owner and collections to display.
 * @returns The public collection owner page.
 */
export function PublicCollectionPage({
  owner,
}: {
  /** Owner and collections to display. */
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
      <PaginatedCards
        ariaLabel={t("web.navigation.collections")}
        items={owner.collections}
        widePageSize={15}
      >
        {(page) => (
          <main className="grid grid-cols-1 gap-[18px] p-3 min-[481px]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(max(240px,calc((100%_-_4_*_18px)_/_5)),1fr))] md:p-[18px_22px_22px]">
            {page.map((collection) => (
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
        )}
      </PaginatedCards>
    </AppShell>
  );
}

/**
 * Renders the signed-in user's collection directory.
 *
 * @param props - User collection directory properties.
 * @param props.collections - User collections to display.
 * @param props.filters - Active catalog filters.
 * @param props.items - Collection items used for filtering.
 * @param props.onFiltersChange - Optional filter state updater.
 * @returns The user collection directory.
 */
export function UserCollectionsPage({
  collections,
  filters = emptyCatalogFilters(),
  items,
  onFiltersChange,
}: {
  /** User collections to display. */
  collections: UserCollectionSummary[];
  /** Active catalog filters. */
  filters?: CatalogFilters;
  /** Collection items used for filtering. */
  items: UserCollectionItem[];
  /** Optional filter state updater. */
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
  const addCollection = (
    <Link
      className={buttonVariants({ variant: "outline" })}
      to="/user/collections/add"
    >
      {t("web.action.addCollection")}
    </Link>
  );
  return (
    <UserPageShell
      contentClassName="p-0"
      section="collections"
      title={t("web.navigation.collections")}
    >
      <main className="grid gap-[18px] p-3 md:p-[18px_22px_22px]">
        {onFiltersChange ? (
          <CatalogFilterBar
            action={addCollection}
            copy={catalogFilterCopy(t)}
            facets={facets}
            filters={filters}
            onChange={onFiltersChange}
          />
        ) : (
          <div className="flex justify-end">{addCollection}</div>
        )}
        {filtered.length ? (
          <PaginatedCards
            ariaLabel={t("web.navigation.collections")}
            items={filtered}
            widePageSize={15}
          >
            {(page) => (
              <section className="grid grid-cols-1 gap-[18px] min-[481px]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(max(240px,calc((100%_-_4_*_18px)_/_5)),1fr))]">
                {page.map((collection) => (
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
                ))}
              </section>
            )}
          </PaginatedCards>
        ) : (
          <section>
            <EmptyState>{t("web.collections.emptyCollections")}</EmptyState>
          </section>
        )}
      </main>
    </UserPageShell>
  );
}

/**
 * Renders a collection summary, gallery, and filtered items.
 *
 * @param props - Collection page properties.
 * @param props.collection - Collection to display.
 * @param props.filters - Active catalog filters.
 * @param props.items - Collection items to display.
 * @param props.onFiltersChange - Optional filter state updater.
 * @param props.ownerUsername - Public owner username shown in navigation.
 * @param props.userArea - Whether the page is rendered in the signed-in user area.
 * @returns The collection page.
 */
export function CollectionPage({
  collection,
  filters = emptyCatalogFilters(),
  items,
  onFiltersChange,
  ownerUsername,
  userArea = false,
}: {
  /** Collection to display. */
  collection: UserCollectionSummary;
  /** Active catalog filters. */
  filters?: CatalogFilters;
  /** Collection items to display. */
  items: UserCollectionItem[];
  /** Optional filter state updater. */
  onFiltersChange?: React.Dispatch<React.SetStateAction<CatalogFilters>>;
  /** Public owner username shown in navigation. */
  ownerUsername?: string;
  /** Whether the page is rendered in the signed-in user area. */
  userArea?: boolean;
}) {
  const t = useCatalogCopy();
  const filtered = items.filter((item) =>
    matchesCatalogFilters(collectionFilterItem(item), filters),
  );
  const facets = buildCatalogFacets(
    items.map(collectionFilterItem),
    filters.productType,
  );
  const filterBar = onFiltersChange ? (
    <CatalogFilterBar
      copy={catalogFilterCopy(t)}
      facets={facets}
      filters={filters}
      onChange={onFiltersChange}
    />
  ) : null;
  const headerActions = (
    <>
      {userArea ? null : filterBar}
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
  );
  const content = (
    <main className="grid gap-6 p-3 md:p-[18px_22px_22px]">
      {userArea ? filterBar : null}
      <CollectionGallery
        collection={collection}
        copy={{
          closeImage: t("web.resources.action.closeImage"),
          gallery: t("web.collections.gallery.title"),
          imageAlt: t("web.resources.detail.imageAlt", {
            name: collection.name,
          }),
          itemCount: t("web.collections.directory.itemCount", {
            count: collection.itemCount,
          }),
          nextImage: t("web.resources.action.nextImage"),
          nextPage: t("web.collections.gallery.nextPage"),
          owner: ownerUsername
            ? t("web.collections.gallery.owner", { owner: ownerUsername })
            : undefined,
          /**
           * Formats collection gallery pagination status.
           *
           * @param page - Current page number.
           * @param pageCount - Total page count.
           * @returns The localized pagination status.
           */
          pageStatus: (page, pageCount) =>
            t("web.collections.gallery.pageStatus", { page, pageCount }),
          previousImage: t("web.resources.action.previousImage"),
          previousPage: t("web.collections.gallery.previousPage"),
          visibility: t(
            collection.isPrivate
              ? "web.resources.visibility.private"
              : "web.resources.visibility.public",
          ),
        }}
      />
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
                {item.approvalStatus !== "approved" ? (
                  <Badge className="mt-2" variant="secondary">
                    {approvalStatusLabel(t, item.approvalStatus)}
                  </Badge>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.productTypeName} ·{" "}
                  <MakerLink
                    className="relative z-20"
                    name={item.makerName}
                    slug={item.makerSlug}
                  />
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
  );
  const meta = t("web.collections.directory.itemCount", {
    count: collection.itemCount,
  });

  if (userArea) {
    return (
      <UserPageShell
        breadcrumbItems={[
          {
            label: t("web.navigation.collections"),
            to: "/user/collections",
          },
        ]}
        contentClassName="p-0"
        headerActions={headerActions}
        meta={meta}
        section="collections"
        title={collection.name}
      >
        {content}
      </UserPageShell>
    );
  }

  return (
    <AppShell
      breadcrumbItems={[
        {
          label: t("web.navigation.collections"),
          to: "/collections",
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
      headerActions={headerActions}
      meta={meta}
      title={collection.name}
    >
      {content}
    </AppShell>
  );
}

/**
 * Renders catalog products as a responsive card grid.
 *
 * @param props - Product grid properties.
 * @param props.products - Catalog products to display.
 * @returns The product grid or its empty state.
 */
export function ProductGrid({
  products,
}: {
  /** Catalog products to display. */
  products: CatalogProduct[];
}) {
  const t = useCatalogCopy();
  if (!products.length) {
    return <EmptyState>{t("web.catalog.noProducts")}</EmptyState>;
  }
  return (
    <PaginatedCards
      ariaLabel={t("web.navigation.products")}
      items={products}
      widePageSize={20}
    >
      {(page) => (
        <section className="grid grid-cols-1 gap-[18px] p-3 min-[481px]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(max(240px,calc((100%_-_4_*_18px)_/_5)),1fr))] md:p-[18px_22px_22px]">
          {page.map((product) => (
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
                approvalLabel={
                  product.approvalStatus === "approved"
                    ? undefined
                    : approvalStatusLabel(t, product.approvalStatus)
                }
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
      )}
    </PaginatedCards>
  );
}

/**
 * Renders shared administrative product and collection-item approval controls.
 *
 * @param props - Current approval state and persistence callback.
 * @returns An accessible approval decision fieldset.
 */
export function CatalogApprovalControls({
  initialStatus,
  onDecide,
  target = "product",
}: {
  /** Entity type used for localized action labels and the legend. */
  target?: "product" | "collectionItem";
  /** Initial durable approval state. */
  initialStatus: CatalogApprovalStatus;
  /**
   * Persists one approval decision.
   *
   * @param input - Administrative action and its nonblank reason.
   * @returns The resulting durable approval state.
   * @rejects When the decision cannot be persisted.
   */
  onDecide(input: {
    /** Requested approval transition. */
    action: CatalogApprovalAction;
    /** Nonblank reason supplied by the administrator. */
    reason: string;
  }): Promise<CatalogApprovalStatus>;
}) {
  const t = useCatalogCopy();
  const reasonId = useId();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState(initialStatus);

  /**
   * Submits one approval action using the current reason.
   *
   * @param action - Requested approval transition.
   * @returns Completion after the UI state settles.
   */
  const decide = async (action: CatalogApprovalAction) => {
    const normalizedReason = reason.trim();
    if (!normalizedReason || pending) return;
    setError(false);
    setPending(true);
    try {
      setStatus(await onDecide({ action, reason: normalizedReason }));
      setReason("");
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <fieldset className="grid gap-3 rounded-xl border border-border bg-card p-4">
      <legend className="px-1 font-semibold">
        {target === "collectionItem"
          ? t("web.catalog.approval.collectionItem.title")
          : t("web.catalog.approval.title")}
      </legend>
      <Badge aria-live="polite" className="w-fit" variant="secondary">
        {approvalStatusLabel(t, status)}
      </Badge>
      <label className="text-sm font-medium" htmlFor={reasonId}>
        {t("web.catalog.approval.reasonLabel")}
      </label>
      <textarea
        className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        disabled={pending}
        id={reasonId}
        maxLength={1000}
        onChange={(event) => setReason(event.target.value)}
        placeholder={t("web.catalog.approval.reasonPlaceholder")}
        required
        value={reason}
      />
      <div className="flex flex-wrap gap-2">
        {status === "pending" ? (
          <>
            <Button
              disabled={!reason.trim() || pending}
              onClick={() => void decide("approve")}
              type="button"
            >
              {target === "collectionItem"
                ? t("web.catalog.approval.collectionItem.approve")
                : t("web.catalog.approval.approve")}
            </Button>
            <Button
              disabled={!reason.trim() || pending}
              onClick={() => void decide("reject")}
              type="button"
              variant="destructive"
            >
              {target === "collectionItem"
                ? t("web.catalog.approval.collectionItem.reject")
                : t("web.catalog.approval.reject")}
            </Button>
          </>
        ) : (
          <Button
            disabled={!reason.trim() || pending}
            onClick={() => void decide("reverse")}
            type="button"
            variant="outline"
          >
            {t("web.catalog.approval.reverse")}
          </Button>
        )}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {t("web.catalog.error.form")}
        </p>
      ) : null}
    </fieldset>
  );
}

/**
 * Localizes a product or collection-item approval state.
 *
 * @param t - Catalog translation function.
 * @param status - Approval state to label.
 * @returns The localized state label.
 */
function approvalStatusLabel(
  t: ReturnType<typeof useCatalogCopy>,
  status: CatalogApprovalStatus,
) {
  if (status === "approved") return t("web.catalog.approval.status.approved");
  if (status === "rejected") return t("web.catalog.approval.status.rejected");
  return t("web.catalog.approval.status.pending");
}

/**
 * Renders one collection item with its effective product details.
 *
 * @param props - Collection item data and its installed button, when present.
 * @param props.installedButton - Installed spinner button, when present.
 * @param props.item - Collection item to display.
 * @returns The collection item detail page.
 */
export function CollectionItemDetailPage({
  installedButton = null,
  item,
}: {
  /** Installed spinner button, when present. */
  installedButton?: UserCollectionItem | null;
  /** Collection item to display. */
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
        {item.canAdminister ? (
          <CatalogApprovalControls
            initialStatus={item.approvalStatus}
            target="collectionItem"
            onDecide={async ({ action, reason }) => {
              const result = await decideCollectionItemApproval({
                data: {
                  action,
                  collectionItemId: item.collectionItemId,
                  reason,
                },
              });
              if (!result.ok) throw new Error(result.formError);
              return result.approvalStatus;
            }}
          />
        ) : item.approvalStatus !== "approved" ? (
          <Badge className="w-fit" variant="secondary">
            {approvalStatusLabel(t, item.approvalStatus)}
          </Badge>
        ) : null}
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
            <MakerLink name={item.makerName} slug={item.makerSlug} />
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
            className="rounded-xl border border-border bg-card p-6 text-[13.5px] leading-[1.6] text-card-foreground"
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

/**
 * Renders owner or administrator visibility controls.
 *
 * @param props - Visibility control properties.
 * @param props.canAdminister - Whether the viewer can moderate visibility.
 * @param props.disabled - Whether visibility changes are disabled.
 * @param props.initialPrivate - Initial private state.
 * @param props.isAdminPrivate - Whether moderation forced privacy.
 * @param props.isOwner - Whether the viewer owns the resource.
 * @param props.onChange - Persists a visibility change.
 * @param props.t - Catalog translation formatter.
 * @returns The visibility control.
 */
function VisibilityButton({
  canAdminister,
  disabled = false,
  initialPrivate,
  isAdminPrivate,
  isOwner,
  onChange,
  t,
}: {
  /** Whether the viewer can moderate visibility. */
  canAdminister: boolean;
  /** Whether visibility changes are disabled. */
  disabled?: boolean;
  /** Initial private state. */
  initialPrivate: boolean;
  /** Whether moderation forced privacy. */
  isAdminPrivate: boolean;
  /** Whether the viewer owns the resource. */
  isOwner: boolean;
  /**
   * Persists a visibility change.
   *
   * @param isPrivate - Next private state.
   * @param reason - Optional moderation reason.
   * @returns A promise that resolves after persistence.
   */
  onChange(isPrivate: boolean, reason?: string): Promise<unknown>;
  /** Catalog translation formatter. */
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
        const reason = actorIsModerating
          ? window.prompt(t("web.resources.moderation.reasonLabel"))?.trim()
          : undefined;
        if (actorIsModerating && !reason) return;
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

/**
 * Renders one labeled detail-list value.
 *
 * @param props - Detail properties.
 * @param props.children - Detail value.
 * @param props.label - Detail label.
 * @returns The detail-list entry.
 */
function Detail({
  children,
  label,
}: {
  /** Detail value. */
  children: React.ReactNode;
  /** Detail label. */
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

/**
 * Renders an empty catalog result state.
 *
 * @param props - Empty-state properties.
 * @param props.children - Empty-state copy.
 * @returns The empty-state panel.
 */
function EmptyState({
  children,
}: {
  /** Empty-state copy. */
  children: React.ReactNode;
}) {
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

/**
 * Formats a finish option with localized built-in color effects.
 *
 * @param option - Finish option to format.
 * @param t - Catalog translation formatter.
 * @returns The localized finish label.
 */
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
