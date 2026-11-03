import { useMemo, useSyncExternalStore } from "react";

/**
 * Observes a media query after commit with a stable server fallback.
 * @param query - Browser media query to observe.
 * @returns Whether the committed browser query matches.
 */
export function useMediaQuery(query: string) {
  const source = useMemo(() => {
    let matches = false;
    return {
      /**
       * Returns the cached browser match.
       * @returns Last committed query result.
       */
      getSnapshot: () => matches,
      /**
       * Observes query changes for this committed consumer.
       * @param notify - React subscription notification.
       * @returns Media listener cleanup.
       */
      subscribe: (notify: () => void) => {
        const media = window.matchMedia(query);
        /** Refreshes the cached result before notifying React. */
        const update = () => {
          matches = media.matches;
          notify();
        };
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
      },
    };
  }, [query]);
  return useSyncExternalStore(
    source.subscribe,
    source.getSnapshot,
    () => false,
  );
}

/**
 * Observes viewport width without measuring during render or server snapshots.
 * @returns Last measured CSS-pixel width, or null before the first subscription.
 */
export function useViewportWidth() {
  const source = useMemo(() => {
    let width: number | null = null;
    return {
      /**
       * Returns the cached viewport measurement.
       * @returns Width in CSS pixels, or null before measurement.
       */
      getSnapshot: () => width,
      /**
       * Measures the viewport and observes subsequent resize events.
       * @param notify - React subscription notification.
       * @returns Resize listener cleanup.
       */
      subscribe: (notify: () => void) => {
        /** Refreshes the cached width before notifying React. */
        const update = () => {
          width = window.innerWidth;
          notify();
        };
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
      },
    };
  }, []);
  return useSyncExternalStore(source.subscribe, source.getSnapshot, () => null);
}
