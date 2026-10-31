import { useCallback, useRef } from "react";
import { type EffectEntity, useEffectReducer } from "use-effect-reducer";

/** Current clipboard source and accessible copy feedback. */
type State = {
  /** Exact current clipboard source. */
  text: string;
  /** Existing accessible result. */
  status: "copied" | "failed" | null;
  /** Current copy observer. */
  request?: EffectEntity<State, Event>;
};
/** Copy intent, source replacement, and terminal cleanup. */
type Event =
  | {
      /** Replaces stale copy feedback. */
      type: "sourceChanged";
      /** Current clipboard source. */
      text: string;
    }
  | {
      /** Requests a copy through the current source. */
      type: "requested";
    }
  | {
      /** Stops a completed clipboard observer. */
      type: "settled";
      /** Whether the browser accepted the copy. */
      success: boolean;
    };
/** Captured clipboard operation. */
type Effect = {
  /** Browser clipboard implementation. */
  type: "copy";
  /** Captured clipboard source. */
  text: string;
};

/**
 * Copies the current source and retains a pending browser write across resumed observers.
 * @param text - Current safe clipboard source.
 * @returns Existing result feedback and the explicit copy command.
 */
export function useClipboardCopy(text: string) {
  const task = useRef<{
    /** Captured operation whose browser write must not repeat. */
    effect: Effect;
    /** Settled browser result. */
    promise: Promise<boolean>;
  } | null>(null);
  const [state, dispatch] = useEffectReducer<State, Event, Effect>(
    (state, event, exec) => {
      exec.stop(state.request);
      if (event.type === "sourceChanged")
        return { text: event.text, status: null };
      if (event.type === "requested")
        return { ...state, request: exec({ type: "copy", text: state.text }) };
      return {
        ...state,
        request: undefined,
        status: event.success ? "copied" : "failed",
      };
    },
    { text, status: null },
    {
      /** Observes one browser clipboard write through its current source lifetime.
       * @param _state - Current accessible feedback.
       * @param effect - Captured clipboard text.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current observer lifetime. */
      copy: (_state, effect, dispatch, { signal }) => {
        if (task.current?.effect !== effect)
          task.current = {
            effect,
            promise: (async () => {
              try {
                await navigator.clipboard.writeText(effect.text);
                return true;
              } catch {
                return false;
              }
            })(),
          };
        void task.current.promise.then((success) => {
          if (!signal.aborted) dispatch({ type: "settled", success });
        });
      },
    },
  );
  if (state.text !== text) dispatch({ type: "sourceChanged", text });
  /** Requests an explicit copy of the current source. */
  const copy = useCallback(() => {
    dispatch({ type: "requested" });
  }, [dispatch]);
  return { status: state.status, copy };
}
