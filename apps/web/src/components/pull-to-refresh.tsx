import { RefreshCw } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Resisted indicator distance, in CSS pixels, required to request a refresh.
 * This corresponds to 144 CSS pixels of finger travel at the 0.5 resistance.
 */
const TRIGGER_DISTANCE = 72;
/**
 * Maximum resisted pull distance, in pixels, shown by the indicator.
 */
const MAX_PULL = 96;

/**
 * Content and controlled refresh state for the compact pull gesture.
 */
type PullToRefreshProps = {
  /**
   * Nested content.
   */
  children: React.ReactNode;
  /**
   * Requests a refresh after a qualifying pull is released.
   */
  onRefresh: () => void;
  /**
   * Whether a refresh is running and new pull gestures are disabled.
   */
  refreshing: boolean;
};

/**
 * Adds a resisted pull-to-refresh gesture while the document is scrolled to the
 * top. The indicator follows the pull and spins while `refreshing`; at `md` and
 * above it is hidden and the wrapper uses `display: contents`.
 *
 * @param props - Pull-to-refresh properties.
 * @param props.children - Content wrapped by the compact gesture surface.
 * @param props.onRefresh - Callback invoked after a qualifying pull is released.
 * @param props.refreshing - Whether a refresh is running.
 * @returns The responsive pull-to-refresh wrapper and indicator.
 */
export function PullToRefresh({
  children,
  onRefresh,
  refreshing,
}: PullToRefreshProps) {
  const [pull, setPull] = React.useState(0);
  const startYRef = React.useRef<number | null>(null);

  /**
   * Clears the visible pull distance and recorded touch origin.
   */
  const reset = () => {
    setPull(0);
    startYRef.current = null;
  };

  return (
    <div
      className="relative md:contents"
      onTouchEnd={() => {
        if (pull >= TRIGGER_DISTANCE && !refreshing) onRefresh();
        reset();
      }}
      onTouchMove={(event) => {
        if (startYRef.current === null || refreshing) return;
        const touch = event.touches[0];
        if (!touch) return;
        const delta = touch.clientY - startYRef.current;
        // Cancel the gesture the moment the page starts scrolling or the pull
        // reverses; otherwise track it with resistance.
        if (delta <= 0 || window.scrollY > 0) {
          setPull(0);
          return;
        }
        setPull(Math.min(delta * 0.5, MAX_PULL));
      }}
      onTouchStart={(event) => {
        if (refreshing || window.scrollY > 0) return;
        startYRef.current = event.touches[0]?.clientY ?? null;
      }}
    >
      <div
        aria-hidden={!(refreshing || pull > 0)}
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center md:hidden"
        style={{
          opacity: refreshing || pull > 8 ? 1 : 0,
          transform: `translateY(${refreshing ? 8 : pull - 32}px)`,
          transition:
            startYRef.current === null
              ? "transform 200ms ease-out, opacity 200ms ease-out"
              : "none",
        }}
      >
        <span className="mt-2 flex size-9 items-center justify-center rounded-full border border-border bg-card shadow-md">
          <RefreshCw
            className={cn(
              "size-4 text-muted-foreground",
              refreshing && "animate-spin",
            )}
            style={
              refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }
            }
          />
        </span>
      </div>
      {children}
    </div>
  );
}
