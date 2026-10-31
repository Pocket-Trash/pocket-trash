import {
  createFileRoute,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { listPublicMakers } from "@/lib/catalog-api";
import {
  loadDirectorySearch,
  parseDirectorySearch,
} from "@/lib/directory-search";
import { canCommitSearch } from "@/lib/search-navigation";
import { MakersDirectoryPage } from "@/pages/makers-directory-page";

/** Shows the public maker directory. */
export const Route = createFileRoute("/makers/")({
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
   * Loads public maker summaries and counts.
   *
   * @param context - Router loader context.
   * @param context.deps - Normalized directory query.
   * @param context.abortController - Router cancellation lifetime.
   * @returns Public maker entries and ranked matches.
   * @rejects When maker aggregation or image delivery fails.
   */
  loader: async ({ deps, abortController }) => {
    const [makers, directorySearch] = await Promise.all([
      listPublicMakers(),
      loadDirectorySearch(deps.q, "makers", abortController.signal),
    ]);
    return { makers, directorySearch };
  },
  component: MakersRoute,
});

/**
 * Renders the public maker directory route.
 *
 * @returns The maker directory page.
 */
function MakersRoute() {
  const navigate = useNavigate();
  const router = useRouter();
  const { location, isLoading: loading } = useRouterState();
  const { q = "" } = parseDirectorySearch(location.search);
  const data = Route.useLoaderData();
  return (
    <MakersDirectoryPage
      makers={data.makers}
      directorySearch={
        loading ? { items: [], status: "loading" } : data.directorySearch
      }
      onQueryChange={(query) => {
        if (!canCommitSearch(router, Route.id)) return;
        void navigate({
          replace: true,
          search: query ? { q: query } : {},
          to: "/makers",
        });
      }}
      query={q}
    />
  );
}
