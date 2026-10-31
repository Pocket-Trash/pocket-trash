import { useAuth } from "@clerk/tanstack-react-start";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import { toast } from "sonner";
import {
  type EffectEntity,
  type EffectFunction,
  useEffectReducer,
} from "use-effect-reducer";
import { downloadResourceFile, downloadResourceVersion } from "@/lib/resources";
import { useLocale } from "@/providers/locale-provider";

/** One file/archive download channel and its current request lifetime. */
type DownloadChannel = {
  /** File/version whose action remains disabled after successful navigation. */
  id: number | undefined;
  /** Monotonic request identifier. */
  token: number;
  /** Pending URL request, absent after terminal cleanup. */
  request:
    | EffectEntity<ResourceDownloadsState, ResourceDownloadsEvent>
    | undefined;
};
/** Resource-scoped file and archive download state. */
type ResourceDownloadsState = {
  /** Resource whose signed URLs own this feedback. */
  resourceId: number;
  /** Account whose signed URL request owns this observer. */
  actorId: string | null | undefined;
  /** Monotonic request sequence. */
  sequence: number;
  /** Current individual-file action. */
  file: DownloadChannel;
  /** Current version-archive action. */
  version: DownloadChannel;
  /** Archives whose failures require the existing detail fallback. */
  failedVersions: ReadonlySet<number>;
};
/** Resource replacement, explicit download intent, and terminal cleanup. */
type ResourceDownloadsEvent =
  | {
      /** Replaces resource-scoped pending feedback. */
      type: "resourceChanged";
      /** Current account identity. */
      actorId: string | null | undefined;
      /** Current resource. */
      resourceId: number;
    }
  | {
      /** Requests one current file or archive URL. */
      type: "requested";
      /** Existing download channel. */
      kind: "file" | "version";
      /** Requested file/version identifier. */
      id: number;
      /** Existing filename used in failure feedback. */
      filename: string;
    }
  | {
      /** Stops a completed URL request. */
      type: "finished";
      /** Channel that completed. */
      kind: "file" | "version";
      /** Request lifetime that completed. */
      token: number;
      /** Whether the URL request/navigation failed. */
      failed: boolean;
    };
/** Captured file/archive URL request. */
type ResourceDownloadEffect = {
  /** Resource receiving the original download recording. */
  resourceId: number;
  /** Requested file/version identifier. */
  id: number;
  /** Existing filename for localized failure feedback. */
  filename: string;
  /** Request lifetime. */
  token: number;
} & (
  | {
      /** Individual file implementation. */
      type: "downloadFile";
    }
  | {
      /** Version archive implementation. */
      type: "downloadVersion";
    }
);
/** One retained download promise; resumption must not record it twice. */
type ResourceDownloadTask = {
  /** Captured request descriptor. */
  effect: ResourceDownloadEffect;
  /** Signed URL result retained while its observer is suspended. */
  promise: Promise<string | null>;
};

/**
 * Owns resource downloads while keeping archive failures terminal and file failures retryable.
 * @param resourceId - Resource whose signed download URLs are requested.
 * @param archiveFallback - Whether archive failures include the existing detail-page link.
 * @returns Semantic download commands and current file/archive control state.
 */
export function useResourceDownloads(
  resourceId: number,
  archiveFallback = false,
) {
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
  const { userId: actorId } = useAuth();
  const tasks = useRef<{
    /** Retained individual-file URL request. */
    file?: ResourceDownloadTask;
    /** Retained version-archive URL request. */
    version?: ResourceDownloadTask;
  }>({});
  /**
   * Resolves one signed URL and publishes only to its active resource/channel observer.
   * @param _state - State that queued the request.
   * @param effect - Captured resource, filename, and request lifetime.
   * @param dispatch - Terminal feedback dispatcher.
   * @param context - Current observer cancellation lifetime.
   */
  const executeDownload: EffectFunction<
    ResourceDownloadsState,
    ResourceDownloadsEvent,
    ResourceDownloadEffect
  > = (_state, effect, dispatch, { signal }) => {
    const kind = effect.type === "downloadFile" ? "file" : "version";
    if (tasks.current[kind]?.effect !== effect)
      tasks.current[kind] = {
        effect,
        promise:
          effect.type === "downloadFile"
            ? downloadResourceFile({
                data: { fileId: effect.id, resourceId: effect.resourceId },
              })
            : downloadResourceVersion({
                data: { resourceId: effect.resourceId, versionId: effect.id },
              }),
      };
    /** Publishes the existing failure feedback only for the current request. */
    const fail = () => {
      if (signal.aborted) return;
      dispatch({ type: "finished", kind, token: effect.token, failed: true });
      toast.error(
        t("web.resources.error.downloadUnavailable", {
          filename: effect.filename,
        }),
        kind === "version" && archiveFallback
          ? {
              description: (
                <Link
                  className="underline"
                  params={{ resourceId: String(effect.resourceId) }}
                  to="/resources/$resourceId"
                >
                  {t("web.resources.error.archiveDownloadFallback", {})}
                </Link>
              ),
            }
          : undefined,
      );
    };
    void tasks.current[kind]?.promise.then((url) => {
      if (signal.aborted) return;
      if (!url) {
        fail();
        return;
      }
      try {
        window.location.assign(url);
        dispatch({
          type: "finished",
          kind,
          token: effect.token,
          failed: false,
        });
      } catch {
        fail();
      }
    }, fail);
  };
  const [state, dispatch] = useEffectReducer<
    ResourceDownloadsState,
    ResourceDownloadsEvent,
    ResourceDownloadEffect
  >(
    (state, event, exec) => {
      if (event.type === "resourceChanged") {
        exec.stop(state.file.request);
        exec.stop(state.version.request);
        return {
          resourceId: event.resourceId,
          actorId: event.actorId,
          sequence: state.sequence + 1,
          file: { id: undefined, token: 0, request: undefined },
          version: { id: undefined, token: 0, request: undefined },
          failedVersions: new Set(),
        };
      }
      if (event.type === "requested") {
        if (
          state[event.kind].id === event.id ||
          (event.kind === "version" && state.failedVersions.has(event.id))
        )
          return state;
        const token = state.sequence + 1;
        return {
          ...state,
          sequence: token,
          [event.kind]: {
            id: event.id,
            token,
            request: exec.replace(state[event.kind].request, {
              type: event.kind === "file" ? "downloadFile" : "downloadVersion",
              id: event.id,
              filename: event.filename,
              resourceId: state.resourceId,
              token,
            }),
          },
        };
      }
      const current = state[event.kind];
      if (event.token !== current.token || !current.request) return state;
      exec.stop(current.request);
      return {
        ...state,
        [event.kind]: {
          ...current,
          id: event.failed ? undefined : current.id,
          request: undefined,
        },
        failedVersions:
          event.kind === "version" && event.failed && current.id !== undefined
            ? new Set(state.failedVersions).add(current.id)
            : state.failedVersions,
      };
    },
    {
      resourceId,
      actorId,
      sequence: 0,
      file: { id: undefined, token: 0, request: undefined },
      version: { id: undefined, token: 0, request: undefined },
      failedVersions: new Set(),
    },
    { downloadFile: executeDownload, downloadVersion: executeDownload },
  );
  if (state.resourceId !== resourceId || state.actorId !== actorId)
    dispatch({ type: "resourceChanged", resourceId, actorId });
  return {
    downloadingFileId: state.file.id,
    downloadingVersionId: state.version.id,
    failedVersionIds: state.failedVersions,
    /**
     * Requests a signed individual-file download.
     * @param id - Resource file identifier.
     * @param filename - Existing display filename.
     */
    startFile(id: number, filename: string) {
      dispatch({ type: "requested", kind: "file", id, filename });
    },
    /**
     * Requests a signed version archive download.
     * @param id - Resource version identifier.
     * @param version - Existing version number used in the archive filename.
     */
    startVersion(id: number, version: number) {
      dispatch({
        type: "requested",
        kind: "version",
        id,
        filename: `resource-${resourceId}-v${version}.zip`,
      });
    },
  };
}
