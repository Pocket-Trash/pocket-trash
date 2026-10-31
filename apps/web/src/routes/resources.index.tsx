import { formatTranslation } from "@pocket-trash/localizations";
import {
  createFileRoute,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { loadDirectorySearch } from "@/lib/directory-search";
import { listResourceDirectory } from "@/lib/resources";
import { SEARCH_QUERY_MAX_LENGTH } from "@/lib/search-constants";
import { canCommitSearch } from "@/lib/search-navigation";
import {
  ResourceDirectoryStatusPage,
  ResourcesPage,
} from "@/pages/resources-page";

/**
 * Normalizes resource category and public query URL values.
 * @param search - Untrusted route search values.
 * @returns Deduplicated category slugs and normalized public query.
 */
export function parseResourceDirectorySearch(search: Record<string, unknown>): {
  /**
   * Optional resource-category slug filters.
   */
  category?: string[];
  /** Optional public resource query. */
  q?: string;
} {
  const value = search.category;
  const categories = (
    Array.isArray(value) ? value : value === undefined ? [] : [value]
  ).filter((category): category is string => typeof category === "string");

  const q =
    typeof search.q === "string"
      ? search.q.trim().slice(0, SEARCH_QUERY_MAX_LENGTH).trim()
      : "";
  return {
    ...(categories.length > 0 ? { category: [...new Set(categories)] } : {}),
    ...(q ? { q } : {}),
  };
}

/**
 * Shows the resource directory filtered by category.
 */
export const Route = createFileRoute("/resources/")({
  component: ResourceDirectoryRoute,
  pendingMs: Infinity,
  /**
   * Builds document metadata for the resources route.
   *
   * @returns Metadata emitted for the route.
   */
  head: () => ({
    meta: [{ title: formatTranslation("web.resources.directory.title") }],
  }),
  validateSearch: parseResourceDirectorySearch,
  /**
   * Selects normalized search state that invalidates the route loader.
   *
   * @param context - Route callback context.
   * @param context.search - Validated route search state.
   * @returns Normalized loader dependencies.
   */
  loaderDeps: ({ search }) => {
    const normalized = parseResourceDirectorySearch(search);
    return { category: normalized.category ?? [], q: normalized.q ?? "" };
  },
  /**
   * Loads the resource directory for the selected categories.
   *
   * @param context - Route callback context.
   * @param context.deps - Normalized query and category dependencies.
   * @param context.abortController - Router cancellation lifetime.
   * @returns The resource directory for the selected category slugs.
   * @rejects When the filtered resource directory cannot be loaded.
   */
  loader: async ({ deps, abortController }) => {
    const [directory, directorySearch] = await Promise.all([
      listResourceDirectory({ data: { categorySlugs: deps.category } }),
      loadDirectorySearch(deps.q, "resources", abortController.signal),
    ]);
    return { directory, directorySearch };
  },
  /**
   * Renders the resources route while its loader is pending.
   *
   * @returns The route loading UI.
   */
  pendingComponent: () => (
    <ResourceDirectoryStatusPage messageKey="web.resources.directory.loading" />
  ),
});

/**
 * Renders the resource directory route content.
 *
 * @returns The rendered route UI.
 */
function ResourceDirectoryRoute() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const { location, isLoading: loading } = useRouterState();
  const navigate = useNavigate();
  const { category = [], q = "" } = parseResourceDirectorySearch(
    location.search,
  );
  return (
    <ResourcesPage
      directory={data.directory}
      directorySearch={
        loading ? { items: [], status: "loading" } : data.directorySearch
      }
      onQueryChange={(query) => {
        if (!canCommitSearch(router, Route.id)) return;
        void navigate({
          replace: true,
          search: {
            ...(category.length ? { category } : {}),
            ...(query ? { q: query } : {}),
          },
          to: "/resources",
        });
      }}
      query={q}
      selectedCategorySlugs={category}
    />
  );
}
