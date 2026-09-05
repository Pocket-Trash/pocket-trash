import {
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  ExternalLink,
  MoveHorizontal,
  Scale,
  X,
} from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PenProduct } from "@/lib/pen-data";
import {
  type CurrencyCode,
  type CurrencyRates,
  type DimensionUnit,
  formatDate,
  formatDiameter,
  formatLength,
  formatPrice,
  formatWeight,
  type WeightUnit,
} from "@/lib/pen-formatters";
import { webText } from "@/lib/ui-text";
import { cn } from "@/lib/utils";
import { useLocale } from "@/providers/locale-provider";

type ProductLightboxProps = {
  currency: CurrencyCode;
  imageIndex: number;
  onClose: () => void;
  onImageChange: (nextIndex: number) => void;
  product: PenProduct | null;
  rates: CurrencyRates;
  units: DimensionUnit;
  weight: WeightUnit;
};

/**
 * Product detail view. On regular widths it is a full-screen two-column
 * lightbox (Escape / arrow keys / buttons); on compact widths it is a vaul
 * bottom sheet, which owns swipe-to-dismiss, the scroll lock, and focus — so
 * there is no hand-rolled drag gesture here. Image paging uses the on-image
 * buttons (and arrow keys on desktop) on both tiers.
 */
export function ProductLightbox({
  currency,
  imageIndex,
  onClose,
  onImageChange,
  product,
  rates,
  units,
  weight,
}: ProductLightboxProps) {
  const isMobile = useIsMobile();
  const { locale } = useLocale();
  const t = (key: Parameters<typeof webText>[1]) => webText(locale, key);

  // The drawer stays mounted through its slide-out animation, so hold the last
  // product to keep the sheet's content intact after `product` clears from the
  // URL. The desktop modal just unmounts, so it reads `product` directly.
  const shownRef = React.useRef(product);
  if (product) shownRef.current = product;
  const shown = product ?? shownRef.current;

  const images = shown?.images_local.length
    ? shown.images_local
    : shown
      ? [shown.image]
      : [];

  // Keep the latest values in a ref so the keyboard listener can subscribe once
  // per open instead of re-running on every index change.
  const stateRef = React.useRef({
    imageIndex,
    length: images.length,
    onClose,
    onImageChange,
  });
  stateRef.current = {
    imageIndex,
    length: images.length,
    onClose,
    onImageChange,
  };

  // Desktop modal only: Escape closes, arrows page images, and the body scroll
  // is locked. The vaul drawer already handles all of this on mobile.
  React.useEffect(() => {
    if (isMobile || !product) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      const s = stateRef.current;
      if (event.key === "Escape") s.onClose();
      if (event.key === "ArrowLeft") {
        s.onImageChange(wrapIndex(s.imageIndex - 1, s.length));
      }
      if (event.key === "ArrowRight") {
        s.onImageChange(wrapIndex(s.imageIndex + 1, s.length));
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobile, product]);

  if (!shown) return null;

  const image = images[imageIndex] ?? images[0] ?? "";

  type LightboxSpec = {
    icon?: typeof Scale;
    label: string;
    value: string | null;
  };

  const allSpecs: LightboxSpec[] = [
    {
      label: t("Price"),
      value: formatPrice(shown.price_min, shown.price_max, currency, rates),
    },
    {
      label: t("Model"),
      value: shown.sizes.length > 0 ? shown.sizes.join(" / ") : null,
    },
    { icon: Scale, label: t("Weight"), value: formatWeight(shown, weight) },
    {
      icon: CircleGauge,
      label: t("Diameter"),
      value: formatDiameter(shown, units),
    },
    {
      icon: MoveHorizontal,
      label: t("Length"),
      value: formatLength(shown, units),
    },
  ];

  const specs = allSpecs.filter(
    (spec): spec is LightboxSpec & { value: string } => Boolean(spec.value),
  );

  const imagePane = (
    <div className="relative flex aspect-4/3 min-h-0 items-start justify-center bg-muted md:aspect-auto md:min-h-[320px]">
      <img
        alt={shown.title}
        className="h-full max-h-[60vh] w-full object-contain md:max-h-none"
        src={image}
      />
      {shown.published_at ? (
        <span className="absolute top-3 left-3 rounded-sm bg-card/85 px-2.5 py-1 text-xs font-bold backdrop-blur">
          '{shown.published_at.slice(2, 4)}
        </span>
      ) : null}
      {images.length > 1 ? (
        <>
          <Button
            aria-label={t("Previous image")}
            className="absolute top-1/2 left-3 rounded-full bg-card/75 backdrop-blur"
            onClick={() =>
              onImageChange(wrapIndex(imageIndex - 1, images.length))
            }
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronLeft />
          </Button>
          <Button
            aria-label={t("Next image")}
            className="absolute top-1/2 right-3 rounded-full bg-card/75 backdrop-blur"
            onClick={() =>
              onImageChange(wrapIndex(imageIndex + 1, images.length))
            }
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronRight />
          </Button>
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-card/75 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur">
            {imageIndex + 1} / {images.length}
          </span>
        </>
      ) : null}
    </div>
  );

  const infoPane = (
    <div className="flex min-w-0 flex-col gap-4 overflow-y-auto p-5 min-[601px]:p-8">
      <div className="text-[11px] tracking-[1px] text-muted-foreground uppercase">
        {t("Released")} - {formatDate(shown.published_at)}
      </div>
      <h2 className="text-[22px] leading-[1.15] font-bold min-[601px]:text-[28px]">
        {shown.title}
      </h2>
      {shown.archived ? (
        <Badge className="w-fit rounded-full bg-accent text-accent-foreground">
          {t("Archived - no longer listed")}
        </Badge>
      ) : null}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3 rounded-lg border border-border bg-secondary p-4">
        {specs.map(({ icon: Icon, label, value }) => (
          <div className="flex flex-col gap-1" key={label}>
            <span className="text-[10px] tracking-[0.8px] text-muted-foreground uppercase">
              {label}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
              {Icon ? <Icon className="size-3.5" /> : null}
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[
          ...shown.materials.map((tag) => [tag, "material"] as const),
          ...shown.refills.map((tag) => [tag, "refill"] as const),
          ...shown.noses.map((tag) => [tag, "nose"] as const),
          ...shown.mechanisms.map((tag) => [tag, "default"] as const),
          ...shown.clips.map((tag) => [tag, "default"] as const),
          ...shown.body_details.map((tag) => [tag, "default"] as const),
          ...shown.finishes.map((tag) => [tag, "default"] as const),
        ].map(([tag, kind]) => (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] tracking-[0.3px]",
              kind === "material" && "bg-chart-1/15 text-chart-1",
              kind === "refill" && "bg-chart-3/15 text-chart-3",
              kind === "nose" && "bg-chart-4/15 text-chart-4",
              kind === "default" && "bg-secondary text-secondary-foreground",
            )}
            key={`${kind}-${tag}`}
          >
            {tag}
          </span>
        ))}
      </div>

      <p className="whitespace-pre-wrap text-[13.5px] leading-[1.6] text-muted-foreground italic">
        {shown.body_text || "(no description on file)"}
      </p>

      <div className="border-t border-border pt-3">
        <Button
          className="w-full"
          nativeButton={false}
          render={<a href={shown.url} rel="noopener" target="_blank" />}
        >
          {t("Visit product page")}
          <ExternalLink />
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        open={product != null}
      >
        <DrawerContent>
          <DrawerHeader className="sr-only">
            <DrawerTitle>{shown.title}</DrawerTitle>
            <DrawerDescription>
              {t("Specs, materials, and release details for this product.")}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-col overflow-y-auto">
            {imagePane}
            {infoPane}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/85 p-3 backdrop-blur-md md:items-stretch md:p-10"
      role="dialog"
    >
      <button
        aria-label={t("Close product details")}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <Button
        className="fixed top-3 right-3 z-[110] rounded-full bg-card/90 backdrop-blur"
        onClick={onClose}
        type="button"
        variant="outline"
      >
        <X />
        {t("Close")}
      </Button>
      <div className="relative z-[101] grid w-full max-w-[1280px] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl md:grid-cols-[1.1fr_1fr]">
        {imagePane}
        {infoPane}
      </div>
    </div>
  );
}

function wrapIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return (index + length) % length;
}
