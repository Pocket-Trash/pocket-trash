import {
  createFileRoute,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import {
  listCatalogProducts,
  listCatalogProductTypes,
  listCatalogTerminologyAliases,
} from "@/lib/catalog-api";
import { parseCatalogProductsSearch } from "@/lib/catalog-filters";
import { loadDirectorySearch } from "@/lib/directory-search";
import { canCommitSearch } from "@/lib/search-navigation";
import { useCatalogFilters } from "@/lib/use-catalog-filters";
import { ProductsPage } from "@/pages/catalog-pages";

/**
 * Shows the filterable catalog product directory.
 */
export const Route = createFileRoute("/products/")({
  validateSearch: parseCatalogProductsSearch,
  pendingMs: Infinity,
  /**
   * Selects the query that keys ranked directory matches.
   * @param context - Validated route context.
   * @param context.search - Current normalized filters.
   * @returns Public directory query.
   */
  loaderDeps: ({ search }) => ({
    q: parseCatalogProductsSearch(search).q ?? "",
  }),
  /**
   * Loads the catalog product directory.
   *
   * @param context - Router loader context.
   * @param context.deps - Normalized directory query.
   * @param context.abortController - Router cancellation lifetime.
   * @returns Catalog products and ranked directory matches.
   * @rejects When catalog products cannot be loaded.
   */
  loader: async ({ deps, abortController }) => {
    const [products, productTypes, aliases, directorySearch] =
      await Promise.all([
        listCatalogProducts(),
        listCatalogProductTypes(),
        listCatalogTerminologyAliases(),
        loadDirectorySearch(deps.q, "products", abortController.signal),
      ]);
    return { aliases, products, productTypes, directorySearch };
  },
  component: ProductsRoute,
});

/**
 * Renders the products route content.
 *
 * @returns The rendered route UI.
 */
function ProductsRoute() {
  const navigate = useNavigate();
  const router = useRouter();
  const { location, isLoading: loading } = useRouterState();
  const data = Route.useLoaderData();
  const { view, ...catalogSearch } = parseCatalogProductsSearch(
    location.search,
  );
  const [filters, setFilters] = useCatalogFilters(catalogSearch, (search) => {
    if (!canCommitSearch(router, Route.id)) return;
    void navigate({
      replace: true,
      search: { ...search, view: "all" },
      to: "/products",
    });
  });
  return (
    <ProductsPage
      directorySearch={
        loading ? { items: [], status: "loading" } : data.directorySearch
      }
      filters={filters}
      onFiltersChange={setFilters}
      aliases={data.aliases}
      productTypes={data.productTypes}
      products={data.products}
      searchQuery={catalogSearch.q ?? ""}
      view={view === "all" ? "products" : "directory"}
    />
  );
}
