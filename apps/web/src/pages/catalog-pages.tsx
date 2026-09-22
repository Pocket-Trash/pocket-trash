import type {
  CatalogFinishOption,
  CatalogProduct,
  PublicCollectionOwner,
  UserCollectionItem,
  UserCollectionSummary,
} from "@package/services";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  CatalogFilterBar,
  type CatalogFilterCopy,
} from "@/components/catalog-filter-bar";
import { ImageGallery } from "@/components/image-gallery";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { finishOptionLabel } from "@/lib/catalog";
import {
  setCollectionItemVisibility,
  setCollectionVisibility,
  setProductVisibility,
} from "@/lib/catalog-api";
import {
  buildCatalogFacets,
  type CatalogFilters,
  collectionFilterItem,
  emptyCatalogFilters,
  matchesCatalogFilters,
  productFilterItem,
} from "@/lib/catalog-filters";
import { cn } from "@/lib/utils";
import { useLocale } from "@/providers/locale-provider";

function useCatalogCopy() {
  const { locale } = useLocale();
  return (
    key: TranslationKey,
    values: Readonly<Record<string, unknown>> = {},
  ) => formatTranslation(key, values, locale);
}

function catalogFilterCopy(
  t: ReturnType<typeof useCatalogCopy>,
): CatalogFilterCopy {
  return {
    all: t("web.archive.filter.all"),
    any: t("web.archive.filter.any"),
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
      image: "/images/navigation/q3d-seigaiha.jpg",
      key: "web.navigation.products" as const,
      to: "/products" as const,
    },
    {
      image: "/images/navigation/collections.webp",
      key: "web.navigation.collections" as const,
      to: "/collections" as const,
    },
    {
      image: "/images/navigation/resources.webp",
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
              src={image}
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
        <>
          {onFiltersChange ? (
            <CatalogFilterBar
              copy={catalogFilterCopy(t)}
              facets={facets}
              filters={filters}
              onChange={onFiltersChange}
            />
          ) : null}
          <Link className={buttonVariants()} to="/products/add">
            {t("web.action.addProduct")}
          </Link>
        </>
      }
      title={t("web.navigation.products")}
    >
      <ProductGrid products={filtered} />
    </AppShell>
  );
}

export function ProductDetailPage({ product }: { product: CatalogProduct }) {
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
        product.canEdit ? (
          <div className="flex items-center gap-2">
            <VisibilityButton
              canAdminister={product.canAdminister}
              initialPrivate={product.isPrivate}
              isAdminPrivate={product.isAdminPrivate}
              onChange={(isPrivate, reason) =>
                setProductVisibility({
                  data: { isPrivate, productId: product.id, reason },
                })
              }
              t={t}
            />
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
          </div>
        ) : null
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
            className="aspect-4/3 max-h-[36rem] w-full rounded-xl border border-border object-cover"
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
        <dl className="grid gap-4 rounded-xl border border-border bg-card p-6 sm:grid-cols-2">
          <Detail label={t("web.catalog.field.productType")}>
            {product.productTypeName}
          </Detail>
          <Detail label={t("web.catalog.field.maker")}>
            {product.makerName}
          </Detail>
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
          {specs.map(([key, value, unit]) =>
            value ? (
              <Detail key={key} label={t(key)}>
                {value} {unit}
              </Detail>
            ) : null,
          )}
        </dl>
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
  const filteredOwners = owners.flatMap((owner) => {
    const matchingItemCount = owner.items.filter((item) =>
      matchesCatalogFilters(collectionFilterItem(item), filters),
    ).length;
    return matchingItemCount ? [{ ...owner, matchingItemCount }] : [];
  });
  const facets = buildCatalogFacets(
    owners.flatMap(({ items }) => items.map(collectionFilterItem)),
    filters.productType,
  );
  return (
    <AppShell
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
          <Link className={buttonVariants()} to="/collections/add">
            {t("web.action.addToCollection")}
          </Link>
        </>
      }
      title={t("web.navigation.collections")}
    >
      <main className="grid gap-[18px] p-4 sm:grid-cols-2 lg:grid-cols-3 md:p-[18px_22px_22px]">
        {filteredOwners.length ? (
          filteredOwners.map((owner) => (
            <Link
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground transition-transform hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              key={owner.userId}
              params={{ userId: owner.userId }}
              to="/collections/$userId"
            >
              <div
                aria-label={t("web.collections.directory.avatar")}
                className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
                role="img"
              >
                <UserRound aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-semibold">{owner.clerkId}</h2>
                <p className="text-sm text-muted-foreground">
                  {owner.matchingItemCount === owner.itemCount
                    ? t("web.collections.directory.itemCount", {
                        count: owner.itemCount,
                      })
                    : t("web.archive.itemCount", {
                        total: owner.itemCount,
                        visible: owner.matchingItemCount,
                      })}
                </p>
              </div>
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
      title={owner.clerkId}
    >
      <main className="grid grid-cols-1 gap-[18px] p-3 min-[481px]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(max(240px,calc((100%_-_4_*_18px)_/_5)),1fr))] md:p-[18px_22px_22px]">
        {owner.items.map((item) => (
          <Link
            className="rounded-xl border border-border bg-card p-5 text-card-foreground"
            key={item.collectionItemId}
            params={{
              collectionItemId: item.collectionItemId,
              userId: owner.userId,
            }}
            to="/collections/$userId/$collectionItemId"
          >
            {[...item.images, ...item.productImages].find(
              ({ deletedAt }) => !deletedAt,
            ) ? (
              <img
                alt={t("web.resources.detail.imageAlt", { name: item.name })}
                className="mb-3 aspect-4/3 w-full rounded-lg object-cover"
                src={
                  [...item.images, ...item.productImages].find(
                    ({ deletedAt }) => !deletedAt,
                  )?.url
                }
              />
            ) : null}
            <h2 className="font-semibold">{item.name}</h2>
            {item.isPrivate || owner.isPrivate ? (
              <Badge variant="secondary">
                {t("web.resources.moderation.privateBadge")}
              </Badge>
            ) : null}
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
            <p className="mt-1 text-xs text-muted-foreground">
              {t("web.resources.upload.imagesLabel")}: {item.imageCount}
            </p>
          </Link>
        ))}
      </main>
    </AppShell>
  );
}

export function UserCollectionPage({
  collection = null,
  filters = emptyCatalogFilters(),
  items,
  onFiltersChange,
}: {
  filters?: CatalogFilters;
  collection?: UserCollectionSummary | null;
  items: UserCollectionItem[];
  onFiltersChange?: React.Dispatch<React.SetStateAction<CatalogFilters>>;
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
          <Link className={buttonVariants()} to="/collections/add">
            {t("web.action.addToCollection")}
          </Link>
          {collection ? (
            <VisibilityButton
              canAdminister={false}
              initialPrivate={collection.isPrivate}
              isAdminPrivate={collection.isAdminPrivate}
              onChange={(isPrivate, reason) =>
                setCollectionVisibility({
                  data: {
                    isPrivate,
                    ownerUserId: collection.ownerUserId,
                    reason,
                  },
                })
              }
              t={t}
            />
          ) : null}
        </>
      }
      title={t("web.navigation.collections")}
    >
      <main className="grid grid-cols-1 gap-[18px] p-3 min-[481px]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(max(240px,calc((100%_-_4_*_18px)_/_5)),1fr))] md:p-[18px_22px_22px]">
        {filtered.length ? (
          filtered.map((item) => (
            <Link
              className="rounded-xl border border-border bg-card p-5 font-semibold text-card-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              key={item.collectionItemId}
              params={{
                collectionItemId: item.collectionItemId,
                userId: item.ownerUserId,
              }}
              to="/collections/$userId/$collectionItemId"
            >
              {[...item.images, ...item.productImages].find(
                ({ deletedAt }) => !deletedAt,
              ) ? (
                <img
                  alt={t("web.resources.detail.imageAlt", { name: item.name })}
                  className="mb-3 aspect-4/3 w-full rounded-lg object-cover"
                  src={
                    [...item.images, ...item.productImages].find(
                      ({ deletedAt }) => !deletedAt,
                    )?.url
                  }
                />
              ) : null}
              <span>{item.name}</span>
              {item.isPrivate || item.collectionIsPrivate ? (
                <Badge className="ml-2" variant="secondary">
                  {t("web.resources.moderation.privateBadge")}
                </Badge>
              ) : null}
              {item.material ? (
                <span className="mt-2 block text-xs font-normal text-muted-foreground">
                  {item.material.name}
                </span>
              ) : null}
              {item.finishOption ? (
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {localizedFinishLabel(item.finishOption, t)}
                </span>
              ) : null}
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {t("web.resources.upload.imagesLabel")}: {item.imageCount}
              </span>
            </Link>
          ))
        ) : (
          <EmptyState>{t("web.collections.empty")}</EmptyState>
        )}
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
        <Link
          className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground transition-transform hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          key={product.id}
          params={{
            productSlug: product.slug,
            productTypeSlug: product.productTypeSlug,
          }}
          to="/products/$productTypeSlug/$productSlug"
        >
          {product.images.find(({ deletedAt }) => !deletedAt) ? (
            <img
              alt={t("web.resources.detail.imageAlt", { name: product.name })}
              className="aspect-4/3 w-full object-cover"
              src={product.images.find(({ deletedAt }) => !deletedAt)?.url}
            />
          ) : null}
          <div className="p-5">
            {product.isPrivate ? (
              <Badge className="mb-2" variant="secondary">
                {t("web.resources.moderation.privateBadge")}
              </Badge>
            ) : null}
            <h2 className="line-clamp-2 min-h-[2.6em] text-[15px] leading-[1.3] font-semibold">
              {product.name}
            </h2>
            <p className="mt-1 min-h-[2.9em] text-[12.5px] leading-[1.45] text-muted-foreground">
              {product.productTypeName} · {product.makerName}
            </p>
            <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
              <span>
                {t("web.catalog.materialCount", {
                  count: product.materials.length,
                })}
              </span>
              <span>
                {t("web.catalog.finishOptionCount", {
                  count: product.finishOptions.length,
                })}
              </span>
              <span>
                {t("web.resources.upload.imagesLabel")}: {product.imageCount}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </section>
  );
}

export function CollectionItemDetailPage({
  item,
}: {
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
      ]}
      headerActions={
        item.canEdit ? (
          <div className="flex items-center gap-2">
            <VisibilityButton
              canAdminister={item.canAdminister}
              disabled={item.collectionIsPrivate}
              initialPrivate={item.isPrivate}
              isAdminPrivate={item.isAdminPrivate}
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
            <Link
              className={buttonVariants({ variant: "outline" })}
              params={{ collectionItemId: item.collectionItemId }}
              to="/collections/edit/$collectionItemId"
            >
              {t("web.action.edit")}
            </Link>
          </div>
        ) : null
      }
      title={item.name}
    >
      <main className="mx-auto grid w-full max-w-5xl gap-6 p-6">
        {item.isPrivate || item.collectionIsPrivate ? (
          <Badge className="w-fit" variant="secondary">
            {t("web.resources.moderation.privateBadge")}
          </Badge>
        ) : null}
        {[...ownImages, ...productImages][0] ? (
          <img
            alt={t("web.resources.detail.imageAlt", { name: item.name })}
            className="aspect-4/3 max-h-[36rem] w-full rounded-xl border border-border object-cover"
            src={[...ownImages, ...productImages][0]?.url}
          />
        ) : null}
        <dl className="grid gap-4 rounded-xl border border-border bg-card p-6 sm:grid-cols-2">
          <Detail label={t("web.catalog.field.productType")}>
            {item.productTypeName}
          </Detail>
          <Detail label={t("web.catalog.field.maker")}>{item.makerName}</Detail>
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
        </dl>
        <ImageGallery
          alt={t("web.resources.detail.imageAlt", { name: item.name })}
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
  onChange,
  t,
}: {
  canAdminister: boolean;
  disabled?: boolean;
  initialPrivate: boolean;
  isAdminPrivate: boolean;
  onChange(isPrivate: boolean, reason?: string): Promise<unknown>;
  t: ReturnType<typeof useCatalogCopy>;
}) {
  const [isPrivate, setIsPrivate] = useState(initialPrivate);
  const locked = disabled || (isAdminPrivate && !canAdminister);
  return (
    <button
      aria-pressed={!isPrivate}
      className={buttonVariants({ variant: "outline" })}
      disabled={locked}
      onClick={async () => {
        const nextPrivate = !isPrivate;
        const reason =
          canAdminister && nextPrivate
            ? window.prompt(t("web.resources.moderation.reasonLabel"))?.trim()
            : undefined;
        if (canAdminister && nextPrivate && !reason) return;
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
