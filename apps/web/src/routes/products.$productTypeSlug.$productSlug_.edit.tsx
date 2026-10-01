import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { slugPattern } from "@/lib/catalog";
import { getCatalogOptions, getCatalogProduct } from "@/lib/catalog-api";
import { ProductFormPage } from "@/pages/catalog-form-pages";

/**
 * Defines the `/products/$productTypeSlug/$productSlug_/edit` route and its data lifecycle.
 */
export const Route = createFileRoute(
  "/products/$productTypeSlug/$productSlug_/edit",
)({
  params: {
    /**
     * Parses serialized route parameters into typed identifiers.
     *
     * @param params - Serialized route parameters.
     * @returns Typed route parameters.
     * @throws When the requested route data is unavailable or access is denied.
     */
    parse: (params) => {
      if (
        !slugPattern.test(params.productTypeSlug) ||
        !slugPattern.test(params.productSlug)
      ) {
        throw notFound();
      }
      return params;
    },
  },
  /**
   * Requires authentication before entering the product edit route.
   *
   * @throws When navigation must continue at another route.
   * @rejects When navigation must continue at another route.
   */
  beforeLoad: async () => {
    if (!(await getAuthState()).isAuthenticated) {
      throw redirect({ params: { _splat: "" }, to: "/sign-in/$" });
    }
  },
  /**
   * Loads an editable catalog product and its form options.
   *
   * @param context - Route callback context.
   * @param context.params - Parsed route parameters.
   * @returns The route's loader data.
   * @throws When the requested route data is unavailable or access is denied.
   * @rejects When the requested route data is unavailable or access is denied.
   */
  loader: async ({ params }) => {
    const [initialProduct, options] = await Promise.all([
      getCatalogProduct({ data: params }),
      getCatalogOptions(),
    ]);
    if (!initialProduct?.canEdit) throw notFound();
    return { initialProduct, options };
  },
  component: ProductEditRoute,
});

/**
 * Renders the product edit route content.
 *
 * @returns The rendered route UI.
 */
function ProductEditRoute() {
  const data = Route.useLoaderData();
  return <ProductFormPage {...data} />;
}
