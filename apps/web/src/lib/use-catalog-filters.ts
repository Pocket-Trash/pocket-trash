import type React from "react";
import {
  type EffectEntity,
  type EffectReducer,
  useEffectReducer,
} from "use-effect-reducer";
import {
  type CatalogFilterSearch,
  type CatalogFilters,
  filtersFromSearch,
  filtersToSearch,
} from "./catalog-filters";

/** Catalog selections, URL acknowledgement, and pending replacement navigation. */
type FilterState = {
  /** Latest URL-backed selections. */
  urlKey: string;
  /** Current editable catalog selections. */
  filters: CatalogFilters;
  /** Last delivered selection key awaiting URL acknowledgement. */
  sentKey: string | null;
  /** Navigation generation. */
  generation: number;
  /** Disposable debounce lifetime. */
  navigation: EffectEntity<FilterState, FilterEvent> | undefined;
};
/** Catalog selection changes, history reconciliation, and navigation completion. */
type FilterEvent =
  | {
      /** User or facet reconciliation changed selections. */
      type: "filtersEdited";
      /** Existing controlled-filter update contract. */
      update: React.SetStateAction<CatalogFilters>;
    }
  | {
      /** Browser history or the current navigation changed URL state. */
      type: "urlChanged";
      /** Normalized URL values. */
      search: CatalogFilterSearch;
      /** Stable normalized URL key. */
      key: string;
    }
  | {
      /** Debounce completed. */
      type: "debounceElapsed";
      /** Navigation generation. */
      generation: number;
      /** Destination selection identity. */
      key: string;
      /** Normalized destination selections. */
      search: CatalogFilterSearch;
    }
  | {
      /** Navigation was delivered. */
      type: "delivered";
      /** Navigation generation. */
      generation: number;
      /** Destination selection identity. */
      key: string;
      /** Normalized destination selections. */
      search: CatalogFilterSearch;
    };
/** One debounced catalog URL replacement. */
type FilterEffect = {
  /** Normalized destination selections. */
  search: CatalogFilterSearch;
  /** Destination selection key. */
  key: string;
  /** Navigation generation. */
  generation: number;
} & (
  | {
      /** Waits for the query debounce. */
      type: "navigate";
    }
  | {
      /** Delivers navigation using the current committed callback. */
      type: "commit";
    }
);

/**
 * Preserves edits newer than acknowledged navigation and cancels them for external history.
 * @param state - Editable filters and current navigation.
 * @param event - Selection, URL, or terminal event.
 * @param exec - Committed effect queue.
 * @returns Reconciled selections and navigation lifetime.
 */
const reducer: EffectReducer<FilterState, FilterEvent, FilterEffect> = (
  state,
  event,
  exec,
) => {
  if (event.type === "debounceElapsed") {
    if (event.generation !== state.generation) return state;
    return {
      ...state,
      navigation: exec.replace(state.navigation, {
        type: "commit",
        search: event.search,
        key: event.key,
        generation: event.generation,
      }),
    };
  }
  if (event.type === "delivered") {
    if (event.generation !== state.generation) return state;
    exec.stop(state.navigation);
    return { ...state, sentKey: event.key, navigation: undefined };
  }
  if (event.type === "urlChanged") {
    const acknowledged = event.key === state.sentKey;
    const current =
      JSON.stringify(filtersToSearch(state.filters)) === event.key;
    if (!acknowledged || current) exec.stop(state.navigation);
    return {
      ...state,
      urlKey: event.key,
      filters:
        acknowledged && !current
          ? state.filters
          : filtersFromSearch(event.search),
      sentKey: null,
      generation: state.generation + (acknowledged ? 0 : 1),
      navigation: acknowledged && !current ? state.navigation : undefined,
    };
  }
  const filters =
    typeof event.update === "function"
      ? event.update(state.filters)
      : event.update;
  const search = filtersToSearch(filters);
  const key = JSON.stringify(search);
  const generation = state.generation + 1;
  exec.stop(state.navigation);
  return {
    ...state,
    filters,
    generation,
    navigation:
      key === state.urlKey || key === state.sentKey
        ? undefined
        : exec({ type: "navigate", search, key, generation }),
  };
};

/**
 * Reconciles catalog selections with history and debounces explicit edits by 300 milliseconds.
 * @param search - Current normalized URL-search values.
 * @param commit - Route-owned replacement navigation.
 * @returns Current filters and the existing controlled-filter dispatcher.
 */
export function useCatalogFilters(
  search: CatalogFilterSearch,
  commit: (search: CatalogFilterSearch) => void,
): [CatalogFilters, React.Dispatch<React.SetStateAction<CatalogFilters>>] {
  const canonical = filtersToSearch(filtersFromSearch(search));
  const key = JSON.stringify(canonical);
  const [state, dispatch] = useEffectReducer(
    reducer,
    () => ({
      urlKey: key,
      filters: filtersFromSearch(search),
      sentKey: null,
      generation: 0,
      navigation: undefined,
    }),
    {
      /**
       * Delivers one current replacement and stops its debounce after completion.
       * @param _state - State that queued navigation.
       * @param effect - Destination and generation.
       * @param dispatch - Terminal navigation dispatcher.
       * @param context - Navigation cancellation lifetime.
       * @returns Debounce cleanup.
       */
      navigate: (_state, effect, dispatch, { signal }) => {
        const timer = window.setTimeout(() => {
          if (signal.aborted) return;
          dispatch({
            type: "debounceElapsed",
            generation: effect.generation,
            key: effect.key,
            search: effect.search,
          });
        }, 300);
        return () => window.clearTimeout(timer);
      },
      /**
       * Uses the latest committed route callback after the debounce completes.
       * @param _state - State that accepted navigation.
       * @param effect - Destination and generation.
       * @param dispatch - Terminal navigation dispatcher.
       * @param context - Committed navigation cancellation lifetime.
       */
      commit: (_state, effect, dispatch, { signal }) => {
        queueMicrotask(() => {
          if (signal.aborted) return;
          dispatch({
            type: "delivered",
            generation: effect.generation,
            key: effect.key,
            search: effect.search,
          });
          commit(effect.search);
        });
      },
    },
  );
  if (key !== state.urlKey)
    dispatch({ type: "urlChanged", search: canonical, key });
  return [
    state.filters,
    (update) => dispatch({ type: "filtersEdited", update }),
  ];
}
