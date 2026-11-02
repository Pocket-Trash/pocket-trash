import { useAuth } from "@clerk/tanstack-react-start";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { toast } from "sonner";
import {
  type Dispatch,
  type EffectEntity,
  useEffectReducer,
} from "use-effect-reducer";
import {
  getUploadErrorTranslation,
  uploadResourceSession,
} from "@/lib/upload-sessions";
import { useLocale } from "@/providers/locale-provider";

/** Resource authoring fields passed to the existing upload-session service. */
export type ResourceUploadRequest = Omit<
  Parameters<typeof uploadResourceSession>[0],
  "getToken" | "onProgress" | "onStage" | "fetch" | "uploadFile"
>;
/** Raw upload progress remains localizable without replaying the mutation. */
type ResourceUploadProgress =
  | {
      /** File currently uploading. */
      filename: string;
      /** Completed percentage. */
      percent: number;
    }
  | {
      /** Completion/finalization stage. */
      stage: "complete";
    };
/** Resource upload lifecycle and current account scope. */
type ResourceUploadState = {
  /** Account whose upload intent owns the current feedback. */
  actorId: string | null | undefined;
  /** Monotonic account/request lifetime. */
  generation: number;
  /** Current raw upload progress. */
  progress: ResourceUploadProgress | undefined;
  /** Pending upload effect, absent after terminal feedback. */
  request: EffectEntity<ResourceUploadState, ResourceUploadEvent> | undefined;
};
/** Upload intent, scoped progress, and terminal feedback. */
type ResourceUploadEvent =
  | {
      /** Replaces account-scoped pending feedback. */
      type: "actorChanged";
      /** Current account. */
      actorId: string | null | undefined;
    }
  | {
      /** Starts a validated creation/version workflow. */
      type: "requested";
      /** Captured authoring fields and files. */
      input: ResourceUploadRequest;
    }
  | {
      /** Receives progress from the active observer. */
      type: "progressChanged";
      /** Request lifetime that produced this feedback. */
      generation: number;
      /** Raw progress for current localization. */
      progress: ResourceUploadProgress;
    }
  | {
      /** Stops a completed or failed upload effect. */
      type: "finished";
      /** Request lifetime that completed. */
      generation: number;
    };
/** Captured committed upload request. */
type ResourceUploadEffect = {
  /** Upload implementation. */
  type: "upload";
  /** Authoring fields and files. */
  input: ResourceUploadRequest;
  /** Current account/request lifetime. */
  generation: number;
};
/** Settled upload retained while its UI is suspended. */
type ResourceUploadOutcome =
  | {
      /** Successful existing upload session. */
      ok: true;
      /** Created resource/version identifiers. */
      result: Awaited<ReturnType<typeof uploadResourceSession>>;
    }
  | {
      /** Failed existing upload session. */
      ok: false;
      /** Original failure mapped by the existing upload helper. */
      error: unknown;
    };

/**
 * Owns resource creation/version upload progress and terminal feedback.
 * @returns Semantic upload command and current localized upload status.
 */
export function useResourceUpload() {
  const { getToken, userId } = useAuth();
  const { locale } = useLocale();
  /**
   * Formats existing resource workflow feedback in the active locale.
   * @param key - Existing resource translation key.
   * @param values - Existing message interpolation values.
   * @returns Localized resource feedback.
   */
  const t = (
    key: TranslationKey,
    values: Record<string, number | string> = {},
  ) => formatTranslation(key, values, locale);
  const navigate = useNavigate();
  const task = useRef<{
    /** Descriptor whose mutation must not replay. */
    effect: ResourceUploadEffect;
    /** Settled result retained across suspended observers. */
    promise: Promise<ResourceUploadOutcome>;
  } | null>(null);
  const observer = useRef<{
    /** Current committed dispatcher. */
    dispatch: Dispatch<ResourceUploadEvent>;
    /** Current observer cancellation lifetime. */
    signal: AbortSignal;
  } | null>(null);
  const [state, dispatch] = useEffectReducer<
    ResourceUploadState,
    ResourceUploadEvent,
    ResourceUploadEffect
  >(
    (state, event, exec) => {
      if (event.type === "actorChanged") {
        exec.stop(state.request);
        return {
          actorId: event.actorId,
          generation: state.generation + 1,
          progress: undefined,
          request: undefined,
        };
      }
      if (event.type === "requested") {
        if (state.request) return state;
        const generation = state.generation + 1;
        return {
          ...state,
          generation,
          progress: undefined,
          request: exec({ type: "upload", input: event.input, generation }),
        };
      }
      if (event.generation !== state.generation) return state;
      if (event.type === "progressChanged")
        return state.request ? { ...state, progress: event.progress } : state;
      exec.stop(state.request);
      return { ...state, progress: undefined, request: undefined };
    },
    { actorId: userId, generation: 0, progress: undefined, request: undefined },
    {
      /**
       * Runs one upload and reattaches progress/feedback after Activity resumption.
       * @param _state - Scoped upload state.
       * @param effect - Captured request and lifetime.
       * @param dispatch - Progress and terminal dispatcher.
       * @param context - Current observer lifetime.
       * @returns Cleanup detaching only this progress observer.
       */
      upload: (_state, effect, dispatch, { signal }) => {
        const currentObserver = { dispatch, signal };
        observer.current = currentObserver;
        if (task.current?.effect !== effect) {
          task.current = {
            effect,
            promise: uploadResourceSession({
              ...effect.input,
              getToken,
              /**
               * Publishes progress only to a currently committed observer.
               * @param filename - Current file.
               * @param percent - Completed percentage.
               */
              onProgress: (filename, percent) => {
                if (observer.current && !observer.current.signal.aborted)
                  observer.current.dispatch({
                    type: "progressChanged",
                    generation: effect.generation,
                    progress: { filename, percent },
                  });
              },
              /**
               * Publishes the existing finalization stage to the current observer.
               * @param stage - Current upload stage.
               */
              onStage: (stage) => {
                if (
                  stage === "complete" &&
                  observer.current &&
                  !observer.current.signal.aborted
                )
                  observer.current.dispatch({
                    type: "progressChanged",
                    generation: effect.generation,
                    progress: { stage },
                  });
              },
            }).then(
              (result): ResourceUploadOutcome => ({ ok: true, result }),
              (error): ResourceUploadOutcome => ({ ok: false, error }),
            ),
          };
        }
        void task.current.promise.then((outcome) => {
          if (signal.aborted) return;
          dispatch({ type: "finished", generation: effect.generation });
          if (!outcome.ok) {
            const message = getUploadErrorTranslation(outcome.error);
            toast.error(t(message.key, message.params ?? {}));
            return;
          }
          toast.success(
            effect.input.operation === "create"
              ? t("web.resources.upload.success")
              : t("web.resources.upload.versionSuccess", {
                  version: outcome.result.version,
                }),
          );
          void navigate({
            params: { resourceId: String(outcome.result.resourceId) },
            to: "/resources/$resourceId",
          });
        });
        return () => {
          if (observer.current === currentObserver) observer.current = null;
        };
      },
    },
  );
  if (state.actorId !== userId)
    dispatch({ type: "actorChanged", actorId: userId });
  const status = state.progress
    ? "stage" in state.progress
      ? t("web.resources.upload.finalizing")
      : t("web.resources.upload.progress", state.progress)
    : "";
  return {
    submitting: Boolean(state.request),
    status,
    /**
     * Starts a validated upload intent through the committed workflow.
     * @param input - Captured authoring fields and file selection.
     */
    startUpload(input: ResourceUploadRequest) {
      dispatch({ type: "requested", input });
    },
  };
}
