import {
  faAtomSimple,
  faBox,
  faBoxesStacked,
  faCube,
  faFileLines,
  faGem,
  faIndustry,
  faMagnifyingGlass as faMagnifyingGlassLight,
  faUser,
  faXmark,
} from "@fortawesome/pro-light-svg-icons";
import { faMagnifyingGlass } from "@fortawesome/pro-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { SearchKind, SearchResult } from "@package/services";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { searchPublic } from "@/lib/search";
import { cn } from "@/lib/utils";
import { useLocale } from "@/providers/locale-provider";
import { Button } from "./ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "./ui/drawer";
import { Input } from "./ui/input";
import { Skeleton } from "./ui/skeleton";

/** Search result icons keyed by public result kind. */
const resultIcons = {
  collection: faBoxesStacked,
  collection_item: faBox,
  maker: faIndustry,
  material: faGem,
  material_detail: faAtomSimple,
  person: faUser,
  product: faCube,
  resource: faFileLines,
} satisfies Record<SearchKind, typeof faCube>;

/** Localization suffixes keyed by public result kind. */
const resultTypeKeys = {
  collection: "collection",
  collection_item: "collectionItem",
  maker: "maker",
  material: "material",
  material_detail: "materialDetail",
  person: "person",
  product: "product",
  resource: "resource",
} as const satisfies Record<SearchKind, string>;

/** Delay before a modal query is sent. */
const SEARCH_DELAY_MS = 300;

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
  const request = React.useRef(0);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [selected, setSelected] = React.useState(0);
  const [state, setState] = React.useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  /** Formats search copy for the active locale. */
  const t = React.useCallback(
    (key: TranslationKey) => formatTranslation(key, {}, locale),
    [locale],
  );

  /** Opens the responsive search surface. */
  const open = React.useCallback(() => {
    if (isMobile) setMobileOpen(true);
    else {
      dialog.current?.showModal();
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [isMobile]);

  React.useEffect(() => {
    const currentDialog = dialog.current;
    if (!currentDialog) return;
    /**
     * Closes the modal when its native backdrop is clicked.
     *
     * @param event - Native dialog click event.
     */
    const onBackdropClick = (event: MouseEvent) => {
      if (event.target === currentDialog) currentDialog.close();
    };
    currentDialog.addEventListener("click", onBackdropClick);
    return () => currentDialog.removeEventListener("click", onBackdropClick);
  }, [isMobile]);

  /** Clears modal state and restores focus to the header trigger. */
  const finishClose = React.useCallback(() => {
    request.current += 1;
    setQuery("");
    setResults([]);
    setSelected(0);
    setState("idle");
    trigger.current?.focus();
  }, []);

  /** Closes the active search presentation. */
  const close = React.useCallback(() => {
    if (isMobile) {
      setMobileOpen(false);
      finishClose();
    } else dialog.current?.close();
  }, [finishClose, isMobile]);

  React.useEffect(() => {
    const trimmed = query.trim();
    const currentRequest = ++request.current;
    if (trimmed.length < 2) {
      setResults([]);
      setSelected(0);
      setState("idle");
      return;
    }

    setResults([]);
    setSelected(0);
    setState("loading");
    const timer = window.setTimeout(() => {
      void searchPublic({
        data: { query: trimmed, surface: "modal" },
      })
        .then((response) => {
          if (currentRequest !== request.current) return;
          setResults(response.items);
          setSelected(0);
          setState("ready");
        })
        .catch(() => {
          if (currentRequest !== request.current) return;
          setResults([]);
          setSelected(0);
          setState("error");
        });
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

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
      setSelected((value) => Math.min(value + 1, results.length - 1));
    } else if (state === "ready" && event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setSelected((value) => Math.max(value - 1, 0));
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
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder={t("web.search.placeholder")}
          ref={input}
          role="combobox"
          value={query}
        />
        <Button
          aria-label={formatTranslation("web.action.close", {}, locale)}
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
              let highlightOffset = 0;
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
                  <FontAwesomeIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                    icon={resultIcons[result.kind]}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
                      {t(
                        `web.search.types.${resultTypeKeys[result.kind]}` as TranslationKey,
                      )}
                    </span>
                    <span className="block truncate text-sm font-medium">
                      {result.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {result.context ? `${result.context} · ` : null}
                      {result.highlights.map((highlight) => {
                        const key = `${highlightOffset}-${highlight.matched}`;
                        highlightOffset += highlight.text.length;
                        return highlight.matched ? (
                          <strong
                            className="font-semibold text-foreground/80"
                            key={key}
                          >
                            {highlight.text}
                          </strong>
                        ) : (
                          <React.Fragment key={key}>
                            {highlight.text}
                          </React.Fragment>
                        );
                      })}
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
            setMobileOpen(nextOpen);
            if (!nextOpen) finishClose();
          }}
          open={mobileOpen}
        >
          <DrawerContent
            className="h-[92svh] max-h-[92svh]"
            data-presentation="drawer"
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
            dialog.current?.close();
          }}
          onClose={finishClose}
          ref={dialog}
        >
          {panel}
        </dialog>
      )}
    </>
  );
}
