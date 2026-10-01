import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getAuthState } from "@/lib/auth";
import { slugPattern } from "@/lib/catalog";
import { getCatalogOptions, getCatalogProduct } from "@/lib/catalog-api";
import { ProductFormPage } from "@/pages/catalog-form-pages";

/**
 * Provides authenticated editing for an authorized catalog product.
 */
export const Route = createFileRoute(
  "/products/$productTypeSlug/$productSlug_/edit",
)({
  params: {
    /**
     * Validates the editable product type and product slugs.
     *
     * @param params - Serialized route parameters.
     * @returns Route parameters containing the validated product type and product slugs.
     * @throws When either slug has an invalid format.
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
   * @rejects When authentication cannot be checked or an unauthenticated visitor is redirected to sign in.
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
   * @returns The editable product and catalog form options.
   * @rejects When the product is not editable or its form data cannot be loaded.
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
