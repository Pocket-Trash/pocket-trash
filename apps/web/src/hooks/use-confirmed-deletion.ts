import { useAuth } from "@clerk/tanstack-react-start";
import { useRef } from "react";
import {
  type EffectEntity,
  type EffectFunction,
  useEffectReducer,
} from "use-effect-reducer";

/** Confirmed deletion and post-commit completion, scoped to the current actor. */
type DeletionState = {
  /** Account whose deletion observer owns this state. */
  actorId: string | null | undefined;
  /** Whether confirmation is currently open. */
  open: boolean;
  /** Whether the confirmed deletion already committed. */
  acknowledged: boolean;
  /** Current confirmed mutation or completion action. */
  request: EffectEntity<DeletionState, DeletionEvent> | undefined;
};
/** Explicit confirmation intent and terminal stage cleanup. */
type DeletionEvent =
  | {
      /** Disposes a previous account's confirmation and observers. */
      type: "actorChanged";
      /** Current account identity. */
      actorId: string | null | undefined;
    }
  | {
      /** Opens explicit confirmation. */
      type: "opened";
    }
  | {
      /** Dismisses an idle confirmation. */
      type: "dismissed";
    }
  | {
      /** Submits the form's confirmed deletion intent. */
      type: "requested";
      /** Existing optional staff reason. */
      reason?: string;
    }
  | {
      /** Stops a completed mutation stage. */
      type: "deleted";
      /** Whether the server deletion committed. */
      success: boolean;
    }
  | {
      /** Stops a completed post-commit action. */
      type: "completed";
      /** Whether post-commit completion succeeded. */
      success: boolean;
    };
/** Captured deletion or post-commit completion action. */
type DeletionEffect =
  | {
      /** Confirmed deletion implementation. */
      type: "delete";
      /** Existing optional staff reason. */
      reason?: string;
      /** Captured service operation.
       * @param reason - Confirmed optional staff reason.
       * @returns Completion after the deletion commits.
       * @rejects When deletion fails. */
      execute(reason?: string): Promise<void>;
    }
  | {
      /** Post-commit completion implementation. */
      type: "complete";
      /** Captured completion/navigation command.
       * @returns Completion after the existing post-delete action.
       * @rejects When the post-delete action fails. */
      execute?: () => Promise<unknown> | void;
    };
/** One settled stage retained across StrictMode and Activity observers. */
type DeletionOutcome =
  | {
      /** Successful stage acknowledgement. */
      ok: true;
    }
  | {
      /** Failed stage acknowledgement. */
      ok: false;
      /** Original failure for the consumer's existing localized feedback. */
      error: unknown;
    };

/**
 * Separates confirmed privacy mutations from post-commit navigation so each stage runs once.
 * @param onDelete - Existing confirmed deletion service operation.
 * @param onComplete - Optional post-commit completion/navigation command.
 * @param onFailure - Publishes failure into the consumer's form error model.
 * @returns Explicit confirmation commands and current deletion eligibility.
 */
export function useConfirmedDeletion(
  onDelete: (reason?: string) => Promise<void>,
  onComplete: (() => Promise<unknown> | void) | undefined,
  onFailure: (error: unknown) => void,
) {
  const { userId: actorId } = useAuth();
  const task = useRef<{
    /** Captured stage whose operation must not replay. */
    effect: DeletionEffect;
    /** Retained stage acknowledgement. */
    promise: Promise<DeletionOutcome>;
  } | null>(null);
  /**
   * Observes one confirmed stage only through its current account/DOM lifetime.
   * @param _state - Current confirmation and durable acknowledgement.
   * @param effect - Captured deletion or completion stage.
   * @param dispatch - Terminal stage dispatcher.
   * @param context - Current observer lifetime.
   */
  const execute: EffectFunction<
    DeletionState,
    DeletionEvent,
    DeletionEffect
  > = (_state, effect, dispatch, { signal }) => {
    if (task.current?.effect !== effect)
      task.current = {
        effect,
        promise: (async (): Promise<DeletionOutcome> => {
          try {
            await (effect.type === "delete"
              ? effect.execute(effect.reason)
              : effect.execute?.());
            return { ok: true };
          } catch (error) {
            return { ok: false, error };
          }
        })(),
      };
    void task.current.promise.then((outcome) => {
      if (signal.aborted) return;
      dispatch({
        type: effect.type === "delete" ? "deleted" : "completed",
        success: outcome.ok,
      });
      if (!outcome.ok) onFailure(outcome.error);
    });
  };
  const [state, dispatch] = useEffectReducer<
    DeletionState,
    DeletionEvent,
    DeletionEffect
  >(
    (state, event, exec) => {
      if (event.type === "actorChanged") {
        exec.stop(state.request);
        return {
          actorId: event.actorId,
          open: false,
          acknowledged: false,
          request: undefined,
        };
      }
      if (event.type === "opened") return { ...state, open: true };
      if (event.type === "dismissed")
        return state.request ? state : { ...state, open: false };
      if (event.type === "requested")
        return !state.open || state.request
          ? state
          : {
              ...state,
              request: state.acknowledged
                ? exec({ type: "complete", execute: onComplete })
                : exec({
                    type: "delete",
                    execute: onDelete,
                    reason: event.reason,
                  }),
            };
      exec.stop(state.request);
      if (event.type === "deleted")
        return event.success
          ? {
              ...state,
              acknowledged: true,
              request: exec({ type: "complete", execute: onComplete }),
            }
          : { ...state, request: undefined };
      return {
        ...state,
        request: undefined,
        open: event.success ? false : true,
      };
    },
    { actorId, open: false, acknowledged: false, request: undefined },
    { delete: execute, complete: execute },
  );
  if (state.actorId !== actorId) dispatch({ type: "actorChanged", actorId });
  return {
    open: state.open,
    submitting: Boolean(state.request),
    /** Opens explicit confirmation. */
    openConfirmation() {
      dispatch({ type: "opened" });
    },
    /** Dismisses an idle confirmation. */
    dismiss() {
      dispatch({ type: "dismissed" });
    },
    /**
     * Submits one already-validated confirmation.
     * @param reason - Existing optional staff reason.
     */
    confirm(reason?: string) {
      dispatch({ type: "requested", reason });
    },
  };
}
