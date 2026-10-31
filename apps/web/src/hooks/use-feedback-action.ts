import { useAuth } from "@clerk/tanstack-react-start";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { type EffectEntity, useEffectReducer } from "use-effect-reducer";
import {
  approveFeedback,
  denyFeedback,
  markFeedbackNotificationRead,
  mergePendingFeedback,
  planFeedback,
  submitFeedback,
  syncFeedbackStatus,
  toggleFeedbackVote,
  updateAdminFeedback,
} from "@/lib/feedback";
import { useLocale } from "@/providers/locale-provider";
/** Existing feedback write contracts captured when the user confirms an action. */
export type FeedbackAction =
  | {
      /** Submission intent. */
      kind: "submit";
      /** Validated draft. */
      data: {
        /** Selected category. */
        category: string;
        /** Draft details. */
        description: string;
        /** Draft title. */
        title: string;
      };
    }
  | {
      /** Vote intent. */
      kind: "vote";
      /** Selected feedback. */
      data: {
        /** Feedback identity. */
        feedbackId: number;
      };
    }
  | {
      /** Approval intent. */
      kind: "approve";
      /** Selected feedback. */
      data: {
        /** Feedback identity. */
        feedbackId: number;
      };
    }
  | {
      /** Denial intent. */
      kind: "deny";
      /** Selected feedback. */
      data: {
        /** Feedback identity. */
        feedbackId: number;
      };
    }
  | {
      /** Merge intent. */
      kind: "merge";
      /** Selected source and target. */
      data: {
        /** Source feedback. */
        feedbackId: number;
        /** Selected merge target. */
        targetId: number;
      };
    }
  | {
      /** Edit intent. */
      kind: "edit";
      /** Validated draft. */
      data: {
        /** Feedback identity. */
        feedbackId: number;
        /** Selected category. */
        category: string;
        /** Draft details. */
        description: string;
        /** Draft title. */
        title: string;
      };
      /** Whether to approve after saving. */
      approve: boolean;
    }
  | {
      /** Reserved Linear planning intent. */
      kind: "plan";
      /** Stable nonce and planning choices. */
      data: {
        /** Optional assignee choice. */
        assignToMe: boolean;
        /** Retained reservation. */
        clientUuid: string;
        /** Feedback identity. */
        feedbackId: number;
        /** Planned entity kind. */
        kind: "issue" | "project";
        /** Selected issue labels. */
        labelIds: string[];
        /** Optional project lead choice. */
        leadProject: boolean;
      };
    }
  | {
      /** Linear synchronization intent. */
      kind: "sync";
      /** Selected feedback. */
      data: {
        /** Feedback identity. */
        feedbackId: number;
      };
    }
  | {
      /** Notification acceptance intent. */
      kind: "read";
      /** Selected notification. */
      data: {
        /** Notification identity. */
        notificationId: number;
      };
    };
/** Settled feedback write, retained while its active observer is hidden. */
type Outcome = {
  /** Existing localized failure. */
  error?: TranslationKey;
  /** Persisted vote state. */
  hasVoted?: boolean;
};
/** Current account-scoped feedback command. */
type State = {
  /** Owning account. */
  actorId: string | null | undefined;
  /** Committed write observer. */
  request?: EffectEntity<State, Event>;
  /** Existing error for inline planning feedback. */
  error?: TranslationKey;
  /** Current confirmed operation. */
  action?: FeedbackAction;
};
/** Explicit feedback intent and terminal cleanup. */
type Event =
  | {
      /** Reconciles an account replacement. */
      type: "actorChanged";
      /** Current account. */
      actorId: State["actorId"];
    }
  | {
      /** Captures a confirmed operation. */
      type: "requested";
      /** Existing write input. */
      action: FeedbackAction;
    }
  | {
      /** Advances an acknowledged write into a fresh committed completion stage. */
      type: "acknowledged";
      /** Settled write outcome. */
      outcome: Outcome;
    }
  | {
      /** Stops a settled operation. */
      type: "finished";
      /** Existing failure feedback. */
      error?: TranslationKey;
    };
/** Captured write descriptor. */
type Effect = {
  /** Owning account. */
  actorId: State["actorId"];
  /** Confirmed operation. */
  action: FeedbackAction;
} & (
  | {
      /** Committed write implementation. */
      type: "write";
    }
  | {
      /** Fresh committed completion implementation. */
      type: "complete";
      /** Acknowledged write. */
      outcome: Outcome;
    }
);

/**
 * Performs feedback writes once per confirmed intent and retries failed post-write refreshes separately.
 * @param onCommitted - Active owner's refresh, navigation, or persisted-vote command.
 * @param onFailure - Optional form-owned failure feedback command.
 * @param onCompleted - Optional active-owner acknowledgement after refresh succeeds.
 * @returns Current eligibility, localized error, and semantic write command.
 */
export function useFeedbackAction(
  onCommitted: (
    action: FeedbackAction,
    outcome: Outcome,
  ) => void | Promise<unknown>,
  onFailure?: (error: TranslationKey) => void,
  onCompleted?: (action: FeedbackAction) => void,
) {
  const { userId: actorId } = useAuth();
  const { locale } = useLocale();

  /** Formats existing feedback messages.
   * @param key - Existing feedback copy key.
   * @returns Localized feedback copy. */
  const t = (key: TranslationKey) => formatTranslation(key, {}, locale);
  const task = useRef<{
    /** Current write descriptor. */
    effect: Effect;
    /** Account/input identity for refresh-only retries. */
    key: string;
    /** Settled write retained across Activity/StrictMode. */
    write: Promise<Outcome>;
    /** Successful write acknowledgement. */
    acknowledged?: boolean;
    /** Whether the original write's existing success feedback was published. */
    successPublished?: boolean;
    /** Active owner's post-write command. */
    completion?: Promise<boolean>;
  } | null>(null);
  const [state, dispatch] = useEffectReducer<State, Event, Effect>(
    (state, event, exec) => {
      if (event.type === "actorChanged") {
        exec.stop(state.request);
        return { actorId: event.actorId };
      }
      if (event.type === "requested")
        return state.request
          ? state
          : {
              ...state,
              error: undefined,
              action: event.action,
              request: exec({
                type: "write",
                actorId: state.actorId,
                action: event.action,
              }),
            };
      exec.stop(state.request);
      if (event.type === "acknowledged" && state.action)
        return {
          ...state,
          request: exec({
            type: "complete",
            actorId: state.actorId,
            action: state.action,
            outcome: event.outcome,
          }),
        };
      return {
        ...state,
        request: undefined,
        error: event.type === "finished" ? event.error : undefined,
      };
    },
    { actorId },
    {
      /** Observes a retained write only during the active account lifetime.
       * @param _state - Current write feedback.
       * @param effect - Captured write input.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current observer lifetime. */
      write: (_state, effect, dispatch, { signal }) => {
        const key = JSON.stringify([effect.actorId, effect.action]);
        const previous = task.current;
        if (previous?.effect !== effect)
          task.current = {
            effect,
            key,
            acknowledged: previous?.key === key && previous.acknowledged,
            successPublished:
              previous?.key === key && previous.successPublished,
            write:
              previous?.key === key && previous.acknowledged
                ? previous.write
                : executeFeedbackAction(effect.action),
          };
        const current = task.current;
        if (!current) return;
        void current.write.then((outcome) => {
          current.acknowledged = !outcome.error;
          if (signal.aborted) return;
          if (outcome.error) {
            task.current = null;
            dispatch({ type: "finished", error: outcome.error });
            onFailure?.(outcome.error);
            toast.error(t(outcome.error));
          } else dispatch({ type: "acknowledged", outcome });
        });
      },
      /** Completes a successful write using the current committed owner's query or navigation.
       * @param _state - Current write acknowledgement.
       * @param effect - Captured acknowledgement.
       * @param dispatch - Terminal dispatcher.
       * @param context - Current completion lifetime. */
      complete: (_state, effect, dispatch, { signal }) => {
        const current = task.current;
        if (!current) return;
        current.completion ??= (async () => {
          try {
            if (!current.successPublished) {
              current.successPublished = true;
              const success = feedbackSuccess(effect.action);
              if (success) toast.success(t(success));
            }
            await onCommitted(effect.action, effect.outcome);
            return true;
          } catch {
            return false;
          }
        })();
        void current.completion.then((ok) => {
          if (signal.aborted) return;
          const error = ok ? undefined : feedbackFailure(effect.action);
          dispatch({ type: "finished", error });
          if (ok) {
            task.current = null;
            onCompleted?.(effect.action);
          }
          if (error) {
            onFailure?.(error);
            toast.error(t(error));
          }
        });
      },
    },
  );
  if (state.actorId !== actorId) dispatch({ type: "actorChanged", actorId });
  /** Requests a confirmed feedback write through a stable consumer command.
   * @param action - Existing feedback operation. */
  const run = useCallback(
    (action: FeedbackAction) => {
      dispatch({ type: "requested", action });
    },
    [dispatch],
  );
  return {
    pending: Boolean(state.request),
    action: state.action,
    error: state.error,
    run,
  };
}

/**
 * Executes one existing feedback service contract without publishing observer feedback.
 * @param action - Captured confirmed operation.
 * @returns Settled acknowledgement or the existing localized failure.
 */
async function executeFeedbackAction(action: FeedbackAction): Promise<Outcome> {
  try {
    switch (action.kind) {
      case "submit": {
        const result = await submitFeedback({ data: action.data });
        return result.ok ? {} : { error: result.error };
      }
      case "vote":
        return { hasVoted: await toggleFeedbackVote({ data: action.data }) };
      case "approve":
        await approveFeedback({ data: action.data });
        return {};
      case "deny": {
        const result = await denyFeedback({ data: action.data });
        return result.ok ? {} : { error: result.error };
      }
      case "merge":
        await mergePendingFeedback({ data: action.data });
        return {};
      case "edit":
        await updateAdminFeedback({ data: action.data });
        if (action.approve)
          await approveFeedback({
            data: { feedbackId: action.data.feedbackId },
          });
        return {};
      case "plan": {
        const result = await planFeedback({ data: action.data });
        return result.ok ? {} : { error: result.error };
      }
      case "sync": {
        const result = await syncFeedbackStatus({ data: action.data });
        return result.ok ? {} : { error: result.error };
      }
      case "read":
        await markFeedbackNotificationRead({ data: action.data });
        return {};
    }
  } catch {
    return { error: feedbackFailure(action) };
  }
}

/**
 * Selects existing failure feedback for a feedback operation.
 * @param action - Existing operation.
 * @returns Existing localized failure key.
 */
function feedbackFailure(action: FeedbackAction): TranslationKey {
  switch (action.kind) {
    case "submit":
      return "web.feedback.new.failure";
    case "vote":
      return "web.feedback.vote.failure";
    case "plan":
      return "web.feedback.admin.plan.failure";
    case "sync":
      return "web.feedback.admin.sync.failure";
    case "read":
      return "web.resources.notification.acceptFailed";
    default:
      return "web.feedback.admin.requests.actionFailed";
  }
}

/**
 * Selects existing success feedback for a feedback operation.
 * @param action - Existing operation.
 * @returns Existing localized success key when the operation has one.
 */
function feedbackSuccess(action: FeedbackAction): TranslationKey | undefined {
  switch (action.kind) {
    case "submit":
      return "web.feedback.new.success";
    case "vote":
      return undefined;
    case "approve":
      return "web.feedback.admin.requests.approved";
    case "deny":
      return "web.feedback.admin.requests.denied";
    case "merge":
      return "web.feedback.admin.requests.merged";
    case "edit":
      return action.approve
        ? "web.feedback.admin.requests.approved"
        : "web.feedback.admin.requests.updated";
    case "plan":
      return "web.feedback.admin.plan.success";
    case "sync":
      return "web.feedback.admin.sync.success";
    case "read":
      return "web.resources.notification.accepted";
  }
}
