import { useEffect } from "react";
import {
  type EffectEntity,
  type EffectReducer,
  useEffectReducer,
} from "use-effect-reducer";

/** Browser image selection and its current metadata check. */
type ImageValidationState = {
  /** Files whose metadata belongs to this result. */
  files: readonly File[];
  /** Requested width-to-height ratio. */
  aspectRatio: number | undefined;
  /** Whether any readable image differs from that ratio. */
  mismatch: boolean;
  /** Selection lifetime rejecting stale completions. */
  generation: number;
  /** Pending metadata effect, absent after completion. */
  check: EffectEntity<ImageValidationState, ImageValidationEvent> | undefined;
};
/** Supplied selection changes and terminal metadata feedback. */
type ImageValidationEvent =
  | {
      /** Adapts committed externally supplied files or ratio changes. */
      type: "selectionChanged";
      /** Current supplied files. */
      files: readonly File[];
      /** Current expected ratio. */
      aspectRatio: number | undefined;
    }
  | {
      /** Completes this selection's metadata check. */
      type: "checked";
      /** Selection lifetime that produced the result. */
      generation: number;
      /** Whether a readable image differs from the requested ratio. */
      mismatch: boolean;
    };
/** Cancellable browser metadata work for one selection. */
type ImageValidationEffect = {
  /** Metadata implementation. */
  type: "check";
  /** Files captured for this selection. */
  files: readonly File[];
  /** Expected ratio. */
  aspectRatio: number;
  /** Selection lifetime. */
  generation: number;
};

/**
 * Compares file identities without reading browser metadata during render.
 * @param state - Selection owning the last result.
 * @param files - Current externally supplied selection.
 * @param aspectRatio - Current expected ratio.
 * @returns Whether the last result belongs to the supplied selection.
 */
function matchesSelection(
  state: ImageValidationState,
  files: readonly File[],
  aspectRatio: number | undefined,
) {
  return (
    state.aspectRatio === aspectRatio &&
    state.files.length === files.length &&
    state.files.every((file, index) => file === files[index])
  );
}

/**
 * Owns selection replacement and terminal metadata cleanup without browser I/O.
 * @param state - Current selection and check.
 * @param event - Committed selection or metadata response.
 * @param exec - Committed metadata effect queue.
 * @returns Current selection, check lifetime, and guidance result.
 */
const imageValidationReducer: EffectReducer<
  ImageValidationState,
  ImageValidationEvent,
  ImageValidationEffect
> = (state, event, exec) => {
  if (event.type === "checked") {
    if (event.generation !== state.generation) return state;
    exec.stop(state.check);
    return { ...state, mismatch: event.mismatch, check: undefined };
  }
  if (matchesSelection(state, event.files, event.aspectRatio)) return state;
  exec.stop(state.check);
  const generation = state.generation + 1;
  return {
    files: event.files,
    aspectRatio: event.aspectRatio,
    generation,
    mismatch: false,
    check:
      event.aspectRatio && event.files.length
        ? exec({
            type: "check",
            files: event.files,
            aspectRatio: event.aspectRatio,
            generation,
          })
        : undefined,
  };
};

/**
 * Adapts externally supplied file selections to cancellable browser metadata validation.
 * @param files - Current selected files.
 * @param aspectRatio - Optional expected width-to-height ratio.
 * @returns Whether a current readable image differs from the expected ratio.
 */
export function useImageFileValidation(
  files: readonly File[],
  aspectRatio: number | undefined,
) {
  const [state, dispatch] = useEffectReducer(
    imageValidationReducer,
    (exec): ImageValidationState => ({
      files,
      aspectRatio,
      generation: 0,
      mismatch: false,
      check:
        aspectRatio && files.length
          ? exec({ type: "check", files, aspectRatio, generation: 0 })
          : undefined,
    }),
    {
      /**
       * Reads browser image sizes and publishes only to the active selection.
       * @param _state - Selection state that queued this check.
       * @param effect - Captured selection and expected ratio.
       * @param dispatch - Terminal metadata dispatcher.
       * @param context - Current cancellation lifetime.
       */
      check: (_state, effect, dispatch, { signal }) => {
        void Promise.all(
          effect.files.map((file) =>
            imageHasDifferentAspectRatio(file, effect.aspectRatio, signal),
          ),
        ).then((results) => {
          if (!signal.aborted)
            dispatch({
              type: "checked",
              generation: effect.generation,
              mismatch: results.some(Boolean),
            });
        });
      },
    },
  );
  useEffect(() => {
    dispatch({ type: "selectionChanged", files, aspectRatio });
  }, [aspectRatio, dispatch, files]);
  return matchesSelection(state, files, aspectRatio) && state.mismatch;
}

/**
 * Reads one image size while disposing listeners and its object URL on every terminal path.
 * Unreadable or canceled files never block selection.
 * @param file - Browser image file.
 * @param expectedRatio - Expected width-to-height ratio.
 * @param signal - Optional selection cancellation lifetime.
 * @returns Whether a readable current image differs by more than the existing tolerance.
 */
export function imageHasDifferentAspectRatio(
  file: File,
  expectedRatio: number,
  signal?: AbortSignal,
): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const image = new Image();
    let url: string | undefined;
    let settled = false;
    /**
     * Settles metadata once and releases its browser resources.
     * @param mismatch - Current guidance result.
     */
    const finish = (mismatch: boolean) => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      signal?.removeEventListener("abort", abort);
      image.removeAttribute("src");
      if (url) URL.revokeObjectURL(url);
      resolve(mismatch);
    };
    /** Cancels this metadata read without publishing a mismatch. */
    const abort = () => {
      finish(false);
    };
    image.onload = () =>
      finish(
        aspectRatioDiffers(
          image.naturalWidth,
          image.naturalHeight,
          expectedRatio,
        ),
      );
    image.onerror = () => finish(false);
    signal?.addEventListener("abort", abort, { once: true });
    try {
      url = URL.createObjectURL(file);
      image.src = url;
    } catch {
      finish(false);
    }
  });
}

/**
 * Compares image dimensions with the existing aspect-ratio guidance tolerance.
 * @param width - Natural image width.
 * @param height - Natural image height.
 * @param expectedRatio - Expected width-to-height ratio.
 * @returns Whether the ratio differs by more than 0.01.
 */
export function aspectRatioDiffers(
  width: number,
  height: number,
  expectedRatio: number,
): boolean {
  return Math.abs(width / height - expectedRatio) > 0.01;
}
