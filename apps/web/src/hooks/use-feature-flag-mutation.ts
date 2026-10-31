import { useAuth } from "@clerk/tanstack-react-start";
import type { FeatureFlagAudience } from "@package/feature-flags";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useRouter } from "@tanstack/react-router";
import { useRef } from "react";
import { type EffectEntity, useEffectReducer } from "use-effect-reducer";
import {
  archiveAdminFeatureFlag,
  createAdminFeatureFlag,
  setAdminFeatureFlagForUser,
  setUserBetaFeatureFlag,
  updateAdminFeatureFlag,
} from "@/lib/feature-flags";
import { useLocale } from "@/providers/locale-provider";

/** Form-owned feature-flag authoring fields. */
export type FeatureFlagDraft = {
  /** Existing flag audience. */
  audience: FeatureFlagAudience;
  /** Default for global flags. */
  defaultEnabled: boolean;
  /** Existing optional description represented by the input. */
  description: string;
  /** Existing flag display name. */
  name: string;
  /** Stable flag slug. */
  slug: string;
};
/** Existing feature-flag mutation contracts expressed as explicit intent. */
export type FeatureFlagOperation =
  | {
      /** Creates a flag with its original audience. */
      kind: "create";
      /** Captured authoring fields. */
      value: FeatureFlagDraft;
    }
  | {
      /** Updates an existing flag without changing its audience or slug. */
      kind: "update";
      /** Captured authoring fields. */
      value: FeatureFlagDraft;
    }
  | {
      /** Archives one existing flag. */
      kind: "archive";
      /** Stable flag identity. */
      slug: string;
    }
  | {
      /** Changes the current user's opt-in. */
      kind: "beta";
      /** Stable flag identity. */
      slug: string;
      /** Desired opt-in state. */
      enabled: boolean;
    }
  | {
      /** Changes one selected user's administrative targeting. */
      kind: "target";
      /** Stable flag identity. */
      slug: string;
      /** Captured selected account identity. */
      targetClerkId: string;
      /** Desired resolved targeting state. */
      enabled: boolean;
    };
/** Current feature-flag mutation observer and existing failure feedback. */
type FlagMutationState = {
  /** Account whose mutation observer owns this state. */
  actorId: string | null | undefined;
  /** Confirmed mutation in flight. */
  request: EffectEntity<FlagMutationState, FlagMutationEvent> | undefined;
  /** Existing failure feedback. */
  error: string | null;
};
/** Account reconciliation, explicit mutation intent, and terminal cleanup. */
type FlagMutationEvent =
  | {
      /** Disposes prior-account feedback. */
      type: "actorChanged";
      /** Current account identity. */
      actorId: string | null | undefined;
    }
  | {
      /** Requests an existing feature-flag mutation. */
      type: "requested";
      /** Captured mutation input. */
      operation: FeatureFlagOperation;
    }
  | {
      /** Stops a completed mutation/loader refresh. */
      type: "finished";
      /** Existing failure feedback when a stage failed. */
      error?: string;
    };
/** Committed feature-flag mutation and its account scope. */
type FlagMutationEffect = {
  /** Mutation implementation. */
  type: "mutate";
  /** Account whose write must not be reused by another account. */
  actorId: string | null | undefined;
  /** Captured mutation input. */
  operation: FeatureFlagOperation;
};
/** Retained write acknowledgement and separately retryable loader refresh. */
type FlagMutationTask = {
  /** Current observer's captured descriptor. */
  effect: FlagMutationEffect;
  /** Account/input identity used when retrying only a failed refresh. */
  key: string;
  /** Durable write completion, containing existing error feedback on failure. */
  mutation: Promise<string | undefined>;
  /** Whether the original write committed successfully. */
  committed?: boolean;
  /** Whether the active authoring owner received the durable identity. */
  acknowledged?: boolean;
  /** Loader refresh started only by an active observer. */
  refresh?: Promise<string | undefined>;
};

/**
 * Persists existing flag operations and refreshes route data without replaying acknowledged writes.
 * @param onCommitted - Optional consumer command after both write and loader refresh succeed.
 * @param onAcknowledged - Optional authoring command as soon as its server write commits.
 * @returns Current pending/error state and an explicit mutation command.
 */
export function useFeatureFlagMutation(
  onCommitted?: (operation: FeatureFlagOperation) => void,
  onAcknowledged?: (operation: FeatureFlagOperation) => void,
) {
  const { userId: actorId } = useAuth();
  const { locale } = useLocale();
  const router = useRouter();
  /**
   * Formats existing feature-flag failure feedback.
   * @param key - Existing failure key.
   * @returns Localized failure feedback.
   */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  /**
   * Preserves server-localized errors with the existing generic fallback.
   * @param error - Service or loader failure.
   * @returns Existing visible failure message.
   */
  const failureMessage = (error: unknown) =>
    error instanceof Error ? error.message : t("web.status.failedToLoad");
  const task = useRef<FlagMutationTask | null>(null);
  const [state, dispatch] = useEffectReducer<
    FlagMutationState,
    FlagMutationEvent,
    FlagMutationEffect
  >(
    (state, event, exec) => {
      if (event.type === "actorChanged") {
        exec.stop(state.request);
        return { actorId: event.actorId, request: undefined, error: null };
      }
      if (event.type === "requested")
        return state.request
          ? state
          : {
              ...state,
              error: null,
              request: exec({
                type: "mutate",
                actorId: state.actorId,
                operation: event.operation,
              }),
            };
      exec.stop(state.request);
      return { ...state, request: undefined, error: event.error ?? null };
    },
    { actorId, request: undefined, error: null },
    {
      /**
       * Observes one write and its route refresh through the current account/selection lifetime.
       * @param _state - Current mutation feedback.
       * @param effect - Captured authorized mutation.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current observer lifetime.
       */
      mutate: (_state, effect, dispatch, { signal }) => {
        const key = JSON.stringify([
          effect.actorId,
          effect.operation.kind === "create" ||
          effect.operation.kind === "update"
            ? { kind: "save", value: effect.operation.value }
            : effect.operation,
        ]);
        const previous = task.current;
        if (previous?.effect !== effect)
          task.current = {
            effect,
            key,
            committed: previous?.key === key && previous.committed,
            acknowledged: previous?.key === key && previous.acknowledged,
            mutation:
              previous?.key === key && previous.committed
                ? previous.mutation
                : (async (): Promise<string | undefined> => {
                    try {
                      const operation = effect.operation;
                      switch (operation.kind) {
                        case "create":
                          await createAdminFeatureFlag({
                            data: {
                              ...operation.value,
                              description: operation.value.description || null,
                            },
                          });
                          break;
                        case "update":
                          await updateAdminFeatureFlag({
                            data: {
                              defaultEnabled: operation.value.defaultEnabled,
                              description: operation.value.description || null,
                              name: operation.value.name,
                              slug: operation.value.slug,
                            },
                          });
                          break;
                        case "archive":
                          await archiveAdminFeatureFlag({
                            data: { slug: operation.slug },
                          });
                          break;
                        case "beta":
                          await setUserBetaFeatureFlag({
                            data: {
                              enabled: operation.enabled,
                              slug: operation.slug,
                            },
                          });
                          break;
                        case "target":
                          await setAdminFeatureFlagForUser({
                            data: {
                              enabled: operation.enabled,
                              slug: operation.slug,
                              targetClerkId: operation.targetClerkId,
                            },
                          });
                          break;
                      }
                      return undefined;
                    } catch (error) {
                      return failureMessage(error);
                    }
                  })(),
          };
        const current = task.current;
        if (!current) return;
        void current.mutation.then(async (error) => {
          current.committed = !error;
          if (signal.aborted) return;
          if (!error) {
            if (!current.acknowledged) {
              current.acknowledged = true;
              onAcknowledged?.(effect.operation);
            }
            current.refresh ??= router
              .invalidate()
              .then(() => undefined, failureMessage);
            error = await current.refresh;
          }
          if (signal.aborted) return;
          if (task.current === current && (!error || !current.committed))
            task.current = null;
          dispatch({ type: "finished", error });
          if (!error) onCommitted?.(effect.operation);
        });
      },
    },
  );
  if (state.actorId !== actorId) dispatch({ type: "actorChanged", actorId });
  return {
    pending: Boolean(state.request),
    error: state.error,
    /**
     * Requests one captured feature-flag mutation.
     * @param operation - Existing mutation contract.
     */
    mutate(operation: FeatureFlagOperation) {
      dispatch({ type: "requested", operation });
    },
  };
}
