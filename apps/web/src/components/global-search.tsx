import {
  faMagnifyingGlass as faMagnifyingGlassLight,
  faUserLock,
  faXmark,
} from "@fortawesome/pro-light-svg-icons";
import { faMagnifyingGlass } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { SearchResult } from "@package/services";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import React from "react";
import {
  type EffectEntity,
  type EffectReducer,
  useEffectReducer,
} from "use-effect-reducer";
import { useIsMobile } from "@/hooks/use-mobile";
import { searchPublic } from "@/lib/search";
import {
  SEARCH_QUERY_DELAY_MS,
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_QUERY_MIN_LENGTH,
} from "@/lib/search-constants";
import { cn } from "@/lib/utils";
import { useLocale } from "@/providers/locale-provider";
import {
  SearchHighlights,
  SearchResultIcon,
  searchResultTypeKeys,
} from "./search-result-icon";
import { Button } from "./ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "./ui/drawer";
import { Input } from "./ui/input";
import { Skeleton } from "./ui/skeleton";

/** Search visibility, result selection, and committed work lifetimes. */
type SearchState = {
  /** Whether the search surface is open. */
  isOpen: boolean;
  /** Current compact presentation. */
  mobile: boolean;
  /** Untrimmed search input. */
  query: string;
  /** Last accepted modal results. */
  results: SearchResult[];
  /** Active result index. */
  selected: number;
  /** Current request feedback. */
  status: "idle" | "loading" | "ready" | "error";
  /** Generation guarding late search responses. */
  generation: number;
  /** Current debounce or search request. */
  lookup: EffectEntity<SearchState, SearchEvent> | undefined;
  /** Generation guarding completed presentation work. */
  presentationId: number;
  /** Committed dialog and focus synchronization. */
  presentation: EffectEntity<SearchState, SearchEvent> | undefined;
};
/** User actions, viewport transitions, and terminal workflow events. */
type SearchEvent =
  | {
      /** Surface visibility transition. */
      type: "opened" | "closed";
    }
  | {
      /** Responsive presentation changed. */
      type: "viewportChanged";
      /** Current compact presentation. */
      mobile: boolean;
    }
  | {
      /** User edited the search input. */
      type: "queryChanged";
      /** New untrimmed query. */
      query: string;
    }
  | {
      /** User moved through search results. */
      type: "selectionMoved";
      /** Adjacent direction. */
      offset: number;
    }
  | {
      /** Search request completed. */
      type: "searchSettled";
      /** Request generation. */
      generation: number;
      /** Accepted result items, or null on failure. */
      results: SearchResult[] | null;
    }
  | {
      /** Dialog/focus synchronization finished. */
      type: "presentationFinished";
      /** Presentation generation. */
      presentationId: number;
    };
/** Disposable committed search and presentation operations. */
type SearchEffect =
  | {
      /** Debounced request implementation. */
      type: "search";
      /** Trimmed query sent to the public API. */
      query: string;
      /** Request generation. */
      generation: number;
    }
  | {
      /** Dialog/focus synchronization implementation. */
      type: "present";
      /** Whether to open or close the surface. */
      open: boolean;
      /** Presentation being opened or closed. */
      mobile: boolean;
      /** Presentation generation. */
      presentationId: number;
    };

/**
 * Owns search transitions and replaces or stops their committed work.
 * @param state - Current search and presentation lifetimes.
 * @param event - User, viewport, or terminal event.
 * @param exec - Committed effect queue.
 * @returns Search state after the semantic transition.
 */
const searchReducer: EffectReducer<SearchState, SearchEvent, SearchEffect> = (
  state,
  event,
  exec,
) => {
  if (event.type === "searchSettled") {
    if (!state.isOpen || event.generation !== state.generation) return state;
    exec.stop(state.lookup);
    return {
      ...state,
      lookup: undefined,
      results: event.results ?? [],
      selected: 0,
      status: event.results === null ? "error" : "ready",
    };
  }
  if (event.type === "presentationFinished") {
    if (event.presentationId !== state.presentationId) return state;
    exec.stop(state.presentation);
    return { ...state, presentation: undefined };
  }
  if (event.type === "selectionMoved") {
    if (state.status !== "ready" || !state.results.length) return state;
    return {
      ...state,
      selected: Math.max(
        0,
        Math.min(state.selected + event.offset, state.results.length - 1),
      ),
    };
  }
  if (event.type === "queryChanged") {
    if (!state.isOpen || event.query === state.query) return state;
    const query = event.query.trim();
    const generation = state.generation + 1;
    exec.stop(state.lookup);
    const searching = query.length >= SEARCH_QUERY_MIN_LENGTH;
    return {
      ...state,
      query: event.query,
      generation,
      results: [],
      selected: 0,
      status: searching ? "loading" : "idle",
      lookup: searching
        ? exec({ type: "search", query, generation })
        : undefined,
    };
  }
  if (event.type === "opened") {
    if (state.isOpen) return state;
    const presentationId = state.presentationId + 1;
    return {
      ...state,
      isOpen: true,
      presentationId,
      presentation: exec.replace(state.presentation, {
        type: "present",
        open: true,
        mobile: state.mobile,
        presentationId,
      }),
    };
  }
  if (event.type === "viewportChanged" && !state.isOpen)
    return { ...state, mobile: event.mobile };
  if (event.type === "closed" && !state.isOpen) return state;
  exec.stop(state.lookup);
  const presentationId = state.presentationId + 1;
  return {
    ...state,
    isOpen: false,
    mobile: event.type === "viewportChanged" ? event.mobile : state.mobile,
    query: "",
    results: [],
    selected: 0,
    status: "idle",
    generation: state.generation + 1,
    lookup: undefined,
    presentationId,
    presentation: exec.replace(state.presentation, {
      type: "present",
      open: false,
      mobile: state.mobile,
      presentationId,
    }),
  };
};

/**
 * Renders the persistent site-wide search trigger and compact search surface.
 *
 * @returns The search trigger and responsive modal.
 */
export function GlobalSearch() {
  const { locale } = useLocale();
  const isMobile = useIsMobile();
  const dialog = React.useRef<HTMLDialogElement>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const seeAll = React.useRef<HTMLAnchorElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const [search, dispatch] = useEffectReducer(
    searchReducer,
    (): SearchState => ({
      isOpen: false,
      mobile: isMobile,
      query: "",
      results: [],
      selected: 0,
      status: "idle",
      generation: 0,
      lookup: undefined,
      presentationId: 0,
      presentation: undefined,
    }),
    {
      /**
       * Debounces the public request and rejects responses from canceled lifetimes.
       * @param _state - State that queued the search.
       * @param effect - Query and request generation.
       * @param dispatch - Terminal workflow dispatcher.
       * @param context - Request cancellation lifetime.
       * @returns Debounce cleanup.
       */
      search: (_state, effect, dispatch, { signal }) => {
        /**
         * Delivers one accepted search result or failure.
         * @param results - Results, or null on failure.
         */
        const settle = (results: SearchResult[] | null) => {
          if (!signal.aborted)
            dispatch({
              type: "searchSettled",
              generation: effect.generation,
              results,
            });
        };
        const timer = window.setTimeout(() => {
          void searchPublic({
            data: { query: effect.query, surface: "modal" },
            signal,
          }).then(
            (response) => settle(response.items),
            () => settle(null),
          );
        }, SEARCH_QUERY_DELAY_MS);
        return () => window.clearTimeout(timer);
      },
      /**
       * Synchronizes the native dialog and focus only after a committed transition.
       * @param _state - State that queued the presentation.
       * @param effect - Requested presentation transition.
       * @param dispatch - Terminal workflow dispatcher.
       * @param context - Presentation cancellation lifetime.
       * @returns Animation-frame and focus-timer cleanup.
       */
      present: (_state, effect, dispatch, { signal }) => {
        let frame = 0;
        let timer = 0;
        /** Completes this presentation without replaying it on Activity resumption. */
        const finish = () => {
          if (!signal.aborted)
            dispatch({
              type: "presentationFinished",
              presentationId: effect.presentationId,
            });
        };
        if (effect.open) {
          if (!effect.mobile) {
            if (dialog.current && !dialog.current.open)
              dialog.current.showModal();
            frame = window.requestAnimationFrame(() => {
              if (!signal.aborted) input.current?.focus();
              finish();
            });
          } else finish();
        } else {
          if (dialog.current?.open) dialog.current.close();
          trigger.current?.focus();
          if (effect.mobile)
            timer = window.setTimeout(() => {
              if (!signal.aborted) trigger.current?.focus();
              finish();
            });
          else finish();
        }
        return () => {
          window.cancelAnimationFrame(frame);
          window.clearTimeout(timer);
        };
      },
    },
  );
  if (search.mobile !== isMobile)
    dispatch({ type: "viewportChanged", mobile: isMobile });
  const { isOpen, query, results, selected, status: state } = search;

  /** Formats search copy for the active locale. */
  const t = React.useCallback(
    (key: TranslationKey) => formatTranslation(key, {}, locale),
    [locale],
  );
  /** Opens the responsive search surface. */
  const open = () => {
    dispatch({ type: "opened" });
  };
  /** Closes the current surface, clears requests, and restores trigger focus. */
  const close = () => {
    dispatch({ type: "closed" });
  };

  const searchHref = query.trim()
    ? `/search?q=${encodeURIComponent(query.trim())}`
    : "/search";
  const activeResult = state === "ready" ? results[selected] : undefined;

  /**
   * Handles input-only result navigation and open shortcuts.
   *
   * @param event - Search input keyboard event.
   */
  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Tab" && event.shiftKey) {
      event.preventDefault();
      seeAll.current?.focus();
    } else if (
      state === "ready" &&
      event.key === "ArrowDown" &&
      results.length
    ) {
      event.preventDefault();
      dispatch({ type: "selectionMoved", offset: 1 });
    } else if (state === "ready" && event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      dispatch({ type: "selectionMoved", offset: -1 });
    } else if (
      event.key === "Enter" &&
      (/Mac|iPhone|iPad|iPod/u.test(navigator.platform)
        ? event.metaKey
        : event.ctrlKey)
    ) {
      event.preventDefault();
      seeAll.current?.click();
    } else if (event.key === "Enter" && activeResult) {
      event.preventDefault();
      document.getElementById(`global-search-result-${selected}`)?.click();
    }
  };

  /**
   * Wraps the final tab stop back to the search input.
   *
   * @param event - See-all link keyboard event.
   */
  const onSeeAllKeyDown = (event: React.KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      input.current?.focus();
    }
  };

  const panel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <FontAwesomeIcon
          aria-hidden="true"
          className="ml-1 size-4 text-muted-foreground"
          icon={faMagnifyingGlassLight}
        />
        <Input
          aria-activedescendant={
            activeResult ? `global-search-result-${selected}` : undefined
          }
          aria-autocomplete="list"
          aria-controls={
            state === "ready" && results.length > 0
              ? "global-search-results"
              : undefined
          }
          aria-expanded={state === "ready" && results.length > 0}
          aria-label={t("web.search.label")}
          className="border-0 shadow-none focus-visible:ring-[3px]"
          maxLength={SEARCH_QUERY_MAX_LENGTH}
          onChange={(event) =>
            dispatch({ type: "queryChanged", query: event.target.value })
          }
          onKeyDown={onInputKeyDown}
          placeholder={t("web.search.placeholder")}
          ref={input}
          role="combobox"
          value={query}
        />
        <Button
          aria-label={t("web.action.close")}
          onClick={close}
          size="icon"
          type="button"
          variant="ghost"
        >
          <FontAwesomeIcon aria-hidden="true" icon={faXmark} />
        </Button>
      </div>

      <div
        aria-busy={state === "loading"}
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto p-2"
      >
        {state === "loading" ? (
          <div
            aria-label={t("web.search.loading")}
            className="grid gap-2"
            role="status"
          >
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton className="h-14" key={index} />
            ))}
          </div>
        ) : state === "error" ? (
          <p className="p-4 text-sm text-destructive" role="alert">
            {t("web.search.error")}
          </p>
        ) : state === "ready" && results.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {t("web.search.noResults")}
          </p>
        ) : state === "ready" ? (
          <div id="global-search-results" role="listbox">
            {results.map((result, index) => {
              return (
                <a
                  aria-selected={index === selected}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 outline-none",
                    index === selected && "bg-accent",
                  )}
                  href={result.href}
                  id={`global-search-result-${index}`}
                  key={`${result.kind}-${result.id}`}
                  role="option"
                  tabIndex={-1}
                >
                  <SearchResultIcon
                    className="size-4 shrink-0 text-muted-foreground"
                    kind={result.kind}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
                      {t(
                        `web.search.types.${searchResultTypeKeys[result.kind]}` as TranslationKey,
                      )}
                    </span>
                    <span className="block truncate text-sm font-medium">
                      {result.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {result.ownerIsProfilePublic === false ? (
                        <>
                          <FontAwesomeIcon
                            aria-hidden="true"
                            icon={faUserLock}
                          />{" "}
                          {t("web.profiles.privateUser")} ·{" "}
                        </>
                      ) : null}
                      {result.context ? `${result.context} · ` : null}
                      <SearchHighlights highlights={result.highlights} />
                    </span>
                  </span>
                </a>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-3" aria-hidden="true">
          <span>↑↓ {t("web.search.modal.navigate")}</span>
          <span>↵ {t("web.search.modal.openResults")}</span>
        </span>
        <a
          className="font-medium text-foreground hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={searchHref}
          onKeyDown={onSeeAllKeyDown}
          ref={seeAll}
        >
          {t("web.search.modal.seeAllResults")}
        </a>
      </div>
    </div>
  );

  return (
    <>
      <Button
        aria-label={t("web.search.modal.openSearch")}
        onClick={open}
        ref={trigger}
        size="icon"
        type="button"
        variant="ghost"
      >
        <FontAwesomeIcon aria-hidden="true" icon={faMagnifyingGlass} />
      </Button>
      {isMobile ? (
        <Drawer
          onOpenChange={(nextOpen) => {
            dispatch({ type: nextOpen ? "opened" : "closed" });
          }}
          open={isOpen}
        >
          <DrawerContent
            className="h-[92svh] max-h-[92svh]"
            data-presentation="drawer"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              trigger.current?.focus();
            }}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              input.current?.focus();
            }}
          >
            <DrawerTitle className="sr-only">
              {t("web.search.label")}
            </DrawerTitle>
            {panel}
          </DrawerContent>
        </Drawer>
      ) : (
        <dialog
          aria-label={t("web.search.label")}
          className="m-auto max-h-[min(42rem,calc(100svh-2rem))] w-[min(42rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/55 backdrop:backdrop-blur-sm"
          data-presentation="dialog"
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onPointerUp={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          onKeyDownCapture={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
          onClose={close}
          ref={dialog}
        >
          {panel}
        </dialog>
      )}
    </>
  );
}
