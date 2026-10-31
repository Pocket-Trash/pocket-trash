import type { EffectEntity, EffectReducer } from "use-effect-reducer";
import type { MarkdownVisualFormat } from "./markdown-visual-editor";

/** Available Markdown editing surfaces. */
export type MarkdownMode = "source" | "visual";
/** Selection context owned by an open link form. */
export type MarkdownLinkContext = {
  /** Whether link text must be collected in a modal. */
  kind: "modal" | "popover";
  /** Whether the selection is exactly one existing link. */
  existing: boolean;
  /** Initial selection text before link-form edits. */
  text: string;
  /** Initial destination before link-form edits. */
  url: string;
};
/** Editor state and its one committed loading notification. */
export type MarkdownEditorState = {
  /** Active editing surface. */
  mode: MarkdownMode;
  /** Current Markdown retained across surfaces. */
  value: string;
  /** Whether visual initialization is pending. */
  loading: boolean;
  /** Whether Source is the visual-editor failure fallback. */
  fallback: boolean;
  /** Formats active at the current selection. */
  activeFormats: readonly MarkdownVisualFormat[];
  /** Open link-form presentation and selection context. */
  linkEditor: MarkdownLinkContext | null;
  /** Current counter/fallback announcement boundary. */
  announcementKey: string;
  /** Last boundary announcement retained between edits. */
  statusAnnouncement: string;
  /** Surface lifetime used to reject stale ready/error callbacks. */
  generation: number;
  /** Disposable consumer loading notification. */
  notice: EffectEntity<MarkdownEditorState, MarkdownEditorEvent> | undefined;
};
/** User edits, editor callbacks, and announcement transitions. */
export type MarkdownEditorEvent =
  | {
      /** Markdown was edited or normalized before switching modes. */
      type: "valueEdited";
      /** Current normalized or raw Source Markdown. */
      value: string;
    }
  | {
      /** User selected an editing surface. */
      type: "modeSelected";
      /** Requested surface. */
      mode: MarkdownMode;
    }
  | {
      /** Visual initialization completed successfully or failed. */
      type: "visualStarting" | "visualReady" | "visualFailed";
      /** Callback's surface lifetime. */
      generation: number;
    }
  | {
      /** Source or visual selection changed. */
      type: "selectionChanged";
      /** Active supported formats. */
      formats: readonly MarkdownVisualFormat[];
    }
  | {
      /** User opened a contextual link form. */
      type: "linkOpened";
      /** Selection context and presentation. */
      context: MarkdownLinkContext;
    }
  | {
      /** User closed or applied a link form. */
      type: "linkClosed";
    }
  | {
      /** Counter or fallback crossed an announcement boundary. */
      type: "statusChanged";
      /** New announcement boundary. */
      key: string;
      /** Localized announcement for this boundary. */
      text: string;
    }
  | {
      /** Loading feedback was delivered to the current consumer. */
      type: "loadingNotified";
      /** Notification's surface lifetime. */
      generation: number;
      /** Delivered loading state. */
      loading: boolean;
    };
/** Consumer feedback delivered only after a committed editor transition. */
export type MarkdownEditorEffect = {
  /** Loading feedback implementation. */
  type: "notifyLoading";
  /** Surface lifetime that owns this notification. */
  generation: number;
  /** Current loading state. */
  loading: boolean;
};

/**
 * Owns editor transitions without creating editors or manipulating selection in render.
 * @param state - Current editing surface and pending notification.
 * @param event - User, editor, or terminal notification event.
 * @param exec - Committed effect queue.
 * @returns Current content, controls, and notification lifetime.
 */
export const markdownEditorReducer: EffectReducer<
  MarkdownEditorState,
  MarkdownEditorEvent,
  MarkdownEditorEffect
> = (state, event, exec) => {
  switch (event.type) {
    case "valueEdited":
      return { ...state, value: event.value };
    case "selectionChanged":
      return { ...state, activeFormats: event.formats };
    case "linkOpened":
      return { ...state, linkEditor: event.context };
    case "linkClosed":
      return { ...state, linkEditor: null };
    case "statusChanged":
      return {
        ...state,
        announcementKey: event.key,
        statusAnnouncement: event.text,
      };
    case "loadingNotified": {
      if (
        event.generation !== state.generation ||
        event.loading !== state.loading
      )
        return state;
      exec.stop(state.notice);
      return { ...state, notice: undefined };
    }
    case "visualReady": {
      if (
        event.generation !== state.generation ||
        state.mode !== "visual" ||
        !state.loading
      )
        return state;
      return {
        ...state,
        loading: false,
        notice: exec.replace(state.notice, {
          type: "notifyLoading",
          generation: state.generation,
          loading: false,
        }),
      };
    }
    case "visualStarting": {
      if (
        event.generation !== state.generation ||
        state.mode !== "visual" ||
        state.loading
      )
        return state;
      return {
        ...state,
        loading: true,
        notice: exec.replace(state.notice, {
          type: "notifyLoading",
          generation: state.generation,
          loading: true,
        }),
      };
    }
    case "visualFailed": {
      if (event.generation !== state.generation || state.mode !== "visual")
        return state;
      const generation = state.generation + 1;
      return {
        ...state,
        generation,
        mode: "source",
        fallback: true,
        loading: false,
        activeFormats: [],
        notice: exec.replace(state.notice, {
          type: "notifyLoading",
          generation,
          loading: false,
        }),
      };
    }
    case "modeSelected": {
      if (event.mode === state.mode) return state;
      const generation = state.generation + 1;
      const loading = event.mode === "visual";
      return {
        ...state,
        generation,
        mode: event.mode,
        loading,
        fallback: loading ? false : state.fallback,
        activeFormats: [],
        notice: exec.replace(state.notice, {
          type: "notifyLoading",
          generation,
          loading,
        }),
      };
    }
  }
};
