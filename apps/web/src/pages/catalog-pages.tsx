import type { CatalogProduct, UserCollectionItem } from "@package/services";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/providers/locale-provider";

function useCatalogCopy() {
  const { locale } = useLocale();
  return (key: string, values: Readonly<Record<string, unknown>> = {}) =>
    formatTranslation(key as TranslationKey, values, locale);
}

export function HomePage() {
  const t = useCatalogCopy();
  const cards = [
    { key: "web.navigation.products" as const, to: "/products" as const },
    { key: "web.navigation.collections" as const, to: "/collections" as const },
    { key: "web.navigation.resources" as const, to: "/resources" as const },
  ];

  return (
    <AppShell sidebarContent={null} title={t("web.site.name")}>
      <main className="grid gap-[18px] p-4 md:grid-cols-3 md:p-[18px_22px_22px]">
        {cards.map(({ key, to }) => (
          <Link
            className="rounded-xl border border-border bg-card p-8 text-xl font-semibold text-card-foreground transition-transform hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            key={to}
            to={to}
          >
            {t(key)}
          </Link>
        ))}
      </main>
    </AppShell>
  );
}

export function ResourcesPage() {
  const t = useCatalogCopy();
  return (
    <AppShell sidebarContent={null} title={t("web.navigation.resources")}>
      <main className="mx-auto max-w-3xl p-6 text-muted-foreground">
        {t("web.page.resources.stub")}
      </main>
    </AppShell>
  );
}

export function ProductsPage({ products }: { products: CatalogProduct[] }) {
  const t = useCatalogCopy();
  return (
    <AppShell
      headerActions={
        <Link className={buttonVariants()} to="/products/add">
          {t("web.action.addProduct")}
        </Link>
      }
      sidebarContent={null}
      title={t("web.navigation.products")}
    >
      <ProductGrid products={products} />
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
      <AppShell sidebarContent={null} title={product.name}>
        <main className="mx-auto max-w-3xl p-6">
          <EmptyState>{t("web.catalog.notImplemented")}</EmptyState>
        </main>
      </AppShell>
    );
  }
  const specs: Array<[string, string | null, string]> =
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
      headerActions={
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
      }
      sidebarContent={null}
      title={product.name}
    >
      <main className="mx-auto grid max-w-3xl gap-6 p-6">
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
  owners,
}: {
  owners: Array<{ clerkId: string; itemCount: number; userId: number }>;
}) {
  const t = useCatalogCopy();
  return (
    <AppShell
      headerActions={
        <Link className={buttonVariants()} to="/collections/add">
          {t("web.action.addToCollection")}
        </Link>
      }
      sidebarContent={null}
      title={t("web.navigation.collections")}
    >
      <main className="grid gap-[18px] p-4 sm:grid-cols-2 lg:grid-cols-3 md:p-[18px_22px_22px]">
        {owners.length ? (
          owners.map((owner) => (
            <article
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground"
              key={owner.userId}
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
                  {t("web.collections.directory.itemCount", {
                    count: owner.itemCount,
                  })}
                </p>
              </div>
            </article>
          ))
        ) : (
          <EmptyState>{t("web.collections.empty")}</EmptyState>
        )}
      </main>
    </AppShell>
  );
}

export function UserCollectionPage({ items }: { items: UserCollectionItem[] }) {
  const t = useCatalogCopy();
  return (
    <AppShell
      headerActions={
        <Link className={buttonVariants()} to="/collections/add">
          {t("web.action.addToCollection")}
        </Link>
      }
      sidebarContent={null}
      title={t("web.navigation.collections")}
    >
      <main className="grid grid-cols-1 gap-[18px] p-3 min-[481px]:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(max(240px,calc((100%_-_4_*_18px)_/_5)),1fr))] md:p-[18px_22px_22px]">
        {items.length ? (
          items.map((item) => (
            <Link
              className="rounded-xl border border-border bg-card p-5 font-semibold text-card-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              key={item.collectionItemId}
              params={{ collectionItemId: item.collectionItemId }}
              to="/collections/edit/$collectionItemId"
            >
              {item.name}
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
          className="rounded-xl border border-border bg-card p-5 text-card-foreground transition-transform hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          key={product.id}
          params={{
            productSlug: product.slug,
            productTypeSlug: product.productTypeSlug,
          }}
          to="/products/$productTypeSlug/$productSlug"
        >
          <h2 className="line-clamp-2 min-h-[2.6em] text-[15px] leading-[1.3] font-semibold">
            {product.name}
          </h2>
          <p className="mt-1 min-h-[2.9em] text-[12.5px] leading-[1.45] text-muted-foreground">
            {product.productTypeName} · {product.makerName}
          </p>
          <div className="mt-3 flex min-h-6 flex-wrap content-start gap-1">
            {product.materials.map(({ id, name }) => (
              <span
                className="rounded-sm bg-chart-1/15 px-1.5 py-0.5 text-[11px] tracking-[0.3px] whitespace-nowrap text-chart-1"
                key={id}
              >
                {name}
              </span>
            ))}
          </div>
        </Link>
      ))}
    </section>
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
