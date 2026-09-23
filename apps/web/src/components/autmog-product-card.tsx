import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { CircleGauge, MoveHorizontal, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PenProduct } from "@/lib/pen-data";
import { normalizedHeadline, splitTitle } from "@/lib/pen-filters";
import {
  type CurrencyCode,
  type CurrencyRates,
  type DimensionUnit,
  formatDiameter,
  formatLength,
  formatPrice,
  formatWeight,
  type WeightUnit,
} from "@/lib/pen-formatters";
import { cn } from "@/lib/utils";
import { useLocale } from "@/providers/locale-provider";

type AutmogProductCardProps = {
  currency: CurrencyCode;
  onOpen: (product: PenProduct, element: HTMLButtonElement) => void;
  product: PenProduct;
  rates: CurrencyRates;
  units: DimensionUnit;
  weight: WeightUnit;
};

export function AutmogProductCard({
  currency,
  onOpen,
  product,
  rates,
  units,
  weight,
}: AutmogProductCardProps) {
  const { locale } = useLocale();
  const t = (
    key: TranslationKey,
    values: Readonly<Record<string, unknown>> = {},
  ) => formatTranslation(key, values, locale);
  const { detail } = splitTitle(product.title);
  const year = product.published_at
    ? `'${product.published_at.slice(2, 4)}`
    : "";
  const dimensions = [
    { id: "weight", icon: Scale, value: formatWeight(product, weight) },
    {
      id: "diameter",
      icon: CircleGauge,
      value: formatDiameter(product, units),
    },
    {
      id: "length",
      icon: MoveHorizontal,
      value: formatLength(product, units),
    },
  ].filter((item): item is { icon: typeof Scale; id: string; value: string } =>
    Boolean(item.value),
  );

  return (
    <button
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border border-border bg-card text-left text-card-foreground transition hover:-translate-y-0.5 hover:border-primary"
      onClick={(event) => onOpen(product, event.currentTarget)}
      type="button"
    >
      <div
        className="relative aspect-4/3 shrink-0 border-b border-border bg-muted bg-cover bg-center"
        style={{ backgroundImage: `url("${product.image}")` }}
      >
        {year ? (
          <span className="absolute top-2 right-2 rounded-sm bg-card/85 px-2 py-1 text-[11px] font-bold tracking-[0.3px] backdrop-blur">
            {year}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <h2 className="line-clamp-2 min-h-[39px] text-[15px] leading-[1.3] font-semibold">
          {normalizedHeadline(product, t)}
        </h2>
        <div className="flex min-h-[79px] flex-col gap-0.5 overflow-hidden text-[12.5px] leading-[1.45] text-muted-foreground">
          {detail
            ? detail.split(" - ").map((part) => (
                <span className="block" key={part}>
                  {part.trim()}
                </span>
              ))
            : null}
        </div>
        <div className="flex min-h-[19px] items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="font-semibold text-card-foreground">
            {formatPrice(product.price_min, product.price_max, currency, rates)}
          </span>
          {product.archived ? (
            <Badge
              className="rounded-sm bg-accent px-2 py-0.5 text-[10.5px] tracking-[0.5px] text-accent-foreground"
              variant="secondary"
            >
              {t("web.archive.state.archived")}
            </Badge>
          ) : null}
        </div>
        <div className="flex min-h-[17px] flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {dimensions.map(({ icon: Icon, id, value }) => (
            <span
              className="inline-flex items-center gap-1 whitespace-nowrap"
              key={id}
            >
              <Icon className="size-3.5" />
              {value}
            </span>
          ))}
        </div>
        <div className="mt-auto flex min-h-[22px] flex-wrap gap-1 pt-1">
          {product.sizes.length > 0 ? (
            <ProductTag className="bg-chart-2/15 text-chart-2">
              {product.sizes.join(" / ")}
            </ProductTag>
          ) : null}
          {product.materials.map((tag) => (
            <ProductTag className="bg-chart-1/15 text-chart-1" key={tag}>
              {tag}
            </ProductTag>
          ))}
          {product.refills.map((tag) => (
            <ProductTag className="bg-chart-3/15 text-chart-3" key={tag}>
              {tag}
            </ProductTag>
          ))}
          {product.noses.map((tag) => (
            <ProductTag className="bg-chart-4/15 text-chart-4" key={tag}>
              {tag}
            </ProductTag>
          ))}
        </div>
      </div>
    </button>
  );
}

function ProductTag({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-sm px-1.5 py-0.5 text-[11px] tracking-[0.3px] whitespace-nowrap",
        className,
        "text-foreground",
      )}
    >
      {children}
    </span>
  );
}
