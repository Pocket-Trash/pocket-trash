import * as React from "react";
import { compactMediaQuery, TWO_PANE_MIN_WIDTH } from "@/lib/breakpoints";

/**
 * Tracks whether the browser viewport uses the compact mobile layout.
 *
 * @returns Whether the viewport is narrower than the two-pane breakpoint.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(compactMediaQuery);
    /** Updates compact-layout state after the media query changes. */
    const onChange = () => {
      setIsMobile(window.innerWidth < TWO_PANE_MIN_WIDTH);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < TWO_PANE_MIN_WIDTH);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
