import * as React from "react";
import {
  type CatalogFilterSearch,
  type CatalogFilters,
  filtersFromSearch,
  filtersToSearch,
} from "./catalog-filters";

/**
 * Synchronizes catalog filters with URL search and debounces local commits by 300 milliseconds.
 *
 * @param search - Current URL-search values.
 * @param commit - Receives debounced URL-search updates.
 * @returns Current filters and their React state dispatcher.
 */
export function useCatalogFilters(
  search: CatalogFilterSearch,
  commit: (search: CatalogFilterSearch) => void,
): [CatalogFilters, React.Dispatch<React.SetStateAction<CatalogFilters>>] {
  const searchKey = JSON.stringify(search);
  const [filters, setFilters] = React.useState(() => filtersFromSearch(search));
  const filtersKey = JSON.stringify(filtersToSearch(filters));
  const commitRef = React.useRef(commit);
  commitRef.current = commit;

  React.useEffect(() => {
    setFilters(filtersFromSearch(search));
  }, [searchKey]);

  React.useEffect(() => {
    if (filtersKey === searchKey) return;
    const timeout = window.setTimeout(
      () => commitRef.current(filtersToSearch(filters)),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [filters, filtersKey, searchKey]);

  return [filters, setFilters];
}
