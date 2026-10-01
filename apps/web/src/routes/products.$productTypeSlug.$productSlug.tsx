import { createFileRoute, notFound } from "@tanstack/react-router";
import { slugPattern } from "@/lib/catalog";
import { getCatalogProductDetail } from "@/lib/catalog-api";
import { ProductDetailPage } from "@/pages/catalog-pages";

/**
 * Shows one catalog product and its collection usage.
 */
export const Route = createFileRoute("/products/$productTypeSlug/$productSlug")(
  {
    params: {
      /**
       * Validates the product type and product slugs.
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
     * Loads catalog product detail from its type and product slugs.
     *
     * @param context - Route callback context.
     * @param context.params - Parsed route parameters.
     * @returns The catalog product and its collection items.
     * @rejects When the catalog product cannot be loaded.
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
