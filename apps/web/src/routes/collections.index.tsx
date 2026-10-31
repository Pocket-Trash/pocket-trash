import {
  createFileRoute,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import {
  getPublicCollectionOwners,
  listCatalogTerminologyAliases,
} from "@/lib/catalog-api";
import { parseCatalogFilterSearch } from "@/lib/catalog-filters";
import { loadDirectorySearch } from "@/lib/directory-search";
import { canCommitSearch } from "@/lib/search-navigation";
import { useCatalogFilters } from "@/lib/use-catalog-filters";
import { PublicCollectionsPage } from "@/pages/catalog-pages";

/**
 * Shows users who expose public collections.
 */
export const Route = createFileRoute("/collections/")({
  validateSearch: parseCatalogFilterSearch,
  pendingMs: Infinity,
  /**
   * Selects the query that keys ranked directory matches.
   * @param context - Validated route context.
   * @param context.search - Current normalized filters.
   * @returns Public directory query.
   */
  loaderDeps: ({ search }) => ({ q: parseCatalogFilterSearch(search).q ?? "" }),
  /**
   * Loads users who expose public collections.
   *
   * @param context - Router loader context.
   * @param context.deps - Normalized directory query.
   * @param context.abortController - Router cancellation lifetime.
   * @returns Public collection owners and ranked directory matches.
   * @rejects When public collection owners cannot be loaded.
   */
  loader: async ({ deps, abortController }) => {
    const [owners, aliases, directorySearch] = await Promise.all([
      getPublicCollectionOwners(),
      listCatalogTerminologyAliases(),
      loadDirectorySearch(deps.q, "collections", abortController.signal),
    ]);
    return { aliases, owners, directorySearch };
  },
  component: CollectionsRoute,
});

/**
 * Renders the collections route content.
 *
 * @returns The rendered route UI.
 */
function CollectionsRoute() {
  const navigate = useNavigate();
  const router = useRouter();
  const { location, isLoading: loading } = useRouterState();
  const data = Route.useLoaderData();
  const search = parseCatalogFilterSearch(location.search);
  const [filters, setFilters] = useCatalogFilters(search, (search) => {
    if (!canCommitSearch(router, Route.id)) return;
    void navigate({ replace: true, search, to: "/collections" });
  });
  return (
    <PublicCollectionsPage
      directorySearch={
        loading ? { items: [], status: "loading" } : data.directorySearch
      }
      filters={filters}
      onFiltersChange={setFilters}
      aliases={data.aliases}
      owners={data.owners}
      searchQuery={search.q ?? ""}
    />
  );
}
