import { compactMediaQuery } from "@/lib/breakpoints";
import { useMediaQuery } from "./use-browser-layout";

/**
 * Tracks whether the browser viewport uses the compact mobile layout.
 *
 * @returns Whether the viewport is narrower than the two-pane breakpoint.
 */
export function useIsMobile() {
  return useMediaQuery(compactMediaQuery);
}
