import type {
  CatalogApprovalAction,
  CatalogApprovalStatus,
  CatalogFinishOption,
  CatalogProduct,
  CatalogProductType,
  CatalogProductTypeSummary,
  CatalogTerminologyAlias,
  EffectiveSliderSetup,
  PublicCollectionOwner,
  SliderMagnetConfiguration,
  UserCollectionItem,
  UserCollectionSummary,
} from "@package/services";
import {
  type SliderMagnetLayout,
  sliderMagnetLayoutDetails,
} from "@package/services/constants";
import {
  formatMeasurement,
  type Measurement,
} from "@package/services/measurements";
import type { TranslationKey } from "@pocket-trash/localizations";
import { Link, useNavigate } from "@tanstack/react-router";
import { CircleHelp } from "lucide-react";
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
import { MaterialLink } from "@/components/material-link";
import { PaginatedCards } from "@/components/paginated-cards";
import { PermanentDeletionControls } from "@/components/permanent-deletion-controls";
import { ProductCard } from "@/components/product-card";
import { PublicProfileAvatar } from "@/components/public-profile-avatar";
import { PublicResourceSwitch } from "@/components/resource-visibility-toggle";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserPageShell } from "@/components/user-page-shell";
import { cardImageUrl } from "@/lib/card-image";
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
import {
  type CatalogSearchMatch,
  catalogTypeDisplayLabel,
  matchCatalogSearch,
} from "@/lib/catalog-search";
import { cn } from "@/lib/utils";
import { useLocale } from "@/providers/locale-provider";

export {
  getCatalogPageSize,
  PaginatedCards,
} from "@/components/paginated-cards";

/** Localized failure returned by a visibility server mutation. */
type VisibilityMutationFailure = {
  /** Primary localized error key. */
  formError: string;
  /** Optional secondary localized error key. */
  formErrorDetail?: string;
  /** Interpolation values for the secondary error. */
  formErrorValues?: Readonly<Record<string, unknown>>;
  /** Failure discriminator. */
  ok: false;
};

/**
 * Returns whether a visibility mutation returned a structured failure.
 *
 * @param value - Candidate server mutation result.
 * @returns Whether the result is a localized visibility failure.
 */
function isMutationFailure(value: unknown): value is VisibilityMutationFailure {
  return Boolean(
    value &&
      typeof value === "object" &&
      "ok" in value &&
      value.ok === false &&
      "formError" in value &&
      typeof value.formError === "string",
  );
}

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
    pattern: t("web.slider.filter.pattern"),
    plate: t("web.slider.filter.plate"),
    productType: t("web.catalog.field.productType"),
    productTypeAll: t("web.catalog.filter.productTypeAll"),
    /**
     * Formats the polite matching-result announcement.
     *
     * @param count - Current matching result count.
     * @returns Localized matching-result announcement.
     */
    resultsAnnouncement: (count) =>
      t("web.slider.filter.resultsAnnouncement", { count }),
    searchLabel: t("web.slider.search.label"),
    searchPlaceholder: t("web.slider.search.placeholder"),
    selectMaker: t("web.catalog.selectMaker"),
    selectProductType: t("web.catalog.selectProductType"),
    spinnerButton: t("web.slider.filter.spinnerButton"),
  };
}

/** English canonical product-type labels retained as locale fallback search terms. */
const englishProductTypeLabels: Record<CatalogProductType, string> = {
  pen: "Pen",
  "pen-actuator": "Pen actuator",
  "pen-clip": "Pen clip",
  "pen-mechanism": "Pen mechanism",
  "pen-tip": "Pen tip",
  "pen-top-cap": "Pen top cap",
  refill: "Refill",
  slider: "Slider",
  "slider-insert": "Slider insert",
  "slider-plate": "Slider plate",
  spinner: "Spinner",
  "spinner-button": "Spinner button",
};

/**
 * Returns the active-locale canonical product-type label.
 *
 * @param t - Active-locale catalog formatter.
 * @param productType - Canonical product-type key.
 * @param fallback - Persisted label used until a localization ships.
 * @returns Active-locale label or the persisted fallback.
 */
function localizedProductTypeLabel(
  t: ReturnType<typeof useCatalogCopy>,
  productType: CatalogProductType,
  fallback: string,
) {
  const key = {
    pen: "web.pens.productType.pen",
    "pen-actuator": "web.pens.productType.actuator",
    "pen-clip": "web.pens.productType.clip",
    "pen-mechanism": "web.pens.productType.mechanism",
    "pen-tip": "web.pens.productType.tip",
    "pen-top-cap": "web.pens.productType.topCap",
    refill: "web.pens.productType.refill",
    slider: "web.slider.productType.slider",
    "slider-insert": "web.slider.productType.insert",
    "slider-plate": "web.slider.productType.plate",
    spinner: "web.slider.productType.spinner",
    "spinner-button": "web.slider.productType.spinnerButton",
  }[productType];
  const label = t(key as TranslationKey);
  return label === key ? fallback : label;
}

/**
 * Formats a concise explanation for a non-name search match.
 *
 * @param t - Active-locale catalog formatter.
 * @param match - Search context to explain.
 * @returns Localized context, or `undefined` for direct name and maker matches.
 */
function searchMatchContext(
  t: ReturnType<typeof useCatalogCopy>,
  match: CatalogSearchMatch | undefined,
) {
  if (match?.matchedAlias)
    return t("web.slider.search.matchedAliasContext", {
      alias: match.matchedAlias,
    });
  if (match?.matchedType)
    return t("web.slider.search.matchedTypeContext", {
      type: match.matchedType,
    });
  if (match?.matchedOwner)
    return t("web.slider.search.ownerMatchContext", {
      owner: match.matchedOwner,
    });
  return undefined;
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
 * @param props.productTypes - Product types and their directory classification.
 * @param props.products - Catalog products to display.
 * @param props.view - Directory or filtered product-list view.
 * @returns The product index page.
 */
export function ProductsPage({
  aliases = [],
  filters = emptyCatalogFilters(),
  onFiltersChange,
  productTypes = [],
  products,
  view = "products",
}: {
  /** Registered terminology aliases available to search and display. */
  aliases?: CatalogTerminologyAlias[];
  /** Active catalog filters. */
  filters?: CatalogFilters;
  /** Optional filter state updater. */
  onFiltersChange?: React.Dispatch<React.SetStateAction<CatalogFilters>>;
  /** Product types and their directory classification. */
  productTypes?: CatalogProductTypeSummary[];
  /** Catalog products to display. */
  products: CatalogProduct[];
  /** Directory or filtered product-list view. */
  view?: "directory" | "products";
}) {
  const t = useCatalogCopy();
  const { locale } = useLocale();
  const addProduct = onFiltersChange ? (
    <Link className={buttonVariants({ size: "sm" })} to="/products/add">
      {t("web.action.addProduct")}
    </Link>
  ) : undefined;
  if (view === "directory") {
    const typeMetadata = new Map(
      productTypes.map((productType) => [productType.slug, productType]),
    );
    const visibleTypes = new Map<
      CatalogProductType,
      {
        /** Optional representative product image. */
        imageUrl: string | null;
        /** Localized product-type label. */
        label: string;
        /** Product-type metadata. */
        productType: CatalogProductTypeSummary;
        /** Supported filter slug. */
        slug: CatalogProductType;
      }
    >();
    for (const product of products) {
      const productType = typeMetadata.get(product.productTypeSlug);
      if (!productType) continue;
      const imageUrl =
        product.images.find(({ deletedAt }) => !deletedAt)?.url ?? null;
      const existing = visibleTypes.get(product.productTypeSlug);
      if (existing) {
        if (!existing.imageUrl && imageUrl) existing.imageUrl = imageUrl;
        continue;
      }
      visibleTypes.set(product.productTypeSlug, {
        imageUrl,
        label: localizedProductTypeLabel(
          t,
          product.productTypeSlug,
          productType.name,
        ),
        productType,
        slug: product.productTypeSlug,
      });
    }
    const sortedTypes = [...visibleTypes.values()].sort((left, right) =>
      left.label.localeCompare(right.label, locale),
    );
    const primary = sortedTypes.filter(
      ({ productType }) => !productType.isPartOrAccessory,
    );
    const partsAndAccessories = sortedTypes.filter(
      ({ productType }) => productType.isPartOrAccessory,
    );

    return (
      <AppShell headerActions={addProduct} title={t("web.navigation.products")}>
        <main className="grid gap-8 p-4 md:p-[18px_22px_22px]">
          <h2 className="sr-only">{t("web.navigation.products")}</h2>
          <section className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
            <ProductTypeNavigationCard
              imageUrl="https://cdn.pocket-trash.app/assets/static/hero-cards/products.webp"
              label={t("web.catalog.allProducts")}
              search={{ view: "all" }}
            />
            {primary.map(({ imageUrl, label, slug }) => (
              <ProductTypeNavigationCard
                imageUrl={imageUrl}
                key={slug}
                label={label}
                search={{ type: slug, view: "all" }}
              />
            ))}
          </section>
          {partsAndAccessories.length ? (
            <section
              aria-labelledby="parts-and-accessories-title"
              className="grid gap-4"
            >
              <h3
                className="m-0 text-xl font-semibold"
                id="parts-and-accessories-title"
              >
                {t("web.catalog.partsAndAccessories")}
              </h3>
              <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
                {partsAndAccessories.map(({ imageUrl, label, slug }) => (
                  <ProductTypeNavigationCard
                    imageUrl={imageUrl}
                    key={slug}
                    label={label}
                    search={{ type: slug, view: "all" }}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </main>
      </AppShell>
    );
  }
  const searchMatches = new Map<number, CatalogSearchMatch>();
  const filtered = products.filter((product) => {
    if (!matchesCatalogFilters(productFilterItem(product), filters))
      return false;
    const activeTypeLabel = localizedProductTypeLabel(
      t,
      product.productTypeSlug,
      product.productTypeName,
    );
    const match = matchCatalogSearch(
      {
        activeTypeLabel,
        aliases: product.aliases,
        englishTypeLabel: englishProductTypeLabels[product.productTypeSlug],
        makerId: product.makerId,
        makerName: product.makerName,
        name: product.name,
        ownerDisplayName: null,
        productTypeSlug: product.productTypeSlug,
      },
      filters.query,
      aliases,
    );
    if (match) searchMatches.set(product.id, match);
    return match !== null;
  });
  const facets = buildCatalogFacets(
    products.map(productFilterItem),
    filters.productType,
  );
  return (
    <AppShell
      headerActions={
        onFiltersChange ? (
          <CatalogFilterBar
            action={addProduct}
            copy={catalogFilterCopy(t)}
            facets={facets}
            filters={filters}
            onChange={onFiltersChange}
            resultCount={filtered.length}
          />
        ) : undefined
      }
      title={t("web.navigation.products")}
    >
      <ProductGrid
        aliases={aliases}
        products={filtered}
        searchMatches={searchMatches}
      />
    </AppShell>
  );
}

/**
 * Renders one keyboard-accessible product-directory navigation card.
 *
 * @param props - Product-type navigation properties.
 * @param props.imageUrl - Optional representative product image.
 * @param props.label - Localized card label.
 * @param props.search - Product-list search selected by the card.
 * @returns Product-type navigation card.
 */
function ProductTypeNavigationCard({
  imageUrl,
  label,
  search,
}: {
  /** Optional representative product image. */
  imageUrl: string | null;
  /** Localized card label. */
  label: string;
  /** Product-list search selected by the card. */
  search: ProductTypeNavigationSearch;
}) {
  const fallbackImage =
    "https://cdn.pocket-trash.app/assets/static/hero-cards/products.webp";
  return (
    <Link
      className="group overflow-hidden rounded-xl border border-border bg-card text-card-foreground transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      search={search}
      to="/products"
    >
      <img
        alt=""
        className="aspect-4/3 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        loading="lazy"
        src={imageUrl ? cardImageUrl(imageUrl) : `${fallbackImage}?width=640`}
      />
      <div className="p-5 text-xl font-semibold">{label}</div>
    </Link>
  );
}

/** Search state selected by a product-type navigation card. */
type ProductTypeNavigationSearch = {
  /** Optional product type selected by the card. */
  type?: CatalogProductType;
  /** Explicit product-list view. */
  view: "all";
};

/**
 * Resolves a configuration choice to its public display label.
 *
 * @param product - Product containing the choice and finish options.
 * @param choice - Configuration choice to label, or `undefined` for stale rule data.
 * @param t - Active catalog translation formatter.
 * @returns Material, part, or appearance label for the choice.
 */
function configurationChoiceLabel(
  product: CatalogProduct,
  choice:
    | CatalogProduct["configurationSlots"][number]["choices"][number]
    | undefined,
  t: ReturnType<typeof useCatalogCopy>,
) {
  if (!choice)
    return t("web.pens.configuration.unknownChoice" as TranslationKey);
  if (choice.label) return choice.label;
  const finish = product.finishOptions.find(
    ({ id }) => id === choice.finishOptionId,
  );
  return finish
    ? localizedFinishLabel(finish, t)
    : t("web.pens.configuration.unknownChoice" as TranslationKey);
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
  const { locale, measurementSystem } = useLocale();
  const navigate = useNavigate();
  let specs: Array<[TranslationKey, Measurement | null]> = [];
  switch (product.productTypeSlug) {
    case "spinner":
      specs = [
        ["web.archive.spec.weight", product.weight],
        ["web.archive.spec.length", product.length],
        ["web.catalog.field.width", product.width],
        ["web.catalog.field.thickness", product.thickness],
        ["web.catalog.field.thicknessWithButton", product.thicknessWithButton],
        ["web.catalog.field.buttonDiameter", product.buttonDiameter],
        ["web.catalog.field.spinDiameter", product.spinDiameter],
      ];
      break;
    case "spinner-button":
      specs = [
        ["web.archive.spec.weight", product.weight],
        ["web.archive.spec.diameter", product.diameter],
        ["web.catalog.field.thickness", product.thickness],
      ];
      break;
    case "slider":
    case "slider-insert":
    case "slider-plate":
      specs = [
        ["web.archive.spec.weight", product.weight],
        ["web.archive.spec.length", product.length],
        ["web.catalog.field.width", product.width],
        ["web.catalog.field.thickness", product.thickness],
      ];
      break;
  }

  return (
    <AppShell
      breadcrumbItems={[
        { label: t("web.navigation.products"), to: "/products" },
      ]}
      headerActions={
        <div className="flex items-center gap-2">
          {product.productTypeSlug === "spinner" ||
          product.productTypeSlug === "spinner-button" ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              search={{ product: product.id }}
              to="/collections/add"
            >
              {t("web.action.addToCollection")}
            </Link>
          ) : null}
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
          {product.aliases.length ? (
            <Detail label={t("web.pens.field.aliases" as TranslationKey)}>
              {product.aliases.join(", ")}
            </Detail>
          ) : null}
          {product.refillModel ? (
            <Detail label={t("web.pens.field.refillModel" as TranslationKey)}>
              {product.refillModel}
            </Detail>
          ) : null}
          {product.makerProductUrl && product.makerProductUrlValid ? (
            <Detail label={t("web.catalog.field.makerProductUrl")}>
              <MakerLink
                name={t("web.action.visitProductPage")}
                url={product.makerProductUrl}
              />
            </Detail>
          ) : null}
          <Detail label={t("web.catalog.field.materials")}>
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {product.materials.map((material) => (
                <li key={material.assignmentId}>
                  <MaterialLink material={material} />
                </li>
              ))}
            </ul>
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
          {product.productTypeSlug === "slider" ? (
            <Detail label={t("web.slider.capability.label")}>
              {t(
                product.usesInserts
                  ? "web.slider.capability.usesInserts"
                  : "web.slider.capability.sliderBodyHoldsMagnets",
              )}
            </Detail>
          ) : null}
          {product.magnetLayout ? (
            <Detail label={t("web.slider.layout.label")}>
              <SliderMagnetLayoutValue layout={product.magnetLayout} t={t} />
            </Detail>
          ) : null}
          {product.magnetConfiguration ? (
            <Detail label={t("web.slider.magnet.configuration")}>
              <MagnetConfigurationValue
                configuration={product.magnetConfiguration}
                t={t}
              />
            </Detail>
          ) : null}
          {product.productTypeSlug === "slider" ? (
            <Detail label={t("web.slider.relationship.plates")}>
              {product.includedPlate ? (
                <Link
                  className="text-primary underline-offset-4 hover:underline"
                  params={{
                    productSlug: product.includedPlate.slug,
                    productTypeSlug: product.includedPlate.productTypeSlug,
                  }}
                  to="/products/$productTypeSlug/$productSlug"
                >
                  {product.includedPlate.name}
                </Link>
              ) : (
                t("web.slider.relationship.includedPlates")
              )}
            </Detail>
          ) : null}
          {product.productTypeSlug === "slider" && product.usesInserts ? (
            <Detail label={t("web.slider.relationship.inserts")}>
              {product.includedInsert ? (
                <Link
                  className="text-primary underline-offset-4 hover:underline"
                  params={{
                    productSlug: product.includedInsert.slug,
                    productTypeSlug: product.includedInsert.productTypeSlug,
                  }}
                  to="/products/$productTypeSlug/$productSlug"
                >
                  {product.includedInsert.name}
                </Link>
              ) : (
                t("web.slider.relationship.includedInsert")
              )}
            </Detail>
          ) : null}
          {specs.map(([key, value]) =>
            value ? (
              <Detail key={key} label={t(key)}>
                {formatMeasurement(value, measurementSystem, locale)}
              </Detail>
            ) : null,
          )}
        </dl>
        {product.configurationSlots.length ? (
          <section className="grid gap-4">
            <h2 className="text-lg font-semibold">
              {t("web.pens.configuration.heading" as TranslationKey)}
            </h2>
            <div className="grid gap-4 rounded-xl border border-border bg-card p-6 sm:grid-cols-2">
              {product.configurationSlots.map((slot) => {
                const slotLabel = t(slot.labelKey as TranslationKey);
                return (
                  <div className="grid content-start gap-2" key={slot.id}>
                    <h3 className="font-semibold">
                      {slotLabel === slot.labelKey
                        ? slot.labelFallback
                        : slotLabel}
                      {slot.required ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {t(
                            "web.pens.configuration.required" as TranslationKey,
                          )}
                        </span>
                      ) : null}
                    </h3>
                    <ul className="grid gap-2 text-sm">
                      {slot.choices.map((choice) => {
                        const label = configurationChoiceLabel(
                          product,
                          choice,
                          t,
                        );
                        return (
                          <li key={choice.id}>
                            <span>{label}</span>
                            {choice.availableWhen.length ? (
                              <p className="text-muted-foreground">
                                {t(
                                  "web.pens.configuration.availableWhen" as TranslationKey,
                                  {
                                    requirements: choice.availableWhen
                                      .map((branch) =>
                                        branch
                                          .map((requiredId) =>
                                            configurationChoiceLabel(
                                              product,
                                              product.configurationSlots
                                                .flatMap(
                                                  ({ choices }) => choices,
                                                )
                                                .find(
                                                  ({ id }) => id === requiredId,
                                                ),
                                              t,
                                            ),
                                          )
                                          .join(" + "),
                                      )
                                      .join(" / "),
                                  },
                                )}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
        {product.refillOfferings.length ? (
          <section className="grid gap-4">
            <h2 className="text-lg font-semibold">
              {t("web.pens.refill.offerings" as TranslationKey)}
            </h2>
            <ul className="grid gap-2 rounded-xl border border-border bg-card p-6 sm:grid-cols-2">
              {product.refillOfferings.map((offering) => (
                <li key={offering.id}>
                  {offering.tipSize} · {offering.tipStyle} · {offering.inkColor}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {product.productTypeSlug === "refill" ? (
          <section className="grid gap-4">
            <h2 className="text-lg font-semibold">
              {t("web.pens.refill.compatiblePens" as TranslationKey)}
            </h2>
            {product.compatiblePens.length ? (
              <ul className="grid gap-2 rounded-xl border border-border bg-card p-6 sm:grid-cols-2">
                {product.compatiblePens.map((pen) => (
                  <li key={`${pen.id}:${pen.requiredTipName ?? ""}`}>
                    <Link
                      className="text-primary underline-offset-4 hover:underline"
                      params={{ productSlug: pen.slug, productTypeSlug: "pen" }}
                      to="/products/$productTypeSlug/$productSlug"
                    >
                      {pen.name}
                    </Link>
                    {pen.requiredTipName ? (
                      <p className="text-sm text-muted-foreground">
                        {t("web.pens.refill.requiresTip" as TranslationKey, {
                          tip: pen.requiredTipName,
                        })}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("web.pens.refill.noCompatiblePens" as TranslationKey)}
              </p>
            )}
          </section>
        ) : null}
        {product.productTypeSlug !== "refill" ? (
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
                        <span className="sm:hidden">
                          {t("web.action.view")}
                        </span>
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
        ) : null}
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
  aliases = [],
  filters = emptyCatalogFilters(),
  onFiltersChange,
  owners,
}: {
  /** Registered terminology aliases available to search. */
  aliases?: CatalogTerminologyAlias[];
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
  const ownerNames = new Map(
    owners.map((owner) => [owner.userId, owner.username]),
  );
  const matchingCollectionIds = new Set(
    publicItems
      .filter((item) => {
        if (
          !matchesCatalogFilters(
            collectionFilterItem(item, publicItems),
            filters,
          )
        )
          return false;
        return Boolean(
          matchCatalogSearch(
            {
              activeTypeLabel: localizedProductTypeLabel(
                t,
                item.productTypeSlug,
                item.productTypeName,
              ),
              englishTypeLabel: englishProductTypeLabels[item.productTypeSlug],
              makerId: item.makerId,
              makerName: item.makerName,
              name: item.displayName,
              ownerDisplayName: ownerNames.get(item.ownerUserId) ?? null,
              productTypeSlug: item.productTypeSlug,
            },
            filters.query,
            aliases,
          ),
        );
      })
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
    publicItems.map((item) => collectionFilterItem(item, publicItems)),
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
            resultCount={collections.length}
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
                    ownerImageUrl={owner.imageUrl}
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
      meta={
        <span className="flex items-center gap-2">
          <PublicProfileAvatar
            imageUrl={owner.imageUrl}
            username={owner.username}
            size="lg"
          />
          {t("web.collections.directory.itemCount", { count: owner.itemCount })}
        </span>
      }
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
  aliases = [],
  collections,
  filters = emptyCatalogFilters(),
  items,
  onFiltersChange,
}: {
  /** Registered terminology aliases available to search. */
  aliases?: CatalogTerminologyAlias[];
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
      .filter((item) => {
        if (!matchesCatalogFilters(collectionFilterItem(item, items), filters))
          return false;
        return Boolean(
          matchCatalogSearch(
            {
              activeTypeLabel: localizedProductTypeLabel(
                t,
                item.productTypeSlug,
                item.productTypeName,
              ),
              englishTypeLabel: englishProductTypeLabels[item.productTypeSlug],
              makerId: item.makerId,
              makerName: item.makerName,
              name: item.displayName,
              ownerDisplayName: item.ownerUsername,
              productTypeSlug: item.productTypeSlug,
            },
            filters.query,
            aliases,
          ),
        );
      })
      .map(({ collectionId }) => collectionId),
  );
  const filtered = hasCatalogFilters(filters)
    ? collections.filter(({ id }) => matchingIds.has(id))
    : collections;
  const facets = buildCatalogFacets(
    items.map((item) => collectionFilterItem(item, items)),
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
            resultCount={filtered.length}
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
 * @param props.ownerImageUrl - Selected public owner picture URL.
 * @param props.ownerUsername - Public owner username shown in navigation.
 * @param props.userArea - Whether the page is rendered in the signed-in user area.
 * @returns The collection page.
 */
export function CollectionPage({
  aliases = [],
  collection,
  filters = emptyCatalogFilters(),
  items,
  onFiltersChange,
  ownerUsername,
  ownerImageUrl = null,
  userArea = false,
}: {
  /** Registered terminology aliases available to search and display. */
  aliases?: CatalogTerminologyAlias[];
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
  /** Selected public owner picture URL, or null when absent. */
  ownerImageUrl?: string | null;
  /** Whether the page is rendered in the signed-in user area. */
  userArea?: boolean;
}) {
  const t = useCatalogCopy();
  const searchMatches = new Map<number, CatalogSearchMatch>();
  const filtered = items.filter((item) => {
    if (!matchesCatalogFilters(collectionFilterItem(item, items), filters))
      return false;
    const match = matchCatalogSearch(
      {
        activeTypeLabel: localizedProductTypeLabel(
          t,
          item.productTypeSlug,
          item.productTypeName,
        ),
        englishTypeLabel: englishProductTypeLabels[item.productTypeSlug],
        makerId: item.makerId,
        makerName: item.makerName,
        name: item.displayName,
        ownerDisplayName: item.ownerUsername ?? ownerUsername ?? null,
        productTypeSlug: item.productTypeSlug,
      },
      filters.query,
      aliases,
    );
    if (match) searchMatches.set(item.collectionItemId, match);
    return match !== null;
  });
  const facets = buildCatalogFacets(
    items.map((item) => collectionFilterItem(item, items)),
    filters.productType,
  );
  const filterBar = onFiltersChange ? (
    <CatalogFilterBar
      copy={catalogFilterCopy(t)}
      facets={facets}
      filters={filters}
      onChange={onFiltersChange}
      resultCount={filtered.length}
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
        ownerAvatar={
          ownerUsername ? (
            <PublicProfileAvatar
              imageUrl={ownerImageUrl}
              size="lg"
              username={ownerUsername}
            />
          ) : undefined
        }
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
                  {catalogTypeDisplayLabel(
                    {
                      activeTypeLabel: localizedProductTypeLabel(
                        t,
                        item.productTypeSlug,
                        item.productTypeName,
                      ),
                      makerId: item.makerId,
                      productTypeSlug: item.productTypeSlug,
                    },
                    aliases,
                  )}{" "}
                  ·{" "}
                  <MakerLink
                    className="relative z-20"
                    name={item.makerName}
                    slug={item.makerSlug}
                  />
                </p>
                {searchMatchContext(
                  t,
                  searchMatches.get(item.collectionItemId),
                ) ? (
                  <p className="mt-1 text-xs text-primary">
                    {searchMatchContext(
                      t,
                      searchMatches.get(item.collectionItemId),
                    )}
                  </p>
                ) : null}
                {item.material ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    <MaterialLink material={item.material} />
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
  aliases = [],
  products,
  searchMatches = new Map(),
}: {
  /** Registered terminology aliases available for preferred display labels. */
  aliases?: CatalogTerminologyAlias[];
  /** Catalog products to display. */
  products: CatalogProduct[];
  /** Per-product context explaining a search match. */
  searchMatches?: ReadonlyMap<number, CatalogSearchMatch>;
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
                productTypeLabel={catalogTypeDisplayLabel(
                  {
                    activeTypeLabel: localizedProductTypeLabel(
                      t,
                      product.productTypeSlug,
                      product.productTypeName,
                    ),
                    makerId: product.makerId,
                    productTypeSlug: product.productTypeSlug,
                  },
                  aliases,
                )}
                searchContext={searchMatchContext(
                  t,
                  searchMatches.get(product.id),
                )}
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
 * @param props - Collection item data, live catalog product, and installed components, when present.
 * @param props.installedButton - Installed spinner button, when present.
 * @param props.installedInsert - Installed slider insert, when present.
 * @param props.installedPlate - Installed slider plate, when present.
 * @param props.item - Collection item to display.
 * @param props.product - Live catalog facts for the exact owned product.
 * @returns The collection item detail page.
 */
export function CollectionItemDetailPage({
  installedButton = null,
  installedInsert = null,
  installedPlate = null,
  item,
  product = null,
}: {
  /** Installed spinner button, when present. */
  installedButton?: UserCollectionItem | null;
  /** Installed slider insert, when present. */
  installedInsert?: UserCollectionItem | null;
  /** Installed slider plate, when present. */
  installedPlate?: UserCollectionItem | null;
  /** Collection item to display. */
  item: UserCollectionItem;
  /** Live catalog facts for the exact owned product. */
  product?: CatalogProduct | null;
}) {
  const t = useCatalogCopy();
  const { locale, measurementSystem } = useLocale();
  const ownImages = item.images.filter(({ deletedAt }) => !deletedAt);
  const productImages = item.productImages.filter(
    ({ deletedAt }) => !deletedAt,
  );
  const displayedSliderSetup: EffectiveSliderSetup | null =
    item.productTypeSlug === "slider"
      ? (item.effectiveSliderSetup ??
        (product?.magnetLayout
          ? {
              clickCount: product.clickCount,
              configuration: product.magnetConfiguration ?? null,
              magnetLayout: product.magnetLayout,
              source: "body-hosted" as const,
            }
          : null))
      : null;
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
              privacyInherited={item.privacyInheritedFromItemId != null}
              savedIsPrivate={item.savedIsPrivate}
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
              <MaterialLink material={item.material} />
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
                      <MaterialLink material={installedButton.material} />
                    </span>
                  ) : null}
                  {installedButton.finishOption ? (
                    <span className="text-sm text-muted-foreground">
                      {localizedFinishLabel(installedButton.finishOption, t)}
                    </span>
                  ) : null}
                </div>
              ) : (
                t(
                  item.installedButtonUnavailable
                    ? "web.slider.moderation.unavailableComponent"
                    : "web.catalog.defaultButton",
                )
              )}
            </Detail>
          ) : null}
          {item.productTypeSlug === "slider" ? (
            <Detail label={t("web.slider.relationship.plates")}>
              {product?.includedPlate ? (
                <Link
                  className="text-primary underline-offset-4 hover:underline"
                  params={{
                    productSlug: product.includedPlate.slug,
                    productTypeSlug: product.includedPlate.productTypeSlug,
                  }}
                  to="/products/$productTypeSlug/$productSlug"
                >
                  {product.includedPlate.name}
                </Link>
              ) : (
                t("web.slider.relationship.includedPlates")
              )}
            </Detail>
          ) : null}
          {item.productTypeSlug === "slider" && product?.usesInserts ? (
            <Detail label={t("web.slider.relationship.inserts")}>
              {product.includedInsert ? (
                <Link
                  className="text-primary underline-offset-4 hover:underline"
                  params={{
                    productSlug: product.includedInsert.slug,
                    productTypeSlug: product.includedInsert.productTypeSlug,
                  }}
                  to="/products/$productTypeSlug/$productSlug"
                >
                  {product.includedInsert.name}
                </Link>
              ) : (
                t("web.slider.relationship.includedInsert")
              )}
            </Detail>
          ) : null}
          {item.productTypeSlug === "slider" ? (
            <Detail label={t("web.slider.component.installedPlate")}>
              {installedPlate?.displayName ??
                t(
                  item.installedPlateUnavailable
                    ? "web.slider.moderation.unavailableComponent"
                    : "web.slider.component.noPlate",
                )}
            </Detail>
          ) : null}
          {item.productTypeSlug === "slider" && product?.usesInserts ? (
            <Detail label={t("web.slider.component.installedInsert")}>
              {installedInsert?.displayName ??
                t(
                  item.installedInsertUnavailable
                    ? "web.slider.moderation.unavailableComponent"
                    : "web.slider.component.noInsert",
                )}
            </Detail>
          ) : null}
          {item.productTypeSlug === "spinner" && item.bearing ? (
            <Detail label={t("web.catalog.field.bearing")}>
              {item.bearing}
            </Detail>
          ) : null}
          {product?.productTypeSlug === "slider" ? (
            <Detail label={t("web.slider.capability.label")}>
              {t(
                product.usesInserts
                  ? "web.slider.capability.usesInserts"
                  : "web.slider.capability.sliderBodyHoldsMagnets",
              )}
            </Detail>
          ) : null}
          {displayedSliderSetup ? (
            <Detail label={t("web.slider.setup.title")}>
              <MagnetSetupDetails setup={displayedSliderSetup} t={t} />
            </Detail>
          ) : null}
          {product?.width ? (
            <Detail label={t("web.catalog.field.width")}>
              {formatMeasurement(product.width, measurementSystem, locale)}
            </Detail>
          ) : null}
          {product?.thickness ? (
            <Detail label={t("web.catalog.field.thickness")}>
              {formatMeasurement(product.thickness, measurementSystem, locale)}
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
 * @param props.privacyInherited - Whether an assembly parent controls privacy.
 * @param props.savedIsPrivate - Privacy preference restored after detaching.
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
  privacyInherited = false,
  savedIsPrivate,
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
  /** Whether an assembly parent controls the effective privacy state. */
  privacyInherited?: boolean;
  /** Saved privacy preference restored when an installed component detaches. */
  savedIsPrivate?: boolean;
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
  const [error, setError] = useState<string | null>(null);
  const actorIsModerating = canAdminister && !isOwner;
  const locked = disabled || (isAdminPrivate && !actorIsModerating);

  if (privacyInherited) {
    return (
      <div className="grid justify-items-end gap-1">
        <div className="flex items-center gap-2">
          <PublicResourceSwitch
            checked={!isPrivate}
            disabled
            onCheckedChange={() => undefined}
          />
          <span className="text-sm text-muted-foreground">
            {t("web.slider.privacy.inherited")}
          </span>
          <Tooltip>
            <TooltipTrigger
              aria-label={t("web.slider.privacy.inheritedHelp")}
              className="rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              render={<button type="button" />}
            >
              <CircleHelp aria-hidden="true" className="size-4" />
            </TooltipTrigger>
            <TooltipContent className="max-w-72" side="bottom">
              <span>{t("web.slider.privacy.inheritedDescription")}</span>
              <span className="mt-1 block">
                {t("web.slider.privacy.savedPreference")}
              </span>
              {isAdminPrivate ? (
                <span className="mt-1 block">
                  {t("web.slider.privacy.staffForcedPrivate")}
                </span>
              ) : null}
            </TooltipContent>
          </Tooltip>
        </div>
        <span className="text-xs text-muted-foreground">
          {t(
            savedIsPrivate
              ? "web.resources.visibility.private"
              : "web.resources.visibility.public",
          )}
        </span>
      </div>
    );
  }

  if (!actorIsModerating) {
    return (
      <div className="grid justify-items-end gap-1">
        <PublicResourceSwitch
          checked={!isPrivate}
          disabled={locked}
          onCheckedChange={(isPublic) => {
            setError(null);
            void onChange(!isPublic).then((result) => {
              if (isMutationFailure(result)) {
                setError(
                  [
                    t(result.formError),
                    result.formErrorDetail
                      ? t(result.formErrorDetail, result.formErrorValues)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" "),
                );
                return;
              }
              setIsPrivate(!isPublic);
            });
          }}
        />
        {error ? (
          <span
            className="max-w-80 text-right text-xs text-destructive"
            role="alert"
          >
            {error}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid justify-items-end gap-1">
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
          setError(null);
          const result = await onChange(nextPrivate, reason);
          if (isMutationFailure(result)) {
            setError(
              [
                t(result.formError),
                result.formErrorDetail
                  ? t(result.formErrorDetail, result.formErrorValues)
                  : null,
              ]
                .filter(Boolean)
                .join(" "),
            );
            return;
          }
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
      {error ? (
        <span
          className="max-w-80 text-right text-xs text-destructive"
          role="alert"
        >
          {error}
        </span>
      ) : null}
    </div>
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
 * Renders an effective slider setup as read-only facts.
 *
 * @param props - Setup and localized formatter.
 * @returns Read-only exact setup details without install or custom controls.
 */
function MagnetSetupDetails({
  setup,
  t,
}: {
  /** Effective slider setup. */
  setup: EffectiveSliderSetup;
  /** Localized catalog message formatter. */
  t: ReturnType<typeof useCatalogCopy>;
}) {
  return (
    <div className="grid gap-3 rounded-md border border-border p-3">
      {setup.magnetLayout ? (
        <SliderMagnetLayoutValue layout={setup.magnetLayout} t={t} />
      ) : null}
      {setup.configuration ? (
        <MagnetConfigurationValue configuration={setup.configuration} t={t} />
      ) : (
        <p className="m-0 text-sm text-muted-foreground">
          {t("web.slider.setup.notRecorded")}
        </p>
      )}
    </div>
  );
}

/**
 * Renders a compact row-major magnet snapshot.
 *
 * @param root0 - Snapshot and translation formatter.
 * @returns Read-only magnet grades grouped by side.
 */
function MagnetConfigurationValue({
  configuration,
  t,
}: {
  /** Snapshot to render. */
  configuration: SliderMagnetConfiguration;
  /** Localized catalog message formatter. */
  t: ReturnType<typeof useCatalogCopy>;
}) {
  /**
   * Formats one side as ordered grades.
   *
   * @param values - Row-major grade values.
   * @returns Compact human-readable grades.
   */
  const side = (values: SliderMagnetConfiguration["sideA"]) =>
    values
      .map((grade) => grade ?? t("web.slider.magnet.state.empty"))
      .join(" · ");
  return (
    <div className="grid gap-1 text-sm">
      <p className="m-0">
        <span className="font-medium">{t("web.slider.magnet.halfA")}:</span>{" "}
        {side(configuration.sideA)}
      </p>
      {configuration.sideB ? (
        <p className="m-0">
          <span className="font-medium">{t("web.slider.magnet.halfB")}:</span>{" "}
          {side(configuration.sideB)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Renders a localized physical layout and its derived facts.
 *
 * @param root0 - Component properties.
 * @param root0.layout - Physical magnet layout.
 * @param root0.t - Catalog localization helper.
 * @returns Localized layout details.
 */
function SliderMagnetLayoutValue({
  layout,
  t,
}: {
  /** Physical magnet layout. */
  layout: SliderMagnetLayout;
  /** Catalog localization helper. */
  t: ReturnType<typeof useCatalogCopy>;
}) {
  const details = sliderMagnetLayoutDetails[layout];
  return (
    <div className="grid gap-1">
      <span>
        {t("web.slider.layout.option", {
          count: details.clickCount,
          layout: details.label,
        })}
      </span>
      <span className="text-sm text-muted-foreground">
        {t("web.slider.layout.help", {
          clicks: details.clickCount,
          columns: details.columnCount,
          layout: details.label,
          rows: details.rowCount,
          slots: details.slotsPerSide,
        })}
      </span>
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
