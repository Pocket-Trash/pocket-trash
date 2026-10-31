import {
  type EffectEntity,
  type EffectReducer,
  useEffectReducer,
} from "use-effect-reducer";
import { SEARCH_QUERY_DELAY_MS } from "@/lib/search-constants";

/** Editable search input and its URL acknowledgement. */
type DraftState = {
  /** Last observed normalized route query. */
  url: string;
  /** Current untrimmed input. */
  value: string;
  /** Last delivered query awaiting URL acknowledgement. */
  sent: string | null;
  /** Navigation generation. */
  generation: number;
  /** Current disposable navigation. */
  navigation: EffectEntity<DraftState, DraftEvent> | undefined;
};
/** Draft edits, explicit submission, URL reconciliation, and navigation completion. */
type DraftEvent =
  | {
      /** Input or route query changed. */
      type: "edited" | "urlChanged";
      /** Current raw input or normalized URL query. */
      value: string;
    }
  | {
      /** User submitted the current draft. */
      type: "submitted";
    }
  | {
      /** Debounce completed. */
      type: "debounceElapsed";
      /** Navigation generation. */
      generation: number;
      /** Normalized destination query. */
      query: string;
    }
  | {
      /** Navigation was delivered. */
      type: "delivered";
      /** Navigation generation. */
      generation: number;
      /** Normalized destination query. */
      query: string;
    };
/** Debounced or immediate navigation to a normalized query. */
type DraftEffect = {
  /** Query to deliver. */
  query: string;
  /** Navigation generation. */
  generation: number;
  /** Debounce delay in milliseconds. */
  delay: number;
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
 * Reconciles URL changes without discarding edits newer than an acknowledged query.
 * @param state - Current input and navigation lifetime.
 * @param event - User input, URL change, or terminal navigation.
 * @param exec - Committed effect queue.
 * @returns Reconciled draft and disposable navigation.
 */
const reducer: EffectReducer<DraftState, DraftEvent, DraftEffect> = (
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
        query: event.query,
        generation: event.generation,
        delay: 0,
      }),
    };
  }
  if (event.type === "delivered") {
    if (event.generation !== state.generation) return state;
    exec.stop(state.navigation);
    return { ...state, sent: event.query, navigation: undefined };
  }
  if (event.type === "urlChanged") {
    if (event.value === state.sent) {
      const acknowledged = state.value.trim() === event.value;
      if (acknowledged) exec.stop(state.navigation);
      return {
        ...state,
        url: event.value,
        value: acknowledged ? event.value : state.value,
        sent: null,
        navigation: acknowledged ? undefined : state.navigation,
      };
    }
    exec.stop(state.navigation);
    return {
      ...state,
      url: event.value,
      value: event.value,
      sent: null,
      generation: state.generation + 1,
      navigation: undefined,
    };
  }
  const value = event.type === "edited" ? event.value : state.value;
  const query = value.trim();
  const generation = state.generation + 1;
  exec.stop(state.navigation);
  return {
    ...state,
    value,
    generation,
    navigation:
      query === state.url
        ? undefined
        : exec({
            type: event.type === "submitted" ? "commit" : "navigate",
            query,
            generation,
            delay: event.type === "submitted" ? 0 : SEARCH_QUERY_DELAY_MS,
          }),
  };
};

/**
 * Owns an editable query while the route owns results and browser history.
 * @param query - Current normalized URL query.
 * @param onCommit - Route-owned replacement navigation.
 * @returns Draft text, edit operation, and immediate submit operation.
 */
export function useSearchDraft(
  query: string,
  onCommit: (query: string) => void,
) {
  const [state, dispatch] = useEffectReducer(
    reducer,
    () => ({
      url: query,
      value: query,
      sent: null,
      generation: 0,
      navigation: undefined,
    }),
    {
      /**
       * Delivers current navigation once and disposes its debounce.
       * @param _state - State that queued navigation.
       * @param effect - Normalized query and debounce policy.
       * @param dispatch - Terminal navigation dispatcher.
       * @param context - Navigation cancellation lifetime.
       * @returns Debounce cleanup when navigation is delayed.
       */
      navigate: (_state, effect, dispatch, { signal }) => {
        const timer = window.setTimeout(() => {
          if (signal.aborted) return;
          dispatch({
            type: "debounceElapsed",
            generation: effect.generation,
            query: effect.query,
          });
        }, effect.delay);
        return () => window.clearTimeout(timer);
      },
      /**
       * Uses the latest committed navigation callback after the debounce event.
       * @param _state - State that accepted the debounce.
       * @param effect - Current normalized query and generation.
       * @param dispatch - Terminal navigation dispatcher.
       * @param context - Committed navigation cancellation lifetime.
       */
      commit: (_state, effect, dispatch, { signal }) => {
        queueMicrotask(() => {
          if (signal.aborted) return;
          dispatch({
            type: "delivered",
            generation: effect.generation,
            query: effect.query,
          });
          onCommit(effect.query);
        });
      },
    },
  );
  if (query !== state.url) dispatch({ type: "urlChanged", value: query });
  return [
    state.value,
    (value: string) => dispatch({ type: "edited", value }),
    () => dispatch({ type: "submitted" }),
  ] as const;
}
