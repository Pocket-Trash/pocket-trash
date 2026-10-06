import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { PaginatedCards } from "@/components/paginated-cards";
import {
  isCanonicalMakerSearch,
  parseMakerDetailSearch,
  withMakerPage,
} from "@/lib/maker-pagination";

/** Deterministic products spanning three mobile pages. */
const products = Array.from(
  { length: 17 },
  (_value, index) => `Product ${index + 1}`,
);

/** Root route for the local regression harness. */
const rootRoute = createRootRoute({ component: Outlet });
/** Maker route that mirrors production search and loader timing. */
const makerRoute = createRoute({
  /**
   * Resolves the parent route for the maker fixture.
   *
   * @returns The harness root route.
   */
  getParentRoute: () => rootRoute,
  path: "/makers/$slug",
  validateSearch: parseMakerDetailSearch,
  /**
   * Canonicalizes maker pagination search parameters before loading.
   *
   * @param context - Router pre-load context.
   * @param context.location - Current browser location.
   * @param context.params - Parsed maker parameters.
   * @param context.search - Parsed pagination search.
   * @returns No value when the search is canonical.
   * @throws A replacement redirect for noncanonical search.
   */
  beforeLoad: ({ location, params, search }) => {
    if (!isCanonicalMakerSearch(location.searchStr, search)) {
      throw redirect({
        params,
        replace: true,
        search,
        to: "/makers/$slug",
      });
    }
  },
  /**
   * Loads deterministic products after an asynchronous boundary.
   *
   * @returns Products used by the pagination regression.
   */
  loader: async () => {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 25);
    });
    return products;
  },
  component: MakerPaginationHarness,
});

/** Complete route tree for the local regression harness. */
const routeTree = rootRoute.addChildren([makerRoute]);
/** Browser router under test. */
const router = createRouter({ routeTree });

/**
 * Runs the production maker pagination component through a real browser router.
 *
 * @returns The deterministic, non-mutating regression fixture.
 */
function MakerPaginationHarness() {
  const search = makerRoute.useSearch();
  const { slug } = makerRoute.useParams();
  const loadedProducts = makerRoute.useLoaderData() as unknown as string[];
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
    return () => {
      delete document.documentElement.dataset.hydrated;
    };
  }, []);

  return (
    <main>
      <h1>Maker pagination regression</h1>
      <PaginatedCards
        ariaLabel="Maker products"
        items={loadedProducts}
        onPageChange={(page, options) => {
          void navigate({
            params: { slug },
            replace: options.replace,
            search: withMakerPage(search, "productsPage", page),
            to: "/makers/$slug",
          });
        }}
        page={(search.productsPage ?? 1) - 1}
        widePageSize={16}
      >
        {(items) => (
          <ul aria-label="Products">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </PaginatedCards>
    </main>
  );
}

/** DOM mount point for the local regression harness. */
const container = document.querySelector("#root");
if (!container) throw new Error("Missing local regression harness root.");

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
