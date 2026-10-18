import { faMagnifyingGlass } from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type {
  SearchCounts,
  SearchGroup,
  SearchKind,
  SearchResponse,
  SearchResult,
} from "@package/services";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import * as React from "react";
import { AppShell } from "@/components/app-shell";
import { Pagination } from "@/components/pagination";
import {
  SearchHighlights,
  SearchResultIcon,
  searchResultTypeKeys,
} from "@/components/search-result-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { searchPublic } from "@/lib/search";
import {
  SEARCH_QUERY_DELAY_MS,
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_QUERY_MIN_LENGTH,
} from "@/lib/search-constants";
import { useLocale } from "@/providers/locale-provider";

/** URL-backed state accepted by the public search page. */
export type SearchPageSearch = {
  /** One-based result page, omitted for the first page. */
  page?: number;
  /** Search query, omitted when empty. */
  q?: string;
  /** Result group, omitted for all results. */
  type?: Exclude<SearchGroup, "all">;
};

/** Navigation behavior for a search state transition. */
export type SearchNavigationOptions = {
  /** Replace the current browser history entry. */
  replace: boolean;
};

/** Properties for the public search page. */
type SearchPageProps = {
  /**
   * Applies a normalized search state to the URL.
   *
   * @param search - Next URL-backed search state.
   * @param options - Browser history behavior.
   */
  onNavigate(search: SearchPageSearch, options: SearchNavigationOptions): void;
  /** Current normalized URL-backed state. */
  search: SearchPageSearch;
};

/** Ordered search groups shown as tabs. */
const groups = [
  "all",
  "products",
  "collections",
  "makers",
  "people",
  "materials",
  "resources",
] as const satisfies SearchGroup[];

/** Representative result icons shown on filtered tabs. */
const groupIconKinds = {
  collections: "collection",
  makers: "maker",
  materials: "material",
  people: "person",
  products: "product",
  resources: "resource",
} as const satisfies Record<Exclude<SearchGroup, "all">, SearchKind>;

/** Empty counts shown before a query completes. */
const emptyCounts: SearchCounts = {
  all: 0,
  collections: 0,
  makers: 0,
  materials: 0,
  people: 0,
  products: 0,
  resources: 0,
};

/**
 * Renders the URL-backed public search page.
 *
 * @param props - Search page properties.
 * @returns The searchable, filterable result directory.
 */
export function SearchPage({ onNavigate, search }: SearchPageProps) {
  const { locale } = useLocale();
  const request = React.useRef(0);
  const [inputValue, setInputValue] = React.useState(search.q ?? "");
  const [response, setResponse] = React.useState<SearchResponse>();
  const [state, setState] = React.useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const group = search.type ?? "all";
  const page = search.page ?? 1;

  /** Formats search copy for the active locale. */
  const t = React.useCallback(
    (key: TranslationKey, values: Record<string, string | number> = {}) =>
      formatTranslation(key, values, locale),
    [locale],
  );

  React.useEffect(() => setInputValue(search.q ?? ""), [search.q]);

  React.useEffect(() => {
    const q = inputValue.trim();
    if (q === (search.q ?? "")) return;
    const timer = window.setTimeout(
      () =>
        onNavigate(
          {
            ...(q ? { q } : {}),
            ...(q && group !== "all" ? { type: group } : {}),
          },
          { replace: true },
        ),
      SEARCH_QUERY_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [group, inputValue, onNavigate, search.q]);

  React.useEffect(() => {
    const query = search.q?.trim() ?? "";
    const currentRequest = ++request.current;
    if (query.length < SEARCH_QUERY_MIN_LENGTH) {
      setResponse(undefined);
      setState("idle");
      return;
    }

    setResponse(undefined);
    setState("loading");
    void searchPublic({
      data: { group, page, query, surface: "page" },
    })
      .then((nextResponse) => {
        if (currentRequest !== request.current) return;
        const pageCount = Math.max(
          1,
          Math.ceil(nextResponse.total / nextResponse.pageSize),
        );
        if (page > pageCount) {
          onNavigate(
            {
              q: query,
              ...(group === "all" ? {} : { type: group }),
              ...(pageCount === 1 ? {} : { page: pageCount }),
            },
            { replace: true },
          );
          return;
        }
        setResponse(nextResponse);
        setState("ready");
      })
      .catch(() => {
        if (currentRequest !== request.current) return;
        setState("error");
      });
  }, [group, onNavigate, page, search.q]);

  /**
   * Submits the input as a new query and resets pagination.
   *
   * @param event - Search form submission.
   */
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const q = inputValue.trim();
    onNavigate(
      {
        ...(q ? { q } : {}),
        ...(q && group !== "all" ? { type: group } : {}),
      },
      { replace: true },
    );
  };

  const counts = response?.counts ?? emptyCounts;
  const pageCount = response
    ? Math.max(1, Math.ceil(response.total / response.pageSize))
    : 1;

  return (
    <AppShell
      meta={t("web.search.resultsCount", { count: response?.total ?? 0 })}
      title={t("web.search.title")}
    >
      <main className="grid gap-5 p-4 sm:p-6">
        <form className="flex gap-2" onSubmit={submit} role="search">
          <Input
            aria-label={t("web.search.label")}
            maxLength={SEARCH_QUERY_MAX_LENGTH}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder={t("web.search.placeholder")}
            value={inputValue}
          />
          <Button type="submit">
            <FontAwesomeIcon aria-hidden="true" icon={faMagnifyingGlass} />
            {t("web.search.title")}
          </Button>
        </form>

        <Tabs
          onValueChange={(value) => {
            const nextGroup = value as SearchGroup;
            onNavigate(
              {
                ...(search.q ? { q: search.q } : {}),
                ...(nextGroup === "all" ? {} : { type: nextGroup }),
              },
              { replace: false },
            );
          }}
          value={group}
        >
          <div className="overflow-x-auto pb-1">
            <TabsList aria-label={t("web.search.title")}>
              {groups.map((searchGroup) => (
                <TabsTrigger key={searchGroup} value={searchGroup}>
                  {searchGroup === "all" ? (
                    <FontAwesomeIcon
                      aria-hidden="true"
                      icon={faMagnifyingGlass}
                    />
                  ) : (
                    <SearchResultIcon kind={groupIconKinds[searchGroup]} />
                  )}
                  {t(`web.search.tabs.${searchGroup}` as TranslationKey)}{" "}
                  <span>{counts[searchGroup]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value={group}>
            {state === "idle" ? (
              (search.q?.length ?? 0) > 0 ? (
                <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                  {t("web.search.minimumLength")}
                </p>
              ) : null
            ) : state === "loading" ? (
              <SearchLoading label={t("web.search.loading")} />
            ) : state === "error" ? (
              <p
                className="rounded-lg border border-destructive/40 p-8 text-center text-destructive"
                role="alert"
              >
                {t("web.search.error")}
              </p>
            ) : response && response.items.length > 0 ? (
              <SearchResults items={response.items} t={t} />
            ) : (
              <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                {t("web.search.noResults")}
              </p>
            )}
          </TabsContent>
        </Tabs>

        {state === "ready" && response ? (
          <Pagination
            ariaLabel={t("web.search.title")}
            onPageChange={(nextPage) =>
              onNavigate(
                {
                  ...(search.q ? { q: search.q } : {}),
                  ...(group === "all" ? {} : { type: group }),
                  ...(nextPage === 1 ? {} : { page: nextPage }),
                },
                { replace: false },
              )
            }
            page={page}
            pageCount={pageCount}
          />
        ) : null}
      </main>
    </AppShell>
  );
}

/** Properties for the search loading state. */
type SearchLoadingProps = {
  /** Accessible loading label. */
  label: string;
};

/**
 * Renders placeholder rows while search is loading.
 *
 * @param props - Loading state properties.
 * @returns Four responsive skeleton rows.
 */
function SearchLoading({ label }: SearchLoadingProps) {
  return (
    <div aria-label={label} className="grid gap-3" role="status">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton className="h-28" key={index} />
      ))}
    </div>
  );
}

/** Properties for the editorial search result list. */
type SearchResultsProps = {
  /** Results on the current page. */
  items: SearchResult[];
  /**
   * Formats localized search copy.
   *
   * @param key - Search translation key.
   * @returns Localized search copy.
   */
  t(key: TranslationKey): string;
};

/**
 * Renders the editorial search result list.
 *
 * @param props - Search result list properties.
 * @returns Linked search result rows.
 */
function SearchResults({ items, t }: SearchResultsProps) {
  return (
    <ul className="grid gap-3">
      {items.map((result) => {
        return (
          <li key={`${result.kind}-${result.id}`}>
            <a
              className="group flex gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={result.href}
            >
              <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted sm:size-24">
                {result.imageUrl ? (
                  <img
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    src={result.imageUrl}
                  />
                ) : (
                  <SearchResultIcon
                    className="size-7 text-muted-foreground"
                    kind={result.kind}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Badge variant="secondary">
                  {t(
                    `web.search.types.${searchResultTypeKeys[result.kind]}` as TranslationKey,
                  )}
                </Badge>
                <h2 className="mt-2 truncate text-base font-semibold group-hover:text-primary">
                  {result.title}
                </h2>
                {result.context ? (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {result.context}
                  </p>
                ) : null}
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  <SearchHighlights highlights={result.highlights} />
                </p>
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
