import { useAuth, useClerk } from "@clerk/tanstack-react-start";
import { useRef } from "react";
import { type EffectEntity, useEffectReducer } from "use-effect-reducer";
import {
  type AdminErasureStatusView,
  type ErasureStatusView,
  getAdminErasureStatus,
  getSelfErasureStatus,
} from "@/lib/account-erasure";

/** Existing self/admin status shapes share the same polling lifecycle. */
type ErasureReceipt = ErasureStatusView | AdminErasureStatusView;
/** Current scoped receipt and its timer/read/redirect observer. */
type ErasurePollState = {
  /** Account/request/retry snapshot that owns this lifetime. */
  sourceKey: string;
  /** Current canonical receipt. */
  status: ErasureReceipt | null;
  /** Current timer, status read, or sign-out command. */
  request: EffectEntity<ErasurePollState, ErasurePollEvent> | undefined;
  /** Whether a poll/redirect failure occurred in this request lifetime. */
  failed: boolean;
  /** Whether the server confirmed this session is signed out. */
  signedOut: boolean;
};
/** Source replacement, timer expiry, status reception, and redirect cleanup. */
type ErasurePollEvent =
  | {
      /** Receives a current account/request/retry snapshot. */
      type: "sourceReceived";
      /** Current source identity. */
      sourceKey: string;
      /** Current receipt supplied by its owner. */
      status: ErasureReceipt | null;
      /** Whether the current account may start polling. */
      active: boolean;
    }
  | {
      /** Advances one current three-second timer. */
      type: "elapsed";
      /** Source whose timer expired. */
      sourceKey: string;
      /** Next status/redirect action. */
      next: "poll" | "signOut";
    }
  | {
      /** Stops one current status read. */
      type: "received";
      /** Source whose status read completed. */
      sourceKey: string;
      /** Existing receipt/signed-out protocol. */
      status: ErasureReceipt | "signed_out" | null;
      /** Whether the read failed. */
      failed: boolean;
    }
  | {
      /** Stops one sign-out command. */
      type: "redirected";
      /** Source whose redirect completed. */
      sourceKey: string;
      /** Whether Clerk completed sign-out/navigation. */
      success: boolean;
    };
/** Captured polling action bound to one receipt/account lifetime. */
type ErasurePollEffect = {
  /** Current source identity. */
  sourceKey: string;
  /** Current receipt identity. */
  requestId: string;
} & (
  | {
      /** Three-second wait implementation. */
      type: "wait";
      /** Next status/redirect action. */
      next: "poll" | "signOut";
    }
  | {
      /** Current status read implementation. */
      type: "poll";
    }
  | {
      /** Clerk sign-out/navigation implementation. */
      type: "signOut";
    }
);

/**
 * Polls one existing erasure receipt every three seconds and stops at terminal/account boundaries.
 * @param initialStatus - Current owner-supplied receipt, or null before an admin request exists.
 * @param mode - Existing self/admin status protocol.
 * @param retryRevision - Explicit administrator retry lifetime, including same-ID retries.
 * @returns Current receipt and existing polling failure feedback.
 */
export function useErasurePolling(
  initialStatus: ErasureReceipt | null,
  mode: "self" | "admin",
  retryRevision = 0,
) {
  const { userId } = useAuth();
  const clerk = useClerk();
  const sourceKey = JSON.stringify([
    userId,
    mode,
    initialStatus,
    retryRevision,
  ]);
  const signOutTask = useRef<{
    /** Descriptor whose completed sign-out must not replay. */
    effect: ErasurePollEffect;
    /** Retained sign-out completion across Activity resumption. */
    promise: Promise<boolean>;
  } | null>(null);
  const [state, dispatch] = useEffectReducer<
    ErasurePollState,
    ErasurePollEvent,
    ErasurePollEffect
  >(
    (state, event, exec) => {
      if (event.type === "sourceReceived") {
        exec.stop(state.request);
        return {
          sourceKey: event.sourceKey,
          status: event.status,
          failed: false,
          signedOut: false,
          request:
            event.active && event.status?.status === "processing"
              ? exec({
                  type: "wait",
                  sourceKey: event.sourceKey,
                  requestId: event.status.requestId,
                  next: "poll",
                })
              : undefined,
        };
      }
      if (event.sourceKey !== state.sourceKey || !state.request) return state;
      if (event.type === "elapsed")
        return {
          ...state,
          request: exec.replace(state.request, {
            type: event.next,
            sourceKey: state.sourceKey,
            requestId: state.status?.requestId ?? "",
          }),
        };
      exec.stop(state.request);
      if (event.type === "redirected")
        return {
          ...state,
          failed: state.failed || !event.success,
          request: event.success
            ? undefined
            : exec({
                type: "wait",
                sourceKey: state.sourceKey,
                requestId: state.status?.requestId ?? "",
                next: "signOut",
              }),
        };
      if (event.status === "signed_out")
        return {
          ...state,
          signedOut: true,
          request: exec({
            type: "signOut",
            sourceKey: state.sourceKey,
            requestId: state.status?.requestId ?? "",
          }),
        };
      const status = event.status ?? state.status;
      return {
        ...state,
        status,
        failed: state.failed || event.failed,
        request:
          status?.status === "processing"
            ? exec({
                type: "wait",
                sourceKey: state.sourceKey,
                requestId: status.requestId,
                next: "poll",
              })
            : undefined,
      };
    },
    (exec) => ({
      sourceKey,
      status: initialStatus,
      failed: false,
      signedOut: false,
      request:
        userId && initialStatus?.status === "processing"
          ? exec({
              type: "wait",
              sourceKey,
              requestId: initialStatus.requestId,
              next: "poll",
            })
          : undefined,
    }),
    {
      /**
       * Schedules the existing poll interval without overlapping status reads.
       * @param _state - Current receipt.
       * @param effect - Captured request lifetime and next action.
       * @param dispatch - Timer-expiry dispatcher.
       * @param context - Current observer cancellation lifetime.
       * @returns Timer cleanup.
       */
      wait: (_state, effect, dispatch, { signal }) => {
        const timer = window.setTimeout(() => {
          if (!signal.aborted)
            dispatch({
              type: "elapsed",
              sourceKey: effect.sourceKey,
              next: effect.next,
            });
        }, 3000);
        return () => window.clearTimeout(timer);
      },
      /**
       * Reads current status with native cancellation and stale-result guards.
       * @param _state - Current receipt.
       * @param effect - Captured receipt identity.
       * @param dispatch - Terminal status dispatcher.
       * @param context - Current account/request observer lifetime.
       */
      poll: (_state, effect, dispatch, { signal }) => {
        const request =
          mode === "self"
            ? getSelfErasureStatus({ signal })
            : getAdminErasureStatus({
                data: { requestId: effect.requestId },
                signal,
              });
        void request.then(
          (status) => {
            if (!signal.aborted)
              dispatch({
                type: "received",
                sourceKey: effect.sourceKey,
                status,
                failed: false,
              });
          },
          () => {
            if (!signal.aborted)
              dispatch({
                type: "received",
                sourceKey: effect.sourceKey,
                status: null,
                failed: true,
              });
          },
        );
      },
      /**
       * Completes the existing signed-out redirect without replaying a completed privacy action.
       * @param _state - Current receipt.
       * @param effect - Captured signed-out request lifetime.
       * @param dispatch - Terminal redirect dispatcher.
       * @param context - Current observer lifetime.
       */
      signOut: (_state, effect, dispatch, { signal }) => {
        if (signOutTask.current?.effect !== effect)
          signOutTask.current = {
            effect,
            promise: (async () => {
              try {
                await clerk.signOut({ redirectUrl: "/account-erased" });
                return true;
              } catch {
                return false;
              }
            })(),
          };
        void signOutTask.current.promise.then((success) => {
          if (!signal.aborted)
            dispatch({
              type: "redirected",
              sourceKey: effect.sourceKey,
              success,
            });
        });
      },
    },
  );
  if (state.sourceKey !== sourceKey)
    dispatch({
      type: "sourceReceived",
      sourceKey,
      status: initialStatus,
      active: Boolean(userId),
    });
  return {
    status: state.status,
    failed: state.failed,
    signedOut: state.signedOut,
  };
}
