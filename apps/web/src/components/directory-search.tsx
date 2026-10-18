import type { TranslationKey } from "@pocket-trash/localizations";
import * as React from "react";
import { Input } from "@/components/ui/input";
import type { DirectorySearchState } from "@/hooks/use-directory-search";
import { useCatalogCopy } from "@/lib/catalog-copy";
import {
  SEARCH_QUERY_DELAY_MS,
  SEARCH_QUERY_MAX_LENGTH,
} from "@/lib/search-constants";

/** Properties for one URL-backed public-directory search input. */
type DirectorySearchProps = {
  /**
   * Commits the debounced query to route search state.
   *
   * @param query - Normalized directory query.
   */
  onQueryChange(query: string): void;
  /** Localized input placeholder. */
  placeholderKey: TranslationKey;
  /** Current normalized route query. */
  query: string;
};

/**
 * Renders a public-directory input whose value settles into the URL.
 *
 * @param props - Directory search properties.
 * @returns Search input and minimum-length guidance.
 */
export function DirectorySearch({
  onQueryChange,
  placeholderKey,
  query,
}: DirectorySearchProps) {
  const t = useCatalogCopy();
  const [value, setValue] = React.useState(query);
  const normalizedValue = value.trim();
  const normalizedQuery = query.trim();

  React.useEffect(() => setValue(query), [query]);
  React.useEffect(() => {
    if (normalizedValue === normalizedQuery) return;
    const timeout = window.setTimeout(
      () => onQueryChange(normalizedValue),
      SEARCH_QUERY_DELAY_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [normalizedQuery, normalizedValue, onQueryChange]);

  return (
    <div className="grid gap-2">
      <Input
        aria-label={t("web.search.label")}
        maxLength={SEARCH_QUERY_MAX_LENGTH}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t(placeholderKey)}
        type="search"
        value={value}
      />
      {normalizedValue.length === 1 ? (
        <p className="m-0 text-sm text-muted-foreground">
          {t("web.search.minimumLength")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Renders transient public-directory search feedback.
 *
 * @param props - Search status properties.
 * @param props.query - Current URL-backed query.
 * @param props.status - Current public search request state.
 * @returns Localized guidance, loading, or failure copy.
 */
export function DirectorySearchStatus({
  query,
  status,
}: {
  /** Current URL-backed query. */
  query: string;
  /** Current public search request state. */
  status: DirectorySearchState["status"];
}) {
  const t = useCatalogCopy();
  const key =
    query.trim().length === 1
      ? "web.search.minimumLength"
      : status === "loading"
        ? "web.search.loading"
        : status === "error"
          ? "web.search.error"
          : null;
  return key ? (
    <p className="m-0 p-4 text-sm text-muted-foreground" role="status">
      {t(key)}
    </p>
  ) : null;
}
