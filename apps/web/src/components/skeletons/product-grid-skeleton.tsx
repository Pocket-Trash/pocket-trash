import { Skeleton } from "@/components/ui/skeleton";

// Stable keys for the placeholder cards (they never reorder), so we avoid keying
// by array index.
/**
 * Stable keys used to render the maximum product-grid placeholder count.
 */
const PLACEHOLDER_KEYS = Array.from(
  { length: 48 },
  (_, index) => `product-skeleton-${index}`,
);

// Placeholder cards shown while the grid is (re)loading — during pull-to-refresh
// now, and behind the service worker's cache warm-up once the PWA lands. Mirrors
// the reserved heights in `product-card.tsx` so there is no layout shift when the
// real cards swap in. Renders bare cards so the caller keeps them in its grid.
/**
 * Renders a configurable grid of product-card placeholders.
 *
 * @param props - Product grid skeleton properties.
 * @param props.count - Number of product-card placeholders to render.
 * @returns The rendered product grid skeleton UI.
 */
export function ProductGridSkeleton({
  count = 12,
}: {
  /**
   * Number of product-card placeholders to render.
   *
   * @default 12
   */
  count?: number;
}) {
  return (
    <>
      {PLACEHOLDER_KEYS.slice(0, count).map((key) => (
        <ProductCardSkeleton key={key} />
      ))}
    </>
  );
}

/**
 * Renders a placeholder for one product card.
 *
 * @returns The rendered product card skeleton UI.
 */
function ProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card">
      <Skeleton className="aspect-4/3 shrink-0 rounded-none border-b border-border" />
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex min-h-[39px] flex-col gap-1.5">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
        <div className="flex min-h-[79px] flex-col gap-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        <div className="flex min-h-[19px] items-center">
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex min-h-[17px] gap-3">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="mt-auto flex min-h-[22px] gap-1 pt-1">
          <Skeleton className="h-4 w-10 rounded-sm" />
          <Skeleton className="h-4 w-14 rounded-sm" />
          <Skeleton className="h-4 w-12 rounded-sm" />
        </div>
      </div>
    </div>
  );
}
