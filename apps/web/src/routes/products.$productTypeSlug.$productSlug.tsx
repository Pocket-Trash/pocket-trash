import { createFileRoute, notFound } from "@tanstack/react-router";
import { slugPattern } from "@/lib/catalog";
import { getCatalogProductDetail } from "@/lib/catalog-api";
import { ProductDetailPage } from "@/pages/catalog-pages";

/**
 * Defines the `/products/$productTypeSlug/$productSlug` route and its data lifecycle.
 */
export const Route = createFileRoute("/products/$productTypeSlug/$productSlug")(
  {
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
     * Loads catalog product detail from its type and product slugs.
     *
     * @param context - Route callback context.
     * @param context.params - Parsed route parameters.
     * @returns The route's loader data.
     * @throws When the requested route data is unavailable or access is denied.
     * @rejects When the requested route data is unavailable or access is denied.
     */
    loader: async ({ params }) => {
      const detail = await getCatalogProductDetail({ data: params });
      if (!detail) throw notFound();
      return detail;
    },
    component: ProductRoute,
  },
);

/**
 * Renders the product route content.
 *
 * @returns The rendered route UI.
 */
function ProductRoute() {
  const { collectionItems, product } = Route.useLoaderData();
  return (
    <ProductDetailPage collectionItems={collectionItems} product={product} />
  );
}
