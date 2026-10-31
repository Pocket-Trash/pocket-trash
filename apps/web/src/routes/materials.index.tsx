import {
  createFileRoute,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { listPublicMaterials } from "@/lib/catalog-api";
import {
  loadDirectorySearch,
  parseDirectorySearch,
} from "@/lib/directory-search";
import { canCommitSearch } from "@/lib/search-navigation";
import { MaterialsPage } from "@/pages/material-pages";

/** Shows the public A-Z materials directory. */
export const Route = createFileRoute("/materials/")({
  validateSearch: parseDirectorySearch,
  pendingMs: Infinity,
  /**
   * Selects the URL query that keys ranked directory results.
   * @param context - Validated search context.
   * @param context.search - Normalized directory search.
   * @returns Query used by the directory loader.
   */
  loaderDeps: ({ search }) => ({ q: parseDirectorySearch(search).q ?? "" }),
  /**
   * Loads every public material summary.
   *
   * @param context - Router loader context.
   * @param context.deps - Normalized directory query.
   * @param context.abortController - Router cancellation lifetime.
   * @returns Public material summaries and ranked matches.
   */
  loader: async ({ deps, abortController }) => {
    const [materials, directorySearch] = await Promise.all([
      listPublicMaterials(),
      loadDirectorySearch(deps.q, "materials", abortController.signal),
    ]);
    return { materials, directorySearch };
  },
  component: MaterialsRoute,
});

/**
 * Renders the public materials directory route.
 *
 * @returns The public materials directory route.
 */
function MaterialsRoute() {
  const navigate = useNavigate();
  const router = useRouter();
  const { location, isLoading: loading } = useRouterState();
  const { q = "" } = parseDirectorySearch(location.search);
  const data = Route.useLoaderData();
  return (
    <MaterialsPage
      materials={data.materials}
      directorySearch={
        loading ? { items: [], status: "loading" } : data.directorySearch
      }
      onQueryChange={(query) => {
        if (!canCommitSearch(router, Route.id)) return;
        void navigate({
          replace: true,
          search: query ? { q: query } : {},
          to: "/materials",
        });
      }}
      query={q}
    />
  );
}
