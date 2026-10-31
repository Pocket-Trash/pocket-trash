import {
  type EffectEntity,
  type EffectReducer,
  useEffectReducer,
} from "use-effect-reducer";

/** Requested and resolved page inputs, after viewport measurement. */
type PageInput = {
  /** Requested URL page, in the caller's indexing convention. */
  requested: number;
  /** Clamped destination page, using the same indexing convention. */
  page: number;
  /** Whether browser page-size measurement is complete. */
  measured: boolean;
};
/** Committed correction lifetime and its input. */
type PageState = PageInput & {
  /** Generation used to reject superseded terminal events. */
  generation: number;
  /** Queued URL correction, stopped after completion. */
  correction: EffectEntity<PageState, PageEvent> | undefined;
};
/** Page-input changes and terminal navigation events. */
type PageEvent =
  | {
      /** New controlled pagination inputs. */
      type: "inputChanged";
      /** Latest page inputs. */
      input: PageInput;
    }
  | {
      /** Navigation was delivered. */
      type: "corrected";
      /** Delivered correction generation. */
      generation: number;
    };
/** Navigation queued only after a committed, measured clamping decision. */
type PageEffect = {
  /** Effect implementation. */
  type: "correctPage";
  /** Destination page. */
  page: number;
  /** Correction generation. */
  generation: number;
};

/**
 * Replaces obsolete navigation and stops completed corrections.
 * @param state - Last page inputs and active correction.
 * @param event - New inputs or terminal navigation.
 * @param exec - Committed effect queue.
 * @returns Current inputs and correction lifetime.
 */
const reducer: EffectReducer<PageState, PageEvent, PageEffect> = (
  state,
  event,
  exec,
) => {
  if (event.type === "corrected") {
    if (event.generation !== state.generation) return state;
    exec.stop(state.correction);
    return { ...state, correction: undefined };
  }
  const generation = state.generation + 1;
  const { input } = event;
  exec.stop(state.correction);
  return {
    ...input,
    generation,
    correction:
      input.measured && input.page !== input.requested
        ? exec({ type: "correctPage", page: input.page, generation })
        : undefined,
  };
};

/**
 * Delivers a measured page correction once without pushing browser history.
 * @param input - Current requested page, clamped page, and measurement status.
 * @param onCorrect - Caller-owned URL replacement operation.
 */
export function usePageCorrection(
  input: PageInput,
  onCorrect: (page: number) => void,
) {
  const [state, dispatch] = useEffectReducer(
    reducer,
    () => ({ ...input, measured: false, generation: 0, correction: undefined }),
    {
      /**
       * Delivers committed navigation, ignoring canceled StrictMode/Activity work.
       * @param _state - State that queued navigation.
       * @param effect - Destination and generation.
       * @param dispatch - Terminal event dispatcher.
       * @param context - Effect cancellation lifetime.
       */
      correctPage: (_state, effect, dispatch, { signal }) => {
        queueMicrotask(() => {
          if (signal.aborted) return;
          dispatch({ type: "corrected", generation: effect.generation });
          onCorrect(effect.page);
        });
      },
    },
  );
  if (
    input.requested !== state.requested ||
    input.page !== state.page ||
    input.measured !== state.measured
  )
    dispatch({ type: "inputChanged", input });
}
