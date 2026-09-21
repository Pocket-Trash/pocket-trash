import * as React from "react";
import {
  type CatalogFilterSearch,
  type CatalogFilters,
  filtersFromSearch,
  filtersToSearch,
} from "./catalog-filters";

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
