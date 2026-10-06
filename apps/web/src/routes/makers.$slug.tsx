import {
  createFileRoute,
  notFound,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { slugPattern } from "@/lib/catalog";
import { getPublicMakerDetail } from "@/lib/catalog-api";
import {
  isCanonicalMakerSearch,
  type MakerDetailSearch,
  parseMakerDetailSearch,
  withMakerPage,
} from "@/lib/maker-pagination";
import {
  MakerDetailPage,
  type MakerPageChangeOptions,
} from "@/pages/maker-detail-page";

/** Shows one public maker profile and its related catalog data. */
export const Route = createFileRoute("/makers/$slug")({
  params: {
    /**
     * Validates the stable maker slug.
     *
     * @param params - Serialized route parameters.
     * @returns The validated maker route parameters.
     * @throws When the slug is invalid.
     */
    parse: (params) => {
      if (!slugPattern.test(params.slug)) throw notFound();
      return params;
    },
  },
  /**
   * Normalizes independent product and collection-item page query values.
   *
   * @param search - Raw route query values.
   * @returns Normalized query state with first pages omitted.
   */
  validateSearch: parseMakerDetailSearch,
  /**
   * Replaces malformed or redundant page parameters with canonical search.
   *
   * @param context - Route pre-load context.
   * @param context.location - Current raw route location.
   * @param context.params - Validated maker parameters.
   * @param context.search - Normalized maker-detail search state.
   * @rejects With a replace redirect when the raw search is not canonical.
   */
  beforeLoad: async ({ location, params, search }) => {
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
   * Loads the requested public maker detail.
   *
   * @param context - Route loader context.
   * @param context.params - Validated maker parameters.
   * @returns The public maker profile and related catalog data.
   * @throws When the maker does not exist.
   * @rejects When maker detail loading fails.
   */
  loader: async ({ params }) => {
    const maker = await getPublicMakerDetail({ data: { slug: params.slug } });
    if (!maker) throw notFound();
    return maker;
  },
  component: MakerDetailRoute,
});

/**
 * Connects controlled maker pagination to URL search state.
 *
 * @returns The routed maker detail page.
 */
function MakerDetailRoute() {
  const maker = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  /**
   * Updates one page parameter while preserving its sibling parameter.
   *
   * @param key - Page parameter to update.
   * @param page - Zero-based destination page.
   * @param options - Navigation history behavior.
   */
  const updatePage = (
    key: keyof MakerDetailSearch,
    page: number,
    options: MakerPageChangeOptions,
  ) => {
    void navigate({
      params: { slug: maker.slug },
      replace: options.replace,
      search: withMakerPage(search, key, page),
      to: "/makers/$slug",
    });
  };
  return (
    <MakerDetailPage
      collectionItemsPage={(search.collectionItemsPage ?? 1) - 1}
      maker={maker}
      onCollectionItemsPageChange={(page, options) =>
        updatePage("collectionItemsPage", page, options)
      }
      onProductsPageChange={(page, options) =>
        updatePage("productsPage", page, options)
      }
      productsPage={(search.productsPage ?? 1) - 1}
    />
  );
}
